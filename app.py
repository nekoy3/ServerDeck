from flask import Flask, render_template, request, jsonify
import yaml
import os

app = Flask(__name__)

CONFIG_DIR = os.path.join(os.path.dirname(__file__), 'config')
SERVERS_CONFIG_PATH = os.path.join(CONFIG_DIR, 'servers.yaml')

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

@app.route('/')
def index():
    config = load_servers_config()
    servers = config.get('servers', [])
    return render_template('index.html', servers=servers)

@app.route('/config')
def config_page():
    # This route now serves the content for the modal
    return render_template('config_modal_content.html')

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

if __name__ == '__main__':
    app.run(host='0.0.0.0', debug=True, port=5001)
