import re
import sys
import logging
import socket
import select
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
app.config["SESSION_COOKIE_SECURE"] = False  # HTTPでも動作するように
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
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
ssh_connection_status = {}  # 接続状態を追跡するための辞書
multitab_ssh_sessions = {}  # マルチタブSSHセッション管理
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
                # tagsフィールドの正規化
                if 'tags' in server:
                    if isinstance(server['tags'], str):
                        if server['tags'].strip():
                            server['tags'] = [tag.strip() for tag in server['tags'].split(',')]
                        else:
                            server['tags'] = []
                    elif not isinstance(server['tags'], list):
                        server['tags'] = []
                else:
                    server['tags'] = []
                
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
        app.logger.debug(f"User {session['username']} already logged in, redirecting to index")
        return redirect(url_for('index'))
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        app.logger.debug(f"Login attempt for username: {username}")
        
        users_config = load_users_config()
        user = next((u for u in users_config.get('users', []) if u['username'] == username), None)
        
        if user and check_password_hash(user['password_hash'], password):
            session['username'] = user['username']
            session.permanent = True
            app.logger.debug(f"Login successful for user: {username}")
            flash('Logged in successfully.', 'success')
            next_page = request.args.get('next')
            redirect_url = next_page or url_for('index')
            app.logger.debug(f"Redirecting to: {redirect_url}")
            return redirect(redirect_url)
        else:
            app.logger.debug(f"Login failed for username: {username}")
            flash('Invalid username or password.', 'danger')
            
    return render_template('login.html')

@app.route('/logout')
def logout():
    session.clear()
    flash('You have been logged out.', 'info')
    return redirect(url_for('login'))


# --- Protected Routes ---

@app.route('/test.html')
def test_page():
    """テスト用のシンプルなHTMLページを配信"""
    return '''<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>テストページ</title>
</head>
<body>
    <h1>こんにちは</h1>
    <p>このページはテスト用です。</p>
    <p>「le=1.0>」の表示が消えているかを確認してください。</p>
    <script>console.log('Test page loaded successfully');</script>
</body>
</html>'''

@app.route('/debug')
def debug_page():
    """デバッグ情報を表示するページ"""
    return f'''<!DOCTYPE html>
<html>
<head><title>Debug Info</title></head>
<body>
    <h1>Debug Information</h1>
    <p>Current time: {datetime.now()}</p>
    <p>Session: {'logged in' if 'username' in session else 'not logged in'}</p>
    <p>Flask version: Working</p>
</body>
</html>'''

@app.route('/modal-test')
@login_required
def modal_test():
    """モーダルテスト用のシンプルなページ"""
    return '''<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>モーダルテスト</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
</head>
<body>
    <div class="container mt-4">
        <h1>モーダルテスト</h1>
        <button type="button" class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#testModal">
            モーダルを開く
        </button>
        
        <!-- Modal -->
        <div class="modal fade" id="testModal" tabindex="-1" aria-labelledby="testModalLabel" aria-hidden="true">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="testModalLabel">テストモーダル</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <p>これはテスト用のモーダルです。</p>
                        <p>正常に開閉できるかテストしています。</p>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">閉じる</button>
                        <button type="button" class="btn btn-primary">保存</button>
                    </div>
                </div>
            </div>
        </div>
    </div>
    
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script>
        console.log('Modal test page loaded');
        
        // モーダルイベントの監視
        const modal = document.getElementById('testModal');
        modal.addEventListener('show.bs.modal', function() {
            console.log('Modal is showing');
        });
        modal.addEventListener('shown.bs.modal', function() {
            console.log('Modal is shown');
        });
        modal.addEventListener('hide.bs.modal', function() {
            console.log('Modal is hiding');
        });
        modal.addEventListener('hidden.bs.modal', function() {
            console.log('Modal is hidden');
        });
    </script>
</body>
</html>'''

@app.route('/')
@login_required
def index():
    config = load_servers_config()
    servers = config.get('servers', [])
    
    # サーバー情報の前処理
    for server in servers:
        server['display_type'] = TYPE_DISPLAY_NAMES.get(server.get('type'), '不明')
        # URLフィールドが存在しない場合は空文字列を設定
        if 'url' not in server:
            server['url'] = ''
        # tagsがない場合は空リストを設定
        if 'tags' not in server:
            server['tags'] = []
        elif isinstance(server['tags'], str):
            # tagsが文字列の場合は、カンマ区切りでリストに変換
            server['tags'] = [tag.strip() for tag in server['tags'].split(',') if tag.strip()]
    
    # 階層構造のためのサーバー整理
    organized_servers = organize_servers_hierarchy(servers)
    
    return render_template('index.html', servers=organized_servers)

@app.route('/config')
@login_required
def config_page():
    return render_template('config_modal_content.html')

@app.route('/ssh/<server_id>')
@login_required
def ssh_terminal(server_id):
    return render_template('ssh_terminal.html', server_id=server_id)

@app.route('/ssh_multitab')
@login_required
def ssh_multitab():
    server_id = request.args.get('server_id')
    return render_template('ssh_terminal_multitab.html', initial_server_id=server_id)

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
    
    # tagsフィールドの正規化
    if 'tags' in new_server:
        if isinstance(new_server['tags'], str):
            if new_server['tags'].strip():
                new_server['tags'] = [tag.strip() for tag in new_server['tags'].split(',')]
            else:
                new_server['tags'] = []
        elif not isinstance(new_server['tags'], list):
            new_server['tags'] = []
    else:
        new_server['tags'] = []
    
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
    # tagsフィールドの正規化
    if 'tags' in updated_data:
        if isinstance(updated_data['tags'], str):
            if updated_data['tags'].strip():
                updated_data['tags'] = [tag.strip() for tag in updated_data['tags'].split(',')]
            else:
                updated_data['tags'] = []
        elif not isinstance(updated_data['tags'], list):
            updated_data['tags'] = []
    
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

# --- SSH Connection Status Management ---
def update_ssh_status(sid, status, message=None, progress=0):
    """SSH接続状態を更新し、クライアントに通知する"""
    ssh_connection_status[sid] = {
        'status': status,
        'message': message or status,
        'progress': progress,
        'timestamp': datetime.now().isoformat()
    }
    socketio.emit('ssh_status_update', ssh_connection_status[sid], room=sid)
    app.logger.debug(f"SSH status updated for {sid}: {status} ({progress}%)")

@socketio.on('connect')
def handle_connect():
    if not _is_authenticated():
        app.logger.warning(f"Unauthenticated socket connection attempt rejected from SID: {request.sid}")
        return False
    app.logger.debug(f"Authenticated client connected! SID: {request.sid}, User: {session.get('username')}")

def _ssh_read_loop(chan, sid):
    """
    従来のSSH用の読み取りループ（SSH接続タイムアウト監視付き）
    
    ※重要な区別※
    - SSH接続タイムアウト: サーバー側でSSH接続自体が切断された時の検出（ここで処理）
    - クライアント都合タイムアウト: フロントエンド側で30分間無操作時の切断（フロントエンドで処理）
    """
    try:
        while True:
            try:
                # データが受信可能かチェック
                if chan.recv_ready():
                    output = chan.recv(4096).decode('utf-8', errors='ignore')
                    if output:  # 空でない場合のみ送信
                        socketio.emit('ssh_output', {'output': output}, room=sid)
                
                # 接続状態をチェック（複数の条件で判定）
                if chan.closed or chan.eof_received or not chan.active:
                    reason = "unknown"
                    if chan.closed:
                        reason = "closed"
                    elif chan.eof_received:
                        reason = "EOF"
                    elif not chan.active:
                        reason = "inactive"
                    
                    app.logger.debug(f"SSH channel terminated for SID: {sid}, reason: {reason}")
                    update_ssh_status(sid, 'disconnected', 'SSH接続が終了しました', 0)
                    socketio.emit('ssh_output', {'output': '\r\n[SSH接続が終了しました]\r\n'}, room=sid)
                    socketio.emit('ssh_connection_closed', {'tab_id': sid, 'message': 'SSH接続が終了しました'}, room=sid)
                    break
                
                # 終了状態をチェック
                if chan.exit_status_ready():
                    exit_status = chan.recv_exit_status()
                    app.logger.debug(f"SSH session exited with status {exit_status} for SID: {sid}")
                    update_ssh_status(sid, 'disconnected', f'SSH接続が終了しました (終了コード: {exit_status})', 0)
                    socketio.emit('ssh_output', {'output': f'\r\n[SSH接続が終了しました (終了コード: {exit_status})]\r\n'}, room=sid)
                    socketio.emit('ssh_connection_closed', {'tab_id': sid, 'message': f'SSH接続が終了しました (終了コード: {exit_status})'}, room=sid)
                    break
                
                # 追加の接続チェック：recv を非ブロッキングで試行
                try:
                    # 0バイトの非ブロッキング読み取りで接続状態を確認
                    test_read = chan.recv(0)  # 0バイト読み取り
                    if test_read is None:  # Noneが返された場合、接続終了
                        app.logger.debug(f"SSH channel recv returned None for SID: {sid}")
                        update_ssh_status(sid, 'disconnected', 'SSH接続が終了しました (recv None)', 0)
                        socketio.emit('ssh_output', {'output': '\r\n[SSH接続が終了しました]\r\n'}, room=sid)
                        socketio.emit('ssh_connection_closed', {'tab_id': sid, 'message': 'SSH接続が終了しました'}, room=sid)
                        break
                except BlockingIOError:
                    # ブロッキングIOエラーは正常（データがない）
                    pass
                except Exception as recv_e:
                    # recv エラーは接続問題を示している可能性がある
                    if "closed" in str(recv_e).lower() or "eof" in str(recv_e).lower():
                        app.logger.debug(f"SSH recv error indicates connection closed for SID {sid}: {recv_e}")
                        update_ssh_status(sid, 'disconnected', 'SSH接続が終了しました (recv error)', 0)
                        socketio.emit('ssh_output', {'output': '\r\n[SSH接続が終了しました]\r\n'}, room=sid)
                        socketio.emit('ssh_connection_closed', {'tab_id': sid, 'message': 'SSH接続が終了しました'}, room=sid)
                        break
                
                time.sleep(0.01)
                    
            except socket.error as sock_e:
                app.logger.debug(f"Socket error in SSH read loop for SID {sid}: {sock_e}")
                update_ssh_status(sid, 'disconnected', f'SSH接続が終了しました (ソケットエラー)', 0)
                socketio.emit('ssh_output', {'output': '\r\n[SSH接続が終了しました (ソケットエラー)]\r\n'}, room=sid)
                socketio.emit('ssh_connection_closed', {'tab_id': sid, 'message': f'SSH接続が終了しました (ソケットエラー)'}, room=sid)
                break
            except Exception as loop_e:
                # 予期しないエラーはログに記録して継続を試行
                app.logger.debug(f"Loop error in SSH read loop for SID {sid}: {loop_e}")
                # 特定のエラーの場合は終了
                if any(keyword in str(loop_e).lower() for keyword in ['closed', 'eof', 'connection', 'broken']):
                    app.logger.debug(f"Connection-related error detected for SID {sid}: {loop_e}")
                    update_ssh_status(sid, 'disconnected', 'SSH接続が終了しました (接続エラー)', 0)
                    socketio.emit('ssh_output', {'output': '\r\n[SSH接続が終了しました]\r\n'}, room=sid)
                    socketio.emit('ssh_connection_closed', {'tab_id': sid, 'message': 'SSH接続が終了しました'}, room=sid)
                    break
                # それ以外は継続
                continue
                
    except Exception as e:
        app.logger.error(f"Error in SSH read loop for SID {sid}: {e}")
        update_ssh_status(sid, 'error', 'SSH接続でエラーが発生しました', 0)
        socketio.emit('ssh_output', {'output': f'\r\n[SSH接続エラー: {e}]\r\n'}, room=sid)
        socketio.emit('ssh_connection_closed', {'tab_id': sid, 'message': f'SSH接続エラー: {e}'}, room=sid)
    finally:
        # セッションクリーンアップ
        if sid in active_ssh_sessions:
            try:
                active_ssh_sessions[sid]['client'].close()
            except:
                pass
            del active_ssh_sessions[sid]
            app.logger.debug(f"SSH session cleaned up for SID: {sid}")

@socketio.on('start_ssh')
def handle_start_ssh(data):
    if not _is_authenticated():
        emit('ssh_output', {'output': 'Authentication required.\r\n'})
        return
    
    server_id = data.get('server_id')
    sid = request.sid
    
    # 初期化: 接続開始状態
    update_ssh_status(sid, 'initializing', 'SSH接続を開始しています...', 10)
    
    app.logger.debug(f"Received start_ssh event. Data: {data}, SID: {request.sid}")
    app.logger.debug(f"Attempting to start SSH for server_id: {server_id} (SID: {sid})")
    
    config = load_servers_config()
    server_info = next((s for s in config.get('servers', []) if s['id'] == server_id), None)
    
    if not server_info:
        app.logger.debug(f"Server '{server_id}' not found.")
        update_ssh_status(sid, 'error', f"サーバー '{server_id}' が見つかりません", 0)
        emit('ssh_output', {'output': f"Error: Server '{server_id}' not found in configuration.\r\n"})
        return
    
    ssh_connectable_types = ['node', 'virtual_machine', 'network_device', 'kvm']
    if server_info.get('type') not in ssh_connectable_types:
        app.logger.debug(f"Server '{server_id}' is not an SSH connectable type server.")
        update_ssh_status(sid, 'error', f"サーバー '{server_id}' はSSH接続できません", 0)
        emit('ssh_output', {'output': f"Error: Server '{server_id}' is not an SSH connectable type server.\r\n"})
        return
    
    # サーバー情報取得完了: 20%
    update_ssh_status(sid, 'connecting', 'サーバー情報を取得しました', 20)
    
    try:
        client = paramiko.SSHClient()
        client.load_system_host_keys()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        
        hostname = server_info.get('host')
        port = server_info.get('port', 22)
        username = server_info.get('username')
        password = server_info.get('password')
        ssh_key_id = server_info.get('ssh_key_id')
        ssh_options = server_info.get('ssh_options', '')
        
        # SSH接続準備完了: 30%
        update_ssh_status(sid, 'connecting', f'{hostname}:{port} に接続中...', 30)
        
        # SSH オプションを解析
        ssh_connect_kwargs = parse_ssh_options(ssh_options)
        app.logger.debug(f"SSH connection will use additional options: {ssh_connect_kwargs}")
        
        if ssh_key_id:
            # SSH鍵認証の準備: 40%
            update_ssh_status(sid, 'authenticating', 'SSH鍵を準備中...', 40)
            
            ssh_keys_config = load_ssh_keys_config()
            ssh_key_info = next((k for k in ssh_keys_config.get('ssh_keys', []) if k['id'] == ssh_key_id), None)
            app.logger.debug(f"Attempting to load key '{ssh_key_id}' with info: {ssh_key_info}")
            
            if ssh_key_info and os.path.exists(os.path.expanduser(ssh_key_info['path'])):
                try:
                    key_path_expanded = os.path.expanduser(ssh_key_info['path'])
                    app.logger.debug(f"Expanded key path: {key_path_expanded}")
                    
                    # SSH鍵の読み込み: 50%
                    update_ssh_status(sid, 'authenticating', f"SSH鍵 '{ssh_key_info['name']}' を読み込み中...", 50)
                    
                    try:
                        key = paramiko.RSAKey.from_private_key_file(key_path_expanded)
                    except paramiko.SSHException as e:
                        app.logger.debug(f"RSAKey load failed: {e}. Attempting Ed25519Key.")
                        try:
                            key = paramiko.Ed25519Key(filename=key_path_expanded)
                        except Exception as ed25519_e:
                            app.logger.debug(f"Ed25519Key load failed: {ed25519_e}.")
                            update_ssh_status(sid, 'error', f"SSH鍵の読み込みに失敗しました", 0)
                            emit('ssh_output', {'output': f"Error loading SSH Key '{ssh_key_info['name']}': {e} (RSA) / {ed25519_e} (Ed25519)\r\n"})
                            client.close()
                            return
                    
                    # SSH鍵認証で接続: 70%
                    update_ssh_status(sid, 'authenticating', f"SSH鍵で認証中...", 70)
                    
                    # 基本的な接続パラメータ（拡張タイムアウト監視付き）
                    connect_params = {
                        'hostname': hostname,
                        'port': port,
                        'username': username,
                        'pkey': key,
                        'timeout': 8,  # 接続タイムアウトを短縮
                        'look_for_keys': False,
                        'allow_agent': False,
                        'auth_timeout': 5,  # 認証タイムアウト
                        'banner_timeout': 5  # バナータイムアウト
                    }
                    
                    # SSH オプションから得られた追加パラメータをマージ
                    connect_params.update(ssh_connect_kwargs)
                    
                    # 接続実行（詳細なタイムアウト監視付き）
                    try:
                        client.connect(**connect_params)
                        app.logger.debug(f"SSH connected to {hostname} using key: {ssh_key_info['name']}")
                        
                        # 接続後の健全性テスト
                        transport = client.get_transport()
                        if not transport or not transport.is_active():
                            raise Exception("SSH transport is not active after connection")
                            
                    except socket.timeout:
                        app.logger.warning(f"SSH connection timeout to {hostname}:{port}")
                        update_ssh_status(sid, 'error', f"接続タイムアウト ({hostname}:{port})", 0)
                        emit('ssh_output', {'output': f"Connection timeout to {hostname}:{port}\r\n"})
                        client.close()
                        return
                    except paramiko.AuthenticationException:
                        app.logger.warning(f"SSH authentication failed to {hostname}")
                        update_ssh_status(sid, 'error', f"認証に失敗しました", 0)
                        emit('ssh_output', {'output': f"Authentication failed to {hostname}\r\n"})
                        client.close()
                        return
                    except Exception as conn_e:
                        app.logger.warning(f"SSH connection failed to {hostname}: {conn_e}")
                        update_ssh_status(sid, 'error', f"接続に失敗しました: {str(conn_e)[:50]}", 0)
                        emit('ssh_output', {'output': f"Connection failed to {hostname}: {conn_e}\r\n"})
                        client.close()
                        return
                except paramiko.PasswordRequiredException:
                    app.logger.debug(f"Key '{ssh_key_info['name']}' requires passphrase.")
                    update_ssh_status(sid, 'error', f"SSH鍵 '{ssh_key_info['name']}' にパスフレーズが必要です", 0)
                    emit('ssh_output', {'output': f"Error: SSH Key '{ssh_key_info['name']}' requires a passphrase.\r\n"})
                    client.close()
                    return
                except Exception as e:
                    app.logger.debug(f"Error loading SSH Key '{ssh_key_info['name']}': {e}")
                    update_ssh_status(sid, 'error', f"SSH鍵 '{ssh_key_info['name']}' の読み込みエラー", 0)
                    emit('ssh_output', {'output': f"Error loading SSH Key '{ssh_key_info['name']}': {e}\r\n"})
                    client.close()
                    return
            else:
                app.logger.debug(f"SSH Key '{ssh_key_id}' not found or path invalid (info: {ssh_key_info}).")
                update_ssh_status(sid, 'error', f"SSH鍵 '{ssh_key_id}' が見つかりません", 0)
                emit('ssh_output', {'output': f"Error: SSH Key '{ssh_key_id}' not found or path invalid.\r\n"})
                client.close()
                return
        elif password:
            # パスワード認証: 50%
            update_ssh_status(sid, 'authenticating', 'パスワードで認証中...', 50)
            
            app.logger.debug(f"Attempting password authentication for {hostname}")
            # 基本的な接続パラメータ（拡張タイムアウト監視付き）
            connect_params = {
                'hostname': hostname,
                'port': port,
                'username': username,
                'password': password,
                'timeout': 8,  # 接続タイムアウトを短縮
                'auth_timeout': 5,  # 認証タイムアウト
                'banner_timeout': 5  # バナータイムアウト
            }
            
            # SSH オプションから得られた追加パラメータをマージ
            connect_params.update(ssh_connect_kwargs)
            
            # 接続実行（詳細なタイムアウト監視付き）
            try:
                client.connect(**connect_params)
                app.logger.debug(f"SSH connected to {hostname} using password.")
                
                # 接続後の健全性テスト
                transport = client.get_transport()
                if not transport or not transport.is_active():
                    raise Exception("SSH transport is not active after connection")
                    
            except socket.timeout:
                app.logger.warning(f"SSH connection timeout to {hostname}:{port}")
                update_ssh_status(sid, 'error', f"接続タイムアウト ({hostname}:{port})", 0)
                emit('ssh_output', {'output': f"Connection timeout to {hostname}:{port}\r\n"})
                client.close()
                return
            except paramiko.AuthenticationException:
                app.logger.warning(f"SSH authentication failed to {hostname}")
                update_ssh_status(sid, 'error', f"認証に失敗しました", 0)
                emit('ssh_output', {'output': f"Authentication failed to {hostname}\r\n"})
                client.close()
                return
            except Exception as conn_e:
                app.logger.warning(f"SSH connection failed to {hostname}: {conn_e}")
                update_ssh_status(sid, 'error', f"接続に失敗しました: {str(conn_e)[:50]}", 0)
                emit('ssh_output', {'output': f"Connection failed to {hostname}: {conn_e}\r\n"})
                client.close()
                return
        else:
            app.logger.debug(f"No valid authentication method provided.")
            update_ssh_status(sid, 'error', f"認証情報が提供されていません", 0)
            emit('ssh_output', {'output': "Error: No valid authentication method (password or SSH key) provided.\r\n"})
            client.close()
            return
        
        # シェルセッション作成: 90%
        update_ssh_status(sid, 'connecting', 'シェルセッションを作成中...', 90)
        
        chan = client.invoke_shell()
        chan.settimeout(0.0)
        active_ssh_sessions[sid] = {'client': client, 'channel': chan}
        
        # 接続完了: 100%
        update_ssh_status(sid, 'connected', f'{hostname} に接続完了', 100)
        
        emit('ssh_output', {'output': f"Successfully connected to {hostname}.\r\n"})
        threading.Thread(target=_ssh_read_loop, args=(chan, sid), daemon=True).start()
    except paramiko.AuthenticationException:
        app.logger.debug(f"Authentication failed for {hostname}.")
        update_ssh_status(sid, 'error', f"認証に失敗しました", 0)
        emit('ssh_output', {'output': "Authentication failed. Please check your credentials.\r\n"})
    except paramiko.SSHException as e:
        app.logger.debug(f"SSH error for {hostname}: {e}")
        update_ssh_status(sid, 'error', f"SSH接続エラー: {e}", 0)
        emit('ssh_output', {'output': f"SSH error: {e}\r\n"})
    except Exception as e:
        app.logger.debug(f"General connection error for {hostname}: {e}")
        update_ssh_status(sid, 'error', f"接続エラー: {e}", 0)
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

@socketio.on('disconnect_ssh')
def handle_disconnect_ssh(data):
    """特定のSSH接続を明示的に切断する（マルチタブ対応）"""
    if not _is_authenticated():
        return
    sid = request.sid
    tab_id = data.get('tab_id')
    
    app.logger.debug(f"Explicit SSH disconnect requested for SID: {sid}, tab_id: {tab_id}")
    
    # マルチタブSSHセッションの処理
    if tab_id and tab_id in multitab_ssh_sessions:
        try:
            session_info = multitab_ssh_sessions[tab_id]
            client = session_info['client']
            chan = session_info['channel']
            
            # チャネルとクライアントを明示的に閉じる
            if chan:
                chan.close()
            if client:
                client.close()
                
            del multitab_ssh_sessions[tab_id]
            app.logger.debug(f"Multi-tab SSH session explicitly closed for tab: {tab_id}")
        except Exception as e:
            app.logger.error(f"Error during explicit multi-tab SSH disconnect: {e}")
    
    # 従来のSSHセッションの処理（後方互換性）
    if sid in active_ssh_sessions:
        try:
            client = active_ssh_sessions[sid]['client']
            chan = active_ssh_sessions[sid]['channel']
            
            # チャネルとクライアントを明示的に閉じる
            if chan:
                chan.close()
            if client:
                client.close()
                
            del active_ssh_sessions[sid]
            app.logger.debug(f"SSH session explicitly closed for SID: {sid}")
        except Exception as e:
            app.logger.error(f"Error during explicit SSH disconnect: {e}")
    
    # SSH接続状態をクリーンアップ
    if sid in ssh_connection_status:
        del ssh_connection_status[sid]

@socketio.on('disconnect')
def handle_disconnect():
    sid = request.sid
    app.logger.debug(f"Client disconnected (SID: {sid})")
    if sid in active_ssh_sessions:
        client = active_ssh_sessions[sid]['client']
        client.close()
        del active_ssh_sessions[sid]
        app.logger.debug(f"SSH session closed for SID: {sid}")
    
    # SSH接続状態をクリーンアップ
    if sid in ssh_connection_status:
        del ssh_connection_status[sid]

# --- SSH Options Parser ---
def parse_ssh_options(ssh_options_string):
    """
    SSH オプション文字列を解析して、Paramiko の connect() に渡す辞書を生成
    例: "-oHostKeyAlgorithms=+ssh-rsa -oPubkeyAcceptedAlgorithms=+ssh-rsa"
    """
    if not ssh_options_string:
        return {}
    
    connect_kwargs = {}
    
    # SSH オプションを分割して解析
    options = ssh_options_string.strip().split()
    
    for option in options:
        option = option.strip()
        if not option:
            continue
            
        # -o で始まるオプションを処理
        if option.startswith('-o'):
            # -oKEY=VALUE 形式から KEY=VALUE を抽出
            key_value = option[2:]  # -o を除去
            if '=' in key_value:
                key, value = key_value.split('=', 1)
                key = key.lower()
                
                # よく使用される SSH オプションを Paramiko パラメータにマッピング
                if key == 'hostkeyalgorithms':
                    # HostKeyAlgorithms の処理
                    if value.startswith('+'):
                        # +ssh-rsa のように + で始まる場合は既存に追加
                        algorithms = value[1:].split(',')
                        # Paramiko では disabled_algorithms を使用して制御
                        if 'disabled_algorithms' not in connect_kwargs:
                            connect_kwargs['disabled_algorithms'] = {}
                        if 'keys' not in connect_kwargs['disabled_algorithms']:
                            connect_kwargs['disabled_algorithms']['keys'] = []
                        # ssh-rsa を無効化リストから除外（有効化）
                        for alg in algorithms:
                            if alg in connect_kwargs['disabled_algorithms']['keys']:
                                connect_kwargs['disabled_algorithms']['keys'].remove(alg)
                    else:
                        # 直接指定の場合
                        algorithms = value.split(',')
                        connect_kwargs['disabled_algorithms'] = {'keys': []}
                        # 指定されていないアルゴリズムを無効化
                        all_algorithms = ['ssh-rsa', 'rsa-sha2-256', 'rsa-sha2-512', 'ssh-ed25519', 'ecdsa-sha2-nistp256', 'ecdsa-sha2-nistp384', 'ecdsa-sha2-nistp521']
                        for alg in all_algorithms:
                            if alg not in algorithms:
                                connect_kwargs['disabled_algorithms']['keys'].append(alg)
                
                elif key == 'pubkeyacceptedalgorithms':
                    # PubkeyAcceptedAlgorithms の処理（HostKeyAlgorithms と同様）
                    if value.startswith('+'):
                        algorithms = value[1:].split(',')
                        if 'disabled_algorithms' not in connect_kwargs:
                            connect_kwargs['disabled_algorithms'] = {}
                        if 'pubkeys' not in connect_kwargs['disabled_algorithms']:
                            connect_kwargs['disabled_algorithms']['pubkeys'] = []
                        for alg in algorithms:
                            if alg in connect_kwargs['disabled_algorithms']['pubkeys']:
                                connect_kwargs['disabled_algorithms']['pubkeys'].remove(alg)
                    else:
                        algorithms = value.split(',')
                        if 'disabled_algorithms' not in connect_kwargs:
                            connect_kwargs['disabled_algorithms'] = {}
                        connect_kwargs['disabled_algorithms']['pubkeys'] = []
                        all_algorithms = ['ssh-rsa', 'rsa-sha2-256', 'rsa-sha2-512', 'ssh-ed25519', 'ecdsa-sha2-nistp256', 'ecdsa-sha2-nistp384', 'ecdsa-sha2-nistp521']
                        for alg in all_algorithms:
                            if alg not in algorithms:
                                connect_kwargs['disabled_algorithms']['pubkeys'].append(alg)
                
                elif key == 'ciphers':
                    # Ciphers の処理
                    if value.startswith('+'):
                        ciphers = value[1:].split(',')
                        if 'disabled_algorithms' not in connect_kwargs:
                            connect_kwargs['disabled_algorithms'] = {}
                        if 'ciphers' not in connect_kwargs['disabled_algorithms']:
                            connect_kwargs['disabled_algorithms']['ciphers'] = []
                        for cipher in ciphers:
                            if cipher in connect_kwargs['disabled_algorithms']['ciphers']:
                                connect_kwargs['disabled_algorithms']['ciphers'].remove(cipher)
                
                elif key == 'stricthostkeychecking':
                    # StrictHostKeyChecking の処理
                    if value.lower() in ['no', 'false', '0']:
                        # これは既に client.set_missing_host_key_policy(paramiko.AutoAddPolicy()) で処理済み
                        pass
                
                elif key == 'userknownhostsfile':
                    # UserKnownHostsFile の処理
                    if value.lower() == '/dev/null':
                        # 既知ホスト確認を無効化（AutoAddPolicy で対応済み）
                        pass
                
                # その他のオプションはログに記録するが、無視
                else:
                    app.logger.debug(f"SSH option '{key}={value}' is not supported and will be ignored.")
    
    app.logger.debug(f"Parsed SSH options: {connect_kwargs}")
    return connect_kwargs

def organize_servers_hierarchy(servers):
    """
    サーバーを階層構造に整理する
    親ノード -> 子VM の順序で並び替え、親がない場合は最初に配置
    """
    # サーバーをIDでインデックス化
    servers_by_id = {server['id']: server for server in servers}
    
    # 親子関係を構築
    for server in servers:
        server['children'] = []
        parent_id = server.get('parent_id')
        if parent_id and parent_id in servers_by_id:
            server['parent'] = servers_by_id[parent_id]
        else:
            server['parent'] = None

    # 子サーバーを親に追加
    for server in servers:
        parent_id = server.get('parent_id')
        if parent_id and parent_id in servers_by_id:
            servers_by_id[parent_id]['children'].append(server)
    
    # 階層構造で整理（親 -> 子の順序）
    organized = []
    processed = set()
    
    # まず親サーバー（parent_idがないもの）を追加
    for server in servers:
        if not server.get('parent_id') and server['id'] not in processed:
            organized.append(server)
            processed.add(server['id'])
            
            # 子サーバーを追加
            for child in server.get('children', []):
                if child['id'] not in processed:
                    organized.append(child)
                    processed.add(child['id'])
    
    # 親が見つからない子サーバーがあれば最後に追加
    for server in servers:
        if server['id'] not in processed:
            organized.append(server)
            processed.add(server['id'])
    
    return organized

# --- Multi-Tab SSH Handlers ---
def update_multitab_ssh_status(tab_id, status, message, progress):
    """マルチタブSSH接続の状態を更新"""
    socketio.emit('ssh_status_update', {
        'tab_id': tab_id,
        'status': status,
        'message': message,
        'progress': progress
    })

def _multitab_ssh_read_loop(channel, tab_id):
    """
    マルチタブSSH用の読み取りループ（Paramikoベースの SSH接続タイムアウト 監視付き）
    
    ※重要な区別※
    - SSH接続タイムアウト: サーバー側でSSH接続自体が切断された時の検出（ここで処理）
    - クライアント都合タイムアウト: フロントエンド側で30分間無操作時の切断（フロントエンドで処理）
    """
    consecutive_empty_reads = 0
    max_empty_reads = 50  # 0.5秒 * 50 = 25秒で SSH接続タイムアウト 判定
    read_timeout = 25.0  # 25秒でread操作をタイムアウト
    
    app.logger.debug(f"Starting SSH read loop for tab {tab_id} (monitoring SSH connection timeout)")
    
    try:
        while not channel.closed:
            try:
                if channel.recv_ready():
                    # データが利用可能な場合
                    try:
                        channel.settimeout(read_timeout)  # read操作にタイムアウトを設定
                        output = channel.recv(4096).decode('utf-8', errors='ignore')
                        if output:
                            consecutive_empty_reads = 0  # データを受信したのでカウンターをリセット
                            socketio.emit('ssh_output', {
                                'tab_id': tab_id,
                                'output': output
                            })
                        else:
                            consecutive_empty_reads += 1
                            app.logger.debug(f"Empty read #{consecutive_empty_reads} for tab {tab_id}")
                    except socket.timeout:
                        app.logger.warning(f"SSH read timeout for tab {tab_id}")
                        consecutive_empty_reads += 10  # タイムアウトが発生した場合は大きくカウントを増やす
                    except Exception as e:
                        app.logger.error(f"SSH read error for tab {tab_id}: {e}")
                        break
                else:
                    # データが利用可能でない場合
                    consecutive_empty_reads += 1
                    
                # 連続して空読みが続く場合、接続の健全性をチェック
                if consecutive_empty_reads >= max_empty_reads:
                    app.logger.warning(f"Too many consecutive empty reads for tab {tab_id}, checking connection health")
                    
                    # Paramikoの内部状態をチェック
                    transport = channel.get_transport()
                    if transport is None or not transport.is_active():
                        app.logger.warning(f"SSH transport is not active for tab {tab_id}")
                        break
                    
                    # ping的なメッセージを送信して接続をテスト
                    try:
                        # ゼロバイトの送信を試す（接続テスト）
                        channel.send('')
                        consecutive_empty_reads = 0  # 成功したらリセット
                        app.logger.debug(f"Connection test successful for tab {tab_id}")
                    except Exception as e:
                        app.logger.warning(f"Connection test failed for tab {tab_id}: {e}")
                        break
                
                if channel.closed:
                    break
                    
                time.sleep(0.01)
                
            except Exception as e:
                app.logger.error(f"Unexpected error in SSH read loop for tab {tab_id}: {e}")
                break
                
    except Exception as e:
        app.logger.error(f"Fatal error in SSH read loop for tab {tab_id}: {e}")
    finally:
        app.logger.debug(f"SSH read loop ended for tab {tab_id}")
        
        # 接続が閉じられた場合、クライアントに通知
        if tab_id in multitab_ssh_sessions:
            try:
                socketio.emit('ssh_connection_closed', {
                    'tab_id': tab_id,
                    'message': 'SSH接続が切断されました'
                })
                app.logger.debug(f"Sent connection closed event for tab {tab_id}")
            except Exception as e:
                app.logger.error(f"Error sending connection closed event for tab {tab_id}: {e}")

@socketio.on('start_ssh_tab')
def handle_start_ssh_tab(data):
    """マルチタブSSH接続を開始"""
    if not _is_authenticated():
        emit('ssh_output', {'tab_id': data.get('tab_id'), 'output': 'Authentication required.\r\n'})
        return
    
    server_id = data.get('server_id')
    tab_id = data.get('tab_id')
    sid = request.sid
    
    if not tab_id:
        emit('ssh_output', {'tab_id': tab_id, 'output': 'Error: Tab ID is required.\r\n'})
        return
    
    # 初期化: 接続開始状態
    update_multitab_ssh_status(tab_id, 'initializing', 'SSH接続を開始しています...', 10)
    
    app.logger.debug(f"Received start_ssh_tab event. Tab ID: {tab_id}, Server ID: {server_id}, SID: {sid}")
    
    config = load_servers_config()
    server_info = next((s for s in config.get('servers', []) if s['id'] == server_id), None)
    
    if not server_info:
        app.logger.debug(f"Server '{server_id}' not found.")
        update_multitab_ssh_status(tab_id, 'error', f"サーバー '{server_id}' が見つかりません", 0)
        emit('ssh_output', {'tab_id': tab_id, 'output': f"Error: Server '{server_id}' not found in configuration.\r\n"})
        return
    
    ssh_connectable_types = ['node', 'virtual_machine', 'network_device', 'kvm']
    if server_info.get('type') not in ssh_connectable_types:
        app.logger.debug(f"Server '{server_id}' is not an SSH connectable type server.")
        update_multitab_ssh_status(tab_id, 'error', f"サーバー '{server_id}' はSSH接続できません", 0)
        emit('ssh_output', {'tab_id': tab_id, 'output': f"Error: Server '{server_id}' is not an SSH connectable type server.\r\n"})
        return
    
    # サーバー情報取得完了: 20%
    update_multitab_ssh_status(tab_id, 'connecting', 'サーバー情報を取得しました', 20)
    
    try:
        client = paramiko.SSHClient()
        client.load_system_host_keys()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        
        hostname = server_info.get('host')
        port = server_info.get('port', 22)
        username = server_info.get('username')
        password = server_info.get('password')
        ssh_key_id = server_info.get('ssh_key_id')
        ssh_options = server_info.get('ssh_options', '')
        
        # SSH接続準備完了: 30%
        update_multitab_ssh_status(tab_id, 'connecting', f'{hostname}:{port} に接続中...', 30)
        
        # SSH オプションを解析
        ssh_connect_kwargs = parse_ssh_options(ssh_options)
        app.logger.debug(f"SSH connection will use additional options: {ssh_connect_kwargs}")
        
        if ssh_key_id:
            # SSH鍵認証の準備: 40%
            update_multitab_ssh_status(tab_id, 'authenticating', 'SSH鍵を準備中...', 40)
            
            ssh_keys_config = load_ssh_keys_config()
            ssh_key_info = next((k for k in ssh_keys_config.get('ssh_keys', []) if k['id'] == ssh_key_id), None)
            app.logger.debug(f"Attempting to load key '{ssh_key_id}' with info: {ssh_key_info}")
            
            if ssh_key_info and os.path.exists(os.path.expanduser(ssh_key_info['path'])):
                try:
                    key_path_expanded = os.path.expanduser(ssh_key_info['path'])
                    app.logger.debug(f"Expanded key path: {key_path_expanded}")
                    
                    # SSH鍵の読み込み: 50%
                    update_multitab_ssh_status(tab_id, 'authenticating', f"SSH鍵 '{ssh_key_info['name']}' を読み込み中...", 50)
                    
                    try:
                        key = paramiko.RSAKey.from_private_key_file(key_path_expanded)
                    except paramiko.SSHException as e:
                        app.logger.debug(f"RSAKey load failed: {e}. Attempting Ed25519Key.")
                        try:
                            key = paramiko.Ed25519Key(filename=key_path_expanded)
                        except Exception as ed25519_e:
                            app.logger.debug(f"Ed25519Key load failed: {ed25519_e}.")
                            update_multitab_ssh_status(tab_id, 'error', f"SSH鍵の読み込みに失敗しました", 0)
                            emit('ssh_output', {'tab_id': tab_id, 'output': f"Error loading SSH Key '{ssh_key_info['name']}': {e} (RSA) / {ed25519_e} (Ed25519)\r\n"})
                            client.close()
                            return
                    
                    # SSH鍵認証で接続: 70%
                    update_multitab_ssh_status(tab_id, 'authenticating', f"SSH鍵で認証中...", 70)
                    
                    # 基本的な接続パラメータ
                    connect_params = {
                        'hostname': hostname,
                        'port': port,
                        'username': username,
                        'pkey': key,
                        'timeout': 10,
                        'look_for_keys': False,
                        'allow_agent': False
                    }
                    
                    # SSH オプションから得られた追加パラメータをマージ
                    connect_params.update(ssh_connect_kwargs)
                    
                    client.connect(**connect_params)
                    app.logger.debug(f"SSH connected to {hostname} using key: {ssh_key_info['name']}")
                except paramiko.PasswordRequiredException:
                    app.logger.debug(f"Key '{ssh_key_info['name']}' requires passphrase.")
                    update_multitab_ssh_status(tab_id, 'error', f"SSH鍵 '{ssh_key_info['name']}' にパスフレーズが必要です", 0)
                    emit('ssh_output', {'tab_id': tab_id, 'output': f"Error: SSH Key '{ssh_key_info['name']}' requires a passphrase.\r\n"})
                    client.close()
                    return
                except Exception as e:
                    app.logger.debug(f"Error loading SSH Key '{ssh_key_info['name']}': {e}")
                    update_multitab_ssh_status(tab_id, 'error', f"SSH鍵 '{ssh_key_info['name']}' の読み込みエラー", 0)
                    emit('ssh_output', {'tab_id': tab_id, 'output': f"Error loading SSH Key '{ssh_key_info['name']}': {e}\r\n"})
                    client.close()
                    return
            else:
                app.logger.debug(f"SSH Key '{ssh_key_id}' not found or path invalid (info: {ssh_key_info}).")
                update_multitab_ssh_status(tab_id, 'error', f"SSH鍵 '{ssh_key_id}' が見つかりません", 0)
                emit('ssh_output', {'tab_id': tab_id, 'output': f"Error: SSH Key '{ssh_key_id}' not found or path invalid.\r\n"})
                client.close()
                return
        elif password:
            # パスワード認証: 50%
            update_multitab_ssh_status(tab_id, 'authenticating', 'パスワードで認証中...', 50)
            
            app.logger.debug(f"Attempting password authentication for {hostname}")
            # 基本的な接続パラメータ
            connect_params = {
                'hostname': hostname,
                'port': port,
                'username': username,
                'password': password,
                'timeout': 10
            }
            
            # SSH オプションから得られた追加パラメータをマージ
            connect_params.update(ssh_connect_kwargs)
            
            client.connect(**connect_params)
            app.logger.debug(f"SSH connected to {hostname} using password.")
        else:
            app.logger.debug(f"No valid authentication method provided.")
            update_multitab_ssh_status(tab_id, 'error', f"認証情報が提供されていません", 0)
            emit('ssh_output', {'tab_id': tab_id, 'output': "Error: No valid authentication method (password or SSH key) provided.\r\n"})
            client.close()
            return
        
        # シェルセッション作成: 90%
        update_multitab_ssh_status(tab_id, 'connecting', 'シェルセッションを作成中...', 90)
        
        chan = client.invoke_shell()
        chan.settimeout(0.0)
        
        # シェル作成後の健全性チェック
        time.sleep(0.1)  # 少し待ってからチェック
        if chan.closed:
            raise Exception("Shell channel was closed immediately after creation")
        
        # マルチタブセッション管理に追加
        multitab_ssh_sessions[tab_id] = {
            'client': client,
            'channel': chan,
            'sid': sid,
            'server_info': server_info
        }
        
        # 接続完了: 100%
        update_multitab_ssh_status(tab_id, 'connected', f'{hostname} に接続完了', 100)
        
        emit('ssh_output', {'tab_id': tab_id, 'output': f"Successfully connected to {hostname}.\r\n"})
        threading.Thread(target=_multitab_ssh_read_loop, args=(chan, tab_id), daemon=True).start()
        
    except paramiko.AuthenticationException:
        app.logger.debug(f"Authentication failed for {hostname}.")
        update_multitab_ssh_status(tab_id, 'error', f"認証に失敗しました", 0)
        emit('ssh_output', {'tab_id': tab_id, 'output': "Authentication failed. Please check your credentials.\r\n"})
    except paramiko.SSHException as e:
        app.logger.debug(f"SSH error for {hostname}: {e}")
        update_multitab_ssh_status(tab_id, 'error', f"SSH接続エラー: {e}", 0)
        emit('ssh_output', {'tab_id': tab_id, 'output': f"SSH error: {e}\r\n"})
    except Exception as e:
        app.logger.debug(f"General connection error for {hostname}: {e}")
        update_multitab_ssh_status(tab_id, 'error', f"接続エラー: {e}", 0)
        emit('ssh_output', {'tab_id': tab_id, 'output': f"Connection error: {e}\r\n"})

@socketio.on('ssh_input')
def handle_ssh_input(data):
    """SSH入力処理（既存の単一タブとマルチタブの両方に対応）"""
    if not _is_authenticated():
        return
    sid = request.sid
    tab_id = data.get('tab_id')
    
    if tab_id:
        # マルチタブモード
        if tab_id in multitab_ssh_sessions:
            chan = multitab_ssh_sessions[tab_id]['channel']
            chan.send(data['input'])
    else:
        # 既存の単一タブモード
        if sid in active_ssh_sessions:
            chan = active_ssh_sessions[sid]['channel']
            chan.send(data['input'])

@socketio.on('resize_terminal')
def handle_resize_terminal(data):
    """ターミナルリサイズ処理（既存の単一タブとマルチタブの両方に対応）"""
    if not _is_authenticated():
        return
    sid = request.sid
    tab_id = data.get('tab_id')
    cols = data.get('cols', 80)
    rows = data.get('rows', 24)
    
    if tab_id:
        # マルチタブモード
        if tab_id in multitab_ssh_sessions:
            chan = multitab_ssh_sessions[tab_id]['channel']
            chan.resize_pty(cols, rows)
    else:
        # 既存の単一タブモード
        if sid in active_ssh_sessions:
            chan = active_ssh_sessions[sid]['channel']
            chan.resize_pty(cols, rows)

@socketio.on('close_ssh_tab')
def handle_close_ssh_tab(data):
    """特定のSSHタブを閉じる"""
    if not _is_authenticated():
        return
    
    tab_id = data.get('tab_id')
    if not tab_id:
        return
    
    app.logger.debug(f"Closing SSH tab: {tab_id}")
    
    if tab_id in multitab_ssh_sessions:
        session_info = multitab_ssh_sessions[tab_id]
        client = session_info['client']
        
        try:
            client.close()
            app.logger.debug(f"SSH client closed for tab: {tab_id}")
        except Exception as e:
            app.logger.debug(f"Error closing SSH client for tab {tab_id}: {e}")
        
        del multitab_ssh_sessions[tab_id]
        app.logger.debug(f"SSH tab session removed: {tab_id}")

@socketio.on('disconnect')
def handle_disconnect():
    """クライアント切断処理（既存の単一タブとマルチタブの両方に対応）"""
    sid = request.sid
    app.logger.debug(f"Client disconnected (SID: {sid})")
    
    # 既存の単一タブセッションの処理
    if sid in active_ssh_sessions:
        client = active_ssh_sessions[sid]['client']
        client.close()
        del active_ssh_sessions[sid]
        app.logger.debug(f"SSH session closed for SID: {sid}")
    
    # SSH接続状態をクリーンアップ
    if sid in ssh_connection_status:
        del ssh_connection_status[sid]
    
    # マルチタブセッションの処理
    tabs_to_close = []
    for tab_id, session_info in multitab_ssh_sessions.items():
        if session_info['sid'] == sid:
            tabs_to_close.append(tab_id)
    
    for tab_id in tabs_to_close:
        try:
            client = multitab_ssh_sessions[tab_id]['client']
            client.close()
            del multitab_ssh_sessions[tab_id]
            app.logger.debug(f"Multi-tab SSH session closed for tab: {tab_id}")
        except Exception as e:
            app.logger.debug(f"Error closing multi-tab SSH session {tab_id}: {e}")

if __name__ == '__main__':
    # Extra import のスケジュール開始
    threading.Thread(target=schedule_extra_import, daemon=True).start()
    
    # Ping monitoring のスケジュール開始
    threading.Thread(target=run_ping_monitoring, daemon=True).start()
    
    # アプリケーション起動
    socketio.run(app, host='0.0.0.0', port=5001, debug=False, allow_unsafe_werkzeug=True)
