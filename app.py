import sys
import logging
from flask import Flask, render_template, request, jsonify, session, redirect, url_for, flash
from flask_socketio import SocketIO, emit
import yaml
import os
import paramiko
import threading
import time
from werkzeug.utils import secure_filename
from werkzeug.security import check_password_hash
from functools import wraps

app = Flask(__name__)
# IMPORTANT: In a production environment, use a strong, randomly generated secret key
# and load it from an environment variable or a secure configuration file.
app.config['SECRET_KEY'] = os.urandom(24)
socketio = SocketIO(app)

# --- Logging Configuration ---
app.logger.setLevel(logging.DEBUG)
handler = logging.StreamHandler(sys.stdout)
formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
handler.setFormatter(formatter)
app.logger.addHandler(handler)
paramiko_logger = logging.getLogger("paramiko")
paramiko_logger.setLevel(logging.DEBUG)
paramiko_logger.addHandler(handler)


# --- Paths and Folders ---
CONFIG_DIR = os.path.join(os.path.dirname(__file__), 'config')
SERVERS_CONFIG_PATH = os.path.join(CONFIG_DIR, 'servers.yaml')
SSH_KEYS_CONFIG_PATH = os.path.join(CONFIG_DIR, 'ssh_keys.yaml')
USERS_CONFIG_PATH = os.path.join(CONFIG_DIR, 'users.yaml')
UPLOAD_FOLDER = os.path.join(CONFIG_DIR, 'uploaded_ssh_keys')
os.makedirs(UPLOAD_FOLDER, exist_ok=True);

active_ssh_sessions = {}

# --- Config Loading/Saving ---
def load_servers_config():
    if os.path.exists(SERVERS_CONFIG_PATH):
        with open(SERVERS_CONFIG_PATH, 'r') as f:
            return yaml.safe_load(f) or {"servers": []}
    return {"servers": []}

def save_servers_config(config_data):
    os.makedirs(CONFIG_DIR, exist_ok=True);
    with open(SERVERS_CONFIG_PATH, 'w') as f:
        yaml.dump(config_data, f, indent=2, sort_keys=False)

def load_ssh_keys_config():
    if os.path.exists(SSH_KEYS_CONFIG_PATH):
        with open(SSH_KEYS_CONFIG_PATH, 'r') as f:
            return yaml.safe_load(f) or {"ssh_keys": []}
    return {"ssh_keys": []}

def save_ssh_keys_config(config_data):
    os.makedirs(CONFIG_DIR, exist_ok=True);
    with open(SSH_KEYS_CONFIG_PATH, 'w') as f:
        yaml.dump(config_data, f, indent=2, sort_keys=False)

def load_users_config():
    if os.path.exists(USERS_CONFIG_PATH):
        with open(USERS_CONFIG_PATH, 'r') as f:
            return yaml.safe_load(f) or {"users": []}
    return {"users": []}

# --- Authentication ---
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'username' not in session:
            return redirect(url_for('login', next=request.url))
        return f(*args, **kwargs)
    return decorated_function

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        
        users_config = load_users_config()
        user = next((u for u in users_config.get('users', []) if u['username'] == username), None)
        
        if user and check_password_hash(user['password_hash'], password):
            session['username'] = user['username']
            flash('Logged in successfully.', 'success')
            next_page = request.args.get('next')
            return redirect(next_page or url_for('index'))
        else:
            flash('Invalid username or password.', 'danger')
            
    return render_template('login.html')

@app.route('/logout')
def logout():
    session.clear()
    flash('You have been logged out.', 'info')
    return redirect(url_for('login'))


# --- Protected Routes ---

@app.route('/')
@login_required
def index():
    config = load_servers_config()
    servers = config.get('servers', [])
    return render_template('index.html', servers=servers)

@app.route('/config')
@login_required
def config_page():
    return render_template('config_modal_content.html')

@app.route('/ssh/<server_id>')
@login_required
def ssh_terminal(server_id):
    return render_template('ssh_terminal.html', server_id=server_id)

# --- Protected API Endpoints ---
@app.route('/api/servers', methods=['GET'])
@login_required
def get_servers():
    config = load_servers_config()
    return jsonify(config.get('servers', []))

@app.route('/api/servers', methods=['POST'])
@login_required
def add_server():
    new_server = request.json
    if not new_server or 'id' not in new_server or 'name' not in new_server or 'type' not in new_server:
        return jsonify({"error": "Missing required fields (id, name, type)"}), 400
    config = load_servers_config()
    servers = config.get('servers', [])
    if any(s['id'] == new_server['id'] for s in servers):
        return jsonify({"error": f"Server with ID '{new_server['id']}' already exists"}), 409
    servers.append(new_server)
    save_servers_config(config)
    return jsonify(new_server), 201

@app.route('/api/servers/<server_id>', methods=['PUT'])
@login_required
def update_server(server_id):
    updated_data = request.json
    config = load_servers_config()
    servers = config.get('servers', [])
    found = False
    for i, server in enumerate(servers):
        if server['id'] == server_id:
            servers[i] = {**server, **updated_data}
            found = True
            break
    if not found:
        return jsonify({"error": "Server not found"}), 404
    save_servers_config(config)
    return jsonify(servers[i])

@app.route('/api/servers/<server_id>', methods=['DELETE'])
@login_required
def delete_server(server_id):
    config = load_servers_config()
    servers = config.get('servers', [])
    original_len = len(servers)
    servers = [s for s in servers if s['id'] != server_id]
    if len(servers) == original_len:
        return jsonify({"error": "Server not found"}), 404
    config['servers'] = servers
    save_servers_config(config)
    return jsonify({"message": "Server deleted"}), 204

@app.route('/api/ssh_keys', methods=['GET'])
@login_required
def get_ssh_keys():
    config = load_ssh_keys_config()
    return jsonify(config.get('ssh_keys', []))

@app.route('/api/ssh_keys', methods=['POST'])
@login_required
def add_ssh_key():
    new_key = request.json
    if not new_key or 'id' not in new_key or 'name' not in new_key or 'path' not in new_key:
        return jsonify({"error": "Missing required fields (id, name, path)"}), 400
    config = load_ssh_keys_config()
    ssh_keys = config.get('ssh_keys', [])
    if any(k['id'] == new_key['id'] for k in ssh_keys):
        return jsonify({"error": f"SSH Key with ID '{new_key['id']}' already exists"}), 409
    ssh_keys.append(new_key)
    save_ssh_keys_config(config)
    return jsonify(new_key), 201

@app.route('/api/ssh_keys/<key_id>', methods=['PUT'])
@login_required
def update_ssh_key(key_id):
    updated_data = request.json
    config = load_ssh_keys_config()
    ssh_keys = config.get('ssh_keys', [])
    found = False
    for i, key in enumerate(ssh_keys):
        if key['id'] == key_id:
            ssh_keys[i] = {**key, **updated_data}
            found = True
            break
    if not found:
        return jsonify({"error": "SSH Key not found"}), 404
    save_ssh_keys_config(config)
    return jsonify(ssh_keys[i])

@app.route('/api/ssh_keys/<key_id>', methods=['DELETE'])
@login_required
def delete_ssh_key(key_id):
    config = load_ssh_keys_config()
    ssh_keys = config.get('ssh_keys', [])
    original_len = len(ssh_keys)
    ssh_keys = [k for k in ssh_keys if k['id'] != key_id]
    if len(ssh_keys) == original_len:
        return jsonify({"error": "SSH Key not found"}), 404
    config['ssh_keys'] = ssh_keys
    save_ssh_keys_config(config)
    return jsonify({"message": "SSH Key deleted"}), 204

@app.route('/api/ssh_keys/upload', methods=['POST'])
@login_required
def upload_ssh_key_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    filename = secure_filename(file.filename)
    filepath = os.path.join(UPLOAD_FOLDER, filename)
    file.save(filepath)
    os.chmod(filepath, 0o600);
    try:
        paramiko.RSAKey.from_private_key_file(filepath)
        return jsonify({'path': filepath}), 200
    except paramiko.PasswordRequiredException:
        os.remove(filepath);
        return jsonify({'error': 'SSH key requires a passphrase. Passphrase input is not yet supported.'}), 400
    except paramiko.SSHException as e:
        app.logger.error(f"SSHException (RSA check): {e}");
        try:
            app.logger.debug("Attempting to load as EdDSA key...");
            paramiko.EdDSAKey(filename=filepath);
            return jsonify({'path': filepath}), 200
        except AttributeError:
            app.logger.debug("paramiko.EdDSAKey not found, attempting to load as Ed25519Key.");
            paramiko.Ed25519Key(filename=filepath);
            return jsonify({'path': filepath}), 200
        except paramiko.PasswordRequiredException:
            os.remove(filepath);
            return jsonify({'error': 'SSH key requires a passphrase. Passphrase input is not yet supported.'}), 400
        except paramiko.SSHException as eddsa_e:
            os.remove(filepath);
            return jsonify({'error': f'Invalid SSH key format or content: {e} (RSA) / {eddsa_e} (EdDSA)'}), 400
        except Exception as other_e:
            app.logger.error(f"General Exception (EdDSA check): {other_e}");
            os.remove(filepath);
            return jsonify({'error': f'Failed to process SSH key (EdDSA check): {other_e}'}), 400
    except Exception as e:
        app.logger.error(f"General Exception (overall): {e}");
        os.remove(filepath);
        return jsonify({'error': f'Failed to process SSH key: {e}'}), 400

# --- Protected Socket.IO Events ---
def _is_authenticated():
    return 'username' in session

@socketio.on('connect')
def handle_connect():
    if not _is_authenticated():
        app.logger.warning(f"Unauthenticated socket connection attempt rejected from SID: {request.sid}");
        return False
    app.logger.debug(f"Authenticated client connected! SID: {request.sid}, User: {session.get('username')}");

def _ssh_read_loop(chan, sid):
    while True:
        if chan.recv_ready():
            output = chan.recv(4096).decode('utf-8', errors='ignore');
            socketio.emit('ssh_output', {'output': output}, room=sid);
        time.sleep(0.01);

@socketio.on('start_ssh')
def handle_start_ssh(data):
    if not _is_authenticated():
        emit('ssh_output', {'output': 'Authentication required.\r\n'});
        return
    app.logger.debug(f"Received start_ssh event. Data: {data}, SID: {request.sid}");
    server_id = data.get('server_id');
    sid = request.sid;
    app.logger.debug(f"Attempting to start SSH for server_id: {server_id} (SID: {sid})");
    config = load_servers_config();
    server_info = next((s for s in config.get('servers', []) if s['id'] == server_id), None);
    if not server_info:
        app.logger.debug(f"Server '{server_id}' not found.");
        emit('ssh_output', {'output': f"Error: Server '{server_id}' not found in configuration.\r\n"});
        return
    if server_info.get('type') != 'ssh':
        app.logger.debug(f"Server '{server_id}' is not an SSH type server.");
        emit('ssh_output', {'output': f"Error: Server '{server_id}' is not an SSH type server.\r\n"});
        return
    try:
        client = paramiko.SSHClient();
        client.load_system_host_keys();
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy());
        hostname = server_info.get('host');
        port = server_info.get('port', 22);
        username = server_info.get('username');
        password = server_info.get('password');
        ssh_key_id = server_info.get('ssh_key_id');
        if ssh_key_id:
            ssh_keys_config = load_ssh_keys_config();
            ssh_key_info = next((k for k in ssh_keys_config.get('ssh_keys', []) if k['id'] == ssh_key_id), None);
            app.logger.debug(f"Attempting to load key '{ssh_key_id}' with info: {ssh_key_info}");
            if ssh_key_info and os.path.exists(os.path.expanduser(ssh_key_info['path'])):
                try:
                    key_path_expanded = os.path.expanduser(ssh_key_info['path']);
                    app.logger.debug(f"Expanded key path: {key_path_expanded}");
                    try:
                        key = paramiko.RSAKey.from_private_key_file(key_path_expanded);
                    except paramiko.SSHException as e:
                        app.logger.debug(f"RSAKey load failed: {e}. Attempting Ed25519Key.");
                        try:
                            key = paramiko.Ed25519Key(filename=key_path_expanded);
                        except Exception as ed25519_e:
                            app.logger.debug(f"Ed25519Key load failed: {ed25519_e}.");
                            emit('ssh_output', {'output': f"Error loading SSH Key '{ssh_key_info['name']}': {e} (RSA) / {ed25519_e} (Ed25519)\r\n"});
                            client.close();
                            return
                    client.connect(
                        hostname=hostname,
                        port=port,
                        username=username,
                        pkey=key,
                        timeout=10,
                        look_for_keys=False,
                        allow_agent=False
                    );
                    app.logger.debug(f"SSH connected to {hostname} using key: {ssh_key_info['name']}");
                except paramiko.PasswordRequiredException:
                    app.logger.debug(f"Key '{ssh_key_info['name']}' requires passphrase.");
                    emit('ssh_output', {'output': f"Error: SSH Key '{ssh_key_info['name']}' requires a passphrase.\r\n"});
                    client.close();
                    return
                except Exception as e:
                    app.logger.debug(f"Error loading SSH Key '{ssh_key_info['name']}': {e}");
                    emit('ssh_output', {'output': f"Error loading SSH Key '{ssh_key_info['name']}': {e}\r\n"});
                    client.close();
                    return
            else:
                app.logger.debug(f"SSH Key '{ssh_key_id}' not found or path invalid (info: {ssh_key_info}).");
                emit('ssh_output', {'output': f"Error: SSH Key '{ssh_key_id}' not found or path invalid.\r\n"});
                client.close();
                return
        elif password:
            app.logger.debug(f"Attempting password authentication for {hostname}");
            client.connect(hostname=hostname, port=port, username=username, password=password, timeout=10);
            app.logger.debug(f"SSH connected to {hostname} using password.");
        else:
            app.logger.debug(f"No valid authentication method provided.");
            emit('ssh_output', {'output': "Error: No valid authentication method (password or SSH key) provided.\r\n"});
            client.close();
            return
        chan = client.invoke_shell();
        chan.settimeout(0.0);
        active_ssh_sessions[sid] = {'client': client, 'channel': chan};
        emit('ssh_output', {'output': f"Successfully connected to {hostname}.\r\n"});
        threading.Thread(target=_ssh_read_loop, args=(chan, sid), daemon=True).start();
    except paramiko.AuthenticationException:
        app.logger.debug(f"Authentication failed for {hostname}.");
        emit('ssh_output', {'output': "Authentication failed. Please check your credentials.\r\n"});
    except paramiko.SSHException as e:
        app.logger.debug(f"SSH error for {hostname}: {e}");
        emit('ssh_output', {'output': f"SSH error: {e}\r\n"});
    except Exception as e:
        app.logger.debug(f"General connection error for {hostname}: {e}");
        emit('ssh_output', {'output': f"Connection error: {e}\r\n"});

@socketio.on('ssh_input')
def handle_ssh_input(data):
    if not _is_authenticated():
        return
    sid = request.sid;
    if sid in active_ssh_sessions:
        chan = active_ssh_sessions[sid]['channel'];
        chan.send(data['input']);

@socketio.on('resize_terminal')
def handle_resize_terminal(data):
    if not _is_authenticated():
        return
    sid = request.sid;
    if sid in active_ssh_sessions:
        chan = active_ssh_sessions[sid]['channel'];
        cols = data.get('cols', 80);
        rows = data.get('rows', 24);
        chan.resize_pty(cols, rows);

@socketio.on('disconnect')
def handle_disconnect():
    sid = request.sid;
    app.logger.debug(f"Client disconnected (SID: {sid})");
    if sid in active_ssh_sessions:
        client = active_ssh_sessions[sid]['client'];
        client.close();
        del active_ssh_sessions[sid];
        app.logger.debug(f"SSH session closed for SID: {sid}");

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', debug=True, allow_unsafe_werkzeug=True, port=5001);
