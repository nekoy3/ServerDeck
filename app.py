from flask import Flask, render_template, request, jsonify, session
from flask_socketio import SocketIO, emit
import yaml
import os
import paramiko
import threading
import time
from werkzeug.utils import secure_filename

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your_secret_key_here' # Replace with a strong secret key
socketio = SocketIO(app)

CONFIG_DIR = os.path.join(os.path.dirname(__file__), 'config')
SERVERS_CONFIG_PATH = os.path.join(CONFIG_DIR, 'servers.yaml')
SSH_KEYS_CONFIG_PATH = os.path.join(CONFIG_DIR, 'ssh_keys.yaml')

UPLOAD_FOLDER = os.path.join(CONFIG_DIR, 'uploaded_ssh_keys')
ALLOWED_EXTENSIONS = {'pem', 'key', 'id_rsa', 'id_dsa', 'id_ecdsa', 'id_ed25519', 'id_vm_machines'} # Common SSH key extensions and custom ones

# Ensure upload folder exists
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

active_ssh_sessions = {} # Store active SSH client sessions

def allowed_file(filename):
    # If there's no dot in the filename, it's considered a file without an extension
    # and is allowed if its base name is in ALLOWED_EXTENSIONS (e.g., 'id_rsa')
    if '.' not in filename:
        return filename.lower() in ALLOWED_EXTENSIONS
    
    # Otherwise, check the extension
    return filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def load_servers_config():
    if os.path.exists(SERVERS_CONFIG_PATH):
        with open(SERVERS_CONFIG_PATH, 'r') as f:
            return yaml.safe_load(f) or {"servers": []} # Ensure it returns a dict with 'servers' key
    return {"servers": []}

def save_servers_config(config_data):
    # Ensure config directory exists
    os.makedirs(CONFIG_DIR, exist_ok=True)
    with open(SERVERS_CONFIG_PATH, 'w') as f:
        yaml.dump(config_data, f, indent=2, sort_keys=False) # Preserve order

def load_ssh_keys_config():
    if os.path.exists(SSH_KEYS_CONFIG_PATH):
        with open(SSH_KEYS_CONFIG_PATH, 'r') as f:
            return yaml.safe_load(f) or {"ssh_keys": []}
    return {"ssh_keys": []}

def save_ssh_keys_config(config_data):
    os.makedirs(CONFIG_DIR, exist_ok=True)
    with open(SSH_KEYS_CONFIG_PATH, 'w') as f:
        yaml.dump(config_data, f, indent=2, sort_keys=False)

@app.route('/')
def index():
    config = load_servers_config()
    servers = config.get('servers', [])
    return render_template('index.html', servers=servers)

@app.route('/config')
def config_page():
    # This route now serves the content for the modal
    return render_template('config_modal_content.html')

@app.route('/ssh/<server_id>')
def ssh_terminal(server_id):
    # You might want to load server details here and pass them to the template
    return render_template('ssh_terminal.html', server_id=server_id)

# API Endpoints for servers
@app.route('/api/servers', methods=['GET'])
def get_servers():
    config = load_servers_config()
    return jsonify(config.get('servers', []))

@app.route('/api/servers', methods=['POST'])
def add_server():
    new_server = request.json
    if not new_server or 'id' not in new_server or 'name' not in new_server or 'type' not in new_server:
        return jsonify({"error": "Missing required fields (id, name, type)"}), 400

    config = load_servers_config()
    servers = config.get('servers', [])

    # Check for duplicate ID
    if any(s['id'] == new_server['id'] for s in servers):
        return jsonify({"error": f"Server with ID '{new_server['id']}' already exists"}), 409

    servers.append(new_server)
    save_servers_config(config)
    return jsonify(new_server), 201

# Placeholder for PUT and DELETE
@app.route('/api/servers/<server_id>', methods=['PUT'])
def update_server(server_id):
    updated_data = request.json
    config = load_servers_config()
    servers = config.get('servers', [])
    found = False
    for i, server in enumerate(servers):
        if server['id'] == server_id:
            servers[i] = {**server, **updated_data} # Merge existing with updated data
            found = True
            break
    if not found:
        return jsonify({"error": "Server not found"}), 404
    save_servers_config(config)
    return jsonify(servers[i])

@app.route('/api/servers/<server_id>', methods=['DELETE'])
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

# API Endpoints for SSH Keys
@app.route('/api/ssh_keys', methods=['GET'])
def get_ssh_keys():
    config = load_ssh_keys_config()
    return jsonify(config.get('ssh_keys', []))

@app.route('/api/ssh_keys', methods=['POST'])
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
def upload_ssh_key_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        file.save(filepath)
        # Set appropriate permissions for the private key
        os.chmod(filepath, 0o600) # Read/write for owner only
        return jsonify({'path': filepath}), 200
    return jsonify({'error': 'File type not allowed'}), 400

def _ssh_read_loop(chan, sid):
    while True:
        if chan.recv_ready():
            output = chan.recv(4096).decode('utf-8', errors='ignore')
            socketio.emit('ssh_output', {'output': output}, room=sid)
        time.sleep(0.01) # Small delay to prevent busy-waiting

@socketio.on('start_ssh')
def handle_start_ssh(data):
    server_id = data.get('server_id')
    sid = request.sid
    print(f"Attempting to start SSH for server_id: {server_id} (SID: {sid})")

    config = load_servers_config()
    server_info = next((s for s in config.get('servers', []) if s['id'] == server_id), None)

    if not server_info:
        emit('ssh_output', {'output': f"Error: Server '{server_id}' not found in configuration.\r\n"})
        return

    if server_info.get('type') != 'ssh':
        emit('ssh_output', {'output': f"Error: Server '{server_id}' is not an SSH type server.\r\n"})
        return

    try:
        client = paramiko.SSHClient()
        client.load_system_host_keys()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

        hostname = server_info.get('host')
        port = server_info.get('port', 22)
        username = server_info.get('username')
        password = server_info.get('password')
        ssh_key_id = server_info.get('ssh_key_id') # Use ssh_key_id instead of ssh_key_path directly

        if ssh_key_id:
            ssh_keys_config = load_ssh_keys_config()
            ssh_key_info = next((k for k in ssh_keys_config.get('ssh_keys', []) if k['id'] == ssh_key_id), None)
            if ssh_key_info and os.path.exists(os.path.expanduser(ssh_key_info['path'])):
                key = paramiko.RSAKey.from_private_key_file(os.path.expanduser(ssh_key_info['path']))
                client.connect(hostname=hostname, port=port, username=username, pkey=key, timeout=10)
                print(f"SSH connected to {hostname} using key: {ssh_key_info['name']}")
            else:
                emit('ssh_output', {'output': f"Error: SSH Key '{ssh_key_id}' not found or path invalid.\r\n"})
                client.close()
                return
        elif password:
            client.connect(hostname=hostname, port=port, username=username, password=password, timeout=10)
            print(f"SSH connected to {hostname} using password.")
        else:
            emit('ssh_output', {'output': "Error: No valid authentication method (password or SSH key) provided.\r\n"})
            client.close()
            return

        chan = client.invoke_shell()
        chan.settimeout(0.0) # Non-blocking

        active_ssh_sessions[sid] = {'client': client, 'channel': chan}
        emit('ssh_output', {'output': f"Successfully connected to {hostname}.\r\n"})

        # Start a separate thread to read SSH output
        threading.Thread(target=_ssh_read_loop, args=(chan, sid), daemon=True).start()

    except paramiko.AuthenticationException:
        emit('ssh_output', {'output': "Authentication failed. Please check your credentials.\r\n"})
    except paramiko.SSHException as e:
        emit('ssh_output', {'output': f"SSH error: {e}\r\n"})
    except Exception as e:
        emit('ssh_output', {'output': f"Connection error: {e}\r\n"})

@socketio.on('ssh_input')
def handle_ssh_input(data):
    sid = request.sid
    if sid in active_ssh_sessions:
        chan = active_ssh_sessions[sid]['channel']
        chan.send(data['input'])

@socketio.on('resize_terminal')
def handle_resize_terminal(data):
    sid = request.sid
    if sid in active_ssh_sessions:
        chan = active_ssh_sessions[sid]['channel']
        cols = data.get('cols', 80)
        rows = data.get('rows', 24)
        chan.resize_pty(cols, rows)

@socketio.on('disconnect')
def handle_disconnect():
    sid = request.sid
    print(f"Client disconnected (SID: {sid})")
    if sid in active_ssh_sessions:
        client = active_ssh_sessions[sid]['client']
        client.close()
        del active_ssh_sessions[sid]
        print(f"SSH session closed for SID: {sid}")

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', debug=True, allow_unsafe_werkzeug=True, port=5001)