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
                    // サーバー設定タブがデフォルトで開くため、初回ロード時にサーバーリストを明示的にロード
                    loadServersForConfigModal();
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
        // 各タブが最初に表示されるときに、それぞれの初期化関数を一度だけ呼び出す
        const serverTab = document.getElementById('servers-tab');
        if(serverTab) {
            serverTab.addEventListener('show.bs.tab', loadServersForConfigModal, { once: true });
        }

        const sshKeysTab = document.getElementById('ssh-keys-tab');
        if (sshKeysTab) {
            sshKeysTab.addEventListener('show.bs.tab', initializeSshKeyManagementScripts, { once: true });
        }

        // 必要に応じて他のタブの初期化もここに追加
    }

    // SSHキー管理画面のスクリプトを初期化する関数
    function initializeSshKeyManagementScripts() {
        console.log('initializeSshKeyManagementScripts called');

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
            addNewSshKeyBtn.addEventListener('click', function() {
                // フォームをリセット
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
            cancelSshKeyFormBtn.addEventListener('click', function() {
                if(sshKeyFormView) sshKeyFormView.classList.add('d-none');
                if(sshKeyListView) sshKeyListView.classList.remove('d-none');
                loadSshKeysForManagementModal(); // リストを再ロード
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
                            if(sshKeyIdInput) sshKeyIdInput.value = key.id;
                            if(sshKeyNameInput) sshKeyNameInput.value = key.name;
                            if(sshKeyPathInput) sshKeyPathInput.value = key.path;
                            
                            if(sshKeyFormTitle) sshKeyFormTitle.textContent = 'SSHキーを編集';
                            if(sshKeyListView) sshKeyListView.classList.add('d-none');
                            if(sshKeyFormView) sshKeyFormView.classList.remove('d-none');
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
                    if(sshKeyPathInput) sshKeyPathInput.value = data.path; // アップロードされたファイルのパスをセット
                    if(sshKeyUploadInput) sshKeyUploadInput.value = ''; // ファイル選択をクリア
                })
                .catch(error => {
                    console.error('Error uploading SSH key:', error);
                    alert('SSHキーのアップロードに失敗しました: ' + error.message);
                });
            });
        }

        // SSHキー追加/編集フォームの送信処理
        if (sshKeyForm) {
            sshKeyForm.addEventListener('submit', function(e) {
                e.preventDefault();
                const keyId = sshKeyIdInput.value;
                const keyName = sshKeyNameInput.value;
                const keyPath = sshKeyPathInput.value;

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
                    alert('SSHキーが保存されました！'); // 成功メッセージを表示
                    if(sshKeyFormView) sshKeyFormView.classList.add('d-none'); // フォームを非表示
                    if(sshKeyListView) sshKeyListView.classList.remove('d-none'); // リストを表示
                    loadSshKeysForManagementModal(); // SSHキーリストを再ロード
                })
                .catch(error => {
                    console.error('Error saving SSH key:', error);
                    alert('SSHキーの保存に失敗しました: ' + (error.message || JSON.stringify(error)));
                });
            });
        }
    }

    // SSHキー管理モーダル用の関数群
    function loadSshKeysForManagementModal() {
        console.log('loadSshKeysForManagementModal called'); // ここにログを追加
        fetch('/api/ssh_keys')
            .then(response => response.json())
            .then(sshKeys => {
                console.log('SSH keys fetched successfully:', sshKeys); // ここにログを追加
                const sshKeyListDiv = document.getElementById('ssh-key-list');
                if (!sshKeyListDiv) return;
                sshKeyListDiv.innerHTML = ''; // Clear existing content

                if (sshKeys.length === 0) {
                    sshKeyListDiv.innerHTML = '<p>SSHキーはまだ登録されていません。</p>';
                    return;
                }

                let allKeyItemsHtml = ''; // すべてのHTMLを格納する変数
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
                    allKeyItemsHtml += keyItemHtml; // HTML文字列を追加
                });

                sshKeyListDiv.innerHTML = allKeyItemsHtml; // 一度にDOMに挿入

                updateBulkDeleteSshKeysButtonVisibility();
            })
            .catch(error => {
                console.error('Error loading SSH keys:', error);
                alert('SSHキーのロードに失敗しました: ' + (error.message || JSON.stringify(error)));
            });
    }

    function updateBulkDeleteSshKeysButtonVisibility() {
        const bulkDeleteSshKeysBtn = document.getElementById('bulkDeleteSshKeysBtn');
        if (bulkDeleteSshKeysBtn) {
            const checkedCount = document.querySelectorAll('.ssh-key-checkbox:checked').length;
            bulkDeleteSshKeysBtn.disabled = checkedCount === 0;
        }
    }

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
                alert('SSHキーが保存されました！'); // 成功メッセージを表示
                sshKeyFormView.classList.add('d-none'); // フォームを非表示
                sshKeyListView.classList.remove('d-none'); // リストを表示
                loadSshKeysForManagementModal(); // SSHキーリストを再ロード
            })
            .catch(error => {
                console.error('Error saving SSH key:', error);
                alert('SSHキーの保存に失敗しました: ' + (error.message || JSON.stringify(error)));
            });
        });
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

                // Pingステータスの更新をここでも呼び出す
                updatePingStatus();

                // 個別サーバーの編集・削除ボタン、および一括削除関連のイベントリスナーを再設定
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

        // --- 一括削除ボタンとチェックボックスのイベントリスナー --- 
        const bulkDeleteServersBtn = document.getElementById('bulkDeleteServersBtn');

        function updateBulkDeleteButtonVisibility() {
            const checkedCount = document.querySelectorAll('.config-server-checkbox:checked').length;
            if (bulkDeleteServersBtn) {
                bulkDeleteServersBtn.disabled = checkedCount === 0;
            }
        }

        // チェックボックスのイベントリスナーを再設定
        document.querySelectorAll('.config-server-checkbox').forEach(checkbox => {
            checkbox.removeEventListener('change', updateBulkDeleteButtonVisibility); // 既存のリスナーを削除
            checkbox.addEventListener('change', updateBulkDeleteButtonVisibility); // 新しいリスナーを追加
        });

        // パネルクリックでチェックボックスをトグル（設定モーダル内）
        document.querySelectorAll('.config-server-card .server-card-body').forEach(cardBody => {
            // 既存のリスナーを削除（もしあれば）
            cardBody.removeEventListener('click', function(event) {
                if (event.target.classList.contains('config-server-checkbox')) {
                    return;
                }
                const checkbox = this.querySelector('.config-server-checkbox');
                if (checkbox) {
                    checkbox.checked = !checkbox.checked;
                    checkbox.dispatchEvent(new Event('change'));
                }
            });
            // 新しいリスナーを追加
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

        // 一括削除ボタンのイベントリスナー
        if (bulkDeleteServersBtn) {
            // 既存のリスナーを削除（もしあれば）
            bulkDeleteServersBtn.removeEventListener('click', handleBulkDeleteServersClick);
            bulkDeleteServersBtn.addEventListener('click', handleBulkDeleteServersClick);
        }

        // 初回ロード時にボタンの状態を更新
        updateBulkDeleteButtonVisibility();
    }

    // 一括削除ボタンのクリックハンドラを定義
    function handleBulkDeleteServersClick() {
        const selectedServerIds = Array.from(document.querySelectorAll('.config-server-checkbox:checked')).map(cb => cb.dataset.serverId);
        if (selectedServerIds.length > 0 && confirm(`${selectedServerIds.length}個のサーバーを本当に削除しますか？`)) {
            fetch('/bulk_delete_servers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ server_ids: selectedServerIds })
            })
            .then(response => response.ok ? response.json() : response.json().then(err => { throw err; }))
            .then(() => {
                alert('選択されたサーバーが削除されました！');
                loadServersForConfigModal(); // サーバーリストを再ロード
            })
            .catch(error => console.error('Error during bulk delete of servers:', error));
        }
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
                loadServersForConfigModal(); // サーバーリストを再ロードして変更を反映
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