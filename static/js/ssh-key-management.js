// SSHキー管理機能
window.SshKeyManagement = {
    initialized: false,
    isLoadingKeys: false, // キー読み込み中フラグ
    
    // 初期化
    initialize: function() {
        console.log('🔑 [SSH] Initializing SSH key management...');
        
        // イベントリスナーは重複初期化を防ぐが、データ読み込みは再実行を許可
        if (this.initialized) {
            console.log('🔑 [SSH] Already initialized, skipping event listener setup');
        } else {
            this.setupEventListeners();
            this.initialized = true;
        }
    },
    
    // イベントリスナーの設定
    setupEventListeners: function() {
        
        const sshKeyListView = document.getElementById('ssh-key-list-view');
        const sshKeyFormView = document.getElementById('ssh-key-form-view');
        const sshKeyFormTitle = document.getElementById('sshKeyFormTitle');
        const sshKeyForm = document.getElementById('sshKeyForm');
        const sshKeyIdInput = document.getElementById('sshKeyId');
        const sshKeyNameInput = document.getElementById('sshKeyName');
        const sshKeyPathInput = document.getElementById('sshKeyPath');
        const sshKeyUploadInput = document.getElementById('sshKeyUpload');

        // 「新しいSSHキーを追加」ボタン
        const addNewSshKeyBtn = document.getElementById('addNewSshKeyBtn');
        if (addNewSshKeyBtn) {
            addNewSshKeyBtn.addEventListener('click', () => {
                if(sshKeyForm) sshKeyForm.reset();
                if(sshKeyIdInput) sshKeyIdInput.value = '';
                
                if(sshKeyFormTitle) sshKeyFormTitle.textContent = '新しいSSHキーを追加';
                if(sshKeyListView) sshKeyListView.classList.add('d-none');
                if(sshKeyFormView) sshKeyFormView.classList.remove('d-none');
            });
        }

        // キャンセルボタン
        const cancelSshKeyFormBtn = document.getElementById('cancelSshKeyFormBtn');
        if (cancelSshKeyFormBtn) {
            cancelSshKeyFormBtn.addEventListener('click', () => {
                if(sshKeyFormView) sshKeyFormView.classList.add('d-none');
                if(sshKeyListView) sshKeyListView.classList.remove('d-none');
                SshKeyManagement.loadSshKeysForManagementModal();
            });
        }

        // SSHキーリストの親要素にイベントリスナーを設定（イベントデリゲーション）
        const sshKeyListDiv = document.getElementById('ssh-key-list');
        if (sshKeyListDiv) {
            sshKeyListDiv.addEventListener('click', (event) => {
                const target = event.target;
                const keyId = target.dataset.id;

                // 編集ボタン
                if (target.classList.contains('edit-ssh-key-btn')) {
                    SshKeyManagement.editSshKey(keyId, sshKeyIdInput, sshKeyNameInput, sshKeyPathInput, sshKeyFormTitle, sshKeyListView, sshKeyFormView);
                }

                // 削除ボタン
                if (target.classList.contains('delete-ssh-key-btn')) {
                    SshKeyManagement.deleteSshKey(keyId);
                }
            });

            sshKeyListDiv.addEventListener('change', (event) => {
                if (event.target.classList.contains('ssh-key-checkbox')) {
                    SshKeyManagement.updateBulkDeleteSshKeysButtonVisibility();
                }
            });
        }

        // 一括削除ボタン
        const bulkDeleteSshKeysBtn = document.getElementById('bulkDeleteSshKeysBtn');
        if (bulkDeleteSshKeysBtn) {
            bulkDeleteSshKeysBtn.addEventListener('click', () => {
                SshKeyManagement.bulkDeleteSshKeys();
            });
        }
        
        // NOTE: SSHキーリストの読み込みは設定モーダルが開かれた時のみ実行
        // this.loadSshKeysForManagementModal(); // メイン初期化時は実行しない

        // SSHキーのアップロード処理
        const uploadSshKeyFileBtn = document.getElementById('uploadSshKeyFileBtn');
        if (uploadSshKeyFileBtn) {
            uploadSshKeyFileBtn.addEventListener('click', () => {
                SshKeyManagement.uploadSshKey(sshKeyUploadInput, sshKeyPathInput);
            });
        }

        // SSHキー追加/編集フォームの送信処理
        if (sshKeyForm) {
            sshKeyForm.addEventListener('submit', (e) => {
                SshKeyManagement.submitSshKeyForm(e, sshKeyIdInput, sshKeyNameInput, sshKeyPathInput, sshKeyFormView, sshKeyListView);
            });
        }
        
        console.log('✅ [SSH] SSH key management initialized successfully');
    },

    // SSHキー編集
    editSshKey: function(keyId, sshKeyIdInput, sshKeyNameInput, sshKeyPathInput, sshKeyFormTitle, sshKeyListView, sshKeyFormView) {
        // APIManagerを使用してSSHキー詳細を取得
        if (!window.APIManager) {
            console.error('❌ [SSH] APIManager not available');
            return;
        }
        
        window.APIManager.sshKeys.get(keyId)
            .then(key => {
                if(sshKeyIdInput) sshKeyIdInput.value = key.id;
                if(sshKeyNameInput) sshKeyNameInput.value = key.name;
                if(sshKeyPathInput) sshKeyPathInput.value = key.path;
                
                if(sshKeyFormTitle) sshKeyFormTitle.textContent = 'SSHキーを編集';
                if(sshKeyListView) sshKeyListView.classList.add('d-none');
                if(sshKeyFormView) sshKeyFormView.classList.remove('d-none');
            })
            .catch(error => {
                console.error('Error fetching SSH key for edit:', error);
                NotificationManager.error('SSHキーの取得に失敗しました');
            });
    },

    // SSHキー削除
    deleteSshKey: function(keyId) {
        if (confirm('本当にこのSSHキーを削除しますか？')) {
            // APIManagerを使用
            if (!window.APIManager) {
                console.error('❌ [SSH] APIManager not available');
                return;
            }
            
            window.APIManager.sshKeys.delete(keyId)
            .then(() => {
                NotificationManager.success('SSHキーが削除されました！');
                SshKeyManagement.loadSshKeysForManagementModal();
            })
            .catch(error => {
                console.error('Error deleting SSH key:', error);
                NotificationManager.error('SSHキーの削除に失敗しました');
            });
        }
    },

    // SSHキー一括削除
    bulkDeleteSshKeys: function() {
        const selectedKeyIds = Array.from(document.querySelectorAll('.ssh-key-checkbox:checked')).map(cb => cb.dataset.keyId);
        if (selectedKeyIds.length > 0 && confirm(`${selectedKeyIds.length}個のSSHキーを本当に削除しますか？`)) {
            // APIManagerを使用
            if (!window.APIManager) {
                console.error('❌ [SSH] APIManager not available');
                return;
            }
            
            window.APIManager.sshKeys.bulkDelete(selectedKeyIds)
            .then(() => {
                NotificationManager.success('選択されたSSHキーが削除されました！');
                SshKeyManagement.loadSshKeysForManagementModal();
            })
            .catch(error => {
                console.error('Error during bulk delete of SSH keys:', error);
                NotificationManager.error('SSHキーの削除に失敗しました');
            });
        }
    },

    // SSHキーアップロード
    uploadSshKey: function(sshKeyUploadInput, sshKeyPathInput) {
        const file = sshKeyUploadInput.files[0];
        if (!file) {
            NotificationManager.warning('アップロードするファイルを選択してください');
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        // APIManagerを使用
        if (!window.APIManager) {
            console.error('❌ [SSH] APIManager not available');
            return;
        }

        window.APIManager.sshKeys.upload(formData)
        .then(data => {
            NotificationManager.success('SSHキーがアップロードされました！');
            if(sshKeyPathInput) sshKeyPathInput.value = data.path;
            if(sshKeyUploadInput) sshKeyUploadInput.value = '';
        })
        .catch(error => {
            console.error('Error uploading SSH key:', error);
            NotificationManager.error('SSHキーのアップロードに失敗しました: ' + error.message);
        });
    },

    // SSHキーフォーム送信
    submitSshKeyForm: function(e, sshKeyIdInput, sshKeyNameInput, sshKeyPathInput, sshKeyFormView, sshKeyListView) {
        e.preventDefault();
        const keyId = sshKeyIdInput.value;
        const keyName = sshKeyNameInput.value;
        const keyPath = sshKeyPathInput.value;

        const payload = {
            id: keyId || `sshkey-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
            name: keyName,
            path: keyPath
        };

        // APIManagerを使用
        if (!window.APIManager) {
            console.error('❌ [SSH] APIManager not available');
            return;
        }

        const apiCall = keyId ? 
            window.APIManager.sshKeys.update(keyId, payload) : 
            window.APIManager.sshKeys.create(payload);

        apiCall
        .then(data => {
            NotificationManager.success('SSHキーが保存されました！');
            if(sshKeyFormView) sshKeyFormView.classList.add('d-none');
            if(sshKeyListView) sshKeyListView.classList.remove('d-none');
            SshKeyManagement.loadSshKeysForManagementModal();
        })
        .catch(error => {
            console.error('Error saving SSH key:', error);
            NotificationManager.error('SSHキーの保存に失敗しました: ' + (error.message || 'Unknown error'));
        });
    },

    // SSHキー管理モーダル用のリスト読み込み
    loadSshKeysForManagementModal: function() {
        console.log('🔑 [SSH] Loading SSH keys for management modal...');
        
        // 既に読み込み中の場合はスキップ
        if (this.isLoadingKeys) {
            console.log('🔑 [SSH] Already loading SSH keys, skipping...');
            return;
        }
        
        // DOM要素の存在チェック（タイミング問題対策）
        const sshKeyListDiv = document.getElementById('ssh-key-list');
        console.log('🔑 [SSH] ssh-key-list element check at start:', !!sshKeyListDiv);
        
        if (!sshKeyListDiv) {
            console.warn('⚠️ [SSH] ssh-key-list element not found at start, waiting 100ms...');
            // 少し待ってから再試行（最大3回）
            if (!this.retryCount) this.retryCount = 0;
            if (this.retryCount < 3) {
                this.retryCount++;
                setTimeout(() => {
                    this.loadSshKeysForManagementModal();
                }, 100);
            } else {
                console.error('❌ [SSH] ssh-key-list element not found after 3 retries');
                this.retryCount = 0;
            }
            return;
        }
        
        this.isLoadingKeys = true;
        this.retryCount = 0;
        
        // 新しいAPIManagerを使用
        if (!window.APIManager) {
            console.error('❌ [SSH] APIManager not available');
            this.isLoadingKeys = false;
            return;
        }
        
        window.APIManager.sshKeys.getAll()
            .then(sshKeys => {
                console.log('🔑 [SSH] SSH keys received:', sshKeys.length, 'keys');
                
                // DOM要素を再度取得（確実性のため）
                const sshKeyListDiv = document.getElementById('ssh-key-list');
                console.log('🔑 [SSH] SSH key list element found (after API):', !!sshKeyListDiv);
                
                if (!sshKeyListDiv) {
                    console.error('❌ [SSH] ssh-key-list element not found after successful API call');
                    this.isLoadingKeys = false;
                    return;
                }
                
                sshKeyListDiv.innerHTML = '';

                if (sshKeys.length === 0) {
                    console.log('🔑 [SSH] No SSH keys found, showing empty message');
                    sshKeyListDiv.innerHTML = '<p class="text-muted">SSHキーはまだ登録されていません。</p>';
                    return;
                }

                let allKeyItemsHtml = '';
                sshKeys.forEach(key => {
                    console.log('🔑 [SSH] Processing SSH key:', key.name);
                    const keyItemHtml = `
                        <div class="list-group-item list-group-item-action d-flex justify-content-between align-items-center">
                            <div>
                                <input class="form-check-input me-1 ssh-key-checkbox" type="checkbox" value="" data-key-id="${key.id}">
                                <strong>${key.name}</strong><br>
                                <small>${key.path}</small>
                            </div>
                            <div>
                                <button class="btn btn-sm btn-info edit-ssh-key-btn" data-id="${key.id}">編集</button>
                                <button class="btn btn-sm btn-danger delete-ssh-key-btn" data-id="${key.id}">削除</button>
                            </div>
                        </div>
                    `;
                    allKeyItemsHtml += keyItemHtml;
                });

                console.log('🔑 [SSH] Setting HTML content, length:', allKeyItemsHtml.length);
                sshKeyListDiv.innerHTML = allKeyItemsHtml;
                
                // 一括削除ボタンの表示状態を更新
                SshKeyManagement.updateBulkDeleteSshKeysButtonVisibility();
                
                console.log('✅ [SSH] SSH keys list updated successfully');
                
                // 読み込み完了フラグをリセット
                this.isLoadingKeys = false;
            })
            .catch(error => {
                console.error('❌ [SSH] Error loading SSH keys:', error);
                const sshKeyListDiv = document.getElementById('ssh-key-list');
                if (sshKeyListDiv) {
                    sshKeyListDiv.innerHTML = '<div class="alert alert-danger">SSH鍵の読み込みに失敗しました: ' + error.message + '</div>';
                }
                
                // 読み込み完了フラグをリセット
                this.isLoadingKeys = false;
            });
    },

    // 一括削除ボタンの表示状態更新
    updateBulkDeleteSshKeysButtonVisibility: function() {
        const bulkDeleteSshKeysBtn = document.getElementById('bulkDeleteSshKeysBtn');
        if (bulkDeleteSshKeysBtn) {
            const checkedCount = document.querySelectorAll('.ssh-key-checkbox:checked').length;
            bulkDeleteSshKeysBtn.disabled = checkedCount === 0;
        }
    }
};

// グローバル関数として公開（モーダルタブ初期化用）
window.loadSshKeysForManagementModal = function() {
    console.log('🔑 [SSH] Global loadSshKeysForManagementModal called');
    if (window.SshKeyManagement && typeof window.SshKeyManagement.loadSshKeysForManagementModal === 'function') {
        window.SshKeyManagement.loadSshKeysForManagementModal();
    } else {
        console.error('❌ [SSH] SshKeyManagement.loadSshKeysForManagementModal not available');
    }
};
