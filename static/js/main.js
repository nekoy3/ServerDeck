// メインエントリーポイント
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, starting ServerDeck initialization...');
    
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
        console.log('Found extra_import_url in URL parameters:', extraImportUrl);
        // URLパラメータを保存
        localStorage.setItem('pendingExtraImportUrl', extraImportUrl);
        // URLをクリーンアップ
        const url = new URL(window.location);
        url.searchParams.delete('extra_import_url');
        window.history.replaceState({}, document.title, url.pathname);
        
        // 設定モーダルを直接開く
        console.log('Opening config modal from main.js');
        // 安全なタイミングで設定モーダルを開く
        setTimeout(() => {
            ServerDeckUtils.openConfigModalWithExtraImport(extraImportUrl);
        }, 1000);
    }

    // 各モジュールの初期化 - より安全な順序で実行
    console.log('Initializing ServerDeck modules...');
    
    try {
        // 1. 基本ユーティリティの初期化
        ServerDeckUtils.loadConfigModal();
        console.log('✓ ServerDeckUtils initialized');
        
        // 2. Ping監視の初期化
        PingStatus.initialize();
        console.log('✓ PingStatus initialized');
        
        // 3. サーバー管理機能の初期化
        ServerManagement.initializeEditForm();
        ServerManagement.attachServerCardEventListeners();
        console.log('✓ ServerManagement initialized');
        
        console.log('All ServerDeck modules initialized successfully');
    } catch (error) {
        console.error('Error during module initialization:', error);
    }
});
