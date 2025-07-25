import yaml
import os
import shutil
from datetime import datetime

CONFIG_DIR = os.path.join(os.path.dirname(__file__), 'config')
SERVERS_CONFIG_PATH = os.path.join(CONFIG_DIR, 'servers.yaml')
SSH_KEYS_CONFIG_PATH = os.path.join(CONFIG_DIR, 'ssh_keys.yaml')
USERS_CONFIG_PATH = os.path.join(CONFIG_DIR, 'users.yaml')
EXTRA_IMPORT_CONFIG_PATH = os.path.join(CONFIG_DIR, 'extra_import.yaml')
UPLOAD_FOLDER = os.path.join(CONFIG_DIR, 'uploaded_ssh_keys')
BACKUP_DIR = os.path.join(CONFIG_DIR, 'backup')

# ディレクトリの作成
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(BACKUP_DIR, exist_ok=True)

def backup_config_file(file_path, logger=None):
    """設定ファイルのバックアップを作成"""
    try:
        if not os.path.exists(file_path):
            if logger:
                logger.warning(f"Backup failed: Source file does not exist: {file_path}")
            return

        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        file_name = os.path.basename(file_path)
        base_name, ext = os.path.splitext(file_name)
        backup_file_name = f"{base_name.split('_')[0]}_{timestamp}{ext}"
        backup_path = os.path.join(BACKUP_DIR, backup_file_name)

        shutil.copy2(file_path, backup_path)
        if logger:
            logger.info(f"Backed up {file_name} to {backup_path}")

        # 古いバックアップを削除（5個まで保持）
        all_backups = []
        for f in os.listdir(BACKUP_DIR):
            if f.startswith(base_name.split('_')[0]) and f.endswith(ext):
                all_backups.append(os.path.join(BACKUP_DIR, f))

        all_backups.sort(key=os.path.getmtime)

        while len(all_backups) > 5:
            oldest_backup = all_backups.pop(0)
            os.remove(oldest_backup)
            if logger:
                logger.info(f"Removed old backup: {oldest_backup}")

    except Exception as e:
        if logger:
            logger.error(f"Error backing up {file_path}: {e}")

def load_servers_config():
    """サーバー設定の読み込み"""
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

def save_servers_config(config_data, logger=None):
    """サーバー設定の保存"""
    os.makedirs(CONFIG_DIR, exist_ok=True)
    with open(SERVERS_CONFIG_PATH, 'w') as f:
        yaml.dump(config_data, f, indent=2, sort_keys=False)
    backup_config_file(SERVERS_CONFIG_PATH, logger)

def load_ssh_keys_config():
    """SSHキー設定の読み込み"""
    if os.path.exists(SSH_KEYS_CONFIG_PATH):
        with open(SSH_KEYS_CONFIG_PATH, 'r') as f:
            return yaml.safe_load(f) or {"ssh_keys": []}
    return {"ssh_keys": []}

def save_ssh_keys_config(config_data, logger=None):
    """SSHキー設定の保存"""
    os.makedirs(CONFIG_DIR, exist_ok=True)
    with open(SSH_KEYS_CONFIG_PATH, 'w') as f:
        yaml.dump(config_data, f, indent=2, sort_keys=False)
    backup_config_file(SSH_KEYS_CONFIG_PATH, logger)

def load_users_config():
    """ユーザー設定の読み込み"""
    if os.path.exists(USERS_CONFIG_PATH):
        with open(USERS_CONFIG_PATH, 'r') as f:
            config = yaml.safe_load(f) or {"users": []}
            return config
    return {"users": []}

def save_users_config(config_data):
    """ユーザー設定の保存"""
    os.makedirs(CONFIG_DIR, exist_ok=True)
    with open(USERS_CONFIG_PATH, 'w') as f:
        yaml.dump(config_data, f, indent=2, sort_keys=False)

def load_extra_import_config():
    """Extra Import設定の読み込み"""
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
    """Extra Import設定の保存"""
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
