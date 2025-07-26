# ServerDeck プロジェクト概要

## プロジェクト名
ServerDeck

## プロジェクトの目的
自宅サーバー群を管理するためのWebアプリケーション。

## 主要機能
- **UIでのサーバーアクセス**: 各サーバーへのアクセスをブラウザ上で可能にするUI。
- **動的なサーバー追加**: YAMLファイルなどを用いてサーバー情報を動的に追加・管理。
- **ブラウザ上でのSSH接続**: WebベースのSSHクライアント機能を提供。
- **SSH接続オプション**: ネットワーク機器や古いシステムとの接続に対応した、柔軟なSSHオプション設定。

## 技術スタック (提案)
- **バックエンド**: Python (Flask)
- **フロントエンド**: HTML, CSS, JavaScript (具体的なフレームワークは未定、必要に応じて検討)
- **サーバー管理**: YAMLによる設定、SSHにはParamikoを使用する可能性あり。

## 開発環境セットアップ

本プロジェクトの開発環境は、主にDockerコンテナを使用して構築されます。これにより、環境依存の問題を最小限に抑え、開発者間で一貫した環境を提供します。

1.  **Dockerのインストール**: Docker Desktop (またはDocker Engine) がシステムにインストールされていることを確認してください。
2.  **リポジトリのクローン**: `git clone [リポジトリURL]` でプロジェクトをローカルにクローンします。
3.  **Dockerコンテナの起動**: 「Dockerを使用した初期セットアップと実行」セクションの手順に従って、アプリケーションコンテナを起動します。

### Python環境に関する注意事項

`user_management.py`のようなスクリプトをホストマシン上で直接実行する場合、`venv`などの仮想環境を利用することが推奨されます。

ライブラリをインストールする際は、`pip install`の代わりに`python3 -m pip install`を使用してください。これにより、システムに複数のPythonバージョンが存在する場合でも、意図した`python3`に関連付けられた`pip`が使用されることが保証され、依存関係の問題を回避できます。

例:
```bash
python3 -m pip install -r requirements.txt
```

## ビルド、テスト、Lintコマンド

### ビルド

アプリケーションのビルドは、Dockerイメージのビルドによって行われます。詳細については、「Dockerを使用した初期セットアップと実行」セクションの「Dockerイメージのビルド」を参照してください。

**重要: 完全再構築の使用について**

HTML、CSS、JavaScript、Pythonコードなどを変更した場合、**必ず`restart_full.sh`スクリプト**を使用してください。通常の`restart_app.sh`だけでは、Docker内部のキャッシュにより変更が反映されないことがあります。

```bash
./restart_full.sh
```

このスクリプトは以下の処理を行います：
- 既存のDockerコンテナの停止・削除
- Dockerキャッシュのクリア
- 古いイメージの削除
- ローカルキャッシュのクリア
- キャッシュなしでの新しいDockerイメージのビルド
- 新しいコンテナの起動

### テスト
(後で追加)

### Lint
(後で追加)

## コーディング規約
(後で追加)

## SSH接続オプション機能

ServerDeckでは、ネットワーク機器や古いシステムとの接続において、柔軟なSSH接続オプションを設定できる機能を提供しています。

### 機能概要

**「その他のオプション」フィールド**を使用して、標準的なSSHクライアントの`-o`オプションと同様の設定を指定できます。これにより、以下のような接続問題を解決できます：

- 古い暗号化アルゴリズムのみをサポートするネットワーク機器
- 特定のホストキーアルゴリズムを要求するシステム
- 厳格でないホストキー確認を必要とする環境

### 使用方法

サーバー編集画面の「その他のオプション」フィールドに、SSH接続オプションを入力します。

**例：**
```
-oHostKeyAlgorithms=+ssh-rsa -oPubkeyAcceptedAlgorithms=+ssh-rsa
```

### サポートされるオプション

現在、以下のSSHオプションがサポートされています：

1. **HostKeyAlgorithms**: ホストキー認証で使用するアルゴリズムを指定
   - 例: `-oHostKeyAlgorithms=+ssh-rsa`
   - `+`プレフィックスで既存の設定に追加

2. **PubkeyAcceptedAlgorithms**: 公開キー認証で受け入れるアルゴリズムを指定
   - 例: `-oPubkeyAcceptedAlgorithms=+ssh-rsa`
   - `+`プレフィックスで既存の設定に追加

3. **Ciphers**: 暗号化アルゴリズムを指定
   - 例: `-oCiphers=+aes128-cbc`

4. **StrictHostKeyChecking**: ホストキーの厳密な確認を制御
   - 例: `-oStrictHostKeyChecking=no`

5. **UserKnownHostsFile**: 既知ホストファイルの場所を指定
   - 例: `-oUserKnownHostsFile=/dev/null`

### 実用例

**古いネットワーク機器（Ciscoスイッチなど）に接続する場合：**
```
-oHostKeyAlgorithms=+ssh-rsa -oPubkeyAcceptedAlgorithms=+ssh-rsa -oKexAlgorithms=+diffie-hellman-group1-sha1
```

**ホストキー確認を無効にする場合：**
```
-oStrictHostKeyChecking=no -oUserKnownHostsFile=/dev/null
```

### 技術的実装

- SSH オプションは`parse_ssh_options()`関数で解析され、Paramiko ライブラリの接続パラメータに変換されます
- サポートされていないオプションはログに記録され、無視されます
- オプションは既存の接続設定（ホスト、ポート、認証情報）と組み合わせて使用されます

### 注意事項

- オプションの指定が間違っている場合、SSH接続が失敗することがあります
- セキュリティを低下させるオプション（StrictHostKeyChecking=no など）は、必要な場合にのみ使用してください
- サポートされていないオプションは無視されますが、ログに記録されます

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

3.  **Dockerコンテナの実行:**
    ```bash
docker run -d -p 5001:5001 \
  -v /path/to/your/ServerDeck/config:/app/config \
  -v /path/to/your/ServerDeck/uploaded_ssh_keys:/app/config/uploaded_ssh_keys \
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

### エージェントのトーンとスタイル

エージェントは、より感情的でフランクな話し言葉を使用し、堅苦しい表現を避け、ユーザーとの対話では、親しみやすく、人間らしいトーンを心がけます。

## 最近の変更

### 設定ページをモーダル化

設定ページ (`/config`) がメインページ上のモーダルオーバーレイとして表示されるようになりました。
ナビゲーションバーの「Config」リンクをクリックすると、設定コンテンツがBootstrapモーダルに動的に読み込まれ、ページ全体のリロードなしでシームレスなユーザーエクスペリエンスを提供します。

**影響を受けるファイル:**
- `app.py`: `/config`ルートが`config_modal_content.html`をレンダリングするように変更されました。
- `templates/index.html`: Bootstrapモーダル構造が追加され、「Config」リンクがモーダルをトリガーするように更新されました。
- `templates/config_modal_content.html`: モーダルに読み込まれるように設計された、設定ページの実際のコンテンツを含む新しいファイルです。
- `static/js/script.js`: モーダルへの設定コンテンツの動的読み込みと、読み込まれたコンテンツのJavaScriptロジックの再初期化を処理するように更新されました。

### 認証機能の導入とユーザー管理

アプリケーションに認証機能が導入されました。これにより、登録されたユーザーのみがServerDeckにアクセスできます。

#### 初回ユーザーの作成

アプリケーションを初めて利用する前、または新しいユーザーを追加するには、以下の手順を実行する必要があります。

1.  **ターミナルで`ServerDeck`ディレクトリに移動します。**
2.  **以下のコマンドを実行します。**
    ```bash
python3 user_management.py adduser
    ```
3.  **対話形式でユーザー名とパスワードを設定します。**

**重要**: このコマンドはパスワード入力など対話的な操作を必要とするため、**開発者自身がターミナルで直接実行する必要があります。** エージェント（Gemini）はこのコマンドを実行できません。

ユーザー作成後、コンテナを再起動するとログインページが表示されます。
## これから実装したいこと

### Ping監視機能の再実装と強化
- 以前試みたPing監視機能を、より堅牢な方法で再実装します。
- Pingの成功/失敗だけでなく、応答時間やパケットロス率なども表示できるように拡張します。
- Ping監視の有効/無効をサーバーごとに設定できるようにします。
- Pingの状態変化をリアルタイムで通知する機能（ブラウザ通知など）を追加します。

### サーバーグループ機能の追加
- 多数のサーバーを管理する際に、サーバーをグループ化して表示・管理できるようにします。
- グループごとに一括で操作（例: 全グループのサーバーのPing状態を確認）できるようにします。

### Webベースのターミナル機能の強化
- 現在のSSH接続機能は基本的なものですが、より高機能なWebターミナル（例: コピー＆ペーストの改善、タブ機能、セッション管理）を導入します。
- SFTP/SCPによるファイル転送機能を追加します。

### ログビューア機能の追加
- 登録されたサーバー上の特定のログファイル（例: `/var/log/syslog`, `/var/log/nginx/access.log`）をブラウザ上でリアルタイムに表示できる機能を追加します。
- ログのフィルタリングや検索機能も提供します。

### プラグイン/拡張機能のサポート
- 将来的に、ユーザーが独自の機能を追加できるようなプラグインシステムを導入します。

### Extra Import機能の追加
- 設定パネルのタブとして新規に追加
- これは、ホスト名リストを以下のコマンドで取得し、自動でホストをパネルに追加するものである。
```bash
% curl -s "http://ns.mynk.home/mynk_hosts.txt" | awk '{print $1}' 
aruba01.mynk.home.
blog.mynk.home.
box.mynk.home.
cache.mynk.home.
db.mynk.home.
deploy.mynk.home.
dhcp.mynk.home.
dns.mynk.home.
docker.mynk.home.
gcv.mynk.home.
go-flow.mynk.home.
gw.mynk.home.
haos.mynk.home.
imm.mynk.home.
ipmi.mynk.home.
kibana.mynk.home.
kuma.mynk.home.
l2sw-1.mynk.home.
nas.mynk.home.
nas-share.mynk.home.
ns.mynk.home.
obsrv.mynk.home.
proxy.mynk.home.
pve01.mynk.home.
pve03.mynk.home.
pve04.mynk.home.
radius.mynk.home.
raspi.mynk.home.
raspi2.mynk.home.
srv.mynk.home.
tsvpn.mynk.home.
ups.mynk.home.
www.mynk.home.
```
- このExtra Import機能は、http://ns.mynk.home/mynk_hosts.txt というURLを登録さえすれば起動時と５分ごとにホスト名をチェックします。
- これによりメインパネルに自動でホストを追加して欲しいです。例えば、aruba01.mynk.home.の場合、以下のように。
```yaml
- id: server-1751995193436 ※idは乱数で振ってね
  name: aruba01
  type: node
  port: 22
  host: aruba01.mynk.home ※末尾のドットはあった場合削除する。
  is_extra: True ※下記の処理のためにextra importによって追加されたものか識別するフラグを置く。既存のものは全てFalseとする。
```
- 自身が持っていないホスト名がにextra importによって新たに得られた場合、新規で上記のようなconfigでパネルを追加します。そして、**枠を緑色に装飾します**。
  - 緑色に装飾されたパネルは、クリックするとそのパネルの設定編集画面が出ます。
  - 編集が完了すると、緑色の装飾は消滅します。
  - 時間が経過したり、新たにextra importされたホストが追加されたとしても、手動で設定が完了するまでは緑色の装飾が出現したままにします。
- 自身が持っているホスト名がextra importの時消滅していた場合、**枠を赤色に装飾します**。
  - 赤色に装飾されたパネルは、クリックすると「extra importから削除しますか？」というダイアログを出す。
    - OKボタンをクリックされたらパネルを削除する。
    - キャンセルボタンを押すと、is_extraフラグをFalseにして装飾を削除する。
- URLの設定方法
  - URLは設定パネルにタブを追加して、そこで設定できるようにします。最大一つ設定可能で、一度設定すると消すまでは再起動しても維持されます。
- 追加したホストの名前について
  - aruba01.mynk.homeというホスト名からaruba01というnameを自動で付けていますが、これはホスト名の最初のドット（.）までを取り出してください。
- 設定編集画面について
  緑枠のパネルをクリックして出る設定編集画面は、既存の設定パネルから編集ボタンを押した時の画面を使い回してもらって構いません。
- 「編集が完了」のタイミング
  - 「編集が完了すると、緑色の装飾は消滅します」とありますが、設定編集画面で「保存」ボタンが押されたときを完了としてください。