// ユーティリティ関数
window.ServerDeckUtils = {
    configModalInitialized: false,
    
    // シンプルなモーダル管理システム
    modalManager: {
        activeModals: new Set(),
        
        // モーダルを安全に開く
        openModal: function(modalElement, options = {}) {
            if (!modalElement || !modalElement.id) {
                console.error('🚨 [MODAL] Modal element not found or invalid');
                return null;
            }
            
            const modalId = modalElement.id;
            console.log(`🚪 [MODAL] Opening modal: ${modalId}`);
            
            // DOM要素の状態を事前チェック
            if (!document.body.contains(modalElement)) {
                console.error(`🚨 [MODAL] Modal element ${modalId} is not in DOM`);
                return null;
            }
            
            // 既存のインスタンスをクリーンアップ
            this.cleanupModal(modalElement);
            
            // 少し遅延を入れてDOM状態を安定化
            setTimeout(() => {
                // 再度要素の存在確認
                if (!document.getElementById(modalId)) {
                    console.error(`🚨 [MODAL] Modal element ${modalId} disappeared during setup`);
                    return null;
                }
                
                // 新しいインスタンスを作成
                const defaultOptions = {
                    backdrop: 'static',
                    keyboard: true,
                    focus: true
                };
                
                const modalOptions = { ...defaultOptions, ...options };
                
                try {
                    const modalInstance = new bootstrap.Modal(modalElement, modalOptions);
                    
                    // アクティブなモーダルとして記録
                    this.activeModals.add(modalId);
                    
                    modalInstance.show();
                    console.log(`✅ [MODAL] Modal ${modalId} opened successfully`);
                    return modalInstance;
                } catch (error) {
                    console.error(`❌ [MODAL] Error opening modal ${modalId}:`, error);
                    this.activeModals.delete(modalId);
                    return null;
                }
            }, 50);
            
            return null; // 非同期処理のため一旦nullを返す
        },
        
        // モーダルを安全に閉じる
        closeModal: function(modalElement) {
            if (!modalElement) return;
            
            const modalId = modalElement.id;
            console.log(`🚪 [MODAL] Closing modal: ${modalId}`);
            
            const instance = bootstrap.Modal.getInstance(modalElement);
            if (instance) {
                try {
                    instance.hide();
                    console.log(`✅ [MODAL] Modal ${modalId} closed successfully`);
                } catch (error) {
                    console.error(`❌ [MODAL] Error closing modal ${modalId}:`, error);
                }
            }
            
            this.activeModals.delete(modalId);
        },
        
        // モーダルのクリーンアップ
        cleanupModal: function(modalElement) {
            if (!modalElement) return;
            
            const modalId = modalElement.id;
            const instance = bootstrap.Modal.getInstance(modalElement);
            
            if (instance) {
                console.log(`🧹 [MODAL] Cleaning up existing instance for: ${modalId}`);
                try {
                    if (typeof instance.dispose === 'function') {
                        instance.dispose();
                    }
                } catch (error) {
                    console.warn(`⚠️  [MODAL] Error disposing modal ${modalId}:`, error);
                }
            }
            
            // DOM状態をリセット
            modalElement.classList.remove('show');
            modalElement.style.display = 'none';
            modalElement.setAttribute('aria-hidden', 'true');
            modalElement.removeAttribute('aria-modal');
            
            this.activeModals.delete(modalId);
        },
        
        // 全モーダルを強制クリーンアップ
        cleanupAllModals: function() {
            console.log('🧹 [MODAL] Cleaning up all modals');
            
            // アクティブなモーダルをクリーンアップ
            this.activeModals.forEach(modalId => {
                const modalElement = document.getElementById(modalId);
                if (modalElement) {
                    this.cleanupModal(modalElement);
                }
            });
            this.activeModals.clear();
            
            // 残留するバックドロップを削除
            document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
                backdrop.remove();
            });
            
            // body状態をリセット
            document.body.classList.remove('modal-open');
            document.body.style.overflow = '';
            document.body.style.paddingRight = '';
            document.body.style.marginRight = '';
            
            console.log('✅ [MODAL] All modals cleaned up');
        }
    },
    
    // 設定モーダルの動的読み込み
    loadConfigModal: function() {
        const configLink = document.getElementById('configLink');
        const configModalBody = document.getElementById('configModalBody');
        const configModalElement = document.getElementById('configModal');

        if (configLink && configModalBody && configModalElement) {
            configLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.openConfigModal();
            });
        }
    },
    
    // 設定モーダルを開く
    openConfigModal: function() {
        console.log('🚪 [CONFIG] Opening config modal');
        
        const configModalElement = document.getElementById('configModal');
        const configModalBody = document.getElementById('configModalBody');
        
        if (!configModalElement || !configModalBody) {
            console.error('� [CONFIG] Config modal elements not found');
            return;
        }
        
        // 既存のモーダルをクリーンアップ
        this.modalManager.cleanupAllModals();
        
        // コンテンツを読み込み
        fetch('/config')
            .then(response => response.text())
            .then(html => {
                configModalBody.innerHTML = html;
                
                // モーダルを開く
                const modalInstance = this.modalManager.openModal(configModalElement);
                
                if (modalInstance) {
                    // 隠れた時のクリーンアップイベント
                    configModalElement.addEventListener('hidden.bs.modal', () => {
                        console.log('🚪 [CONFIG] Config modal hidden, cleaning up');
                        this.modalManager.cleanupModal(configModalElement);
                        this.configModalInitialized = false;
                    }, { once: true });
                    
                    // 表示された後にスクリプトを初期化
                    configModalElement.addEventListener('shown.bs.modal', () => {
                        console.log('🚪 [CONFIG] Config modal shown, initializing scripts');
                        this.initializeConfigModalScripts();
                        ServerManagement.loadServersForConfigModal();
                    }, { once: true });
                }
            })
            .catch(error => {
                console.error('❌ [CONFIG] Error loading config modal:', error);
                this.modalManager.cleanupAllModals();
            });
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
    
    // 直接設定モーダルを開き、Extra Importタブを選択する
    openConfigModalWithExtraImport: function(extraImportUrl) {
        console.log('🚪 [CONFIG] Opening config modal with Extra Import tab');
        
        const configModalElement = document.getElementById('configModal');
        const configModalBody = document.getElementById('configModalBody');
        
        if (!configModalElement || !configModalBody) {
            console.error('🚨 [CONFIG] Config modal elements not found');
            return;
        }
        
        // 既存のモーダルをクリーンアップ
        this.modalManager.cleanupAllModals();
        
        fetch('/config')
            .then(response => response.text())
            .then(html => {
                configModalBody.innerHTML = html;
                
                // モーダルを開く
                const modalInstance = this.modalManager.openModal(configModalElement);
                
                if (modalInstance) {
                    // 隠れた時のクリーンアップイベント
                    configModalElement.addEventListener('hidden.bs.modal', () => {
                        console.log('🚪 [CONFIG] Extra Import modal hidden, cleaning up');
                        this.modalManager.cleanupModal(configModalElement);
                        this.configModalInitialized = false;
                    }, { once: true });
                    
                    // 表示された後にExtra Importタブに切り替え
                    configModalElement.addEventListener('shown.bs.modal', () => {
                        console.log('🚪 [CONFIG] Modal shown, switching to Extra Import tab');
                        
                        // スクリプトを初期化
                        this.initializeConfigModalScripts();
                        
                        // Extra Importタブに切り替え
                        const extraImportTab = document.getElementById('extra-import-tab');
                        if (extraImportTab) {
                            const tab = new bootstrap.Tab(extraImportTab);
                            tab.show();
                            
                            // ExtraImportを初期化してURLを設定
                            setTimeout(() => {
                                if (window.ExtraImport) {
                                    ExtraImport.initialize();
                                    
                                    if (extraImportUrl) {
                                        const extraImportUrlInput = document.getElementById('extra-import-url');
                                        if (extraImportUrlInput) {
                                            extraImportUrlInput.value = decodeURIComponent(extraImportUrl);
                                            const form = document.getElementById('extra-import-form');
                                            if (form) {
                                                console.log('🚀 [CONFIG] Auto-submitting Extra Import form');
                                                setTimeout(() => form.dispatchEvent(new Event('submit')), 200);
                                            }
                                        }
                                    }
                                }
                            }, 300);
                        }
                    }, { once: true });
                }
            })
            .catch(error => {
                console.error('❌ [CONFIG] Error loading config modal:', error);
                this.modalManager.cleanupAllModals();
            });
    }
};
