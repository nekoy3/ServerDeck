/**
 * ServerDeck Utilities - メインエントリーポイント
 * 各モジュールの初期化と統合管理
 */

// メイン初期化関数
window.ServerDeckUtils = {
    initialized: false,
    
    /**
     * すべてのユーティリティモジュールを初期化
     */
    initialize: function() {
        if (this.initialized) {
            console.log('ServerDeckUtils already initialized');
            return;
        }
        
        console.log('🚀 [UTILS] Initializing ServerDeck Utilities...');
        
        // 各モジュールの初期化
        try {
            // 設定モーダルの初期化
            if (window.ConfigModal) {
                window.ConfigModal.initialize();
                console.log('✅ [UTILS] ConfigModal initialized');
            }
            
            // URLパラメータの処理
            this.handleUrlParameters();
            
            this.initialized = true;
            console.log('✅ [UTILS] ServerDeck Utilities initialized successfully');
            
        } catch (error) {
            console.error('❌ [UTILS] Error initializing ServerDeck Utilities:', error);
        }
    },
    
    /**
     * URLパラメータの処理
     */
    handleUrlParameters: function() {
        if (!window.CommonUtils) return;
        
        const params = window.CommonUtils.getUrlParams();
        
        // Extra Import URLパラメータの処理
        if (params.extra_import_url && window.ConfigModal) {
            console.log('🔗 [UTILS] Extra Import URL parameter detected');
            
            // パラメータを一時保存
            localStorage.setItem('pendingExtraImportUrl', params.extra_import_url);
            
            // URLパラメータを削除
            window.CommonUtils.removeUrlParam('extra_import_url');
            
            // 設定モーダルを開く
            setTimeout(() => {
                if (window.ConfigModal) {
                    window.ConfigModal.openWithExtraImport(params.extra_import_url);
                }
                // 一時保存を削除
                localStorage.removeItem('pendingExtraImportUrl');
            }, 1000);
        }
    },
    
    /**
     * モジュールの依存関係チェック
     */
    checkDependencies: function() {
        const requiredModules = [
            'ModalManager',
            'APIManager', 
            'ConfigModal',
            'CommonUtils'
        ];
        
        const missingModules = requiredModules.filter(module => !window[module]);
        
        if (missingModules.length > 0) {
            console.error('❌ [UTILS] Missing required modules:', missingModules);
            return false;
        }
        
        console.log('✅ [UTILS] All required modules are available');
        return true;
    }
};

// 下位互換性のためのプロキシプロパティ
Object.defineProperty(window.ServerDeckUtils, 'modalManager', {
    get: function() {
        return window.ModalManager;
    }
});

Object.defineProperty(window.ServerDeckUtils, 'configModalInitialized', {
    get: function() {
        return window.ConfigModal ? window.ConfigModal.initialized : false;
    }
});

// 下位互換性のためのメソッドエイリアス
window.ServerDeckUtils.loadConfigModal = function() {
    if (window.ConfigModal) {
        return window.ConfigModal.initialize();
    }
};

window.ServerDeckUtils.openConfigModal = function() {
    if (window.ConfigModal) {
        return window.ConfigModal.openModal();
    }
};

window.ServerDeckUtils.openConfigModalWithExtraImport = function(url) {
    if (window.ConfigModal) {
        return window.ConfigModal.openWithExtraImport(url);
    }
};

window.ServerDeckUtils.initializeConfigModalScripts = function() {
    if (window.ConfigModal) {
        return window.ConfigModal.initializeModalScripts();
    }
};

window.ServerDeckUtils.toggleAuthFields = function(authMethod) {
    if (window.CommonUtils) {
        return window.CommonUtils.toggleAuthFields(authMethod);
    }
};

window.ServerDeckUtils.loadSshKeysForEditModal = function(selectedKeyId) {
    if (window.CommonUtils) {
        return window.CommonUtils.loadSshKeysForEditModal(selectedKeyId);
    }
};

window.ServerDeckUtils.handleApiError = function(error, userMessage) {
    if (window.CommonUtils) {
        return window.CommonUtils.handleApiError(error, userMessage);
    }
};

window.ServerDeckUtils.confirm = function(message, callback) {
    if (window.CommonUtils) {
        return window.CommonUtils.confirm(message, callback);
    }
};

window.ServerDeckUtils.apiRequest = function(url, options) {
    if (window.APIManager) {
        return window.APIManager.request(url, options);
    }
};

// DOMContentLoadedでの自動初期化
document.addEventListener('DOMContentLoaded', function() {
    // 依存関係のチェック
    if (window.ServerDeckUtils.checkDependencies()) {
        window.ServerDeckUtils.initialize();
    } else {
        console.warn('⚠️ [UTILS] Some dependencies are missing, delaying initialization');
        // 少し遅延させて再試行
        setTimeout(() => {
            if (window.ServerDeckUtils.checkDependencies()) {
                window.ServerDeckUtils.initialize();
            }
        }, 1000);
    }
});

console.log('📦 [UTILS] ServerDeck Utilities module loaded');
