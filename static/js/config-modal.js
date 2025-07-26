/**
 * 設定モーダル管理
 * 設定モーダルの開閉とタブ管理
 */
window.ConfigModal = {
    initialized: false,
    
    /**
     * 設定モーダル機能の初期化
     */
    initialize: function() {
        console.log('🔧 [CONFIG] Initializing config modal');
        
        const configLink = document.getElementById('configLink');
        const configModalBody = document.getElementById('configModalBody');
        const configModalElement = document.getElementById('configModal');

        if (configLink && configModalBody && configModalElement) {
            configLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.openModal();
            });
        }
    },
    
    /**
     * 設定モーダルを開く
     */
    openModal: function() {
        console.log('🚪 [CONFIG] Opening config modal');
        
        const configModalElement = document.getElementById('configModal');
        const configModalBody = document.getElementById('configModalBody');
        
        if (!configModalElement || !configModalBody) {
            console.error('❌ [CONFIG] Config modal elements not found');
            return;
        }
        
        // 既存のモーダルをクリーンアップ
        if (window.ModalManager) {
            window.ModalManager.cleanupAllModals();
        }
        
        // コンテンツを読み込み
        fetch('/config')
            .then(response => response.text())
            .then(html => {
                configModalBody.innerHTML = html;
                
                // モーダルを開く
                if (window.ModalManager) {
                    const modalInstance = window.ModalManager.openModal(configModalElement);
                    
                    if (modalInstance) {
                        // 隠れた時のクリーンアップイベント
                        configModalElement.addEventListener('hidden.bs.modal', () => {
                            console.log('🚪 [CONFIG] Config modal hidden, cleaning up');
                            window.ModalManager.cleanupModal(configModalElement);
                            this.initialized = false;
                        }, { once: true });
                        
                        // 表示された後にスクリプトを初期化
                        configModalElement.addEventListener('shown.bs.modal', () => {
                            console.log('🚪 [CONFIG] Config modal shown, initializing scripts');
                            this.initializeModalScripts();
                            if (typeof window.loadServersForConfigModal === 'function') {
                                window.loadServersForConfigModal();
                            }
                            
                            // すべてのタブの内容を即座に初期化
                            this.initializeAllTabs();
                        }, { once: true });
                    }
                } else {
                    console.error('❌ [CONFIG] ModalManager not available');
                }
            })
            .catch(error => {
                console.error('❌ [CONFIG] Error loading config modal:', error);
                if (window.ModalManager) {
                    window.ModalManager.cleanupAllModals();
                }
            });
    },

    /**
     * 設定モーダル内のスクリプト初期化（一度だけ実行）
     */
    initializeModalScripts: function() {
        // 既に初期化済みの場合はスキップ
        if (this.initialized) {
            console.log('Config modal scripts already initialized, skipping');
            return;
        }

        console.log('Initializing config modal scripts...');

        // 各タブが最初に表示されるときに、それぞれの初期化関数を一度だけ呼び出す
        const serverTab = document.getElementById('servers-tab');
        if(serverTab) {
            serverTab.addEventListener('show.bs.tab', () => {
                if (typeof window.loadServersForConfigModal === 'function') {
                    window.loadServersForConfigModal();
                }
            }, { once: true });
        }

        const sshKeysTab = document.getElementById('ssh-keys-tab');
        if (sshKeysTab) {
            sshKeysTab.addEventListener('shown.bs.tab', () => {
                if (window.SshKeyManagement) {
                    window.SshKeyManagement.initialize();
                }
            }, { once: true });
        }

        const extraImportTab = document.getElementById('extra-import-tab');
        if (extraImportTab) {
            // タブが表示されたときに初期化
            extraImportTab.addEventListener('shown.bs.tab', () => {
                if (window.ExtraImport) {
                    window.ExtraImport.initialize();
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
                        window.ExtraImport.initialize();
                    }
                }, 300); // モーダル表示後少し遅延させる
            }
        }

        const backupTab = document.getElementById('backup-tab');
        if (backupTab) {
            backupTab.addEventListener('shown.bs.tab', () => {
                if (window.BackupManagement) {
                    window.BackupManagement.initialize();
                }
            }, { once: true });
        }

        this.initialized = true;
        console.log('Config modal scripts initialized successfully');
    },
    
    /**
     * すべてのタブの内容を即座に初期化
     */
    initializeAllTabs: function() {
        console.log('🔧 [CONFIG] Initializing all tabs immediately');
        
        // 各タブの初期化を順次実行（DOM要素が確実に存在することを保証）
        this.initializeTabContent();
    },
    
    /**
     * タブの内容を初期化
     */
    initializeTabContent: function() {
        console.log('🔧 [CONFIG] Starting tab content initialization');
        
        // DOM要素の存在確認を含む遅延実行
        setTimeout(() => {
            // SSHキータブの初期化
            if (window.SshKeyManagement) {
                console.log('🔑 [CONFIG] Initializing SSH key management');
                try {
                    window.SshKeyManagement.initialize();
                    // データ読み込みも実行
                    window.SshKeyManagement.loadSshKeysForManagementModal();
                    console.log('✅ [CONFIG] SSH key management initialized successfully');
                } catch (error) {
                    console.error('❌ [CONFIG] Error initializing SSH key management:', error);
                }
            }
            
            // バックアップタブの初期化
            if (window.BackupManagement) {
                console.log('📁 [CONFIG] Initializing backup management');
                try {
                    window.BackupManagement.initialize();
                    // データ読み込みも実行
                    window.BackupManagement.loadBackupFileList();
                    console.log('✅ [CONFIG] Backup management initialized successfully');
                } catch (error) {
                    console.error('❌ [CONFIG] Error initializing backup management:', error);
                }
            } else {
                console.error('❌ [CONFIG] BackupManagement module not found!');
            }
            
            // ExtraImportタブの初期化
            if (window.ExtraImport) {
                console.log('📤 [CONFIG] Initializing extra import');
                try {
                    window.ExtraImport.initialize();
                    console.log('✅ [CONFIG] Extra import initialized successfully');
                } catch (error) {
                    console.error('❌ [CONFIG] Error initializing extra import:', error);
                }
            }
        }, 500); // 500ms の遅延を追加してDOM構築を確実にする
    },
    
    /**
     * 直接設定モーダルを開き、Extra Importタブを選択する
     * @param {string} extraImportUrl - 設定するExtra Import URL
     */
    openWithExtraImport: function(extraImportUrl) {
        console.log('🚪 [CONFIG] Opening config modal with Extra Import tab');
        
        const configModalElement = document.getElementById('configModal');
        const configModalBody = document.getElementById('configModalBody');
        
        if (!configModalElement || !configModalBody) {
            console.error('🚨 [CONFIG] Config modal elements not found');
            return;
        }
        
        // 既存のモーダルをクリーンアップ
        if (window.ModalManager) {
            window.ModalManager.cleanupAllModals();
        }
        
        fetch('/config')
            .then(response => response.text())
            .then(html => {
                configModalBody.innerHTML = html;
                
                // モーダルを開く
                if (window.ModalManager) {
                    const modalInstance = window.ModalManager.openModal(configModalElement);
                    
                    if (modalInstance) {
                        // 隠れた時のクリーンアップイベント
                        configModalElement.addEventListener('hidden.bs.modal', () => {
                            console.log('🚪 [CONFIG] Extra Import modal hidden, cleaning up');
                            window.ModalManager.cleanupModal(configModalElement);
                            this.initialized = false;
                        }, { once: true });
                        
                        // 表示された後にExtra Importタブに切り替え
                        configModalElement.addEventListener('shown.bs.modal', () => {
                            console.log('🚪 [CONFIG] Modal shown, switching to Extra Import tab');
                            
                            // スクリプトを初期化
                            this.initializeModalScripts();
                            
                            // Extra Importタブに切り替え
                            const extraImportTab = document.getElementById('extra-import-tab');
                            if (extraImportTab) {
                                const tab = new bootstrap.Tab(extraImportTab);
                                tab.show();
                                
                                // ExtraImportを初期化してURLを設定
                                setTimeout(() => {
                                    if (window.ExtraImport) {
                                        window.ExtraImport.initialize();
                                        
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
                }
            })
            .catch(error => {
                console.error('❌ [CONFIG] Error loading config modal:', error);
                if (window.ModalManager) {
                    window.ModalManager.cleanupAllModals();
                }
            });
    }
};

// モジュールはutils.jsで一元管理されるため、直接エクスポートは削除
