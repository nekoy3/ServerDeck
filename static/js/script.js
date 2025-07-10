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

    function initializeConfigModalScripts() {
        // フォーム送信処理
        const configForm = document.getElementById('configForm');
        if (configForm) {
            configForm.addEventListener('submit', function(e) {
                e.preventDefault();
                const formData = new FormData(configForm);
                fetch('/save_config', {
                    method: 'POST',
                    body: formData
                })
                .then(response => response.json())
                .then(data => {
                    if (data.status === 'success') {
                        alert('設定が保存されました！');
                        // モーダルを閉じる
                        const configModal = bootstrap.Modal.getInstance(document.getElementById('configModal'));
                        configModal.hide();
                        // ページをリロードして変更を反映
                        location.reload();
                    } else {
                        alert('設定の保存に失敗しました: ' + data.message);
                    }
                })
                .catch(error => console.error('Error saving config:', error));
            });
        }

        // SSHキーのアップロード処理
        const sshKeyUploadForm = document.getElementById('sshKeyUploadForm');
        if (sshKeyUploadForm) {
            sshKeyUploadForm.addEventListener('submit', function(e) {
                e.preventDefault();
                const formData = new FormData(sshKeyUploadForm);
                fetch('/upload_ssh_key', {
                    method: 'POST',
                    body: formData
                })
                .then(response => response.json())
                .then(data => {
                    if (data.status === 'success') {
                        alert('SSHキーがアップロードされました！');
                        // フォームをリセット
                        sshKeyUploadForm.reset();
                        // SSHキーリストを更新（必要であれば）
                    } else {
                        alert('SSHキーのアップロードに失敗しました: ' + data.message);
                    }
                })
                .catch(error => console.error('Error uploading SSH key:', error));
            });
        }

        // サーバー編集ボタンのイベントリスナー
        document.querySelectorAll('.edit-server-btn').forEach(button => {
            button.addEventListener('click', function() {
                const serverId = this.dataset.id;
                fetch(`/get_server/${serverId}`)
                    .then(response => response.json())
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
                    .catch(error => console.error('Error fetching server data:', error));
            });
        });

        // サーバー編集フォームの送信処理
        const editServerForm = document.getElementById('editServerForm');
        if (editServerForm) {
            editServerForm.addEventListener('submit', function(e) {
                e.preventDefault();
                const formData = new FormData(editServerForm);
                const serverId = document.getElementById('editServerId').value;
                fetch(`/update_server/${serverId}`, {
                    method: 'POST',
                    body: formData
                })
                .then(response => response.json())
                .then(data => {
                    if (data.status === 'success') {
                        alert('サーバー情報が更新されました！');
                        const editModal = bootstrap.Modal.getInstance(document.getElementById('editServerModal'));
                        editModal.hide();
                        location.reload();
                    } else {
                        alert('サーバー情報の更新に失敗しました: ' + data.message);
                    }
                })
                .catch(error => console.error('Error updating server:', error));
            });
        }

        // サーバー削除ボタンのイベントリスナー
        document.querySelectorAll('.delete-server-btn').forEach(button => {
            button.addEventListener('click', function() {
                const serverId = this.dataset.id;
                if (confirm('本当にこのサーバーを削除しますか？')) {
                    fetch(`/delete_server/${serverId}`, {
                        method: 'POST'
                    })
                    .then(response => response.json())
                    .then(data => {
                        if (data.status === 'success') {
                            alert('サーバーが削除されました！');
                            location.reload();
                        } else {
                            alert('サーバーの削除に失敗しました: ' + data.message);
                        }
                    })
                    .catch(error => console.error('Error deleting server:', error));
                }
            });
        });

        // 新規サーバー追加フォームの送信処理
        const addServerForm = document.getElementById('addServerForm');
        if (addServerForm) {
            addServerForm.addEventListener('submit', function(e) {
                e.preventDefault();
                const formData = new FormData(addServerForm);
                fetch('/add_server', {
                    method: 'POST',
                    body: formData
                })
                .then(response => response.json())
                .then(data => {
                    if (data.status === 'success') {
                        alert('サーバーが追加されました！');
                        addServerForm.reset();
                        location.reload();
                    } else {
                        alert('サーバーの追加に失敗しました: ' + data.message);
                    }
                })
                .catch(error => console.error('Error adding server:', error));
            });
        }

        // Extra Import URL設定フォームの送信処理
        const extraImportForm = document.getElementById('extraImportForm');
        if (extraImportForm) {
            extraImportForm.addEventListener('submit', function(e) {
                e.preventDefault();
                const formData = new FormData(extraImportForm);
                fetch('/save_extra_import_url', {
                    method: 'POST',
                    body: formData
                })
                .then(response => response.json())
                .then(data => {
                    if (data.status === 'success') {
                        alert('Extra Import URLが保存されました！');
                        // フォームをリセット
                        extraImportForm.reset();
                        // ページをリロードして変更を反映
                        location.reload();
                    } else {
                        alert('Extra Import URLの保存に失敗しました: ' + data.message);
                    }
                })
                .catch(error => console.error('Error saving Extra Import URL:', error));
            });
        }

        // Extra Import URLの削除処理
        const deleteExtraImportUrlBtn = document.getElementById('deleteExtraImportUrlBtn');
        if (deleteExtraImportUrlBtn) {
            deleteExtraImportUrlBtn.addEventListener('click', function() {
                if (confirm('本当にExtra Import URLを削除しますか？')) {
                    fetch('/delete_extra_import_url', {
                        method: 'POST'
                    })
                    .then(response => response.json())
                    .then(data => {
                        if (data.status === 'success') {
                            alert('Extra Import URLが削除されました！');
                            location.reload();
                        } else {
                            alert('Extra Import URLの削除に失敗しました: ' + data.message);
                        }
                    })
                    .catch(error => console.error('Error deleting Extra Import URL:', error));
                }
            });
        }

        // 新規サーバー設定ボタンのイベントリスナー
        document.querySelectorAll('.setup-btn').forEach(button => {
            button.addEventListener('click', function() {
                const serverId = this.dataset.id;
                // 既存の編集モーダルを再利用
                fetch(`/get_server/${serverId}`)
                    .then(response => response.json())
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
                    .catch(error => console.error('Error fetching server data for setup:', error));
            });
        });

        // 削除確認ボタンのイベントリスナー
        document.querySelectorAll('.confirm-delete-btn').forEach(button => {
            button.addEventListener('click', function() {
                const serverId = this.dataset.id;
                if (confirm('このサーバーを完全に削除しますか？')) {
                    fetch(`/delete_server_permanently/${serverId}`, {
                        method: 'POST'
                    })
                    .then(response => response.json())
                    .then(data => {
                        if (data.status === 'success') {
                            alert('サーバーが完全に削除されました！');
                            location.reload();
                        } else {
                            alert('サーバーの完全削除に失敗しました: ' + data.message);
                        }
                    })
                    .catch(error => console.error('Error permanently deleting server:', error));
                }
            });
        });

        // 削除キャンセルボタンのイベントリスナー
        document.querySelectorAll('.cancel-delete-btn').forEach(button => {
            button.addEventListener('click', function() {
                const serverId = this.dataset.id;
                if (confirm('このサーバーの削除を取り消し、維持しますか？')) {
                    fetch(`/cancel_delete_server/${serverId}`, {
                        method: 'POST'
                    })
                    .then(response => response.json())
                    .then(data => {
                        if (data.status === 'success') {
                            alert('サーバーの削除が取り消されました！');
                            location.reload();
                        } else {
                            alert('サーバーの削除取り消しに失敗しました: ' + data.message);
                        }
                    })
                    .catch(error => console.error('Error canceling server delete:', error));
                }
            });
        });

        // 設定モーダルが開かれたときにサーバーリストをロード
        const configModalElement = document.getElementById('configModal');
        if (configModalElement) {
            configModalElement.addEventListener('shown.bs.modal', function () {
                loadServersForConfigModal();
            });
        }
    }

    // 設定モーダル内のサーバーリストをロードする関数
    function loadServersForConfigModal() {
        fetch('/api/servers')
            .then(response => response.json())
            .then(servers => {
                const serverListDiv = document.getElementById('server-list');
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
                    if (checkedCount > 0) {
                        bulkDeleteServersBtn.disabled = false;
                    } else {
                        bulkDeleteServersBtn.disabled = true;
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

                // 一括削除ボタンのクリックイベント（設定モーダル内）
                bulkDeleteServersBtn.addEventListener('click', function() {
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
                            .then(response => response.json())
                            .then(data => {
                                if (data.status === 'success') {
                                    alert('選択されたサーバーが削除されました！');
                                    // サーバーリストを再ロードしてUIを更新
                                    loadServersForConfigModal();
                                } else {
                                    alert('サーバーの一括削除に失敗しました: ' + data.message);
                                }
                            })
                            .catch(error => console.error('Error during bulk delete:', error));
                        }
                    } else {
                        alert('削除するサーバーを選択してください。');
                    }
                });

                // Pingステータスの更新をここでも呼び出す
                updatePingStatus();
            })
            .catch(error => console.error('Error loading servers for config modal:', error));
    }
});