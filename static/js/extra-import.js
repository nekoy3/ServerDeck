// Extra Import機能
window.ExtraImport = {
    initialized: false,
    
    // 初期化
    initialize: function() {
        // 重複初期化を防ぐ
        if (this.initialized) {
            console.log('ExtraImport already initialized');
            return;
        }
        
        // デバッグ: 利用可能なメソッドを確認
        console.log('ExtraImport object methods:', Object.getOwnPropertyNames(ExtraImport));
        
        const extraImportForm = document.getElementById('extra-import-form');
        const extraImportUrlInput = document.getElementById('extra-import-url');

        // フォーム送信処理
        if (extraImportForm) {
            extraImportForm.addEventListener('submit', (e) => {
                ExtraImport.submitExtraImportForm(e, extraImportUrlInput);
            });
        }

        // Extra Import確認モーダルのボタンイベントリスナー
        if (typeof ExtraImport.initializeConfirmModal === 'function') {
            ExtraImport.initializeConfirmModal();
        } else {
            console.error('initializeConfirmModal method not found in ExtraImport object');
        }

        // URLパラメータから設定を読み込み
        ExtraImport.loadFromUrlParams(extraImportUrlInput);
        
        // Extra Importタブが表示されたときにURLをロード
        ExtraImport.loadExtraImportUrl(extraImportUrlInput);
        
        // 初期化完了フラグ
        this.initialized = true;
        console.log('ExtraImport initialized');
    },

    // URLパラメータまたはlocalStorageから設定を読み込み
    loadFromUrlParams: function(extraImportUrlInput) {
        if (!extraImportUrlInput) {
            console.log('extraImportUrlInput element not found');
            return;
        }
        
        // まずlocalStorageからの読み込みを試みる（main.jsで保存されたもの）
        const savedExtraImportUrl = localStorage.getItem('pendingExtraImportUrl');
        
        if (savedExtraImportUrl) {
            console.log('Loading Extra Import URL from localStorage:', savedExtraImportUrl);
            // URLデコードして入力フィールドに設定
            const decodedUrl = decodeURIComponent(savedExtraImportUrl);
            extraImportUrlInput.value = decodedUrl;
            
            // localStorageから削除
            localStorage.removeItem('pendingExtraImportUrl');
            
            // Extra Import URLを設定したらモーダルを自動的に送信
            this.submitExtraImportForm(new Event('submit'), extraImportUrlInput);
            return;
        }
        
        // localStorageに無ければURLパラメータを確認
        const urlParams = new URLSearchParams(window.location.search);
        const extraImportUrl = urlParams.get('extra_import_url');
        
        if (extraImportUrl) {
            console.log('Loading Extra Import URL from URL parameters:', extraImportUrl);
            // URLデコードして入力フィールドに設定
            const decodedUrl = decodeURIComponent(extraImportUrl);
            extraImportUrlInput.value = decodedUrl;
            
            // URLパラメータをクリア
            const url = new URL(window.location);
            url.searchParams.delete('extra_import_url');
            window.history.replaceState({}, document.title, url.pathname);
            
            // Extra Import URLを設定したらモーダルを自動的に送信
            this.submitExtraImportForm(new Event('submit'), extraImportUrlInput);
        }
    },

    // 現在のExtra Import URLをロードして表示
    loadExtraImportUrl: function(extraImportUrlInput) {
        // 既にURLパラメータから値が設定されている場合はスキップ
        if (extraImportUrlInput && extraImportUrlInput.value) {
            console.log('Extra Import URL already set from URL parameters, skipping API load');
            return;
        }
        
        fetch('/api/config/extra_import_url')
            .then(response => {
                if (!response.ok) {
                    // 404 Not Found の場合はURLが設定されていないと判断
                    if (response.status === 404) {
                        return { url: '' };
                    }
                    return response.json().then(err => { throw err; });
                }
                return response.json();
            })
            .then(data => {
                if (extraImportUrlInput) {
                    extraImportUrlInput.value = data.url || '';
                }
            })
            .catch(error => {
                console.error('Error loading Extra Import URL:', error);
                // エラー時も入力フィールドをクリア
                if (extraImportUrlInput) {
                    extraImportUrlInput.value = '';
                }
            });
    },

    // フォーム送信処理
    submitExtraImportForm: function(e, extraImportUrlInput) {
        e.preventDefault(); // デフォルトのフォーム送信を防ぐ

        const url = extraImportUrlInput.value;

        fetch('/api/config/extra_import_url', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ url: url })
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => { throw err; });
            }
            return response.json();
        })
        .then(data => {
            if (data.confirmation_needed) {
                const extraImportConfirmModal = new bootstrap.Modal(document.getElementById('extraImportConfirmModal'));
                extraImportConfirmModal.show();
            } else {
                NotificationManager.success('Extra Import URLが保存されました！');
            }
        })
        .catch(error => {
            console.error('Error saving Extra Import URL:', error);
            NotificationManager.error('Extra Import URLの保存に失敗しました: ' + error.message);
        });
    },

    // Extra Import確認モーダルの初期化
    initializeConfirmModal: function() {
        const extraImportConfirmModalElement = document.getElementById('extraImportConfirmModal');
        if (extraImportConfirmModalElement) {
            const extraImportConfirmDeleteBtn = document.getElementById('extraImportConfirmDeleteBtn');
            const extraImportConfirmKeepBtn = document.getElementById('extraImportConfirmKeepBtn');
            const extraImportConfirmCancelBtn = document.getElementById('extraImportConfirmCancelBtn');

            if (extraImportConfirmDeleteBtn) {
                extraImportConfirmDeleteBtn.addEventListener('click', () => ExtraImport.confirmExtraImportAction('delete_all'));
            }
            if (extraImportConfirmKeepBtn) {
                extraImportConfirmKeepBtn.addEventListener('click', () => ExtraImport.confirmExtraImportAction('keep_all'));
            }
            if (extraImportConfirmCancelBtn) {
                extraImportConfirmCancelBtn.addEventListener('click', () => ExtraImport.confirmExtraImportAction('cancel'));
            }
        }
    },

    // Extra Import アクションの確認
    confirmExtraImportAction: function(action) {
        fetch('/api/extra_import_url/confirm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: action })
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => { throw err; });
            }
            return response.json();
        })
        .then(data => {
            alert(data.message);
            const modalInstance = bootstrap.Modal.getInstance(document.getElementById('extraImportConfirmModal'));
            if (modalInstance) modalInstance.hide();
            // 両方のビューを更新
            ServerManagement.loadServersForConfigModal();
            ServerManagement.updateMainPageServerCards();
        })
        .catch(error => {
            console.error('Error confirming Extra Import action:', error);
            alert('Extra Importアクションの確認に失敗しました: ' + (error.message || JSON.stringify(error)));
        });
    },

    // 削除確認ダイアログを表示（個別サーバー用）
    showDeleteConfirmation: function(serverId, serverName) {
        const confirmDeleteModal = new bootstrap.Modal(document.getElementById('extraImportConfirmModal'));
        const modalBody = document.querySelector('#extraImportConfirmModal .modal-body');
        modalBody.innerHTML = `<p>このサーバー (<strong>${serverName}</strong>) はExtra Importから削除されました。どうしますか？</p>
                               <p><strong>削除:</strong> このサーバーを完全に削除します。</p>
                               <p><strong>維持:</strong> このサーバーを通常のサーバーとして維持し、Extra Importの管理対象から外します。</p>`;
        
        const extraImportConfirmDeleteBtn = document.getElementById('extraImportConfirmDeleteBtn');
        const extraImportConfirmKeepBtn = document.getElementById('extraImportConfirmKeepBtn');
        const extraImportConfirmCancelBtn = document.getElementById('extraImportConfirmCancelBtn');

        // イベントリスナーを一時的に削除して再設定
        const tempDeleteHandler = () => {
            ExtraImport.confirmSingleServerAction('delete_single', serverId);
            ExtraImport.removeTemporaryListeners(extraImportConfirmDeleteBtn, extraImportConfirmKeepBtn, extraImportConfirmCancelBtn, tempDeleteHandler, tempKeepHandler, tempCancelHandler);
        };

        const tempKeepHandler = () => {
            ExtraImport.confirmSingleServerAction('keep_single', serverId);
            ExtraImport.removeTemporaryListeners(extraImportConfirmDeleteBtn, extraImportConfirmKeepBtn, extraImportConfirmCancelBtn, tempDeleteHandler, tempKeepHandler, tempCancelHandler);
        };

        const tempCancelHandler = () => {
            const modalInstance = bootstrap.Modal.getInstance(document.getElementById('extraImportConfirmModal'));
            if (modalInstance) modalInstance.hide();
            ExtraImport.removeTemporaryListeners(extraImportConfirmDeleteBtn, extraImportConfirmKeepBtn, extraImportConfirmCancelBtn, tempDeleteHandler, tempKeepHandler, tempCancelHandler);
        };

        extraImportConfirmDeleteBtn.addEventListener('click', tempDeleteHandler);
        extraImportConfirmKeepBtn.addEventListener('click', tempKeepHandler);
        extraImportConfirmCancelBtn.addEventListener('click', tempCancelHandler);

        confirmDeleteModal.show();
    },

    // 個別サーバーのアクション確認
    confirmSingleServerAction: function(action, serverId) {
        fetch('/api/extra_import_url/confirm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: action, server_id: serverId })
        })
        .then(response => response.ok ? response.json() : response.json().then(err => { throw err; }))
        .then(data => {
            alert(data.message);
            const modalInstance = bootstrap.Modal.getInstance(document.getElementById('extraImportConfirmModal'));
            if (modalInstance) modalInstance.hide();
            ServerManagement.loadServersForConfigModal();
            ServerManagement.updateMainPageServerCards();
        })
        .catch(error => {
            console.error('Error confirming single server action:', error);
            alert('サーバーアクションの確認に失敗しました: ' + (error.message || JSON.stringify(error)));
        });
    },

    // 一時的なイベントリスナーを削除
    removeTemporaryListeners: function(deleteBtn, keepBtn, cancelBtn, deleteHandler, keepHandler, cancelHandler) {
        deleteBtn.removeEventListener('click', deleteHandler);
        keepBtn.removeEventListener('click', keepHandler);
        cancelBtn.removeEventListener('click', cancelHandler);
    }
};
