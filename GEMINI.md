# ServerDeck プロジェクト概要

## プロジェクト名
ServerDeck

## プロジェクトの目的
自宅サーバー群を管理するためのWebアプリケーション。

## 主要機能
- **UIでのサーバーアクセス**: 各サーバーへのアクセスをブラウザ上で可能にするUI。
- **動的なサーバー追加**: YAMLファイルなどを用いてサーバー情報を動的に追加・管理。
- **ブラウザ上でのSSH接続**: WebベースのSSHクライアント機能を提供。

## 技術スタック (提案)
- **バックエンド**: Python (Flask)
- **フロントエンド**: HTML, CSS, JavaScript (具体的なフレームワークは未定、必要に応じて検討)
- **サーバー管理**: YAMLによる設定、SSHにはParamikoを使用する可能性あり。

## 開発環境セットアップ

本プロジェクトの開発環境は、主にDockerコンテナを使用して構築されます。これにより、環境依存の問題を最小限に抑え、開発者間で一貫した環境を提供します。

1.  **Dockerのインストール**: Docker Desktop (またはDocker Engine) がシステムにインストールされていることを確認してください。
2.  **リポジトリのクローン**: `git clone [リポジトリURL]` でプロジェクトをローカルにクローンします。
3.  **Dockerコンテナの起動**: 「Dockerを使用した初期セットアップと実行」セクションの手順に従って、アプリケーションコンテナを起動します。

## ビルド、テスト、Lintコマンド

### ビルド

アプリケーションのビルドは、Dockerイメージのビルドによって行われます。詳細については、「Dockerを使用した初期セットアップと実行」セクションの「Dockerイメージのビルド」を参照してください。

### テスト
(後で追加)

### Lint
(後で追加)

## コーディング規約
(後で追加)

## 重要なファイル/ディレクトリ
- `app.py`: メインのFlaskアプリケーションファイル。
- `templates/`: HTMLテンプレート。
- `static/`: CSS, JavaScript, 画像ファイル。
- `config/servers.yaml`: サーバー設定ファイル。
- `Dockerfile`: Dockerコンテナのビルド定義ファイル。
- `requirements.txt`: Pythonの依存関係リスト。

## 一般的な開発ワークフロー

本プロジェクトでは、以下のGitワークフローに従って開発を進めます。詳細については「Gitワークフロー」セクションを参照してください。

## Gitワークフロー

本プロジェクトでは、`main`ブランチをメインの開発ブランチとして使用します。`master`ブランチは使用しません。

### コミットの手順

1.  **変更のステージング**: 作業ディレクトリでの変更をステージングエリアに追加します。
    ```bash
    git add <ファイル名> # 特定のファイルを追加
    git add .           # すべての変更を追加
    ```

2.  **変更のコミット**: ステージングされた変更をコミットします。コミットメッセージは、変更内容を簡潔かつ明確に記述してください。
    ```bash
    git commit -m "feat: 新機能の追加" # 新機能
    git commit -m "fix: バグ修正"     # バグ修正
    git commit -m "docs: ドキュメント更新" # ドキュメント更新
    ```

3.  **変更のプッシュ**: コミットした変更をリモートリポジトリの`main`ブランチにプッシュします。
    ```bash
    git push origin main
    ```

### 最新の変更の取得

リモートリポジトリの`main`ブランチから最新の変更を取得するには、以下のコマンドを使用します。

```bash
git pull origin main
```

### ブランチの作成と切り替え

新機能の開発やバグ修正を行う際は、`main`ブランチから新しいブランチを作成し、そのブランチで作業を進めることを推奨します。

1.  **新しいブランチの作成と切り替え**: 
    ```bash
    git checkout -b feature/your-feature-name
    ```

2.  **ブランチの切り替え**: 
    ```bash
    git checkout main
    ```

### リモートブランチの追跡設定の解除

もし、誤って`master`ブランチを追跡する設定になってしまった場合は、以下のコマンドで追跡設定を解除できます。

```bash
git branch --unset-upstream
```

## 既知の問題/注意事項
- SSH接続機能の実装にはセキュリティ面での考慮が重要。
- 動的なサーバー追加・管理の仕組みをどのように設計するかが鍵。

### SSHキーの安全な管理 (Docker環境)

SSH秘密鍵をDockerイメージに直接含めることは、セキュリティ上のリスクを伴います。秘密鍵が漏洩した場合、サーバーへの不正アクセスにつながる可能性があります。ServerDeckがSSHキー認証で接続を行う場合、秘密鍵へのアクセスが必要です。

より安全にSSHキーを管理するためには、Dockerの**バインドマウント**機能を使用することを推奨します。これにより、ホストマシン上の秘密鍵ファイルをコンテナ内部にマウントし、秘密鍵をイメージに含めることなくコンテナからアクセスできるようになります。

**手順:**

1.  **ホストマシン上にSSH秘密鍵を配置する**: 
    通常、SSH秘密鍵は`~/.ssh/`ディレクトリに保存されています。例: `/home/user/.ssh/id_rsa`

2.  **`config/ssh_keys.yaml`にコンテナ内のパスを登録する**: 
    ServerDeckのSSHキー管理画面でSSHキーを登録する際、`パス`の項目には、**コンテナ内部から見た秘密鍵のパス**を指定します。
    例えば、ホストの`/Users/nekoy/.ssh/id_vm_machines`をコンテナの`/root/.ssh/id_vm_machines`にマウントする場合、`config/ssh_keys.yaml`には`/root/.ssh/id_vm_machines`と登録します。

3.  **`docker run`コマンドでバインドマウントを設定する**: 
    コンテナを起動する際に、`-v`オプションを使用してホストの秘密鍵ディレクトリをコンテナ内にマウントします。

    ```bash
    docker run -d -p 5001:5001 \
      -v /Users/nekoy/.ssh:/root/.ssh:ro \
      --name serverdeck-container serverdeck-app
    ```
    *   `/Users/nekoy/.ssh`: ホストマシン上のSSH秘密鍵が保存されているディレクトリの絶対パス。
    *   `/root/.ssh`: コンテナ内部でSSH秘密鍵がマウントされるパス。`paramiko`がデフォルトで`~/.ssh`を探すため、このパスが推奨されます。
    *   `:ro`: 読み取り専用（read-only）でマウントすることを意味し、コンテナがホストのファイルを誤って変更するのを防ぎます。

    **重要**: SSH秘密鍵のパーミッションは`600`（所有者のみ読み書き可能）または`400`（所有者のみ読み取り可能）に設定されている必要があります。これより緩いパーミッションだと、SSH接続が拒否される場合があります。


## Dockerを使用した初期セットアップと実行

リポジトリをクローンした後、Dockerを使用してServerDeckアプリケーションをセットアップし実行するには、以下の手順に従ってください。

1.  **プロジェクトディレクトリへ移動:**
    ```bash
    cd ServerDeck
    ```

2.  **Dockerイメージのビルド:**
    ```bash
    docker build -t serverdeck-app .
    ```
    このコマンドは、現在のディレクトリにある`Dockerfile`に基づいて`serverdeck-app`という名前のDockerイメージをビルドします。

3.  **Dockerコンテナの実行:**
    ```bash
    docker run -d -p 5001:5001 
      -v /path/to/your/ServerDeck/config:/app/config 
      -v /path/to/your/ServerDeck/uploaded_ssh_keys:/app/config/uploaded_ssh_keys 
      --name serverdeck-container serverdeck-app
    ```
    このコマンドは、`serverdeck-app`イメージをデタッチモード(`-d`)で実行し、ホストのポート5001をコンテナのポート5001にマッピング(`-p 5001:5001`)し、ホストの`config`ディレクトリと`uploaded_ssh_keys`ディレクトリをコンテナにマウントします。コンテナに`serverdeck-container`という名前を付けます。

    アプリケーションは通常、ブラウザで`http://127.0.0.1:5001/`からアクセスできます。

4.  **Dockerコンテナの停止 (完了時):**
    ```bash
    docker stop serverdeck-container
    ```

5.  **Dockerコンテナの削除 (不要になった場合):**
    ```bash
    docker rm serverdeck-container
    ```

## Dockerコンテナの再起動スクリプト

開発中にDockerコンテナを再起動する際に便利なスクリプトを以下に示します。これらのスクリプトは、`ServerDeck`ディレクトリのルートに配置することを想定しています。

### 1. イメージを再ビルドしてコンテナを再起動する (restart_full.sh)

コードの変更（特に`app.py`、`requirements.txt`、`Dockerfile`など）を反映させる必要がある場合に実行します。これにより、新しいDockerイメージがビルドされ、既存のコンテナが削除されて新しいコンテナが起動します。

```bash
#!/bin/bash

echo "Stopping and removing existing Docker container..."
docker stop serverdeck-container && docker rm serverdeck-container

echo "Building new Docker image..."
docker build -t serverdeck-app .

echo "Starting new Docker container..."
docker run -d -p 5001:5001 --name serverdeck-container serverdeck-app

echo "ServerDeck application restarted with new image. Access at http://127.0.0.1:5001/"
```

### 2. ビルド不要でコンテナを再起動する (restart_app.sh)

コードの変更がない場合や、コンテナの再起動のみが必要な場合に実行します。既存のDockerイメージを使用し、コンテナを停止して再起動します。

```bash
#!/bin/bash

echo "Stopping and restarting Docker container..."
docker stop serverdeck-container && docker start serverdeck-container

echo "ServerDeck application restarted. Access at http://127.0.0.1:5001/"
```

**使用方法:**

1.  上記のコードをそれぞれ`restart_full.sh`と`restart_app.sh`という名前で`ServerDeck`ディレクトリに保存します。
2.  実行権限を付与します。
    ```bash
    chmod +x restart_full.sh restart_app.sh
    ```
3.  スクリプトを実行します。
    ```bash
    ./restart_full.sh
    ./restart_app.sh
    ```

## エージェントとのインタラクションガイドライン

エージェント（Gemini）がコードの変更を行った際、必要に応じてDockerコンテナの再ビルドと再起動を自動的に実行します。ユーザーからの明示的な指示は不要です。

## 最近の変更

### 設定ページをモーダル化

設定ページ (`/config`) がメインページ上のモーダルオーバーレイとして表示されるようになりました。
ナビゲーションバーの「Config」リンクをクリックすると、設定コンテンツがBootstrapモーダルに動的に読み込まれ、ページ全体のリロードなしでシームレスなユーザーエクスペリエンスを提供します。

**影響を受けるファイル:**
- `app.py`: `/config`ルートが`config_modal_content.html`をレンダリングするように変更されました。
- `templates/index.html`: Bootstrapモーダル構造が追加され、「Config」リンクがモーダルをトリガーするように更新されました。
- `templates/config_modal_content.html`: モーダルに読み込まれるように設計された、設定ページの実際のコンテンツを含む新しいファイルです。
- `static/js/script.js`: モーダルへの設定コンテンツの動的読み込みと、読み込まれたコンテンツのJavaScriptロジックの再初期化を処理するように更新されました。