# ServerDeck Project Overview

## Project Name
ServerDeck

## Project Goal
自宅サーバー群を管理するためのWebアプリケーション。

## Key Features
- **UIでのサーバーアクセス**: 各サーバーへのアクセスをブラウザ上で可能にするUI。
- **動的なサーバー追加**: YAMLファイルなどを用いてサーバー情報を動的に追加・管理。
- **ブラウザ上でのSSH接続**: WebベースのSSHクライアント機能を提供。

## Technology Stack (Proposed)
- **Backend**: Python (Flask)
- **Frontend**: HTML, CSS, JavaScript (具体的なフレームワークは未定、必要に応じて検討)
- **Server Management**: YAML for configuration, potentially Paramiko for SSH.

## Development Environment Setup
(To be added later)

## Build, Test, Lint Commands
(To be added later)

## Coding Conventions
(To be added later)

## Important Files/Directories
- `app.py`: Main Flask application file.
- `templates/`: HTML templates.
- `static/`: CSS, JavaScript, images.
- `config/servers.yaml`: Server configuration file.

## General Development Workflow
(To be added later)

## Known Issues/Notes
- SSH接続機能の実装にはセキュリティ面での考慮が重要。
- 動的なサーバー追加・管理の仕組みをどのように設計するかが鍵。

## Initial Setup after Cloning Repository

To set up and run the ServerDeck application after cloning the repository, follow these steps:

1.  **Navigate to the project directory:**
    ```bash
    cd ServerDeck
    ```

2.  **Create a Python virtual environment:**
    ```bash
    python3 -m venv venv
    ```

3.  **Activate the virtual environment:**
    ```bash
    source venv/bin/activate
    ```

4.  **Install required Python packages:**
    ```bash
    pip install Flask PyYAML
    ```

5.  **Run the Flask application:**
    ```bash
    python app.py
    ```
    The application will typically run on `http://127.0.0.1:5000/`.

6.  **Deactivate the virtual environment (when done):**
    ```bash
    deactivate
    ```