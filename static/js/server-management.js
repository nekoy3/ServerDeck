// サーバー管理機能
window.ServerManagement = {
    // メインページのサーバーカードを更新する関数
    updateMainPageServerCards: function() {
        fetch('/api/servers')
            .then(response => response.json())
            .then(servers => {
                // メインページ上のすべてのサーバーカードを更新
                servers.forEach(server => {
                    const serverCard = document.querySelector(`[data-server-id="${server.id}"]`);
                    if (serverCard && !serverCard.classList.contains('config-server-card')) {
                        // 緑枠・赤枠の更新
                        serverCard.classList.remove('border-success', 'border-danger');
                        if (server.is_new) {
                            serverCard.classList.add('border-success');
                        } else if (server.is_deleted) {
                            serverCard.classList.add('border-danger');
                        }

                        // サーバー情報の更新
                        const titleElement = serverCard.querySelector('.server-card-title');
                        const typeElement = serverCard.querySelector('.server-card-text');
                        if (titleElement) titleElement.textContent = server.name;
                        if (typeElement) typeElement.innerHTML = `<strong>タイプ:</strong> ${server.display_type || server.type}`;

                        // ボタンの更新
                        const cardFooter = serverCard.querySelector('.server-card-footer');
                        if (cardFooter) {
                            let buttonsHtml = '';
                            if (server.is_new) {
                                buttonsHtml = `<button class="btn btn-sm btn-success setup-btn" data-id="${server.id}">設定</button>`;
                            } else if (server.is_deleted) {
                                buttonsHtml = `
                                    <button class="btn btn-sm btn-danger confirm-delete-btn" data-id="${server.id}">削除</button>
                                    <button class="btn btn-sm btn-secondary cancel-delete-btn" data-id="${server.id}">維持</button>
                                `;
                            } else {
                                // 通常のサーバーはSSH接続ボタンのみ
                                const sshConnectableTypes = ['node', 'virtual_machine', 'network_device', 'kvm'];
                                if (sshConnectableTypes.includes(server.type)) {
                                    buttonsHtml = `<a href="/ssh/${server.id}" class="btn btn-sm btn-primary" target="_blank">SSH接続</a>`;
                                }
                            }
                            cardFooter.innerHTML = buttonsHtml;
                        }
                    }
                });

                // イベントリスナーを再アタッチ
                this.attachServerCardEventListeners();
            })
            .catch(error => console.error('Error updating main page server cards:', error));
    },

    // サーバー編集モーダルを開く共通関数
    openEditModalForServer: function(serverId) {
        fetch(`/api/servers/${serverId}`)
            .then(response => response.ok ? response.json() : Promise.reject(response))
            .then(server => {
                const editModalElement = document.getElementById('editServerModal');
                if (!editModalElement) {
                    console.error('Edit modal element not found');
                    return;
                }
                const editModal = new bootstrap.Modal(editModalElement);

                this.populateEditModal(server);
                editModal.show();
            })
            .catch(error => {
                console.error('Error fetching server data:', error);
                alert('サーバーデータの取得に失敗しました。');
            });
    },

    // 編集モーダルにサーバーデータを設定
    populateEditModal: function(server) {
        // 必要な要素の存在確認と値の設定
        const elements = {
            'editServerId': server.id,
            'editServerName': server.name,
            'editServerHost': server.host || '',
            'editServerPort': server.port || '22',
            'editServerType': server.type,
            'editServerUrl': server.url || '',
            'editServerDescription': server.description || '',
            'editServerTags': server.tags ? server.tags.join(', ') : ''
        };

        for (const [elementId, value] of Object.entries(elements)) {
            const element = document.getElementById(elementId);
            if (element) {
                element.value = value;
            } else {
                console.warn(`Element with id ${elementId} not found`);
            }
        }
        
        // Ping監視設定
        const pingEnabledElement = document.getElementById('editPingEnabled');
        if (pingEnabledElement) {
            pingEnabledElement.checked = server.ping_enabled || false;
        }

        // 認証設定
        this.setupAuthenticationFields(server);
    },

    // 認証フィールドの設定
    setupAuthenticationFields: function(server) {
        const authMethodSelect = document.getElementById('editAuthMethod');
        const usernameInput = document.getElementById('editServerUsername');
        const sshUsernameInput = document.getElementById('editServerUsernameSsh');
        const passwordInput = document.getElementById('editServerPassword');

        if (authMethodSelect) {
            // サーバーデータに基づいて認証方法を設定
            const authMethod = server.auth_method || (server.ssh_key_id ? 'ssh_key' : 'password');
            authMethodSelect.value = authMethod;
            
            if (usernameInput) usernameInput.value = server.username || '';
            if (sshUsernameInput) sshUsernameInput.value = server.username || '';
            if (passwordInput) passwordInput.value = server.password || '';

            // SSHキーのリストをロードし、サーバーのキーを選択
            ServerDeckUtils.loadSshKeysForEditModal(server.ssh_key_id);

            // 初期表示を正しく設定
            ServerDeckUtils.toggleAuthFields(authMethod);

            // 認証方法の変更イベントリスナーを設定
            authMethodSelect.onchange = () => ServerDeckUtils.toggleAuthFields(authMethodSelect.value);
        }
    },

    // 設定モーダル内のサーバーリストをロードする関数
    loadServersForConfigModal: function() {
        fetch('/api/servers')
            .then(response => response.json())
            .then(servers => {
                const serverListDiv = document.getElementById('server-list');
                if (!serverListDiv) return;
                serverListDiv.innerHTML = ''; // Clear existing content

                servers.forEach(server => {
                    const serverCardHtml = `
                        <div class="col-md-4">
                            <div class="card server-card config-server-card ${server.is_new ? 'border-success' : ''} ${server.is_deleted ? 'border-danger' : ''}" data-server-id="${server.id}">
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
                PingStatus.updatePingStatus();

                // 個別サーバーの編集・削除ボタン、および一括削除関連のイベントリスナーを再設定
                this.attachServerCardEventListeners();
            })
            .catch(error => console.error('Error loading servers for config modal:', error));
    },

    // 個別サーバーカードの編集・削除ボタンにイベントリスナーをアタッチする関数
    attachServerCardEventListeners: function() {
        // サーバー編集ボタンのイベントリスナー
        document.querySelectorAll('.edit-server-btn').forEach(button => {
            button.removeEventListener('click', this.handleEditServerClick);
            button.addEventListener('click', this.handleEditServerClick.bind(this));
        });

        // サーバー削除ボタンのイベントリスナー
        document.querySelectorAll('.delete-server-btn').forEach(button => {
            button.removeEventListener('click', this.handleDeleteServerClick);
            button.addEventListener('click', this.handleDeleteServerClick.bind(this));
        });

        // 新規サーバー設定ボタンのイベントリスナー
        document.querySelectorAll('.setup-btn').forEach(button => {
            button.removeEventListener('click', this.handleSetupButtonClick);
            button.addEventListener('click', this.handleSetupButtonClick.bind(this));
        });

        // 削除確認ボタンのイベントリスナー
        document.querySelectorAll('.confirm-delete-btn').forEach(button => {
            button.removeEventListener('click', this.handleConfirmDeleteClick);
            button.addEventListener('click', this.handleConfirmDeleteClick.bind(this));
        });

        // 削除キャンセルボタンのイベントリスナー
        document.querySelectorAll('.cancel-delete-btn').forEach(button => {
            button.removeEventListener('click', this.handleCancelDeleteClick);
            button.addEventListener('click', this.handleCancelDeleteClick.bind(this));
        });

        // 一括削除とチェックボックス関連
        this.attachBulkDeleteListeners();
        this.attachConfigCardClickListeners();
    },

    // 一括削除関連のイベントリスナー
    attachBulkDeleteListeners: function() {
        const bulkDeleteServersBtn = document.getElementById('bulkDeleteServersBtn');

        const updateBulkDeleteButtonVisibility = () => {
            const checkedCount = document.querySelectorAll('.config-server-checkbox:checked').length;
            if (bulkDeleteServersBtn) {
                bulkDeleteServersBtn.disabled = checkedCount === 0;
            }
        };

        // チェックボックスのイベントリスナーを再設定
        document.querySelectorAll('.config-server-checkbox').forEach(checkbox => {
            checkbox.removeEventListener('change', updateBulkDeleteButtonVisibility);
            checkbox.addEventListener('change', updateBulkDeleteButtonVisibility);
        });

        // 一括削除ボタンのイベントリスナー
        if (bulkDeleteServersBtn) {
            bulkDeleteServersBtn.removeEventListener('click', this.handleBulkDeleteServersClick);
            bulkDeleteServersBtn.addEventListener('click', this.handleBulkDeleteServersClick.bind(this));
        }

        // 初回ロード時にボタンの状態を更新
        updateBulkDeleteButtonVisibility();
    },

    // 設定カード（緑枠・赤枠）のクリックリスナー
    attachConfigCardClickListeners: function() {
        document.querySelectorAll('.config-server-card').forEach(card => {
            card.removeEventListener('click', this.handleConfigServerCardClick);
            card.addEventListener('click', this.handleConfigServerCardClick.bind(this));
        });
    },

    // イベントハンドラー関数群
    handleEditServerClick: function(event) {
        const serverId = event.target.dataset.id;
        
        // 設定モーダル内からクリックされた場合、設定モーダルを閉じる
        const configModal = bootstrap.Modal.getInstance(document.getElementById('configModal'));
        if (configModal) {
            configModal.hide();
            // モーダルが完全に閉じられてから編集モーダルを開く
            setTimeout(() => {
                this.openEditModalForServer(serverId);
            }, 300);
        } else {
            // メインページから直接呼ばれた場合
            this.openEditModalForServer(serverId);
        }
    },

    handleDeleteServerClick: function(event) {
        const serverId = event.target.dataset.id;
        if (confirm('本当にこのサーバーを削除しますか？')) {
            fetch(`/api/servers/${serverId}`, {
                method: 'DELETE'
            })
            .then(response => {
                if (!response.ok) {
                    return response.json().then(err => { throw err; });
                }
                if (response.status === 204) {
                    return {};
                }
                return response.json();
            })
            .then(data => {
                alert('サーバーが削除されました！');
                this.loadServersForConfigModal();
                this.updateMainPageServerCards();
            })
            .catch(error => {
                console.error('Error deleting server:', error);
                alert('サーバーの削除に失敗しました: ' + (error.message || JSON.stringify(error)));
            });
        }
    },

    handleSetupButtonClick: function(event) {
        const serverId = event.target.dataset.id;
        
        const configModal = bootstrap.Modal.getInstance(document.getElementById('configModal'));
        if (configModal) {
            configModal.hide();
            setTimeout(() => {
                this.openEditModalForServer(serverId);
            }, 300);
        } else {
            this.openEditModalForServer(serverId);
        }
    },

    handleConfirmDeleteClick: function(event) {
        const serverId = event.target.dataset.id;
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
                this.loadServersForConfigModal();
            })
            .catch(error => {
                console.error('Error permanently deleting server:', error);
                alert('サーバーの完全削除に失敗しました: ' + (error.message || JSON.stringify(error)));
            });
        }
    },

    handleCancelDeleteClick: function(event) {
        const serverId = event.target.dataset.id;
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
                this.loadServersForConfigModal();
            })
            .catch(error => {
                console.error('Error canceling server delete:', error);
                alert('サーバーの削除取り消しに失敗しました: ' + (error.message || JSON.stringify(error)));
            });
        }
    },

    handleBulkDeleteServersClick: function() {
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
                this.loadServersForConfigModal();
                this.updateMainPageServerCards();
            })
            .catch(error => console.error('Error during bulk delete of servers:', error));
        }
    },

    handleConfigServerCardClick: function(event) {
        const card = event.currentTarget;
        const serverId = card.dataset.serverId;
        const checkbox = card.querySelector('.config-server-checkbox');

        // チェックボックス自体がクリックされた場合は何もしない
        if (event.target.classList.contains('config-server-checkbox')) {
            return;
        }

        // 編集ボタンまたは削除ボタンがクリックされた場合は何もしない
        if (event.target.classList.contains('edit-server-btn') || event.target.classList.contains('delete-server-btn')) {
            return;
        }

        // is_new または is_deleted のカードがクリックされた場合の特殊処理
        if (card.classList.contains('border-success')) {
            // 緑枠のカード（is_new）がクリックされた場合、編集モーダルを開く
            this.openEditModalForServer(serverId);
        } else if (card.classList.contains('border-danger')) {
            // 赤枠のカード（is_deleted）がクリックされた場合、確認ダイアログを表示
            ExtraImport.showDeleteConfirmation(serverId, card.querySelector('.server-card-title').textContent);
        } else {
            // 通常のカードクリックではチェックボックスをトグル
            if (checkbox) {
                checkbox.checked = !checkbox.checked;
                // チェックボックスの状態変更イベントを手動で発火
                checkbox.dispatchEvent(new Event('change'));
            }
        }
    },

    // サーバー編集フォームの初期化
    initializeEditForm: function() {
        const editServerForm = document.getElementById('editServerForm');
        if (editServerForm) {
            editServerForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const serverId = document.getElementById('editServerId').value;
                const authMethod = document.getElementById('editAuthMethod').value;
                
                const formData = new FormData(editServerForm);
                const payload = Object.fromEntries(formData.entries());

                payload.ping_enabled = document.getElementById('editPingEnabled').checked;

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
                    if (editModal) editModal.hide();
                    this.loadServersForConfigModal();
                    this.updateMainPageServerCards();
                })
                .catch(error => {
                    console.error('Error updating server:', error);
                    alert(error);
                });
            });
        }
    }
};
