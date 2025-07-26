// バックアップ管理機能
window.BackupManagement = {
    initialized: false,
    
    // 初期化
    initialize: function() {
        console.log('📁 [BACKUP] Initializing backup management...');
        
        // イベントリスナーは毎回確実に設定する
        this.setupEventListeners();
        
        // 初期化フラグを設定
        this.initialized = true;
    },
    
    // イベントリスナーの設定
    setupEventListeners: function() {
        console.log('📁 [BACKUP] Setting up event listeners...');
        
        // エクスポートボタンの初期化
        this.initializeExportButton();
        
        // インポートフォームの初期化
        this.initializeImportForm();
        
        console.log('✅ [BACKUP] Backup management initialized successfully');
    },
    
    // バックアップファイルリストの読み込み
    loadBackupFileList: function() {
        console.log('Loading backup file list...');
        
        // APIManagerを使用
        if (!window.APIManager) {
            console.error('❌ [BACKUP] APIManager not available');
            return;
        }
        
        window.APIManager.backup.getAll()
            .then(backupFiles => {
                const backupFileListDiv = document.getElementById('backup-file-list');
                if (!backupFileListDiv) return;
                
                backupFileListDiv.innerHTML = '';
                
                if (backupFiles.length === 0) {
                    backupFileListDiv.innerHTML = '<p class="text-muted">バックアップファイルはありません。</p>';
                    return;
                }

                backupFiles.forEach(file => {
                    const fileElement = document.createElement('div');
                    fileElement.className = 'list-group-item d-flex justify-content-between align-items-center';
                    fileElement.innerHTML = `
                        <div>
                            <strong>${file.name}</strong><br>
                            <small class="text-muted">作成日時: ${new Date(file.created_at).toLocaleString('ja-JP')}</small><br>
                            <small class="text-muted">サイズ: ${file.size}</small>
                        </div>
                        <div>
                            <button class="btn btn-sm btn-outline-primary download-backup-btn" data-filename="${file.name}">ダウンロード</button>
                            <button class="btn btn-sm btn-outline-danger delete-backup-btn" data-filename="${file.name}">削除</button>
                        </div>
                    `;
                    backupFileListDiv.appendChild(fileElement);
                });

                // イベントリスナーを追加
                BackupManagement.attachBackupFileEventListeners();
            })
            .catch(error => {
                console.error('Error loading backup files:', error);
                const backupFileListDiv = document.getElementById('backup-file-list');
                if (backupFileListDiv) {
                    backupFileListDiv.innerHTML = '<p class="text-danger">バックアップファイルの読み込みに失敗しました。</p>';
                }
                if (window.NotificationManager) {
                    window.NotificationManager.error('バックアップファイルの読み込みに失敗しました。');
                }
            });
    },

    // エクスポートボタンの初期化
    initializeExportButton: function() {
        console.log('📁 [BACKUP] Initializing export button...');
        const exportBtn = document.getElementById('export-config-btn');
        if (exportBtn) {
            console.log('📁 [BACKUP] Export button found, adding event listener');
            
            // 既存のイベントリスナーがあれば削除
            exportBtn.removeEventListener('click', this._exportHandler);
            
            // 新しいイベントリスナーを追加
            this._exportHandler = () => {
                console.log('📁 [BACKUP] Export button clicked!');
                BackupManagement.exportConfig();
            };
            exportBtn.addEventListener('click', this._exportHandler);
            
            console.log('✅ [BACKUP] Export button event listener added successfully');
        } else {
            console.warn('⚠️ [BACKUP] Export button not found (expected when config modal is not open)');
        }
    },

    // インポートフォームの初期化
    initializeImportForm: function() {
        console.log('📁 [BACKUP] Initializing import form...');
        const importForm = document.getElementById('import-form');
        if (importForm) {
            console.log('📁 [BACKUP] Import form found, adding event listener');
            
            // 既存のイベントリスナーがあれば削除
            importForm.removeEventListener('submit', this._importHandler);
            
            // 新しいイベントリスナーを追加
            this._importHandler = (e) => {
                BackupManagement.importConfig(e);
            };
            importForm.addEventListener('submit', this._importHandler);
            
            console.log('✅ [BACKUP] Import form event listener added successfully');
        } else {
            console.warn('⚠️ [BACKUP] Import form not found (expected when config modal is not open)');
        }
    },

    // バックアップファイルのイベントリスナー
    attachBackupFileEventListeners: function() {
        // ダウンロードボタン
        document.querySelectorAll('.download-backup-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const filename = e.target.dataset.filename;
                BackupManagement.downloadBackup(filename);
            });
        });

        // 削除ボタン
        document.querySelectorAll('.delete-backup-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const filename = e.target.dataset.filename;
                if (confirm(`バックアップファイル "${filename}" を削除しますか？`)) {
                    BackupManagement.deleteBackup(filename);
                }
            });
        });
    },

    // 設定のエクスポート
    exportConfig: function() {
        console.log('📁 [BACKUP] Starting config export...');
        
        console.log('📁 [BACKUP] Calling fetch for /api/config/export...');
        
        // 直接fetchを使用してBlobレスポンスを取得
        fetch('/api/config/export')
            .then(response => {
                console.log('📁 [BACKUP] Export API response received:', response);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                return response.blob();
            })
            .then(blob => {
                console.log('📁 [BACKUP] Export blob received, creating download...');
                // ファイルダウンロード
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `serverdeck_backup_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)}.yaml`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
                
                console.log('✅ [BACKUP] Export completed successfully');
                if (window.NotificationManager) {
                    window.NotificationManager.success('設定がエクスポートされました！');
                } else {
                    alert('設定がエクスポートされました！');
                }
                this.loadBackupFileList(); // リストを更新
            })
            .catch(error => {
                console.error('❌ [BACKUP] Error exporting config:', error);
                if (window.NotificationManager) {
                    window.NotificationManager.error('設定のエクスポートに失敗しました。');
                } else {
                    alert('設定のエクスポートに失敗しました。');
                }
            });
    },

    // 設定のインポート
    importConfig: function(e) {
        e.preventDefault();
        const fileInput = document.getElementById('import-file');
        const file = fileInput.files[0];
        
        if (!file) {
            if (window.NotificationManager) {
                window.NotificationManager.warning('ファイルを選択してください。');
            } else {
                alert('ファイルを選択してください。');
            }
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        // APIManagerを使用
        if (!window.APIManager) {
            console.error('❌ [BACKUP] APIManager not available');
            return;
        }
        
        window.APIManager.backup.import(formData)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            if (window.NotificationManager) {
                window.NotificationManager.success('設定がインポートされました！ページを再読み込みしてください。');
            } else {
                alert('設定がインポートされました！ページを再読み込みしてください。');
            }
            fileInput.value = '';
            // サーバーリストを更新
            if (typeof window.loadServersForConfigModal === 'function') {
                window.loadServersForConfigModal();
            }
            if (typeof window.updateMainPageServerCards === 'function') {
                window.updateMainPageServerCards();
            }
        })
        .catch(error => {
            console.error('Error importing config:', error);
            if (window.NotificationManager) {
                window.NotificationManager.error('設定のインポートに失敗しました: ' + (error.message || JSON.stringify(error)));
            } else {
                alert('設定のインポートに失敗しました: ' + (error.message || JSON.stringify(error)));
            }
        });
    },

    // バックアップのダウンロード
    downloadBackup: function(filename) {
        const link = document.createElement('a');
        link.href = `/api/backups/download/${encodeURIComponent(filename)}`;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    },

    // バックアップの削除
    deleteBackup: function(filename) {
        // APIManagerを使用
        if (!window.APIManager) {
            console.error('❌ [BACKUP] APIManager not available');
            return;
        }
        
        window.APIManager.backup.delete(filename)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            if (window.NotificationManager) {
                window.NotificationManager.success('バックアップファイルが削除されました。');
            } else {
                alert('バックアップファイルが削除されました。');
            }
            BackupManagement.loadBackupFileList(); // リストを更新
        })
        .catch(error => {
            console.error('Error deleting backup:', error);
            if (window.NotificationManager) {
                window.NotificationManager.error('バックアップファイルの削除に失敗しました。');
            } else {
                alert('バックアップファイルの削除に失敗しました。');
            }
        });
    }
};
