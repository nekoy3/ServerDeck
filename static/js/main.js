// メインエントリーポイント - Bootstrap 対応改良版
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, starting ServerDeck initialization...');
    
    // Bootstrap の読み込みを待つ関数
    function waitForBootstrap(callback, maxAttempts = 50) {
        let attempts = 0;
        function checkBootstrap() {
            attempts++;
            if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
                console.log('✅ Bootstrap loaded successfully after', attempts, 'attempts');
                callback();
            } else if (attempts < maxAttempts) {
                console.log('⏳ Waiting for Bootstrap...', attempts + '/' + maxAttempts);
                setTimeout(checkBootstrap, 100);
            } else {
                console.error('❌ Bootstrap failed to load after', maxAttempts, 'attempts');
                callback(); // Continue anyway
            }
        }
        checkBootstrap();
    }
    
    // 初期化メイン関数
    function initializeServerDeck() {
        // ダークモードの切り替え
        const darkModeToggle = document.getElementById('darkModeToggle');
        const themeBody = document.getElementById('theme-body');

        if (!darkModeToggle) {
            console.warn('Dark mode toggle not found');
        }
        if (!themeBody) {
            console.warn('Theme body not found');
        }

        // 保存されたテーマ設定を読み込む
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme) {
            themeBody.classList.add(savedTheme);
            if (savedTheme === 'dark-theme') {
                darkModeToggle.checked = true;
            }
            console.log('Applied saved theme:', savedTheme);
        }

        if (darkModeToggle) {
            darkModeToggle.addEventListener('change', function() {
                if (this.checked) {
                    themeBody.classList.add('dark-theme');
                    localStorage.setItem('theme', 'dark-theme');
                    console.log('Switched to dark theme');
                } else {
                    themeBody.classList.remove('dark-theme');
                    localStorage.setItem('theme', 'light-theme');
                    console.log('Switched to light theme');
                }
            });
        }

        // URLパラメータを確認
        const urlParams = new URLSearchParams(window.location.search);
        const extraImportUrl = urlParams.get('extra_import_url');
        
        if (extraImportUrl) {
            console.log('Extra import URL detected:', extraImportUrl);
            // URLパラメータを保存
            localStorage.setItem('pendingExtraImportUrl', extraImportUrl);
            // URLをクリーンアップ
            const url = new URL(window.location);
            url.searchParams.delete('extra_import_url');
            window.history.replaceState({}, document.title, url.pathname);
            
            // 設定モーダルを開く（Bootstrap 確認後により長い遅延）
            console.log('Opening config modal from main.js');
            setTimeout(() => {
                if (typeof ServerDeckUtils !== 'undefined' && ServerDeckUtils.openConfigModalWithExtraImport) {
                    ServerDeckUtils.openConfigModalWithExtraImport(extraImportUrl);
                } else {
                    console.error('ServerDeckUtils not available for extra import');
                }
            }, 1500);
        }

        // 各モジュールの初期化 - より安全な順序で実行
        console.log('Initializing ServerDeck modules...');
        
        try {
            // 1. 基本ユーティリティの初期化
            if (typeof ServerDeckUtils !== 'undefined' && ServerDeckUtils.loadConfigModal) {
                ServerDeckUtils.loadConfigModal();
                console.log('✓ ServerDeckUtils initialized');
            }
            
            // 2. Ping監視の初期化
            if (typeof PingStatus !== 'undefined' && PingStatus.initialize) {
                PingStatus.initialize();
                console.log('✓ PingStatus initialized');
            }
            
            // 3. サーバー管理機能の初期化
            if (typeof ServerManagement !== 'undefined' && ServerManagement.initializeEditForm) {
                ServerManagement.initializeEditForm();
                console.log('✓ ServerManagement initialized');
            }
            
            // 4. エクストラインポート機能の初期化
            if (typeof ExtraImportUtils !== 'undefined' && ExtraImportUtils.initialize) {
                ExtraImportUtils.initialize();
                console.log('✓ ExtraImportUtils initialized');
            }
            
            console.log('All ServerDeck modules initialized successfully');
        } catch (error) {
            console.error('Error during module initialization:', error);
        }
    }
    
    // Bootstrap の読み込みを待ってから初期化
    waitForBootstrap(initializeServerDeck);
});

// クリップボードコピー機能
function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
        // Clipboard API を使用（HTTPS環境）
        navigator.clipboard.writeText(text).then(function() {
            showNotification('URLをクリップボードにコピーしました', 'success');
        }).catch(function(err) {
            console.error('クリップボードコピーエラー:', err);
            fallbackCopyToClipboard(text);
        });
    } else {
        // フォールバック方式（HTTP環境）
        fallbackCopyToClipboard(text);
    }
}

// フォールバック用のクリップボードコピー
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
