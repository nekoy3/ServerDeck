// サーバー管理機能
window.ServerManagement = {
    sshWindow: null, // SSH マルチタブウィンドウの参照
    
    // メインページのサーバーカードを更新する関数
    updateMainPageServerCards: function() {
        APIManager.servers.getAll()
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
                                    buttonsHtml = `<button class="btn btn-sm btn-primary ssh-connect-btn" data-server-id="${server.id}">SSH接続</button>`;
                                }
                            }
                            cardFooter.innerHTML = buttonsHtml;
                        }
                    }
                });

                // 動的に生成されたドロップダウンを初期化（不要になった）
                // console.log('🔍 About to call reinitializeDropdowns...');
                // this.reinitializeDropdowns();

                // SSH接続ボタンのイベントリスナーを再アタッチ
                this.attachSSHEventListeners();

                // イベントリスナーを再アタッチ
                // サーバーカードの更新後、必要に応じてイベントリスナーを再設定
                console.log('Server cards updated on main page');
            })
            .catch(error => {
                console.error('Error updating main page server cards:', error);
                NotificationManager.error('サーバー情報の更新に失敗しました');
            });
    },

    // サーバー編集モーダルを開く
    openEditModal: function(serverId, fromConfigModal = false) {
        console.log(`🔧 [EDIT] Opening edit modal for server: ${serverId}, fromConfigModal: ${fromConfigModal}`);
        
        APIManager.servers.get(serverId)
            .then(server => {
                const editModalElement = document.getElementById('editServerModal');
                if (!editModalElement) {
                    console.error('🚨 [EDIT] Edit modal element not found');
                    return;
                }

                // DOM要素が完全に読み込まれているか確認
                const modalBody = editModalElement.querySelector('.modal-body');
                if (!modalBody) {
                    console.error('🚨 [EDIT] Modal body not found, waiting for DOM...');
                    setTimeout(() => this.openEditModal(serverId, fromConfigModal), 100);
                    return;
                }

                // 既存のモーダルをクリーンアップ
                ServerDeckUtils.modalManager.cleanupModal(editModalElement);

                // サーバーデータをフォームに設定
                this.populateEditModal(server);

                // モーダルを開く（遅延を追加してDOM準備を確実にする）
                setTimeout(() => {
                    ServerDeckUtils.modalManager.openModal(editModalElement)
                        .then(modalInstance => {
                            if (modalInstance) {
                                // 隠れた時の処理を設定
                                const handleHidden = () => {
                                    console.log('🔧 [EDIT] Edit modal hidden');
                                    ServerDeckUtils.modalManager.cleanupModal(editModalElement);
                                    
                                    // 設定モーダルから開いた場合は設定モーダルを再度開く
                                    if (fromConfigModal) {
                                        console.log('🔧 [EDIT] Reopening config modal after edit modal close');
                                        setTimeout(() => {
                                            ServerDeckUtils.openConfigModal();
                                        }, 200);
                                    }
                                    
                                    // フラグをリセット
                                    delete editModalElement.dataset.savedSuccessfully;
                                };
                        
                        editModalElement.addEventListener('hidden.bs.modal', handleHidden, { once: true });
                    } else {
                        // モーダルインスタンス作成に失敗した場合の代替処理
                        console.warn('🔧 [EDIT] Failed to create modal instance, using fallback');
                        
                        // 直接Bootstrapモーダルを作成してみる
                        setTimeout(() => {
                            try {
                                const fallbackModal = new bootstrap.Modal(editModalElement, {
                                    backdrop: 'static',
                                    keyboard: true,
                                    focus: true
                                });
                                fallbackModal.show();
                                
                                editModalElement.addEventListener('hidden.bs.modal', () => {
                                    console.log('🔧 [EDIT] Fallback edit modal hidden');
                                    if (fromConfigModal) {
                                        console.log('🔧 [EDIT] Reopening config modal from fallback');
                                        setTimeout(() => {
                                            ServerDeckUtils.openConfigModal();
                                        }, 200);
                                    }
                                    delete editModalElement.dataset.savedSuccessfully;
                                }, { once: true });
                            } catch (fallbackError) {
                                console.error('🔧 [EDIT] Fallback modal creation also failed:', fallbackError);
                            }
                        }, 100);
                    }
                })
                .catch(modalError => {
                    console.error('🔧 [EDIT] Modal creation failed:', modalError);
                    NotificationManager.error('モーダルの表示に失敗しました');
                });
            }, 50); // 50ms遅延でDOM準備を確実にする
        })
        .catch(error => {
            console.error('❌ [EDIT] Error fetching server data:', error);
            NotificationManager.error('サーバーデータの取得に失敗しました');
        });
    },

    // 編集モーダルにサーバーデータを設定
    populateEditModal: function(server) {
        console.log('🔧 [EDIT] Populating edit modal with server data:', server.name);
        
        // 必要な要素の存在確認と値の設定
        const elements = {
            'editServerId': server.id,
            'editServerName': server.name,
            'editServerHost': server.host || '',
            'editServerPort': server.port || '22',
            'editServerType': server.type,
            'editServerUrl': server.url || '',
            'editServerDescription': server.description || '',
            'editServerTags': server.tags ? server.tags.join(', ') : '',
            'editServerSshOptions': server.ssh_options || ''
        };

        let missingElements = [];
        for (const [elementId, value] of Object.entries(elements)) {
            const element = document.getElementById(elementId);
            if (element) {
                element.value = value;
            } else {
                console.warn(`❌ [EDIT] Element with id ${elementId} not found`);
                missingElements.push(elementId);
            }
        }
        
        if (missingElements.length > 0) {
            console.error('🚨 [EDIT] Missing form elements:', missingElements);
        }
        
        // Ping監視設定
        const pingEnabledElement = document.getElementById('editPingEnabled');
        if (pingEnabledElement) {
            pingEnabledElement.checked = server.ping_enabled || false;
        }

        // 親ホスト設定
        this.setupParentHostField(server);

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

    // 親ホストフィールドの設定
    setupParentHostField: function(server) {
        const parentSelect = document.getElementById('editServerParentId');
        if (!parentSelect) return;

        // 親候補となるサーバー（nodeタイプ）を取得
        fetch('/api/servers')
            .then(response => response.json())
            .then(servers => {
                parentSelect.innerHTML = '<option value="">なし (物理サーバー・独立)</option>';
                
                // nodeタイプのサーバーのみを親候補として追加
                servers
                    .filter(s => s.type === 'node' && s.id !== server.id)
                    .forEach(parentServer => {
                        const option = document.createElement('option');
                        option.value = parentServer.id;
                        option.textContent = `${parentServer.name} (${parentServer.host || 'ホスト不明'})`;
                        
                        // 現在の親ホストが設定されている場合は選択
                        if (server.parent_id === parentServer.id) {
                            option.selected = true;
                        }
                        
                        parentSelect.appendChild(option);
                    });
            })
            .catch(error => {
                console.error('Error loading parent hosts:', error);
            });
    },

    // 設定パネル用の親ホスト設定関数
    setupParentHostFieldForConfig: function(server) {
        const parentSelect = document.getElementById('parentHost');
        if (!parentSelect) return;

        // serverがnullまたは未定義の場合は空のオブジェクトとして扱う
        server = server || {};

        // 親候補となるサーバー（nodeタイプ）を取得
        fetch('/api/servers')
            .then(response => response.json())
            .then(servers => {
                parentSelect.innerHTML = '<option value="">-- 選択してください（任意） --</option>';
                
                // nodeタイプのサーバーのみを親候補として追加
                servers
                    .filter(s => s.type === 'node' && s.id !== server.id)
                    .forEach(parentServer => {
                        const option = document.createElement('option');
                        option.value = parentServer.id;
                        option.textContent = `${parentServer.name} (${parentServer.host || 'ホスト不明'})`;
                        
                        // 現在の親ホストが設定されている場合は選択
                        if (server.parent_id === parentServer.id) {
                            option.selected = true;
                        }
                        
                        parentSelect.appendChild(option);
                    });
            })
            .catch(error => {
                console.error('Error loading parent hosts for config:', error);
            });
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
                    NotificationManager.success('サーバー情報が更新されました！');
                    const editModalElement = document.getElementById('editServerModal');
                    
                    // モーダルを閉じる（設定モーダルは hidden イベントで自動的に再表示される）
                    if (editModalElement) {
                        console.log('🔄 [SAVE] Server saved successfully, closing edit modal');
                        
                        const modalInstance = bootstrap.Modal.getInstance(editModalElement);
                        if (modalInstance) {
                            modalInstance.hide();
                        }
                    }
                    
                    // データを更新
                    // loadServersForConfigModal は script.js で定義されているグローバル関数
                    if (typeof loadServersForConfigModal === 'function') {
                        loadServersForConfigModal();
                    }
                    this.updateMainPageServerCards();
                })
                .catch(error => {
                    console.error('Error updating server:', error);
                    NotificationManager.error('サーバー情報の更新に失敗しました: ' + error.message);
                });
            });
        }
    },

    // SSH接続ボタンのイベントリスナーを設定
    attachSSHEventListeners: function() {
        console.log('🔧 Attaching SSH event listeners...');
        
        // SSH接続ボタンのイベントリスナー
        document.querySelectorAll('.ssh-connect-btn').forEach(button => {
            // 既存のリスナーを削除してから新しいリスナーを追加
            button.removeEventListener('click', this.handleSSHConnectClick);
            button.addEventListener('click', this.handleSSHConnectClick.bind(this));
        });
        
        console.log(`🔧 SSH event listeners attached to ${document.querySelectorAll('.ssh-connect-btn').length} buttons`);
    },

    // SSH接続ボタンのクリックハンドラー
    handleSSHConnectClick: function(event) {
        event.preventDefault();
        console.log('🔧 SSH connect button clicked:', event.target);
        
        const serverId = event.target.dataset.serverId;
        if (!serverId) {
            console.error('❌ Server ID not found in SSH connect button');
            return;
        }
        
        console.log('🔧 Opening SSH connection for server (multi-tab mode):', serverId);
        
        // 既存のマルチタブSSHウィンドウを探す
        const existingSSHWindow = this.findExistingSSHWindow();
        
        if (existingSSHWindow && !existingSSHWindow.closed) {
            // 既存のウィンドウにタブを追加
            console.log('🔧 Adding tab to existing SSH window');
            existingSSHWindow.postMessage({
                type: 'ADD_SSH_TAB',
                serverId: serverId
            }, window.location.origin);
            
            // 既存のウィンドウにフォーカス
            existingSSHWindow.focus();
        } else {
            // 新しいウィンドウを開く
            console.log('🔧 Opening new SSH window');
            const sshUrl = `/ssh_multitab?server_id=${serverId}`;
            const newWindow = window.open(sshUrl, 'ssh-multitab', 'width=1200,height=800');
            
            // 新しいウィンドウの参照を保存
            this.sshWindow = newWindow;
        }
    },
    
    // 既存のSSHウィンドウを探す
    findExistingSSHWindow: function() {
        return this.sshWindow;
    },

    // 動的に生成されたドロップダウンを再初期化する
    reinitializeDropdowns: function() {
        console.log('🔄 ===== REINITIALIZE DROPDOWNS START =====');
        console.log('🔄 Function called at:', new Date().toISOString());
        console.log('🔄 Document ready state:', document.readyState);
        console.log('🔄 Bootstrap available:', typeof bootstrap !== 'undefined');
        
        // 少し遅延を入れてDOM更新を確実にする
        setTimeout(() => {
            console.log('🔄 Inside setTimeout callback...');
            
            if (typeof bootstrap === 'undefined') {
                console.warn('⚠️ Bootstrap not available for dropdown reinitialization');
                return;
            }
            
            const dropdowns = document.querySelectorAll('[data-bs-toggle="dropdown"]');
            console.log(`🔍 Found ${dropdowns.length} dropdown toggles to reinitialize`);
            
            // 全ページのドロップダウン要素をチェック
            const allDropdownElements = document.querySelectorAll('.dropdown-toggle, .dropdown-toggle-split, [data-bs-toggle="dropdown"]');
            console.log(`🔍 All dropdown-related elements: ${allDropdownElements.length}`);
            allDropdownElements.forEach((element, i) => {
                console.log(`  Element ${i}:`, element.classList.toString(), element.getAttribute('data-bs-toggle'));
            });
            
            // SSH関連のボタンをチェック
            const sshButtons = document.querySelectorAll('.ssh-connect-btn');
            console.log(`🔍 SSH buttons found: ${sshButtons.length}`);
            
            // btn-groupをチェック
            const btnGroups = document.querySelectorAll('.btn-group');
            console.log(`🔍 Button groups found: ${btnGroups.length}`);
            btnGroups.forEach((group, i) => {
                console.log(`  Group ${i}:`, group.outerHTML);
            });
            
            // 各ドロップダウンの詳細情報をログ出力
            dropdowns.forEach((dropdown, index) => {
                console.log(`Dropdown ${index}:`, dropdown);
                console.log(`  Text: "${dropdown.textContent.trim()}"`);
                console.log(`  Parent HTML:`, dropdown.parentElement?.outerHTML);
                console.log(`  Next sibling (menu):`, dropdown.nextElementSibling);
            });
            
            dropdowns.forEach((dropdown, index) => {
                try {
                    // 既存のBootstrapインスタンスがあれば破棄
                    const existingInstance = bootstrap.Dropdown.getInstance(dropdown);
                    if (existingInstance) {
                        console.log(`Disposing existing dropdown instance ${index}`);
                        existingInstance.dispose();
                    }
                    
                    // 新しいBootstrapドロップダウンインスタンスを作成
                    const dropdownInstance = new bootstrap.Dropdown(dropdown);
                    console.log(`✅ Reinitialized dropdown ${index}:`, dropdownInstance);
                    
                    // SSH接続ボタンの場合は、z-indexイベントを設定
                    const btnGroup = dropdown.closest('.btn-group');
                    if (btnGroup && btnGroup.querySelector('.ssh-connect-btn')) {
                        console.log(`🔧 Adding event handlers to SSH dropdown ${index}`);
                        
                        // Bootstrapイベントリスナーを追加
                        dropdown.addEventListener('show.bs.dropdown', function(event) {
                            console.log('🎯 SSH dropdown showing, setting z-index');
                            if (btnGroup) {
                                btnGroup.style.zIndex = '9999';
                                btnGroup.style.position = 'relative';
                            }
                        });
                        
                        dropdown.addEventListener('hidden.bs.dropdown', function(event) {
                            console.log('🎯 SSH dropdown hidden, resetting z-index');
                            if (btnGroup) {
                                btnGroup.style.zIndex = '';
                            }
                        });
                        
                        // クリックイベントも手動で追加
                        dropdown.addEventListener('click', function(event) {
                            console.log('🎯 Dropdown button clicked manually');
                            console.log('  Button:', this);
                            console.log('  Classes:', this.classList);
                            console.log('  Parent:', this.parentElement);
                            console.log('  Next sibling:', this.nextElementSibling);
                            
                            // 手動でドロップダウンを切り替え
                            const menu = this.nextElementSibling;
                            if (menu && menu.classList.contains('dropdown-menu')) {
                                if (menu.classList.contains('show')) {
                                    menu.classList.remove('show');
                                    this.setAttribute('aria-expanded', 'false');
                                    console.log('  Manual hide menu');
                                } else {
                                    menu.classList.add('show');
                                    this.setAttribute('aria-expanded', 'true');
                                    console.log('  Manual show menu');
                                }
                            }
                        });
                    }
                } catch (error) {
                    console.error(`❌ Failed to reinitialize dropdown ${index}:`, error);
                }
            });
        }, 100);
    }
};
