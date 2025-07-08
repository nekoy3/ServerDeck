from flask import Flask, render_template
import yaml
import os

app = Flask(__name__)

CONFIG_PATH = os.path.join(os.path.dirname(__file__), 'config', 'servers.yaml')

def load_servers_config():
    if os.path.exists(CONFIG_PATH):
        with open(CONFIG_PATH, 'r') as f:
            return yaml.safe_load(f)
    return {"servers": []}

@app.route('/')
def index():
    config = load_servers_config()
    servers = config.get('servers', [])
    return render_template('index.html', servers=servers)

@app.route('/config')
def config_page():
    # ここにconfig.yamlの読み書きロジックを実装予定
    return "Config Page - Under Construction"

if __name__ == '__main__':
    app.run(debug=True)
