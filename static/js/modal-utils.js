/**
 * Modal管理ユーティリティ
 * Bootstrapモーダルの安全な開閉とライフサイクル管理
 */
window.ModalManager = {
    activeModals: new Set(),
    
    /**
     * モーダルを安全に開く
     * @param {HTMLElement} modalElement - モーダル要素
     * @param {Object} options - Bootstrapモーダルオプション
     * @returns {Promise<bootstrap.Modal|null>} モーダルインスタンス
     */
    openModal: function(modalElement, options = {}) {
        if (!modalElement || !modalElement.id) {
            console.error('🚨 [MODAL] Modal element not found or invalid');
            return Promise.resolve(null);
        }
        
        const modalId = modalElement.id;
        console.log(`🚪 [MODAL] Opening modal: ${modalId}`);
        
        // DOM要素の状態を事前チェック
        if (!document.body.contains(modalElement)) {
            console.error(`🚨 [MODAL] Modal element ${modalId} is not in DOM`);
            return Promise.resolve(null);
        }
        
        // 全てのモーダルを一旦クリーンアップ（競合を防ぐため）
        this.cleanupAllModals();
        
        // モーダル要素が完全に準備されるまで待機
        return new Promise((resolve) => {
            // DOM処理の前に必要な遅延を追加
            setTimeout(() => {
                try {
                    // Bootstrap modal 関連のDOM属性を安全に強制リセット
                    if (modalElement) {
                        modalElement.classList.remove('show');
                        modalElement.style.display = 'none';
                        modalElement.setAttribute('aria-hidden', 'true');
                        modalElement.removeAttribute('aria-modal');
                        modalElement.removeAttribute('role');
                    } else {
                        console.error(`❌ [MODAL] Modal element ${modalId} not found during reset`);
                        resolve(null);
                        return;
                    }
                    
                    // 新しいインスタンスを作成するための追加遅延
                    setTimeout(() => {
                        try {
                            // 新しいインスタンスを作成
                            const defaultOptions = {
                                backdrop: 'static',
                                keyboard: true,
                                focus: true
                            };
                            
                            const modalOptions = { ...defaultOptions, ...options };
                            
                            // モーダル内の重要な要素が存在するかチェック
                            const modalDialog = modalElement.querySelector('.modal-dialog');
                            const modalContent = modalElement.querySelector('.modal-content');
                            const modalBody = modalElement.querySelector('.modal-body');
                            
                            if (!modalDialog || !modalContent || !modalBody) {
                                console.error(`🚨 [MODAL] Modal ${modalId} structure is incomplete`, {
                                    hasDialog: !!modalDialog,
                                    hasContent: !!modalContent, 
                                    hasBody: !!modalBody,
                                    elementHtml: modalElement.innerHTML.substring(0, 200) + '...'
                                });
                                resolve(null);
                                return;
                            }
                            
                            // Bootstrapの既存のインスタンスを確実に削除
                            const existingInstance = bootstrap.Modal.getInstance(modalElement);
                            if (existingInstance) {
                                try {
                                    existingInstance.dispose();
                                } catch (e) {
                                    console.warn(`⚠️  [MODAL] Error disposing existing instance: ${e.message}`);
                                }
                            }
                            
                            const modalInstance = new bootstrap.Modal(modalElement, modalOptions);
                            
                            // アクティブなモーダルとして記録
                            this.activeModals.add(modalId);
                            
                            // モーダル表示（エラーを無視）
                            try {
                                modalInstance.show();
                                console.log(`✅ [MODAL] Modal ${modalId} opened successfully`);
                            } catch (showError) {
                                // Bootstrap内部エラーは無視して継続
                                console.warn(`⚠️  [MODAL] Bootstrap show error (ignored): ${showError.message}`);
                            }
                            resolve(modalInstance);
                            
                        } catch (innerError) {
                            console.error(`❌ [MODAL] Error creating modal instance ${modalId}:`, innerError);
                            this.activeModals.delete(modalId);
                            resolve(null);
                        }
                    }, 100); // 100ms遅延でBootstrap準備を確実にする
                    
                } catch (error) {
                    console.error(`❌ [MODAL] Error opening modal ${modalId}:`, error);
                    console.error('Modal element details:', {
                        id: modalElement.id,
                        classes: modalElement.className,
                        style: modalElement.style.cssText,
                        hasDialog: !!modalElement.querySelector('.modal-dialog'),
                        hasContent: !!modalElement.querySelector('.modal-content'),
                        hasBody: !!modalElement.querySelector('.modal-body')
                    });
                    this.activeModals.delete(modalId);
                    resolve(null);
                }
            }, 50); // DOM安定化のため50ms待機
        });
    },
    
    /**
     * モーダルを安全に閉じる
     * @param {HTMLElement} modalElement - モーダル要素
     */
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
    
    /**
     * モーダルのクリーンアップ
     * @param {HTMLElement} modalElement - モーダル要素
     */
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
    
    /**
     * 全モーダルを強制クリーンアップ
     */
    cleanupAllModals: function() {
        console.log('🧹 [MODAL] Cleaning up all modals');
        
        // 全てのBootstrapモーダルインスタンスを検索して削除
        document.querySelectorAll('.modal').forEach(modalElement => {
            const instance = bootstrap.Modal.getInstance(modalElement);
            if (instance) {
                try {
                    instance.hide();
                    instance.dispose();
                } catch (e) {
                    console.warn(`⚠️  [MODAL] Error disposing modal ${modalElement.id}:`, e.message);
                }
            }
            
            // DOM状態を強制リセット
            modalElement.classList.remove('show');
            modalElement.style.display = 'none';
            modalElement.setAttribute('aria-hidden', 'true');
            modalElement.removeAttribute('aria-modal');
            modalElement.removeAttribute('role');
        });
        
        // アクティブなモーダル記録をクリア
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
};

// モジュールはutils.jsで一元管理されるため、直接エクスポートは削除
