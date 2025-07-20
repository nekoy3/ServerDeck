import re
import sys
import logging
from flask import Flask, render_template, request, jsonify, session, redirect, url_for, flash, send_from_directory, make_response
from flask_socketio import SocketIO, emit
from flask_session import Session
import yaml
import os
import paramiko
import threading
import time
import subprocess
from werkzeug.utils import secure_filename
from werkzeug.security import check_password_hash
from functools import wraps
from datetime import datetime, timedelta
import shutil
import requests
import random

app = Flask(__name__)
app.config['SECRET_KEY'] = os.urandom(24)

app.config["SESSION_TYPE"] = "filesystem"
app.config["SESSION_FILE_DIR"] = os.path.join(os.path.dirname(__file__), 'config', 'flask_session')
app.config["PERMANENT_SESSION_LIFETIME"] = timedelta(hours=1)
Session(app)

socketio = SocketIO(app)

# --- Ping Utility ---
def ping_host(host, count=1, timeout=1):
    param = '-n' if sys.platform.startswith('win') else '-c'
    command = ['ping', param, str(count), '-W' if sys.platform != 'win32' else '-w', str(timeout * 1000 if sys.platform.startswith('win') else timeout), host]
    
    result_data = {'status': 'unknown', 'response_time': None, 'packet_loss': None}

    try:
        process = subprocess.run(command, capture_output=True, text=True, timeout=timeout + 1)
        output = process.stdout + process.stderr

        if process.returncode == 0:
            result_data['status'] = 'online'
        else:
            result_data['status'] = 'offline'

        packet_loss_match = re.search(r'(\d+)% packet loss', output)
        if packet_loss_match:
            result_data['packet_loss'] = float(packet_loss_match.group(1))

        if sys.platform.startswith('win'):
            avg_time_match = re.search(r'Average = (\d+)ms', output)
            if avg_time_match:
                result_data['response_time'] = float(avg_time_match.group(1))
        else:
            avg_time_match = re.search(r'rtt min/avg/max/mdev = [^/]+/([\d.]+)', output)
            if avg_time_match:
                result_data['response_time'] = float(avg_time_match.group(1))

        if result_data['status'] == 'online' and result_data['response_time'] is None:
            result_data['response_time'] = 0.0

    except subprocess.TimeoutExpired:
        app.logger.debug(f"Ping timed out for {host}")
        result_data['status'] = 'offline'
    except FileNotFoundError:
        app.logger.error("Ping command not found. Please ensure ping is installed and in your PATH.")
        result_data['status'] = 'unknown'
    except Exception as e:
        app.logger.error(f"An error occurred during ping for {host}: {e}")
        result_data['status'] = 'unknown'
    
    return result_data

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
EXTRA_IMPORT_CONFIG_PATH = os.path.join(CONFIG_DIR, 'extra_import.yaml')
UPLOAD_FOLDER = os.path.join(CONFIG_DIR, 'uploaded_ssh_keys')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

BACKUP_DIR = os.path.join(CONFIG_DIR, 'backup')
os.makedirs(BACKUP_DIR, exist_ok=True)

active_ssh_sessions = {}
server_ping_status = {}

# --- Config Loading/Saving ---
def backup_config_file(file_path):
    try:
        if not os.path.exists(file_path):
            app.logger.warning(f"Backup failed: Source file does not exist: {file_path}")
            return

        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        file_name = os.path.basename(file_path)
        base_name, ext = os.path.splitext(file_name)
        backup_file_name = f"{base_name.split('_')[0]}_{timestamp}{ext}"
        backup_path = os.path.join(BACKUP_DIR, backup_file_name)

        shutil.copy2(file_path, backup_path)
        app.logger.info(f"Backed up {file_name} to {backup_path}")

        all_backups = []
        for f in os.listdir(BACKUP_DIR):
            if f.startswith(base_name.split('_')[0]) and f.endswith(ext):
                all_backups.append(os.path.join(BACKUP_DIR, f))

        all_backups.sort(key=os.path.getmtime)

        while len(all_backups) > 5:
            oldest_backup = all_backups.pop(0)
            os.remove(oldest_backup)
            app.logger.info(f"Removed old backup: {oldest_backup}")

    except Exception as e:
        app.logger.error(f"Error backing up {file_path}: {e}")

def load_servers_config():
    if os.path.exists(SERVERS_CONFIG_PATH):
        with open(SERVERS_CONFIG_PATH, 'r') as f:
            config = yaml.safe_load(f) or {"servers": []}
            for server in config.get('servers', []):
                if 'ping_enabled' not in server:
                    server['ping_enabled'] = True
                if 'is_extra' not in server:
                    server['is_extra'] = False
                
            return config
    return {"servers": []}

def save_servers_config(config_data):
    os.makedirs(CONFIG_DIR, exist_ok=True)
    with open(SERVERS_CONFIG_PATH, 'w') as f:
        yaml.dump(config_data, f, indent=2, sort_keys=False)
    backup_config_file(SERVERS_CONFIG_PATH)

def load_ssh_keys_config():
    if os.path.exists(SSH_KEYS_CONFIG_PATH):
        with open(SSH_KEYS_CONFIG_PATH, 'r') as f:
            return yaml.safe_load(f) or {"ssh_keys": []}
    return {"ssh_keys": []}

def save_ssh_keys_config(config_data):
    os.makedirs(CONFIG_DIR, exist_ok=True)
    with open(SSH_KEYS_CONFIG_PATH, 'w') as f:
        yaml.dump(config_data, f, indent=2, sort_keys=False)
    backup_config_file(SSH_KEYS_CONFIG_PATH)

def load_users_config():
    if os.path.exists(USERS_CONFIG_PATH):
        with open(USERS_CONFIG_PATH, 'r') as f:
            config = yaml.safe_load(f) or {"users": []}
            return config
    return {"users": []}

def save_users_config(config_data):
    os.makedirs(CONFIG_DIR, exist_ok=True)
    with open(USERS_CONFIG_PATH, 'w') as f:
        yaml.dump(config_data, f, indent=2, sort_keys=False)

def load_extra_import_config():
    if os.path.exists(EXTRA_IMPORT_CONFIG_PATH):
        with open(EXTRA_IMPORT_CONFIG_PATH, 'r') as f:
            config = yaml.safe_load(f) or {}
            if "url" not in config:
                config["url"] = ""
            if "previous_url" not in config:
                config["previous_url"] = config["url"]
            return config
    return {"url": "", "previous_url": ""}

def save_extra_import_config(config_data):
    os.makedirs(CONFIG_DIR, exist_ok=True)
    with open(EXTRA_IMPORT_CONFIG_PATH, 'w') as f:
        yaml.dump(config_data, f, indent=2, sort_keys=False)


# Type display names mapping
TYPE_DISPLAY_NAMES = {
    'node': 'ノード',
    'virtual_machine': '仮想マシン',
    'network_device': 'ネットワークデバイス',
    'kvm': 'KVM',
}

def run_extra_import():
    with app.app_context():
        app.logger.info("Running extra import...")
        extra_import_config = load_extra_import_config()
        url = extra_import_config.get('url')
        previous_url = extra_import_config.get('previous_url', '')

        if not url:
            app.logger.info("Extra import URL not configured. Skipping.")
            config = load_servers_config()
            servers = config.get('servers', [])
            updated_servers = []
            for server in servers:
                if server.get('is_extra'):
                    server['is_extra'] = False
                    server['is_new'] = False
                    server['is_deleted'] = False
                updated_servers.append(server)
            config['servers'] = updated_servers
            save_servers_config(config)
            return

        try:
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            
            imported_hosts = []
            for line in response.text.splitlines():
                stripped_line = line.strip()
                if stripped_line:
                    host_part = stripped_line.split()[0]
                    if host_part.endswith('.'):
                        host_part = host_part[:-1]
                    imported_hosts.append(host_part)

            config = load_servers_config()
            servers = config.get('servers', [])
            
            # URLが変更された場合、またはprevious_urlが空でurlが設定されている場合のみis_newをリセット
            if url != previous_url or (previous_url == "" and url != ""):
                for server in servers:
                    if server.get('is_extra'):
                        server['is_new'] = False
                        server['is_deleted'] = False
                extra_import_config['previous_url'] = url
                save_extra_import_config(extra_import_config)
                app.logger.info(f"Extra import URL changed from '{previous_url}' to '{url}'. Resetting is_new flags.")

            existing_hosts_map = {s.get('host'): s for s in servers if s.get('host')}
            
            newly_added_servers = []
            for host in imported_hosts:
                if host not in existing_hosts_map:
                    new_server = {
                        'id': f"server-{int(time.time() * 1000)}-{random.randint(1000, 9999)}",
                        'name': host.split('.')[0],
                        'type': 'node',
                        'port': 22,
                        'host': host,
                        'is_extra': True,
                        'is_new': True, # 新規追加なのでTrue
                        'ping_enabled': True
                    }
                    servers.append(new_server)
                    newly_added_servers.append(new_server)
                    app.logger.info(f"Added new server from extra import: {host}")
                else:
                    # 既存のextra importされたサーバーが引き続き存在する場合
                    # is_newは既にFalseにリセットされているか、元々Falseなので何もしない
                    pass

            # 削除されたextra importサーバーのマーク
            for server in servers:
                if server.get('is_extra') and server.get('host') not in imported_hosts:
                    server['is_deleted'] = True
                    server.pop('is_new', None) # 削除されるものはis_newを削除

            save_servers_config(config)
            app.logger.info("Extra import finished.")
            socketio.emit('extra_import_finished')

        except requests.RequestException as e:
            app.logger.error(f"Error during extra import: {e}")

def schedule_extra_import():
    run_extra_import()
    threading.Timer(300, schedule_extra_import).start()

# Ping monitoring background task
def run_ping_monitoring():
    with app.app_context():
        app.logger.info("Starting ping monitoring thread...")
        while True:
            config = load_servers_config()
            servers = config.get('servers', [])
            for server in servers:
                server_id = server.get('id')
                host = server.get('host')
                ping_enabled = server.get('ping_enabled', False)

                if server_id and host and ping_enabled:
                    app.logger.debug(f"Pinging {host} (ID: {server_id}) for monitoring...")
                    ping_result = ping_host(host)
                    server_ping_status[server_id] = ping_result
                    socketio.start_background_task(socketio.emit, 'ping_status_update', {'server_id': server_id, 'status': ping_result['status'], 'response_time': ping_result['response_time'], 'packet_loss': ping_result['packet_loss']})
                elif server_id and server_id in server_ping_status:
                    del server_ping_status[server_id]
                    socketio.start_background_task(socketio.emit, 'ping_status_update', {'server_id': server_id, 'status': 'disabled', 'response_time': None, 'packet_loss': None})

            time.sleep(10)

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
    if 'username' in session:
        return redirect(url_for('index'))
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
    for server in servers:
        server['display_type'] = TYPE_DISPLAY_NAMES.get(server.get('type'), '不明')
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
    try:
        config = load_servers_config()
        return jsonify(config.get('servers', []))
    except Exception as e:
        app.logger.error(f"Error getting servers: {e}")
        return jsonify({"error": f"Failed to get servers: {e}"}), 500

@app.route('/api/servers/<server_id>', methods=['GET'])
@login_required
def get_server(server_id):
    try:
        config = load_servers_config()
        server = next((s for s in config.get('servers', []) if s['id'] == server_id), None)
        if not server:
            return jsonify({"error": "Server not found"}), 404
        return jsonify(server)
    except Exception as e:
        app.logger.error(f"Error getting server {server_id}: {e}")
        return jsonify({"error": f"Failed to get server: {e}"}), 500

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
            servers[i]['is_new'] = False
            servers[i]['is_deleted'] = False
            # is_extraフラグはそのまま維持（Extra Import管理から外さない）
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

@app.route('/bulk_delete_servers', methods=['POST'])
@login_required
def bulk_delete_servers():
    try:
        data = request.json
        server_ids_to_delete = data.get('server_ids', [])
        
        app.logger.debug(f"Attempting bulk delete for server IDs: {server_ids_to_delete}")

        if not server_ids_to_delete:
            app.logger.debug("No server IDs provided for deletion (bulk_delete_servers).")
            return jsonify({"status": "error", "message": "No server IDs provided for deletion."}), 400

        config = load_servers_config()
        servers = config.get('servers', [])
        original_len = len(servers)
        
        servers = [s for s in servers if s['id'] not in server_ids_to_delete]
        
        if len(servers) == original_len:
            app.logger.debug("No matching servers found for deletion (bulk_delete_servers).")
            return jsonify({"status": "error", "message": "No matching servers found for deletion."}), 404
        
        config['servers'] = servers
        save_servers_config(config)
        app.logger.info(f"Successfully deleted {original_len - len(servers)} servers via bulk delete.")
        return jsonify({"status": "success", "message": f"{original_len - len(servers)} servers deleted."}), 200
    except Exception as e:
        app.logger.error(f"Error during bulk_delete_servers: {e}")
        return jsonify({"status": "error", "message": f"Failed to delete servers: {e}"}), 500

@app.route('/api/config/extra_import_url', methods=['GET'])
@login_required
def get_extra_import_url():
    config = load_extra_import_config()
    return jsonify(config)

@app.route('/api/config/extra_import_url', methods=['POST'])
@login_required
def set_extra_import_url():
    data = request.json
    new_url = data.get('url', '')
    
    extra_import_config = load_extra_import_config()
    current_url = extra_import_config.get('url', '')
    previous_url = extra_import_config.get('previous_url', '')

    app.logger.debug(f"set_extra_import_url: new_url='{new_url}', current_url='{current_url}', previous_url='{previous_url}'")
    app.logger.debug(f"set_extra_import_url: new_url != current_url is {new_url != current_url}")

    if new_url != current_url:
        extra_import_config['url'] = new_url
        # previous_urlはrun_extra_importで更新されるため、ここでは設定しない
        save_extra_import_config(extra_import_config)
        app.logger.info("Extra import URL changed and saved.")

        # affected_serversは常に空になるので、このif文は不要になる
        # if affected_servers:
        #     app.logger.info("Confirmation needed for existing extra imported servers.")
        #     return jsonify({"message": "URL changed. Confirmation needed for existing extra imported servers.", "confirmation_needed": True}), 200
        # else:
        app.logger.info("Starting import directly after URL change.")
        threading.Thread(target=run_extra_import).start()
        return jsonify({"message": "URL saved, import started."}), 200
    else:
        app.logger.info("URL is unchanged, re-triggering import.")
        threading.Thread(target=run_extra_import).start()
        return jsonify({"message": "URL is unchanged, import re-triggered."}), 200


@app.route('/api/extra_import_url/confirm', methods=['POST'])
@login_required
def confirm_extra_import_action():
    data = request.json
    action = data.get('action')

    config = load_servers_config()
    servers = config.get('servers', [])
    extra_import_config = load_extra_import_config()
    
    if action == 'delete_all':
        servers = [s for s in servers if not (s.get('is_extra') and s.get('is_deleted'))]
        app.logger.info("Confirmed: Deleted all extra imported servers marked for deletion.")
    elif action == 'keep_all':
        for server in servers:
            if server.get('is_extra') and server.get('is_deleted'):
                server['is_extra'] = False
                server.pop('is_deleted', None)
                server.pop('is_new', None)
        app.logger.info("Confirmed: Kept all extra imported servers, removed extra import flag.")
    elif action == 'delete_single':
        server_id = data.get('server_id')
        if server_id:
            app.logger.info(f"Attempting to delete single extra imported server with ID: {server_id}")
            original_len = len(servers)
            servers = [s for s in servers if not (s['id'] == server_id and s.get('is_extra') and s.get('is_deleted'))]
            app.logger.info(f"After deletion attempt, servers count changed from {original_len} to {len(servers)}.")
            app.logger.info(f"Confirmed: Deleted single extra imported server: {server_id}")
        else:
            return jsonify({"error": "Server ID not provided for single delete."}), 400
    elif action == 'keep_single':
        server_id = data.get('server_id')
        if server_id:
            for server in servers:
                if server['id'] == server_id and server.get('is_extra') and server.get('is_deleted'):
                    server['is_extra'] = False
                    server.pop('is_deleted', None)
                    server.pop('is_new', None)
                    app.logger.info(f"Confirmed: Kept single extra imported server, removed extra import flag: {server_id}")
                    break
        else:
            return jsonify({"error": "Server ID not provided for single keep."}), 400
    elif action == 'cancel':
        extra_import_config['url'] = extra_import_config.get('previous_url', '')
        for server in servers:
            if server.get('is_extra') and server.get('is_deleted'):
                server.pop('is_deleted', None)
                server.pop('is_new', None)
        app.logger.info("Confirmed: Canceled URL change, reverted to previous URL.")
    else:
        return jsonify({"error": "Invalid action specified."}), 400

    save_servers_config(config)
    app.logger.info("Servers config saved after extra import action.")
    save_extra_import_config(extra_import_config)

    threading.Thread(target=run_extra_import).start()
    return jsonify({"message": f"Action '{action}' processed. Extra import re-triggered."}), 200


@app.route('/api/ping_status/<server_id>', methods=['GET'])
@login_required
def get_ping_status(server_id):
    ping_result = server_ping_status.get(server_id, {'status': 'unknown', 'response_time': None, 'packet_loss': None})
    return jsonify(ping_result)

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

@app.route('/api/ssh_keys/<key_id>', methods=['GET'])
@login_required
def get_ssh_key(key_id):
    try:
        config = load_ssh_keys_config()
        key = next((k for k in config.get('ssh_keys', []) if k['id'] == key_id), None)
        if not key:
            return jsonify({"error": "SSH Key not found"}), 404
        return jsonify(key)
    except Exception as e:
        app.logger.error(f"Error getting SSH key {key_id}: {e}")
        return jsonify({"error": f"Failed to get SSH key: {e}"}), 500

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
    os.chmod(filepath, 0o600)
    key_types_to_try = (paramiko.RSAKey, paramiko.ECDSAKey, paramiko.Ed25519Key)
    last_error = None

    for key_type in key_types_to_try:
        try:
            key_type.from_private_key_file(filepath)
            app.logger.info(f"Uploaded key '{filename}' validated as {key_type.__name__}.")
            return jsonify({'path': filepath}), 200
        except paramiko.PasswordRequiredException:
            last_error = 'SSH key requires a passphrase, which is not supported.'
            break
        except paramiko.SSHException as e:
            last_error = str(e)
            continue
        except Exception as e:
            last_error = f"An unexpected error occurred during validation: {e}"
            continue

    os.remove(filepath)
    error_message = f"Invalid or unsupported SSH key format. Last error: {last_error}"
    app.logger.error(f"Failed to validate key '{filename}'. Reason: {error_message}")
    return jsonify({'error': error_message}), 400

@app.route('/api/ssh_keys/bulk_delete', methods=['POST'])
@login_required
def bulk_delete_ssh_keys():
    data = request.json
    key_ids_to_delete = data.get('ids', [])
    
    if not key_ids_to_delete:
        return jsonify({"error": "No SSH key IDs provided for deletion."}), 400

    config = load_ssh_keys_config()
    ssh_keys = config.get('ssh_keys', [])
    original_len = len(ssh_keys)
    
    ssh_keys = [k for k in ssh_keys if k['id'] not in key_ids_to_delete]
    
    if len(ssh_keys) == original_len:
        return jsonify({"error": "No matching SSH keys found for deletion."}), 404
    
    config['ssh_keys'] = ssh_keys
    save_ssh_keys_config(config)
    return jsonify({"message": f"{original_len - len(ssh_keys)} SSH keys deleted."}), 200

# --- Backup API Endpoints ---
@app.route('/api/backups', methods=['GET'])
@login_required
def list_backups():
    try:
        backup_files = []
        for f in os.listdir(BACKUP_DIR):
            if f.endswith(('.yaml', '.yml')):
                file_path = os.path.join(BACKUP_DIR, f)
                if os.path.isfile(file_path):
                    backup_files.append({
                        'name': f,
                        'size': os.path.getsize(file_path),
                        'last_modified': datetime.fromtimestamp(os.path.getmtime(file_path)).isoformat()
                    })
        backup_files.sort(key=lambda x: x['last_modified'], reverse=True)
        return jsonify(backup_files)
    except Exception as e:
        app.logger.error(f"Error listing backups: {e}")
        return jsonify({"error": "Failed to list backups"}), 500

@app.route('/api/backups/download/<filename>', methods=['GET'])
@login_required
def download_backup(filename):
    try:
        return send_from_directory(BACKUP_DIR, filename, as_attachment=True)
    except FileNotFoundError:
        return jsonify({"error": "File not found"}), 404
    except Exception as e:
        app.logger.error(f"Error downloading backup {filename}: {e}")
        return jsonify({"error": "Failed to download backup"}), 500

@app.route('/api/backups/delete/<filename>', methods=['DELETE'])
@login_required
def delete_backup(filename):
    try:
        file_path = os.path.join(BACKUP_DIR, filename)
        if os.path.exists(file_path):
            os.remove(file_path)
            return jsonify({"message": "Backup deleted successfully"}), 200
        return jsonify({"error": "File not found"}), 404
    except Exception as e:
        app.logger.error(f"Error deleting backup {filename}: {e}")
        return jsonify({"error": "Failed to delete backup"}), 500

@app.route('/api/config/import', methods=['POST'])
@login_required
def import_config():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    try:
        uploaded_content = file.read().decode('utf-8')
        new_config = yaml.safe_load(uploaded_content)

        if 'servers' in new_config:
            save_servers_config(new_config)
            return jsonify({"message": "Servers configuration imported successfully"}), 200
        elif 'ssh_keys' in new_config:
            save_ssh_keys_config(new_config)
            return jsonify({"message": "SSH keys configuration imported successfully"}), 200
        else:
            return jsonify({"error": "Invalid configuration file format. Must contain 'servers' or 'ssh_keys' key."}), 400

    except yaml.YAMLError as e:
        return jsonify({"error": f"Invalid YAML format: {e}"}), 400
    except Exception as e:
        app.logger.error(f"Error importing config: {e}")
        return jsonify({"error": f"Failed to import configuration: {e}"}), 500

@app.route('/api/config/export', methods=['GET'])
@login_required
def export_config():
    try:
        servers_config = load_servers_config()
        ssh_keys_config = load_ssh_keys_config()

        full_config = {
            "servers": servers_config.get("servers", []),
            "ssh_keys": ssh_keys_config.get("ssh_keys", [])
        }

        yaml_string = yaml.dump(full_config, indent=2, sort_keys=False)

        response = make_response(yaml_string)
        response.headers["Content-Disposition"] = "attachment; filename=serverdeck_config_export.yaml"
        response.headers["Content-Type"] = "application/x-yaml"
        return response
    except Exception as e:
        app.logger.error(f"Error exporting config: {e}")
        return jsonify({"error": "Failed to export configuration"}), 500

# --- Protected Socket.IO Events ---
def _is_authenticated():
    return 'username' in session

@socketio.on('connect')
def handle_connect():
    if not _is_authenticated():
        app.logger.warning(f"Unauthenticated socket connection attempt rejected from SID: {request.sid}")
        return False
    app.logger.debug(f"Authenticated client connected! SID: {request.sid}, User: {session.get('username')}")

def _ssh_read_loop(chan, sid):
    while True:
        if chan.recv_ready():
            output = chan.recv(4096).decode('utf-8', errors='ignore')
            socketio.emit('ssh_output', {'output': output}, room=sid)
        time.sleep(0.01)

@socketio.on('start_ssh')
def handle_start_ssh(data):
    if not _is_authenticated():
        emit('ssh_output', {'output': 'Authentication required.\r\n'})
        return
    app.logger.debug(f"Received start_ssh event. Data: {data}, SID: {request.sid}")
    server_id = data.get('server_id')
    sid = request.sid
    app.logger.debug(f"Attempting to start SSH for server_id: {server_id} (SID: {sid})")
    config = load_servers_config()
    server_info = next((s for s in config.get('servers', []) if s['id'] == server_id), None)
    if not server_info:
        app.logger.debug(f"Server '{server_id}' not found.")
        emit('ssh_output', {'output': f"Error: Server '{server_id}' not found in configuration.\r\n"})
        return
    ssh_connectable_types = ['node', 'virtual_machine', 'network_device', 'kvm']
    if server_info.get('type') not in ssh_connectable_types:
        app.logger.debug(f"Server '{server_id}' is not an SSH connectable type server.")
        emit('ssh_output', {'output': f"Error: Server '{server_id}' is not an SSH connectable type server.\r\n"})
        return
    try:
        client = paramiko.SSHClient()
        client.load_system_host_keys()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        hostname = server_info.get('host')
        port = server_info.get('port', 22)
        username = server_info.get('username')
        password = server_info.get('password')
        ssh_key_id = server_info.get('ssh_key_id')
        if ssh_key_id:
            ssh_keys_config = load_ssh_keys_config()
            ssh_key_info = next((k for k in ssh_keys_config.get('ssh_keys', []) if k['id'] == ssh_key_id), None)
            app.logger.debug(f"Attempting to load key '{ssh_key_id}' with info: {ssh_key_info}")
            if ssh_key_info and os.path.exists(os.path.expanduser(ssh_key_info['path'])):
                try:
                    key_path_expanded = os.path.expanduser(ssh_key_info['path'])
                    app.logger.debug(f"Expanded key path: {key_path_expanded}")
                    try:
                        key = paramiko.RSAKey.from_private_key_file(key_path_expanded)
                    except paramiko.SSHException as e:
                        app.logger.debug(f"RSAKey load failed: {e}. Attempting Ed25519Key.")
                        try:
                            key = paramiko.Ed25519Key(filename=key_path_expanded)
                        except Exception as ed25519_e:
                            app.logger.debug(f"Ed25519Key load failed: {ed25519_e}.")
                            emit('ssh_output', {'output': f"Error loading SSH Key '{ssh_key_info['name']}': {e} (RSA) / {ed25519_e} (Ed25519)\r\n"})
                            client.close()
                            return
                    client.connect(
                        hostname=hostname,
                        port=port,
                        username=username,
                        pkey=key,
                        timeout=10,
                        look_for_keys=False,
                        allow_agent=False
                    )
                    app.logger.debug(f"SSH connected to {hostname} using key: {ssh_key_info['name']}")
                except paramiko.PasswordRequiredException:
                    app.logger.debug(f"Key '{ssh_key_info['name']}' requires passphrase.")
                    emit('ssh_output', {'output': f"Error: SSH Key '{ssh_key_info['name']}' requires a passphrase.\r\n"})
                    client.close()
                    return
                except Exception as e:
                    app.logger.debug(f"Error loading SSH Key '{ssh_key_info['name']}': {e}")
                    emit('ssh_output', {'output': f"Error loading SSH Key '{ssh_key_info['name']}': {e}\r\n"})
                    client.close()
                    return
            else:
                app.logger.debug(f"SSH Key '{ssh_key_id}' not found or path invalid (info: {ssh_key_info}).")
                emit('ssh_output', {'output': f"Error: SSH Key '{ssh_key_id}' not found or path invalid.\r\n"})
                client.close()
                return
        elif password:
            app.logger.debug(f"Attempting password authentication for {hostname}")
            client.connect(hostname=hostname, port=port, username=username, password=password, timeout=10)
            app.logger.debug(f"SSH connected to {hostname} using password.")
        else:
            app.logger.debug(f"No valid authentication method provided.")
            emit('ssh_output', {'output': "Error: No valid authentication method (password or SSH key) provided.\r\n"})
            client.close()
            return
        chan = client.invoke_shell()
        chan.settimeout(0.0)
        active_ssh_sessions[sid] = {'client': client, 'channel': chan}
        emit('ssh_output', {'output': f"Successfully connected to {hostname}.\r\n"})
        threading.Thread(target=_ssh_read_loop, args=(chan, sid), daemon=True).start()
    except paramiko.AuthenticationException:
        app.logger.debug(f"Authentication failed for {hostname}.")
        emit('ssh_output', {'output': "Authentication failed. Please check your credentials.\r\n"})
    except paramiko.SSHException as e:
        app.logger.debug(f"SSH error for {hostname}: {e}")
        emit('ssh_output', {'output': f"SSH error: {e}\r\n"})
    except Exception as e:
        app.logger.debug(f"General connection error for {hostname}: {e}")
        emit('ssh_output', {'output': f"Connection error: {e}\r\n"})

@socketio.on('ssh_input')
def handle_ssh_input(data):
    if not _is_authenticated():
        return
    sid = request.sid
    if sid in active_ssh_sessions:
        chan = active_ssh_sessions[sid]['channel']
        chan.send(data['input'])

@socketio.on('resize_terminal')
def handle_resize_terminal(data):
    if not _is_authenticated():
        return
    sid = request.sid
    if sid in active_ssh_sessions:
        chan = active_ssh_sessions[sid]['channel']
        cols = data.get('cols', 80)
        rows = data.get('rows', 24)
        chan.resize_pty(cols, rows)

@socketio.on('disconnect')
def handle_disconnect():
    sid = request.sid
    app.logger.debug(f"Client disconnected (SID: {sid})")
    if sid in active_ssh_sessions:
        client = active_ssh_sessions[sid]['client']
        client.close()
        del active_ssh_sessions[sid]
        app.logger.debug(f"SSH session closed for SID: {sid}")

if __name__ == '__main__':
    threading.Thread(target=schedule_extra_import, daemon=True).start()
    threading.Thread(target=run_ping_monitoring, daemon=True).start()
    socketio.run(app, host='0.0.0.0', debug=True, allow_unsafe_werkzeug=True, port=5001)