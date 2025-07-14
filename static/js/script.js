document.addEventListener('DOMContentLoaded', function() {
    // ダークモードの切り替え
    const darkModeToggle = document.getElementById('darkModeToggle');
    const themeBody = document.getElementById('theme-body');

    // 保存されたテーマ設定を読み込む
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        themeBody.classList.add(savedTheme);
        if (savedTheme === 'dark-theme') {
            darkModeToggle.checked = true;
        }
    }

    darkModeToggle.addEventListener('change', function() {
        if (this.checked) {
            themeBody.classList.add('dark-theme');
            localStorage.setItem('theme', 'dark-theme');
        } else {
            themeBody.classList.remove('dark-theme');
            localStorage.setItem('theme', 'light-theme');
        }
    });

    // 設定モーダルの動的読み込み
    const configLink = document.getElementById('configLink');
    const configModalBody = document.getElementById('configModalBody');

    if (configLink) {
        configLink.addEventListener('click', function(e) {
            e.preventDefault();
            fetch('/config')
                .then(response => response.text())
                .then(html => {
                    configModalBody.innerHTML = html;
                    const configModal = new bootstrap.Modal(document.getElementById('configModal'));
                    configModal.show();
                    // モーダルコンテンツが読み込まれた後にJavaScriptを再初期化
                    initializeConfigModalScripts();
                })
                .catch(error => console.error('Error loading config modal:', error));
        });
    }

    // Pingステータスの更新関数
    function updatePingStatus() {
        document.querySelectorAll('.ping-status-box').forEach(box => {
            const serverId = box.id.replace('ping-status-', '');
            fetch(`/api/ping_status/${serverId}`)
                .then(response => response.json())
                .then(data => {
                    box.classList.remove('online', 'offline', 'checking', 'na');
                    if (data.status === 'online') {
                        box.classList.add('online');
                        box.textContent = 'Online';
                    } else if (data.status === 'offline') {
                        box.classList.add('offline');
                        box.textContent = 'Offline';
                    } else if (data.status === 'checking') {
                        box.classList.add('checking');
                        box.textContent = 'Checking...';
                    } else {
                        box.classList.add('na');
                        box.textContent = 'N/A';
                    }
                })
                .catch(error => {
                    console.error('Error fetching ping status:', error);
                    box.classList.remove('online', 'offline', 'checking');
                    box.classList.add('na');
                    box.textContent = 'N/A';
                });
        });
    }

    // ページ読み込み時と5秒ごとにPingステータスを更新
    updatePingStatus();
    setInterval(updatePingStatus, 5000);

    // --- SSHキーのドロップダウンをロードする ---
    function loadSshKeysForEditModal(selectedKeyId) {
        const sshKeySelect = document.getElementById('editServerSshKeyId');
        if (!sshKeySelect) return;

        fetch('/api/ssh_keys')
            .then(response => response.json())
            .then(keys => {
                sshKeySelect.innerHTML = '<option value="">SSHキーを選択...</option>'; // Reset
                keys.forEach(key => {
                    const option = document.createElement('option');
                    option.value = key.id;
                    option.textContent = key.name;
                    if (key.id === selectedKeyId) {
                        option.selected = true;
                    }
                    sshKeySelect.appendChild(option);
                });
            })
            .catch(error => console.error('Error loading SSH keys for modal:', error));
    }

    // --- 認証フィールドの表示を切り替える ---
    function toggleAuthFields(authMethod) {
        const passwordFields = document.getElementById('editPasswordFields');
        const sshKeyFields = document.getElementById('editSshKeyFields');
        const usernameInput = document.getElementById('editServerUsername');
        const sshUsernameInput = document.getElementById('editServerUsernameSsh');

        if (authMethod === 'ssh_key') {
            if (passwordFields) passwordFields.style.display = 'none';
            if (sshKeyFields) sshKeyFields.style.display = 'block';
            // SSHキーのユーザー名をメインのユーザー名フィールドに同期
            if (usernameInput) sshUsernameInput.value = usernameInput.value;
        } else { // password or default
            if (passwordFields) passwordFields.style.display = 'block';
            if (sshKeyFields) sshKeyFields.style.display = 'none';
        }
    }

    // イベントハンドラー関数を定義
    function handleEditServerClick() {
        const serverId = this.dataset.id;
        fetch(`/api/servers/${serverId}`)
            .then(response => response.ok ? response.json() : Promise.reject(response))
            .then(server => {
                const editModalElement = document.getElementById('editServerModal');
                const editModal = new bootstrap.Modal(editModalElement);

                // モーダルが表示される直前にフィールドを設定
                document.getElementById('editServerId').value = server.id;
                document.getElementById('editServerName').value = server.name;
                document.getElementById('editServerHost').value = server.host || '';
                document.getElementById('editServerPort').value = server.port || '22';
                document.getElementById('editServerType').value = server.type;
                document.getElementById('editServerUrl').value = server.url || '';
                document.getElementById('editServerDescription').value = server.description || '';
                document.getElementById('editServerTags').value = server.tags ? server.tags.join(', ') : '';
                
                // 認証方法を設定
                const authMethodSelect = document.getElementById('editAuthMethod');
                const usernameInput = document.getElementById('editServerUsername');
                const sshUsernameInput = document.getElementById('editServerUsernameSsh');
                const passwordInput = document.getElementById('editServerPassword');

                // サーバーデータに基づいて認証方法を設定
                const authMethod = server.auth_method || (server.ssh_key_id ? 'ssh_key' : 'password');
                authMethodSelect.value = authMethod;
                
                usernameInput.value = server.username || '';
                sshUsernameInput.value = server.username || '';
                passwordInput.value = server.password || '';

                // SSHキーのリストをロードし、サーバーのキーを選択
                loadSshKeysForEditModal(server.ssh_key_id);

                // 初期表示を正しく設定
                toggleAuthFields(authMethod);

                // 認証方法の変更イベントリスナーを設定
                authMethodSelect.onchange = () => toggleAuthFields(authMethodSelect.value);

                editModal.show();
            })
            .catch(error => {
                console.error('Error fetching server data:', error);
                alert('サーバーデータの取得に失敗しました。');
            });
    }

    function handleDeleteServerClick() {
        const serverId = this.dataset.id;
        if (confirm('本当にこのサーバーを削除しますか？')) {
            fetch(`/api/servers/${serverId}`, {
                method: 'DELETE'
            })
            .then(response => {
                if (!response.ok) {
                    return response.json().then(err => { throw err; });
                }
                // If the response is 204 No Content, don't try to parse JSON
                if (response.status === 204) {
                    return {}; // Return an empty object or null to proceed
                }
                return response.json();
            })
            .then(data => {
                alert('サーバーが削除されました！');
                loadServersForConfigModal(); // サーバーリストを再ロード
            })
            .catch(error => {
                console.error('Error deleting server:', error);
                alert('サーバーの削除に失敗しました: ' + (error.message || JSON.stringify(error)));
            });
        }
    }

    function handleSetupButtonClick() {
        const serverId = this.dataset.id;
        fetch(`/api/servers/${serverId}`)
            .then(response => {
                if (!response.ok) {
                    return response.json().then(err => { throw err; });
                }
                return response.json();
            })
            .then(server => {
                if (server) {
                    document.getElementById('editServerId').value = server.id;
                    document.getElementById('editServerName').value = server.name;
                    document.getElementById('editServerHost').value = server.host;
                    document.getElementById('editServerPort').value = server.port;
                    document.getElementById('editServerType').value = server.type;
                    document.getElementById('editServerUrl').value = server.url || '';
                    document.getElementById('editServerDescription').value = server.description || '';
                    document.getElementById('editServerTags').value = server.tags ? server.tags.join(', ') : '';
                    document.getElementById('editServerUsername').value = server.username || '';
                    document.getElementById('editServerPassword').value = server.password || '';
                    document.getElementById('editServerSshKeyPath').value = server.ssh_key_path || '';
                    document.getElementById('editServerSshKeyPassphrase').value = server.ssh_key_passphrase || '';

                    const editModal = new bootstrap.Modal(document.getElementById('editServerModal'));
                    editModal.show();
                }
            })
            .catch(error => {
                console.error('Error fetching server data for setup:', error);
                alert('サーバーデータの取得に失敗しました: ' + (error.message || JSON.stringify(error)));
            });
    }

    function handleConfirmDeleteClick() {
        const serverId = this.dataset.id;
        if (confirm('このサーバーを完全に削除しますか？')) {
            fetch(`/delete_server_permanently/${serverId}`, {
                method: 'POST'
            })
            .then(response => {
                if (!response.ok) {
                    return response.json().then(err => { throw err; });
                }
                return response.json();
            })
            .then(data => {
                alert('サーバーが完全に削除されました！');
                loadServersForConfigModal(); // サーバーリストを再ロード
            })
            .catch(error => {
                console.error('Error permanently deleting server:', error);
                alert('サーバーの完全削除に失敗しました: ' + (error.message || JSON.stringify(error)));
            });
        }
    }

    function handleCancelDeleteClick() {
        const serverId = this.dataset.id;
        if (confirm('このサーバーの削除を取り消し、維持しますか？')) {
            fetch(`/cancel_delete_server/${serverId}`, {
                method: 'POST'
            })
            .then(response => {
                if (!response.ok) {
                    return response.json().then(err => { throw err; });
                }
                return response.json();
            })
            .then(data => {
                alert('サーバーの削除が取り消されました！');
                loadServersForConfigModal(); // サーバーリストを再ロード
            })
            .catch(error => {
                console.error('Error canceling server delete:', error);
                alert('サーバーの削除取り消しに失敗しました: ' + (error.message || JSON.stringify(error)));
            });
        }
    }

    function initializeConfigModalScripts() {
        // SSHキー管理タブのイベントリスナー
        const sshKeysTab = document.getElementById('ssh-keys-tab');
        if (sshKeysTab) {
            sshKeysTab.addEventListener('shown.bs.tab', function () {
                const sshKeysPane = document.getElementById('ssh-keys-pane');
                // コンテンツがまだロードされていない場合のみロードする
                if (sshKeysPane && sshKeysPane.innerHTML.trim() === '') {
                    fetch('/ssh_keys_content')
                        .then(response => response.text())
                        .then(html => {
                            sshKeysPane.innerHTML = html;
                            initializeSshKeyManagementScripts();
                        })
                        .catch(error => console.error('Error loading SSH keys content:', error));
                }
            }, { once: true }); // 一度だけ実行
        }

        // サーバー設定タブのコンテンツをロードする関数
        function loadServerConfigContent() {
            const configModalBody = document.getElementById('configModalBody');
            fetch('/config')
                .then(response => response.text())
                .then(html => {
                    configModalBody.innerHTML = html;
                    // 設定モーダルのスクリプトを再初期化
                    initializeConfigModalScripts();
                    // 動的にロードされた後、サーバーリストをロード
                    loadServersForConfigModal();
                    loadExtraImportUrl();
                })
                .catch(error => console.error('Error reloading config modal content:', error));
        }

        // フォーム送信処理 (既存のconfigFormがあれば)
        const configForm = document.getElementById('configForm');
        if (configForm) {
            configForm.addEventListener('submit', function(e) {
                e.preventDefault();
                const formData = new FormData(configForm);
                fetch('/save_config', {
                    method: 'POST',
                    body: formData
                })
                .then(response => {
                    if (!response.ok) {
                        return response.json().then(err => { throw err; });
                    }
                    return response.json();
                })
                .then(data => {
                    alert('設定が保存されました！');
                    const configModal = bootstrap.Modal.getInstance(document.getElementById('configModal'));
                    configModal.hide();
                    location.reload();
                })
                .catch(error => {
                    console.error('Error saving config:', error);
                    alert('設定の保存に失敗しました: ' + (error.message || JSON.stringify(error)));
                });
            });
        }

        // SSHキー管理モーダルが開かれたときにSSHキーリストをロード
        const sshKeyManagementModalElement = document.getElementById('sshKeyManagementModal');
        if (sshKeyManagementModalElement) {
            sshKeyManagementModalElement.addEventListener('shown.bs.modal', function () {
                loadSshKeysForManagementModal();
            });
        }

        // SSHキー追加/編集モーダルが開かれたときにフォームをリセット
        const addSshKeyModalElement = document.getElementById('addSshKeyModal');
        if (addSshKeyModalElement) {
            addSshKeyModalElement.addEventListener('shown.bs.modal', function () {
                document.getElementById('sshKeyForm').reset();
                document.getElementById('sshKeyId').value = ''; // IDをクリアして新規追加モードにする
            });
        }

        // Extra Import URL設定フォームの送信処理
        const extraImportForm = document.getElementById('extra-import-form');
        if (extraImportForm) {
            extraImportForm.addEventListener('submit', function(e) {
                e.preventDefault();
                const extraImportUrlInput = document.getElementById('extra-import-url');
                const newUrl = extraImportUrlInput.value;

                fetch('/api/extra_import_url', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ url: newUrl })
                })
                .then(response => {
                    if (!response.ok) {
                        return response.json().then(err => { throw err; });
                    }
                    return response.json();
                })
                .then(data => {
                    if (data.confirmation_needed) {
                        const extraImportConfirmModal = new bootstrap.Modal(document.getElementById('extraImportConfirmModal'));
                        extraImportConfirmModal.show();

                        document.getElementById('extraImportConfirmDeleteBtn').onclick = () => {
                            sendExtraImportConfirmation('delete_all');
                            extraImportConfirmModal.hide();
                        };
                        document.getElementById('extraImportConfirmKeepBtn').onclick = () => {
                            sendExtraImportConfirmation('keep_all');
                            extraImportConfirmModal.hide();
                        };
                        document.getElementById('extraImportConfirmCancelBtn').onclick = () => {
                            sendExtraImportConfirmation('cancel');
                            extraImportConfirmModal.hide();
                        };
                    } else {
                        alert(data.message);
                        loadExtraImportUrl(); // URLを再ロードして表示を更新
                        loadServersForConfigModal(); // サーバーリストを再ロード
                    }
                })
                .catch(error => {
                    console.error('Error saving Extra Import URL:', error);
                    alert('Extra Import URLの保存に失敗しました: ' + (error.message || JSON.stringify(error)));
                });
            });
        }

        function sendExtraImportConfirmation(action) {
            fetch('/api/extra_import_url/confirm', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ action: action })
            })
            .then(response => {
                if (!response.ok) {
                    return response.json().then(err => { throw err; });
                }
                return response.json();
            })
            .then(data => {
                alert(data.message);
                loadExtraImportUrl(); // URLを再ロードして表示を更新
                loadServersForConfigModal(); // サーバーリストを再ロード
            })
            .catch(error => {
                console.error('Error sending extra import confirmation:', error);
                alert('Extra Importの確認に失敗しました: ' + (error.message || JSON.stringify(error)));
            });
        }

        // Extra Import URLのロード
        function loadExtraImportUrl() {
            fetch('/api/extra_import_url')
                .then(response => response.json())
                .then(data => {
                    const extraImportUrlInput = document.getElementById('extra-import-url');
                    if (extraImportUrlInput) {
                        extraImportUrlInput.value = data.url || '';
                    }
                })
                .catch(error => console.error('Error loading extra import URL:', error));
        }

        // 設定モーダルが開かれたときにサーバーリストとExtra Import URLをロード
        const configModalElement = document.getElementById('configModal');
        if (configModalElement) {
            configModalElement.addEventListener('shown.bs.modal', function () {
                loadServersForConfigModal();
                loadExtraImportUrl(); // Extra Import URLもロード
            });
        }

        // サーバー選択機能の初期化（設定モーダル内）
        const bulkDeleteServersBtn = document.getElementById('bulkDeleteServersBtn');

        // 一括削除ボタンのクリックイベント（設定モーダル内）
        if (bulkDeleteServersBtn) {
            bulkDeleteServersBtn.removeEventListener('click', handleBulkDeleteServersClick); // 既存のリスナーを削除
            bulkDeleteServersBtn.addEventListener('click', handleBulkDeleteServersClick); // 新しいリスナーを追加
        }


        function handleBulkDeleteServersClick() {
            const selectedServerIds = [];
            document.querySelectorAll('.config-server-checkbox:checked').forEach(checkbox => {
                selectedServerIds.push(checkbox.dataset.serverId);
            });

            if (selectedServerIds.length > 0) {
                if (confirm(`${selectedServerIds.length}個のサーバーを本当に削除しますか？`)) {
                    fetch('/bulk_delete_servers', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ server_ids: selectedServerIds })
                    })
                    .then(response => {
                        if (!response.ok) {
                            return response.json().then(err => { throw err; });
                        }
                        return response.json();
                    })
                    .then(data => {
                        alert('選択されたサーバーが削除されました！');
                        // サーバーリストを再ロードしてUIを更新
                        loadServersForConfigModal();
                    })
                    .catch(error => {
                        console.error('Error during bulk delete:', error);
                        alert('サーバーの一括削除に失敗しました: ' + (error.message || JSON.stringify(error)));
                    });
                }
            } else {
                alert('削除するサーバーを選択してください。');
            }
        }

    }

    // SSHキー管理モーダル用の関数群
    function loadSshKeysForManagementModal() {
        fetch('/api/ssh_keys')
            .then(response => response.json())
            .then(sshKeys => {
                const sshKeyListDiv = document.getElementById('ssh-key-list');
                if (!sshKeyListDiv) return;
                sshKeyListDiv.innerHTML = ''; // Clear existing content

                if (sshKeys.length === 0) {
                    sshKeyListDiv.innerHTML = '<p>SSHキーはまだ登録されていません。</p>';
                    return;
                }

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
                    sshKeyListDiv.insertAdjacentHTML('beforeend', keyItemHtml);
                });

                updateBulkDeleteSshKeysButtonVisibility();
            })
            .catch(error => console.error('Error loading SSH keys:', error));
    }

    function updateBulkDeleteSshKeysButtonVisibility() {
        const bulkDeleteSshKeysBtn = document.getElementById('bulkDeleteSshKeysBtn');
        if (bulkDeleteSshKeysBtn) {
            const checkedCount = document.querySelectorAll('.ssh-key-checkbox:checked').length;
            bulkDeleteSshKeysBtn.disabled = checkedCount === 0;
        }
    }

    // SSHキー管理画面のスクリプトを初期化する関数
    function initializeSshKeyManagementScripts() {
        // 「新しいSSHキーを追加」ボタン
        const addNewSshKeyBtn = document.getElementById('addNewSshKeyBtn');
        if (addNewSshKeyBtn) {
            addNewSshKeyBtn.addEventListener('click', function() {
                // フォームをリセット
                const sshKeyForm = document.getElementById('sshKeyForm');
                if(sshKeyForm) sshKeyForm.reset();
                const sshKeyId = document.getElementById('sshKeyId');
                if(sshKeyId) sshKeyId.value = '';
                
                const addSshKeyModal = new bootstrap.Modal(document.getElementById('addSshKeyModal'));
                addSshKeyModal.show();
            });
        }

        // SSHキーリストの親要素にイベントリスナーを設定（イベントデリゲーション）
        const sshKeyListDiv = document.getElementById('ssh-key-list');
        if (sshKeyListDiv) {
            sshKeyListDiv.addEventListener('click', function(event) {
                const target = event.target;
                const keyId = target.dataset.id;

                // 編集ボタン
                if (target.classList.contains('edit-ssh-key-btn')) {
                    fetch(`/api/ssh_keys/${keyId}`)
                        .then(response => response.json())
                        .then(key => {
                            document.getElementById('sshKeyId').value = key.id;
                            document.getElementById('sshKeyName').value = key.name;
                            document.getElementById('sshKeyPath').value = key.path;
                            const addSshKeyModal = new bootstrap.Modal(document.getElementById('addSshKeyModal'));
                            addSshKeyModal.show();
                        })
                        .catch(error => console.error('Error fetching SSH key for edit:', error));
                }

                // 削除ボタン
                if (target.classList.contains('delete-ssh-key-btn')) {
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
                            alert('SSHキーが削除されました！');
                            loadSshKeysForManagementModal(); // リストを再ロード
                        })
                        .catch(error => console.error('Error deleting SSH key:', error));
                    }
                }
            });

            sshKeyListDiv.addEventListener('change', function(event) {
                if (event.target.classList.contains('ssh-key-checkbox')) {
                    updateBulkDeleteSshKeysButtonVisibility();
                }
            });
        }

        // 一括削除ボタン
        const bulkDeleteSshKeysBtn = document.getElementById('bulkDeleteSshKeysBtn');
        if (bulkDeleteSshKeysBtn) {
            bulkDeleteSshKeysBtn.addEventListener('click', function() {
                const selectedKeyIds = Array.from(document.querySelectorAll('.ssh-key-checkbox:checked')).map(cb => cb.dataset.keyId);
                if (selectedKeyIds.length > 0 && confirm(`${selectedKeyIds.length}個のSSHキーを本当に削除しますか？`)) {
                    fetch('/api/ssh_keys/bulk_delete', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ ids: selectedKeyIds })
                    })
                    .then(response => response.ok ? response.json() : response.json().then(err => { throw err; }))
                    .then(() => {
                        alert('選択されたSSHキーが削除されました！');
                        loadSshKeysForManagementModal(); // リストを再ロード
                    })
                    .catch(error => console.error('Error during bulk delete of SSH keys:', error));
                }
            });
        }
        
        // SSHキーリストを初回ロード
        loadSshKeysForManagementModal();

        // SSHキーのアップロード処理
        const uploadSshKeyFileBtn = document.getElementById('uploadSshKeyFileBtn');
        if (uploadSshKeyFileBtn) {
            uploadSshKeyFileBtn.addEventListener('click', function() {
                const sshKeyUploadInput = document.getElementById('sshKeyUpload');
                const file = sshKeyUploadInput.files[0];
                if (!file) {
                    alert('アップロードするファイルを選択してください。');
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
                    alert('SSHキーがアップロードされました！');
                    document.getElementById('sshKeyPath').value = data.path; // アップロードされたファイルのパスをセット
                    sshKeyUploadInput.value = ''; // ファイル選択をクリア
                })
                .catch(error => {
                    console.error('Error uploading SSH key:', error);
                    alert('SSHキーのアップロードに失敗しました: ' + error.message);
                });
            });
        }

        // SSHキー追加/編集フォームの送信処理
        const sshKeyForm = document.getElementById('sshKeyForm');
        if (sshKeyForm) {
            sshKeyForm.addEventListener('submit', function(e) {
                e.preventDefault();
                const keyId = document.getElementById('sshKeyId').value;
                const keyName = document.getElementById('sshKeyName').value;
                const keyPath = document.getElementById('sshKeyPath').value;

                const method = keyId ? 'PUT' : 'POST';
                const url = keyId ? `/api/ssh_keys/${keyId}` : '/api/ssh_keys';

                const payload = {
                    id: keyId || `sshkey-${Date.now()}-${Math.floor(Math.random() * 10000)}`, // 新規作成時はIDを生成
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
                    alert('SSHキーが保存されました！');
                    const addSshKeyModal = bootstrap.Modal.getInstance(document.getElementById('addSshKeyModal'));
                    addSshKeyModal.hide();
                    loadSshKeysForManagementModal(); // SSHキーリストを再ロード
                })
                .catch(error => {
                    console.error('Error saving SSH key:', error);
                    alert('SSHキーの保存に失敗しました: ' + (error.message || JSON.stringify(error)));
                });
            });
        }
    }

    // 設定モーダル内のサーバーリストをロードする関数
    function loadServersForConfigModal() {
        fetch('/api/servers')
            .then(response => response.json())
            .then(servers => {
                const serverListDiv = document.getElementById('server-list');
                if (!serverListDiv) return;
                serverListDiv.innerHTML = ''; // Clear existing content

                servers.forEach(server => {
                    const serverCardHtml = `
                        <div class="col-md-4">
                            <div class="card server-card config-server-card" data-server-id="${server.id}">
                                <div class="card-body server-card-body d-flex align-items-center">
                                    <div class="form-check config-checkbox-overlay">
                                        <input class="form-check-input config-server-checkbox" type="checkbox" value="" id="config-server-checkbox-${server.id}" data-server-id="${server.id}">
                                    </div>
                                    <i class="server-card-icon fas ${server.type === 'node' ? 'fa-server node' : server.type === 'virtual_machine' ? 'fa-laptop virtual_machine' : server.type === 'network_device' ? 'fa-network-wired network_device' : server.type === 'kvm' ? 'fa-boxes-stacked kvm' : 'fa-question-circle'}"></i>
                                    <div class="server-card-info">
                                        <h5 class="card-title server-card-title">${server.name}</h5>
                                        <p class="card-text server-card-text"><strong>タイプ:</strong> ${server.display_type || server.type}</p>
                                        ${server.host ? `<p class="card-text server-card-text"><strong>ホスト:</strong> ${server.host}</p>` : ''}
                                        ${server.url ? `<p class="card-text server-card-text"><strong>URL:</strong> <a href="${server.url}" target="_blank">${server.url}</a></p>` : ''}
                                        ${server.description ? `<p class="card-text server-card-text">${server.description}</p>` : ''}
                                        ${server.tags && server.tags.length > 0 ? `
                                        <div class="server-card-tags">
                                            ${server.tags.map(tag => `<span class="badge bg-secondary">${tag}</span>`).join('')}
                                        </div>` : ''}
                                        <div class="d-flex align-items-center mt-2">
                                            <div class="ping-status-box" id="ping-status-${server.id}"></div>
                                        </div>
                                    </div>
                                </div>
                                <div class="card-footer server-card-footer">
                                    <button class="btn btn-sm btn-primary edit-server-btn" data-id="${server.id}">編集</button>
                                    <button class="btn btn-sm btn-danger delete-server-btn" data-id="${server.id}">削除</button>
                                </div>
                            </div>
                        </div>
                    `;
                    serverListDiv.insertAdjacentHTML('beforeend', serverCardHtml);
                });

                // サーバー選択機能の初期化（設定モーダル内）
                const bulkDeleteServersBtn = document.getElementById('bulkDeleteServersBtn');
                const configServerCheckboxes = document.querySelectorAll('.config-server-checkbox');

                function updateBulkDeleteButtonVisibility() {
                    const checkedCount = document.querySelectorAll('.config-server-checkbox:checked').length;
                    if (bulkDeleteServersBtn) {
                        bulkDeleteServersBtn.disabled = checkedCount === 0;
                    }
                }

                configServerCheckboxes.forEach(checkbox => {
                    checkbox.addEventListener('change', function() {
                        const serverCard = this.closest('.config-server-card');
                        if (this.checked) {
                            serverCard.classList.add('selected');
                        } else {
                            serverCard.classList.remove('selected');
                        }
                        updateBulkDeleteButtonVisibility();
                    });
                });

                // パネルクリックでチェックボックスをトグル（設定モーダル内）
                document.querySelectorAll('.config-server-card .server-card-body').forEach(cardBody => {
                    cardBody.addEventListener('click', function(event) {
                        // チェックボックス自体がクリックされた場合は何もしない
                        if (event.target.classList.contains('config-server-checkbox')) {
                            return;
                        }
                        const checkbox = this.querySelector('.config-server-checkbox');
                        if (checkbox) {
                            checkbox.checked = !checkbox.checked;
                            // 手動でchangeイベントを発火させて、selectedクラスのトグルとボタンの表示更新を行う
                            checkbox.dispatchEvent(new Event('change'));
                        }
                    });
                });

                // Pingステータスの更新をここでも呼び出す
                updatePingStatus();

                // 個別サーバーの編集・削除ボタンのイベントリスナーを再設定
                attachServerCardEventListeners();
            })
            .catch(error => console.error('Error loading servers for config modal:', error));
    }

    // 個別サーバーカードの編集・削除ボタンにイベントリスナーをアタッチする関数
    function attachServerCardEventListeners() {
        // サーバー編集ボタンのイベントリスナー
        document.querySelectorAll('.edit-server-btn').forEach(button => {
            button.removeEventListener('click', handleEditServerClick); // 既存のリスナーを削除
            button.addEventListener('click', handleEditServerClick); // 新しいリスナーを追加
        });

        // サーバー削除ボタンのイベントリスナー
        document.querySelectorAll('.delete-server-btn').forEach(button => {
            button.removeEventListener('click', handleDeleteServerClick); // 既存のリスナーを削除
            button.addEventListener('click', handleDeleteServerClick); // 新しいリスナーを追加
        });

        // 新規サーバー設定ボタンのイベントリスナー
        document.querySelectorAll('.setup-btn').forEach(button => {
            button.removeEventListener('click', handleSetupButtonClick); // 既存のリスナーを削除
            button.addEventListener('click', handleSetupButtonClick); // 新しいリスナーを追加
        });

        // 削除確認ボタンのイベントリスナー
        document.querySelectorAll('.confirm-delete-btn').forEach(button => {
            button.removeEventListener('click', handleConfirmDeleteClick); // 既存のリスナーを削除
            button.addEventListener('click', handleConfirmDeleteClick); // 新しいリスナーを追加
        });

        // 削除キャンセルボタンのイベントリスナー
        document.querySelectorAll('.cancel-delete-btn').forEach(button => {
            button.removeEventListener('click', handleCancelDeleteClick); // 既存のリスナーを削除
            button.addEventListener('click', handleCancelDeleteClick); // 新しいリスナーを追加
        });
    }

    // サーバー編集フォームの送信処理
    const editServerForm = document.getElementById('editServerForm');
    if (editServerForm) {
        editServerForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const serverId = document.getElementById('editServerId').value;
            const authMethod = document.getElementById('editAuthMethod').value;
            
            const formData = new FormData(editServerForm);
            const payload = Object.fromEntries(formData.entries());

            if (authMethod === 'ssh_key') {
                payload.username = payload.username_ssh;
                delete payload.username_ssh;
                delete payload.password;
            } else {
                delete payload.username_ssh;
                delete payload.ssh_key_id;
            }

            fetch(`/api/servers/${serverId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })
            .then(response => response.ok ? response.json() : Promise.reject('サーバー情報の更新に失敗しました。'))
            .then(() => {
                alert('サーバー情報が更新されました！');
                const editModal = bootstrap.Modal.getInstance(document.getElementById('editServerModal'));
                if (editModal) {
                    editModal.hide();
                }
                location.reload(); // ページをリロードして変更を反映
            })
            .catch(error => {
                console.error('Error updating server:', error);
                alert(error);
            });
        });
    }

    // メインページのサーバーカードにイベントリスナーを設定
    attachServerCardEventListeners();
});