// ユーティリティ関数
window.ServerDeckUtils = {
    configModalInitialized: false,
    
    // 設定モーダルの動的読み込み
    loadConfigModal: function() {
        const configLink = document.getElementById('configLink');
        const configModalBody = document.getElementById('configModalBody');
        const configModalElement = document.getElementById('configModal');

        // 既存のモーダルバックドロップとクラスをクリーンアップ（安全策）
        this.cleanupModalRemnants();

        if (configLink && configModalBody && configModalElement) {
            configLink.addEventListener('click', function(e) {
                e.preventDefault();
                
                // クリックする前にクリーンアップ
                ServerDeckUtils.cleanupModalRemnants();
                
                fetch('/config')
                    .then(response => response.text())
                    .then(html => {
                        // モーダル表示前に内容をクリア
                        configModalBody.innerHTML = '';
                        // 少し遅延させてからHTMLを設定（メモリリークを防止）
                        setTimeout(() => {
                            configModalBody.innerHTML = html;
                            
                            // モーダル閉じるイベントハンドラを先に設定
                            const handleModalHidden = function(event) {
                                console.log('🚪 [MODAL] Modal hidden event triggered:', event);
                                console.log('🚪 [MODAL] Starting cleanup after modal hidden');
                                // 遅延させてクリーンアップを実行
                                setTimeout(() => {
                                    console.log('🚪 [MODAL] Executing delayed cleanup');
                                    ServerDeckUtils.cleanupModalRemnants();
                                }, 150);
                            };
                            
                            // 既存のイベントリスナーを削除
                            console.log('🚪 [MODAL] Setting up modal event handlers');
                            configModalElement.removeEventListener('hidden.bs.modal', handleModalHidden);
                            configModalElement.addEventListener('hidden.bs.modal', handleModalHidden, { once: true });
                            
                            // モーダルを表示
                            console.log('🚪 [MODAL] Creating Bootstrap modal instance');
                            const configModal = new bootstrap.Modal(configModalElement, {
                                backdrop: 'static', // 背景クリックで閉じないように
                                keyboard: true,
                                focus: true
                            });
                            
                            // モーダル表示前にエラーハンドリングを追加
                            try {
                                console.log('🚪 [MODAL] Showing modal...');
                                configModal.show();
                                console.log('🚪 [MODAL] Modal show() called successfully');
                            } catch (error) {
                                console.error('🚪 [MODAL] Error showing modal:', error);
                                ServerDeckUtils.cleanupModalRemnants();
                                return;
                            }
                            
                            // モーダルコンテンツが読み込まれた後にJavaScriptを再初期化
                            ServerDeckUtils.initializeConfigModalScripts();
                            // サーバー設定タブがデフォルトで開くため、初回ロード時にサーバーリストを明示的にロード
                            ServerManagement.loadServersForConfigModal();
                        }, 50);
                    })
                    .catch(error => console.error('Error loading config modal:', error));
            });
        }
    },

    // 設定モーダル内のスクリプト初期化（一度だけ実行）
    initializeConfigModalScripts: function() {
        // 既に初期化済みの場合はスキップ
        if (this.configModalInitialized) {
            console.log('Config modal scripts already initialized, skipping');
            return;
        }

        console.log('Initializing config modal scripts...');

        // 各タブが最初に表示されるときに、それぞれの初期化関数を一度だけ呼び出す
        const serverTab = document.getElementById('servers-tab');
        if(serverTab) {
            serverTab.addEventListener('show.bs.tab', () => ServerManagement.loadServersForConfigModal(), { once: true });
        }

        const sshKeysTab = document.getElementById('ssh-keys-tab');
        if (sshKeysTab) {
            sshKeysTab.addEventListener('shown.bs.tab', () => {
                if (window.SshKeyManagement) {
                    SshKeyManagement.initialize();
                }
            }, { once: true });
        }

        const extraImportTab = document.getElementById('extra-import-tab');
        if (extraImportTab) {
            // タブが表示されたときに初期化
            extraImportTab.addEventListener('shown.bs.tab', () => {
                if (window.ExtraImport) {
                    ExtraImport.initialize();
                }
            }, { once: true });
            
            // URLパラメータがあれば自動的にタブを開く
            if (localStorage.getItem('pendingExtraImportUrl')) {
                console.log('Auto-opening Extra Import tab due to URL parameter');
                setTimeout(() => {
                    const tab = new bootstrap.Tab(extraImportTab);
                    tab.show();
                    // タブ表示後にExtraImportを初期化
                    if (window.ExtraImport) {
                        ExtraImport.initialize();
                    }
                }, 300); // モーダル表示後少し遅延させる
            }
        }

        const backupTab = document.getElementById('backup-tab');
        if (backupTab) {
            backupTab.addEventListener('shown.bs.tab', () => {
                if (window.BackupManagement) {
                    BackupManagement.initialize();
                }
            }, { once: true });
        }

        this.configModalInitialized = true;
        console.log('Config modal scripts initialized successfully');
    },

    // 認証フィールドの表示を切り替える
    toggleAuthFields: function(authMethod) {
        const elements = {
            passwordFields: document.getElementById('editPasswordFields'),
            sshKeyFields: document.getElementById('editSshKeyFields'),
            usernameInput: document.getElementById('editServerUsername'),
            sshUsernameInput: document.getElementById('editServerUsernameSsh')
        };

        if (authMethod === 'ssh_key') {
            if (elements.passwordFields) elements.passwordFields.style.display = 'none';
            if (elements.sshKeyFields) elements.sshKeyFields.style.display = 'block';
            // SSHキーのユーザー名をメインのユーザー名フィールドに同期
            if (elements.usernameInput && elements.sshUsernameInput) {
                elements.sshUsernameInput.value = elements.usernameInput.value;
            }
        } else { // password or default
            if (elements.passwordFields) elements.passwordFields.style.display = 'block';
            if (elements.sshKeyFields) elements.sshKeyFields.style.display = 'none';
        }
    },

    // SSHキーのドロップダウンをロードする
    loadSshKeysForEditModal: function(selectedKeyId) {
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
    },

    // 共通エラーハンドリング
    handleApiError: function(error, userMessage = 'エラーが発生しました') {
        console.error('API Error:', error);
        const message = error.message || JSON.stringify(error) || userMessage;
        alert(`${userMessage}: ${message}`);
    },

    // 共通の確認ダイアログ
    confirm: function(message, callback) {
        if (confirm(message)) {
            callback();
        }
    },

    // 共通のAPIリクエスト
    apiRequest: function(url, options = {}) {
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json'
            }
        };
        
        return fetch(url, { ...defaultOptions, ...options })
            .then(response => {
                if (!response.ok) {
                    return response.json().then(err => { throw err; });
                }
                if (response.status === 204) {
                    return {};
                }
                return response.json();
            });
    },
    
    // モーダル関連のDOM要素とスタイルをクリーンアップ
    cleanupModalRemnants: function() {
        console.log('🧹 [CLEANUP] Starting modal cleanup...');
        
        // モーダル本体の内容をクリア
        const configModalBody = document.getElementById('configModalBody');
        if (configModalBody) {
            console.log('🧹 [CLEANUP] Clearing modal body content');
            configModalBody.innerHTML = '';
        } else {
            console.warn('🧹 [CLEANUP] Modal body not found');
        }
        
        // すべてのモーダルインスタンスを取得して強制的に閉じる
        const configModalElement = document.getElementById('configModal');
        if (configModalElement) {
            console.log('🧹 [CLEANUP] Found modal element, checking for Bootstrap instance');
            const existingModal = bootstrap.Modal.getInstance(configModalElement);
            if (existingModal) {
                console.log('🧹 [CLEANUP] Bootstrap modal instance found, disposing...');
                try {
                    existingModal.hide(); // まず隠す
                    setTimeout(() => {
                        existingModal.dispose(); // 少し遅延させてから破棄
                        console.log('🧹 [CLEANUP] Modal instance disposed');
                    }, 300);
                } catch (e) {
                    console.warn('🧹 [CLEANUP] Error disposing modal:', e);
                }
            } else {
                console.log('🧹 [CLEANUP] No Bootstrap modal instance found');
            }
            
            // モーダル要素から強制的にクラスを削除
            console.log('🧹 [CLEANUP] Removing modal classes and attributes');
            configModalElement.classList.remove('show');
            configModalElement.style.display = 'none';
            configModalElement.setAttribute('aria-hidden', 'true');
            configModalElement.removeAttribute('aria-modal');
        } else {
            console.warn('🧹 [CLEANUP] Modal element not found');
        }
        
        // バックドロップ検査とクリーンアップ
        console.log('🧹 [CLEANUP] Checking for backdrop elements...');
        const initialBackdrops = document.querySelectorAll('.modal-backdrop');
        console.log(`🧹 [CLEANUP] Found ${initialBackdrops.length} backdrop elements initially`);
        
        // バックドロップ要素を削除（残留している場合）
        setTimeout(() => {
            const backdrops = document.querySelectorAll('.modal-backdrop');
            console.log(`🧹 [CLEANUP] Found ${backdrops.length} backdrop elements to remove`);
            backdrops.forEach((element, index) => {
                console.log(`🧹 [CLEANUP] Removing backdrop element ${index + 1}`);
                element.remove();
            });
            
            // fade クラスが残っている要素も削除
            const fadeElements = document.querySelectorAll('.modal.fade.show');
            console.log(`🧹 [CLEANUP] Found ${fadeElements.length} modal elements with fade+show classes`);
            fadeElements.forEach((element, index) => {
                console.log(`🧹 [CLEANUP] Removing fade+show from modal element ${index + 1}`);
                element.classList.remove('show');
                element.style.display = 'none';
            });
            
            // bodyからモーダル関連のクラスとスタイルを削除
            console.log('🧹 [CLEANUP] Cleaning body classes and styles');
            const bodyHadModalOpen = document.body.classList.contains('modal-open');
            console.log(`🧹 [CLEANUP] Body had modal-open class: ${bodyHadModalOpen}`);
            
            document.body.classList.remove('modal-open');
            document.body.style.overflow = '';
            document.body.style.paddingRight = '';
            document.body.style.marginRight = '';
            
            console.log('🧹 [CLEANUP] Modal cleanup completed successfully');
        }, 100);
        
        // フラグをリセット
        this.configModalInitialized = false;
    },
    
    // 強制的にモーダルを閉じる（緊急時用）
    forceCloseModal: function() {
        console.log('🆘 [FORCE CLOSE] Emergency modal force close initiated');
        
        // すべてのモーダル要素を強制的に隠す
        const modals = document.querySelectorAll('.modal');
        console.log(`🆘 [FORCE CLOSE] Found ${modals.length} modal elements to close`);
        modals.forEach((modal, index) => {
            console.log(`🆘 [FORCE CLOSE] Closing modal element ${index + 1}`);
            modal.classList.remove('show');
            modal.style.display = 'none';
            modal.setAttribute('aria-hidden', 'true');
            modal.removeAttribute('aria-modal');
        });
        
        // すべてのバックドロップを削除
        const backdrops = document.querySelectorAll('.modal-backdrop');
        console.log(`🆘 [FORCE CLOSE] Found ${backdrops.length} backdrop elements to remove`);
        backdrops.forEach((backdrop, index) => {
            console.log(`🆘 [FORCE CLOSE] Removing backdrop element ${index + 1}`);
            backdrop.remove();
        });
        
        // bodyクラスとスタイルの強制リセット
        console.log('🆘 [FORCE CLOSE] Resetting body classes and styles');
        document.body.classList.remove('modal-open');
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
        document.body.style.marginRight = '';
        
        // すべてのBootstrap modalインスタンスを破棄
        console.log('🆘 [FORCE CLOSE] Disposing all Bootstrap modal instances');
        modals.forEach((modal, index) => {
            const instance = bootstrap.Modal.getInstance(modal);
            if (instance) {
                console.log(`🆘 [FORCE CLOSE] Disposing Bootstrap instance for modal ${index + 1}`);
                try {
                    instance.dispose();
                } catch (e) {
                    console.warn(`🆘 [FORCE CLOSE] Error disposing modal ${index + 1}:`, e);
                }
            }
        });
        
        // フラグをリセット
        this.configModalInitialized = false;
        
        console.log('🆘 [FORCE CLOSE] Emergency modal force close completed');
    },
    
    // 直接設定モーダルを開き、Extra Importタブを選択する
    openConfigModalWithExtraImport: function(extraImportUrl) {
        console.log('Opening config modal with Extra Import tab');
        
        // 事前にクリーンアップを実行
        this.cleanupModalRemnants();
        
        // モーダル本体を取得
        const configModalElement = document.getElementById('configModal');
        if (!configModalElement) {
            console.error('Config modal element not found');
            return;
        }
        
        // モーダルのBodyにコンテンツを読み込む
        const configModalBody = document.getElementById('configModalBody');
        if (!configModalBody) {
            console.error('Config modal body not found');
            return;
        }
        
        fetch('/config')
            .then(response => response.text())
            .then(html => {
                // モーダル表示前に内容をクリア
                configModalBody.innerHTML = '';
                
                // 少し遅延させてからHTMLを設定
                setTimeout(() => {
                    configModalBody.innerHTML = html;
                    
                    // モーダルが閉じられた後のクリーンアップ処理を先に追加
                    const handleModalHidden = function() {
                        console.log('Extra Import modal hidden, starting cleanup');
                        // 遅延させてクリーンアップを実行
                        setTimeout(() => {
                            ServerDeckUtils.cleanupModalRemnants();
                        }, 150);
                    };
                    
                    // 既存のイベントリスナーを削除
                    configModalElement.removeEventListener('hidden.bs.modal', handleModalHidden);
                    configModalElement.addEventListener('hidden.bs.modal', handleModalHidden, { once: true });
                    
                    // モーダルを表示
                    const configModal = new bootstrap.Modal(configModalElement, {
                        backdrop: 'static', // 背景クリックで閉じないように
                        keyboard: true,
                        focus: true
                    });
                    
                    // モーダル表示前にエラーハンドリングを追加
                    try {
                        configModal.show();
                    } catch (error) {
                        console.error('Error showing Extra Import modal:', error);
                        ServerDeckUtils.cleanupModalRemnants();
                        return;
                    }
                    
                    // モーダルが表示された後の処理
                    const handleModalShown = function() {
                        console.log('Modal shown, switching to Extra Import tab');
                        // タブを切り替え
                        const extraImportTab = document.getElementById('extra-import-tab');
                        if (extraImportTab) {
                            const tab = new bootstrap.Tab(extraImportTab);
                            tab.show();
                            
                            // ExtraImportを初期化
                            setTimeout(() => {
                                if (window.ExtraImport) {
                                    ExtraImport.initialize();
                                    
                                    // URLパラメータがある場合は自動的に送信
                                    if (extraImportUrl) {
                                        const extraImportUrlInput = document.getElementById('extra-import-url');
                                        if (extraImportUrlInput) {
                                            extraImportUrlInput.value = decodeURIComponent(extraImportUrl);
                                            const form = document.getElementById('extra-import-form');
                                            if (form) {
                                                console.log('Auto-submitting Extra Import form');
                                                setTimeout(() => form.dispatchEvent(new Event('submit')), 200);
                                            }
                                        }
                                    }
                                }
                            }, 300);
                        }
                    };
                    configModalElement.addEventListener('shown.bs.modal', handleModalShown, { once: true });
                    
                    // その他の初期化
                    ServerDeckUtils.initializeConfigModalScripts();
                }, 50);
            })
            .catch(error => console.error('Error loading config modal:', error));
    }
};
