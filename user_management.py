import yaml
import os
import getpass
from werkzeug.security import generate_password_hash, check_password_hash
import argparse

CONFIG_DIR = os.path.join(os.path.dirname(__file__), 'config')
USERS_CONFIG_PATH = os.path.join(CONFIG_DIR, 'users.yaml')

def load_users_config():
    """Loads the users configuration file."""
    os.makedirs(CONFIG_DIR, exist_ok=True)
    if os.path.exists(USERS_CONFIG_PATH):
        with open(USERS_CONFIG_PATH, 'r') as f:
            return yaml.safe_load(f) or {"users": []}
    return {"users": []}

def save_users_config(config_data):
    """Saves the users configuration file."""
    with open(USERS_CONFIG_PATH, 'w') as f:
        yaml.dump(config_data, f, indent=2, sort_keys=False)

def add_user():
    """Interactively adds a new user to the users.yaml file."""
    print("Adding a new user...")
    username = input("Enter username: ")
    
    config = load_users_config()
    users = config.get('users', [])

    # Check if user already exists
    if any(u['username'] == username for u in users):
        print(f"Error: User '{username}' already exists.")
        return

    while True:
        password = getpass.getpass("Enter password: ")
        password_confirm = getpass.getpass("Confirm password: ")
        if password == password_confirm:
            break
        else:
            print("Passwords do not match. Please try again.")

    hashed_password = generate_password_hash(password)
    
    new_user = {
        'username': username,
        'password_hash': hashed_password
    }
    
    users.append(new_user)
    config['users'] = users
    save_users_config(config)
    
    print(f"User '{username}' added successfully to {USERS_CONFIG_PATH}")

def main():
    parser = argparse.ArgumentParser(description="ServerDeck User Management")
    parser.add_argument('action', choices=['adduser'], help="The action to perform (e.g., 'adduser')")
    
    args = parser.parse_args()
    
    if args.action == 'adduser':
        add_user()

if __name__ == '__main__':
    main()
