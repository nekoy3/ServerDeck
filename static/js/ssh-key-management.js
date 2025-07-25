// SSHキー管理機能
window.SshKeyManagement = {
    initialized: false,
    
    // 初期化
    initialize: function() {
        // 重複初期化を防ぐ
        if (this.initialized) {
            console.log('SshKeyManagement already initialized');
            return;
        }
        
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
        
        // SSHキーリストを初回ロード
        SshKeyManagement.loadSshKeysForManagementModal();

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
        
        // 初期化完了フラグ
        this.initialized = true;
        console.log('SshKeyManagement initialized');
    },

    // SSHキー編集
    editSshKey: function(keyId, sshKeyIdInput, sshKeyNameInput, sshKeyPathInput, sshKeyFormTitle, sshKeyListView, sshKeyFormView) {
        fetch(`/api/ssh_keys/${keyId}`)
            .then(response => response.json())
            .then(key => {
                if(sshKeyIdInput) sshKeyIdInput.value = key.id;
                if(sshKeyNameInput) sshKeyNameInput.value = key.name;
                if(sshKeyPathInput) sshKeyPathInput.value = key.path;
                
                if(sshKeyFormTitle) sshKeyFormTitle.textContent = 'SSHキーを編集';
                if(sshKeyListView) sshKeyListView.classList.add('d-none');
                if(sshKeyFormView) sshKeyFormView.classList.remove('d-none');
            })
            .catch(error => console.error('Error fetching SSH key for edit:', error));
    },

    // SSHキー削除
    deleteSshKey: function(keyId) {
        if (confirm('本当にこのSSHキーを削除しますか？')) {
            fetch(`/api/ssh_keys/${keyId}`, {
                method: 'DELETE'
            })
            .then(response => {
                if (!response.ok) {
                    return response.json().then(err => { throw err; });
                }
                if (response.status === 204) { return {}; }
                return response.json();
            })
            .then(() => {
                NotificationManager.success('SSHキーが削除されました！');
                SshKeyManagement.loadSshKeysForManagementModal();
            })
            .catch(error => console.error('Error deleting SSH key:', error));
        }
    },

    // SSHキー一括削除
    bulkDeleteSshKeys: function() {
        const selectedKeyIds = Array.from(document.querySelectorAll('.ssh-key-checkbox:checked')).map(cb => cb.dataset.keyId);
        if (selectedKeyIds.length > 0 && confirm(`${selectedKeyIds.length}個のSSHキーを本当に削除しますか？`)) {
            fetch('/api/ssh_keys/bulk_delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: selectedKeyIds })
            })
            .then(response => response.ok ? response.json() : response.json().then(err => { throw err; }))
            .then(() => {
                NotificationManager.success('選択されたSSHキーが削除されました！');
                SshKeyManagement.loadSshKeysForManagementModal();
            })
            .catch(error => console.error('Error during bulk delete of SSH keys:', error));
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

        fetch('/api/ssh_keys/upload', {
            method: 'POST',
            body: formData
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => { throw new Error(err.error || 'Unknown error'); });
            }
            return response.json();
        })
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

        const method = keyId ? 'PUT' : 'POST';
        const url = keyId ? `/api/ssh_keys/${keyId}` : '/api/ssh_keys';

        const payload = {
            id: keyId || `sshkey-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
            name: keyName,
            path: keyPath
        };

        fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => { throw err; });
            }
            return response.json();
        })
        .then(data => {
            NotificationManager.success('SSHキーが保存されました！');
            if(sshKeyFormView) sshKeyFormView.classList.add('d-none');
            if(sshKeyListView) sshKeyListView.classList.remove('d-none');
            SshKeyManagement.loadSshKeysForManagementModal();
        })
        .catch(error => {
            console.error('Error saving SSH key:', error);
            NotificationManager.error('SSHキーの保存に失敗しました: ' + error.message);
        });
    },

    // SSHキー管理モーダル用のリスト読み込み
    loadSshKeysForManagementModal: function() {
        fetch('/api/ssh_keys')
            .then(response => response.json())
            .then(sshKeys => {
                const sshKeyListDiv = document.getElementById('ssh-key-list');
                if (!sshKeyListDiv) return;
                sshKeyListDiv.innerHTML = '';

                if (sshKeys.length === 0) {
                    sshKeyListDiv.innerHTML = '<p>SSHキーはまだ登録されていません。</p>';
                    return;
                }

                let allKeyItemsHtml = '';
                sshKeys.forEach(key => {
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

                sshKeyListDiv.innerHTML = allKeyItemsHtml;
                SshKeyManagement.updateBulkDeleteSshKeysButtonVisibility();
            })
            .catch(error => {
                console.error('Error loading SSH keys:', error);
                NotificationManager.error('SSHキーのロードに失敗しました: ' + error.message);
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
