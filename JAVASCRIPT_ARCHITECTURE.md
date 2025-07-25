# ServerDeck JavaScript アーキテクチャドキュメント

## ファイル構成と役割

### 1. `/static/js/main.js` (メインエントリーポイント)
**役割**: アプリケーションの初期化とテーマ管理
**読み込み順**: 最後（7番目）
**主な機能**:
- `DOMContentLoaded`イベントでの初期化
- ダークモード/ライトモードの切り替え
- ローカルストレージでのテーマ設定保存
- URLパラメータからの`extra_import_url`検出とモーダル自動表示
- 各モジュールの初期化呼び出し

**主要メソッド**:
- ダークモードトグル処理
- `ServerDeckUtils.loadConfigModal()`, `PingStatus.initialize()`の呼び出し

---

### 2. `/static/js/utils.js` (ユーティリティとモーダル管理)
**役割**: 共通ユーティリティとモーダル管理
**読み込み順**: 最初（1番目）
**主な機能**:
- 設定モーダルの動的読み込み
- モーダルのクリーンアップ処理
- 共通API関数
- 認証フィールドの切り替え

**主要メソッド**:
```javascript
window.ServerDeckUtils = {
    loadConfigModal()           // 設定モーダルの読み込み
    initializeConfigModalScripts() // モーダル内スクリプト初期化
    cleanupModalRemnants()      // モーダルクリーンアップ
    forceCloseModal()          // 強制モーダル終了
    openConfigModalWithExtraImport() // Extra Import用モーダル
    toggleAuthFields()          // 認証フィールド切り替え
    apiRequest()               // 共通APIリクエスト
}
```

---

### 3. `/static/js/ping-status.js` (Ping状態管理)
**役割**: Socket.IOを使ったリアルタイムPing状態管理  
**読み込み順**: 2番目
**主な機能**:
- Socket.IOクライアント初期化
- リアルタイムPing状態更新
- サーバーカードのステータス表示更新

**主要メソッド**:
```javascript
window.PingStatus = {
    initialize()               // Socket.IO初期化
    updatePingStatus()         // Ping状態更新
}
```

---

### 4. `/static/js/server-management.js` (サーバー管理)
**役割**: サーバーCRUD操作とUI管理
**読み込み順**: 3番目
**主な機能**:
- サーバー一覧の表示・更新
- サーバー追加・編集・削除
- サーバーカードの動的生成
- バルク削除機能

**主要メソッド**:
```javascript
window.ServerManagement = {
    updateMainPageServerCards()    // メインページカード更新
    loadServersForConfigModal()    // 設定モーダルでの一覧表示
    initializeEditForm()           // 編集フォーム初期化
    attachServerCardEventListeners() // カードイベント設定
    addNewServer()                 // 新規サーバー追加
    editServer()                   // サーバー編集
    deleteServer()                 // サーバー削除
    bulkDeleteServers()            // バルク削除
}
```

---

### 5. `/static/js/ssh-key-management.js` (SSHキー管理)
**役割**: SSHキーのCRUD操作
**読み込み順**: 4番目
**主な機能**:
- SSHキー一覧表示
- SSHキー追加・編集・削除
- ファイルアップロード機能
- バルク削除機能

**主要メソッド**:
```javascript
window.SshKeyManagement = {
    initialize()               // 初期化
    loadSshKeysForManagementModal() // 一覧読み込み
    addNewSshKey()            // 新規追加
    editSshKey()              // 編集
    deleteSshKey()            // 削除
    bulkDeleteSshKeys()       // バルク削除
}
```

---

### 6. `/static/js/extra-import.js` (外部インポート機能)
**役割**: 外部URLからのサーバー情報インポート
**読み込み順**: 5番目
**主な機能**:
- URLパラメータからの設定読み込み
- Extra ImportフォームのPOST処理
- 確認モーダルの管理

**主要メソッド**:
```javascript
window.ExtraImport = {
    initialize()               // 初期化
    loadFromUrlParams()        // URLパラメータ処理
    loadExtraImportUrl()       // 現在設定の読み込み
    submitExtraImportForm()    // フォーム送信
    initializeConfirmModal()   // 確認モーダル初期化
    confirmExtraImportAction() // 確認アクション
}
```

---

### 7. `/static/js/backup-management.js` (バックアップ機能)
**役割**: 設定のバックアップ・リストア
**読み込み順**: 6番目
**主な機能**:
- バックアップファイル一覧表示
- 設定のインポート・エクスポート
- バックアップファイルの削除

**主要メソッド**:
```javascript
window.BackupManagement = {
    initialize()               // 初期化
    loadBackupFiles()          // バックアップ一覧読み込み
    downloadBackup()           // ダウンロード
    deleteBackup()             // 削除
    exportConfig()             // エクスポート
    importConfig()             // インポート
}
```

---

## イベントリスナーと初期化フロー

### 1. 初期化順序
```javascript
1. DOMContentLoaded (main.js)
2. ServerDeckUtils.loadConfigModal() (utils.js)
3. PingStatus.initialize() (ping-status.js)
4. ServerManagement.initializeEditForm() (server-management.js)
5. ServerManagement.attachServerCardEventListeners() (server-management.js)
```

### 2. モーダル表示時の初期化
```javascript
1. fetch('/config') でモーダルコンテンツ読み込み
2. ServerDeckUtils.initializeConfigModalScripts() 実行
3. 各タブの初期化（shown.bs.tab イベント）:
   - サーバー設定タブ: ServerManagement.loadServersForConfigModal()
   - SSHキー管理タブ: SshKeyManagement.initialize()
   - Extra Importタブ: ExtraImport.initialize()
   - バックアップタブ: BackupManagement.initialize()
```

---

## 名前空間とグローバル変数

### グローバルオブジェクト
- `window.ServerDeckUtils`
- `window.PingStatus`
- `window.ServerManagement`
- `window.SshKeyManagement`
- `window.ExtraImport`
- `window.BackupManagement`

### 初期化フラグ
- `ServerDeckUtils.configModalInitialized` (boolean)

---

## 重複防止ルール

### 1. イベントリスナー
- 全てのイベントリスナーに `{ once: true }` オプションを使用
- モーダル関連イベントは `removeEventListener` で古いリスナーを削除してから追加

### 2. 初期化処理
- 各モジュールで初期化フラグを管理
- 重複初期化をコンソールログで警告

### 3. モーダル処理
- `cleanupModalRemnants()` で完全なクリーンアップ
- Bootstrap Modal インスタンスの適切な破棄（`dispose()`）

---

## トラブルシューティング

### モーダルフリーズ時
1. `ServerDeckUtils.forceCloseModal()` を実行
2. コンソールでエラーログを確認
3. 必要に応じてページリロード

### 重複初期化の検出
- コンソールで "already initialized" メッセージを確認
- 各モジュールの初期化フラグをチェック

---

## 更新時の注意点

1. **新しいJSファイル追加時**:
   - 適切な名前空間を使用 (`window.ModuleName`)
   - 初期化フラグを実装
   - このドキュメントを更新

2. **イベントリスナー追加時**:
   - `{ once: true }` オプションの使用を検討
   - 重複防止策を実装

3. **モーダル関連機能追加時**:
   - `cleanupModalRemnants()` の更新
   - 適切なクリーンアップ処理の実装

---

**最終更新**: 2025年7月25日  
**バージョン**: 1.0
