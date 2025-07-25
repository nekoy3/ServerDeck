// バックアップ管理機能
window.BackupManagement = {
    initialized: false,
    
    // 初期化
    initialize: function() {
        // 重複初期化を防ぐ
        if (this.initialized) {
            console.log('BackupManagement already initialized');
            return;
        }
        
        BackupManagement.loadBackupFileList();
        BackupManagement.initializeExportButton();
        BackupManagement.initializeImportForm();
        
        // 初期化完了フラグ
        this.initialized = true;
        console.log('BackupManagement initialized');
    },

    // バックアップファイルリストの読み込み
    loadBackupFileList: function() {
        if (!window.APIManager) {
            console.error('APIManager not available');
            return;
        }
        
        window.APIManager.get('/api/backups')
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
        const exportBtn = document.getElementById('export-config-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                BackupManagement.exportConfig();
            });
        }
    },

    // インポートフォームの初期化
    initializeImportForm: function() {
        const importForm = document.getElementById('import-form');
        if (importForm) {
            importForm.addEventListener('submit', (e) => {
                BackupManagement.importConfig(e);
            });
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
        if (!window.APIManager) {
            console.error('APIManager not available');
            return;
        }
        
        window.APIManager.get('/api/config/export', {
            responseType: 'blob'
        })
        .then(blob => {
            // ファイルダウンロード
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `serverdeck_backup_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)}.yaml`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            if (window.NotificationManager) {
                window.NotificationManager.success('設定がエクスポートされました！');
            } else {
                alert('設定がエクスポートされました！');
            }
            this.loadBackupFileList(); // リストを更新
        })
        .catch(error => {
            console.error('Error exporting config:', error);
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

        if (!window.APIManager) {
            console.error('APIManager not available');
            return;
        }

        window.APIManager.post('/api/config/import', formData)
        .then(data => {
            if (window.NotificationManager) {
                window.NotificationManager.success('設定がインポートされました！ページを再読み込みしてください。');
            } else {
                alert('設定がインポートされました！ページを再読み込みしてください。');
            }
            fileInput.value = '';
            // サーバーリストを更新
            if (typeof ServerManagement !== 'undefined') {
                ServerManagement.loadServersForConfigModal();
                ServerManagement.updateMainPageServerCards();
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
        if (!window.APIManager) {
            console.error('APIManager not available');
            return;
        }
        
        window.APIManager.delete(`/api/backups/delete/${encodeURIComponent(filename)}`)
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
