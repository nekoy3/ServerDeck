// ServerDeck Utilities - 修正版
window.ServerDeckUtils = {
    configModalInitialized: false,
    
    // 設定モーダルを開く - 修正版
    openConfigModal: function() {
        console.log('🚪 [CONFIG] Opening config modal');
        
        const configModalElement = document.getElementById('configModal');
        const configModalBody = document.getElementById('configModalBody');
        
        if (!configModalElement || !configModalBody) {
            console.error('❌ [CONFIG] Config modal elements not found', {
                hasConfigModal: !!configModalElement,
                hasConfigModalBody: !!configModalBody
            });
            return;
        }

        // コンテンツを読み込み
        fetch('/config')
            .then(response => response.text())
            .then(html => {
                configModalBody.innerHTML = html;
                
                // Bootstrap Modal を直接作成・表示
                setTimeout(() => {
                    try {
                        // 既存のインスタンスをクリーンアップ
                        const existingInstance = bootstrap.Modal.getInstance(configModalElement);
                        if (existingInstance) {
                            existingInstance.dispose();
                        }
                        
                        // 新しいインスタンスを作成
                        const modalInstance = new bootstrap.Modal(configModalElement, {
                            backdrop: 'static',
                            keyboard: true
                        });
                        
                        // イベント設定
                        configModalElement.addEventListener('shown.bs.modal', () => {
                            console.log('🚪 [CONFIG] Config modal shown');
                            if (typeof loadServersForConfigModal === 'function') {
                                loadServersForConfigModal();
                            }
                        }, { once: true });
                        
                        configModalElement.addEventListener('hidden.bs.modal', () => {
                            console.log('🚪 [CONFIG] Config modal hidden');
                        }, { once: true });
                        
                        // 表示
                        modalInstance.show();
                        
                    } catch (error) {
                        console.error('❌ [CONFIG] Bootstrap modal error:', error);
                        // フォールバック表示
                        this.showModalFallback(configModalElement);
                    }
                }, 100);
            })
            .catch(error => {
                console.error('❌ [CONFIG] Error loading config:', error);
            });
    },
    
    // フォールバック表示
    showModalFallback: function(modalElement) {
        console.log('🔄 [CONFIG] Using fallback modal display');
        modalElement.style.display = 'block';
        modalElement.classList.add('show');
        modalElement.setAttribute('aria-modal', 'true');
        modalElement.setAttribute('role', 'dialog');
        modalElement.removeAttribute('aria-hidden');
        document.body.classList.add('modal-open');
        
        // 背景を追加
        const backdrop = document.createElement('div');
        backdrop.className = 'modal-backdrop fade show';
        backdrop.id = 'config-modal-backdrop';
        document.body.appendChild(backdrop);
        
        // 閉じるボタンのイベント
        const closeButtons = modalElement.querySelectorAll('[data-bs-dismiss="modal"]');
        closeButtons.forEach(btn => {
            btn.addEventListener('click', () => this.hideModalFallback(modalElement), { once: true });
        });
        
        // loadServersForConfigModal を呼び出し
        if (typeof loadServersForConfigModal === 'function') {
            loadServersForConfigModal();
        }
    },
    
    // フォールバック非表示
    hideModalFallback: function(modalElement) {
        modalElement.style.display = 'none';
        modalElement.classList.remove('show');
        modalElement.setAttribute('aria-hidden', 'true');
        modalElement.removeAttribute('aria-modal');
        modalElement.removeAttribute('role');
        document.body.classList.remove('modal-open');
        
        const backdrop = document.getElementById('config-modal-backdrop');
        if (backdrop) {
            backdrop.remove();
        }
    },
    
    // 設定モーダルの初期化
    loadConfigModal: function() {
        console.log('🔧 [CONFIG] Loading config modal handler');
        
        // 設定リンクのイベント
        const configLink = document.getElementById('configLink');
        if (configLink) {
            configLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.openConfigModal();
            });
        }
    },
    
    // Extra Import URLでモーダルを開く
    openConfigModalWithExtraImport: function(extraImportUrl) {
        console.log('🚪 [CONFIG] Opening config modal with extra import:', extraImportUrl);
        
        // 通常のモーダルを開く
        this.openConfigModal();
        
        // モーダルが表示された後にExtra Importタブを開く
        const configModalElement = document.getElementById('configModal');
        if (configModalElement) {
            const handleModalShown = () => {
                setTimeout(() => {
                    const extraImportTab = document.querySelector('[data-bs-target="#extra-import"]');
                    if (extraImportTab) {
                        extraImportTab.click();
                        
                        // URLを設定
                        setTimeout(() => {
                            const urlInput = document.getElementById('extraImportUrl');
                            if (urlInput) {
                                urlInput.value = extraImportUrl;
                                console.log('✅ [CONFIG] Extra import URL set:', extraImportUrl);
                            }
                        }, 500);
                    }
                }, 500);
            };
            
            configModalElement.addEventListener('shown.bs.modal', handleModalShown, { once: true });
        }
    }
};

// グローバル関数として公開
window.copyToClipboard = function(text) {
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(function() {
            showNotification('URLをクリップボードにコピーしました', 'success');
        }).catch(function(err) {
            console.error('クリップボードコピーエラー:', err);
            fallbackCopyToClipboard(text);
        });
    } else {
        fallbackCopyToClipboard(text);
    }
};

function fallbackCopyToClipboard(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
        const successful = document.execCommand('copy');
        if (successful) {
            showNotification('URLをクリップボードにコピーしました', 'success');
        } else {
            showNotification('クリップボードコピーに失敗しました', 'error');
        }
    } catch (err) {
        console.error('フォールバッククリップボードコピーエラー:', err);
        showNotification('クリップボードコピーに失敗しました', 'error');
    } finally {
        document.body.removeChild(textArea);
    }
}
