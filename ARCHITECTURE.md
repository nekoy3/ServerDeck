# ServerDeck アーキテクチャドキュメント

## 📋 概要
ServerDeckは、サーバー管理・監視用のWebダッシュボードアプリケーションです。
2025年7月にフロントエンドの大幅なリファクタリングを実施し、現代的なモジュラー設計を採用しています。

## 🏗 フロントエンドアーキテクチャ

### モジュラー設計
各機能が独立したJavaScriptモジュールとして実装されています：

```
static/js/
├── main.js                    # メインエントリーポイント
├── utils.js                   # ユーティリティと共通機能
├── notification.js            # 統一通知システム 🆕
├── server-management.js       # サーバー管理機能
├── ssh-key-management.js      # SSHキー管理機能
├── backup-management.js       # バックアップ機能
├── extra-import.js           # 外部インポート機能
└── ping-status.js            # Pingステータス管理
```

### 🆕 新機能とアーキテクチャ改善

#### 1. 統一通知システム (`notification.js`)
```javascript
// 使用例
NotificationManager.success('操作が完了しました');
NotificationManager.error('エラーが発生しました');
NotificationManager.warning('警告メッセージ');
NotificationManager.info('情報をお知らせします');
```

**利点:**
- ✅ 全ての通知が一貫したスタイルとAPI
- ✅ `alert()`の使用を完全排除
- ✅ ユーザー体験の統一化

#### 2. API抽象化レイヤー (`utils.js` - APIManager)
```javascript
// 使用例
APIManager.get('/api/servers')           // GET リクエスト
APIManager.post('/api/servers', data)    // POST リクエスト
APIManager.put('/api/servers/1', data)   // PUT リクエスト
APIManager.delete('/api/servers/1')      // DELETE リクエスト
APIManager.get('/api/export', {          // Blob レスポンス対応
    responseType: 'blob'
})
```

**利点:**
- ✅ 全てのHTTPリクエストを統一的に処理
- ✅ エラーハンドリングの一元化
- ✅ 重複コードの大幅削減
- ✅ FormData、Blob対応

#### 3. モジュール間の依存関係管理
```javascript
// main.js で統一初期化
document.addEventListener('DOMContentLoaded', function() {
    // 1. 基盤システム初期化
    NotificationManager.initialize();
    
    // 2. 各機能モジュール初期化
    ServerManagement.initialize();
    SshKeyManagement.initialize();
    BackupManagement.initialize();
    // ...
});
```

### 🔧 技術的改善点

#### Before (レガシー)
```javascript
// 重複コード、一貫性なし
alert('エラーが発生しました');
fetch('/api/servers').then(response => {
    if (!response.ok) {
        alert('リクエストに失敗しました');
        throw new Error('Request failed');
    }
    return response.json();
});
```

#### After (現在)
```javascript
// 統一されたAPI、一貫性あり
APIManager.get('/api/servers')
    .then(data => {
        NotificationManager.success('データを取得しました');
        // 処理続行
    })
    .catch(error => {
        NotificationManager.error('データの取得に失敗しました: ' + error.message);
    });
```

## 🏛 バックエンドアーキテクチャ

### Flask アプリケーション構造
```
├── app.py                     # メインアプリケーション
├── user_management.py         # ユーザー管理
├── config/                    # 設定ファイル
│   ├── servers.yaml          # サーバー設定
│   ├── ssh_keys.yaml         # SSH鍵設定
│   ├── users.yaml            # ユーザー設定
│   └── settings.yaml         # アプリケーション設定
└── templates/                 # HTMLテンプレート
    └── index.html            # メインインターフェース
```

### API エンドポイント
- `GET/POST /api/servers` - サーバー管理
- `GET/POST /api/ssh_keys` - SSHキー管理
- `GET/POST /api/config/export` - 設定エクスポート
- `GET/POST /api/config/import` - 設定インポート
- `WebSocket` - リアルタイム通信

## 🐳 インフラストラクチャ

### Docker構成
```dockerfile
FROM python:3.9-bullseye
# システム依存関係インストール
# Python依存関係インストール
# Node.js/npm（xterm.js用）
# アプリケーションコピー
EXPOSE 5001
```

### 起動・管理スクリプト
- `restart_full.sh` - 完全再構築（推奨）
- `restart_app.sh` - 軽量再起動

## 📈 パフォーマンス特性

### フロントエンド
- ✅ **モジュラー読み込み**: 必要な機能のみ初期化
- ✅ **メモリ効率**: 適切なクリーンアップ処理
- ✅ **ネットワーク効率**: 統一されたAPI呼び出し

### バックエンド
- ✅ **リアルタイム通信**: Socket.IOによる効率的な更新
- ✅ **リソース管理**: Pythonベースの軽量実装

## 🔐 セキュリティ

### フロントエンド
- CSRFトークン対応
- 入力値検証
- XSS対策

### バックエンド
- セッション管理
- ユーザー認証
- SSH鍵の安全な管理

## 🚀 将来の拡張性

### 短期的改善候補
1. TypeScript導入による型安全性
2. ユニットテストの追加
3. パフォーマンス監視

### 長期的改善候補
1. フロントエンドフレームワーク（React/Vue）移行
2. PWA対応
3. マイクロサービス化

## 📝 開発ガイドライン

### 新機能追加時
1. **モジュール作成**: `static/js/new-feature.js`
2. **通知統一**: `NotificationManager`使用
3. **API統一**: `APIManager`使用
4. **初期化**: `main.js`に追加
5. **文書更新**: 本ドキュメント更新

### コード品質
- ES6+標準準拠
- 一貫したコメント
- エラーハンドリング必須
- モジュール間の疎結合

---

**最終更新**: 2025年7月26日  
**アーキテクチャバージョン**: 2.0（大幅リファクタリング後）
