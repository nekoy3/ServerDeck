# ServerDeck

サーバー管理・監視用のWebダッシュボードアプリケーション

## 機能概要

- **サーバー管理**: サーバーの追加・編集・削除
- **リアルタイム監視**: Pingステータスのリアルタイム表示
- **SSH接続**: ブラウザ経由でのSSH端末接続
- **SSHキー管理**: SSH秘密鍵のアップロード・管理
- **External Import**: 外部URLからのサーバー情報自動インポート
- **バックアップ機能**: 設定の自動バックアップ・復元
- **ダークモード**: ライト/ダークテーマ切り替え

## 技術スタック

- **Backend**: Python 3.9, Flask, Flask-SocketIO
- **Frontend**: HTML5, Bootstrap 5, Vanilla JavaScript
- **インフラ**: Docker, Docker Compose
- **データ**: YAML設定ファイル

## クイックスタート

### 必須要件
- Docker Desktop
- Git

### インストール・起動
```bash
git clone <repository-url>
cd ServerDeck
./restart_full.sh
```

アプリケーションは http://127.0.0.1:5001/ でアクセス可能です。

### 管理コマンド
```bash
# 完全再構築（推奨）
./restart_full.sh

# 軽量再起動（非推奨）
./restart_app.sh
```

## 初期設定

### ユーザー作成
```bash
python user_management.py
```

### 設定ファイル
- `config/servers.yaml`: サーバー情報
- `config/ssh_keys.yaml`: SSH鍵設定
- `config/users.yaml`: ユーザー情報
- `config/settings.yaml`: アプリケーション設定

## 開発者向け

詳細な開発ガイドは [DEVELOPMENT.md](DEVELOPMENT.md) を参照してください。

### アーキテクチャドキュメント
- [フロントエンドアーキテクチャ](FRONTEND_ARCHITECTURE.md)
- [JavaScriptアーキテクチャ](JAVASCRIPT_ARCHITECTURE.md)

### ドキュメント更新ポリシー
**重要**: コード変更時は対応するドキュメントも必ず更新してください。
- 新機能追加: セクション・詳細を追加
- 機能変更: 該当部分を更新
- 機能削除: セクション削除または「廃止」マーク
- 常に `./restart_full.sh` を使用

## トラブルシューティング

### よくある問題
1. **表示が崩れる・更新されない**
   ```bash
   ./restart_full.sh
   ```

2. **Docker関連エラー**
   ```bash
   docker system prune -f
   ./restart_full.sh
   ```

3. **ログ確認**
   ```bash
   docker logs serverdeck-app
   ```

## ライセンス

[ライセンス情報を記載]

## 貢献

プルリクエストやイシューの報告を歓迎します。開発ガイドラインについては [DEVELOPMENT.md](DEVELOPMENT.md) を参照してください。
