/**
 * API管理ユーティリティ
 * 共通のAPIリクエスト処理とエラーハンドリング
 */
window.APIManager = {
    /**
     * 共通APIリクエスト関数
     * @param {string} url - APIエンドポイント
     * @param {Object} options - fetchオプション
     * @returns {Promise} APIレスポンス
     */
    request: async function(url, options = {}) {
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        };
        
        const mergedOptions = { ...defaultOptions, ...options };
        
        // FormDataの場合はContent-Typeヘッダーを削除（ブラウザが自動設定）
        if (options.body instanceof FormData) {
            delete mergedOptions.headers['Content-Type'];
        }
        
        try {
            const response = await fetch(url, mergedOptions);
            
            if (!response.ok) {
                // エラーレスポンスの処理
                let errorMessage;
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.message || errorData.error || `HTTP ${response.status}: ${response.statusText}`;
                } catch {
                    errorMessage = `HTTP ${response.status}: ${response.statusText}`;
                }
                throw new Error(errorMessage);
            }
            
            // 成功レスポンスの処理
            if (response.status === 204) {
                return {}; // No Content
            }
            
            // Blobレスポンスの場合
            if (options.responseType === 'blob') {
                return await response.blob();
            }
            
            return await response.json();
        } catch (error) {
            console.error(`API request failed for ${url}:`, error);
            throw error;
        }
    },
    
    /**
     * GETリクエスト
     * @param {string} url - APIエンドポイント
     * @param {Object} options - fetchオプション
     * @returns {Promise} APIレスポンス
     */
    get: function(url, options = {}) {
        return this.request(url, { ...options, method: 'GET' });
    },
    
    /**
     * POSTリクエスト
     * @param {string} url - APIエンドポイント
     * @param {Object|FormData} data - リクエストデータ
     * @param {Object} options - fetchオプション
     * @returns {Promise} APIレスポンス
     */
    post: function(url, data, options = {}) {
        const body = data instanceof FormData ? data : JSON.stringify(data);
        return this.request(url, { ...options, method: 'POST', body });
    },
    
    /**
     * PUTリクエスト
     * @param {string} url - APIエンドポイント
     * @param {Object} data - リクエストデータ
     * @param {Object} options - fetchオプション
     * @returns {Promise} APIレスポンス
     */
    put: function(url, data, options = {}) {
        return this.request(url, { ...options, method: 'PUT', body: JSON.stringify(data) });
    },
    
    /**
     * DELETEリクエスト
     * @param {string} url - APIエンドポイント
     * @param {Object} options - fetchオプション
     * @returns {Promise} APIレスポンス
     */
    delete: function(url, options = {}) {
        return this.request(url, { ...options, method: 'DELETE' });
    },
    
    // サーバー関連APIエンドポイント
    servers: {
        /**
         * 全サーバー取得
         * @returns {Promise<Array>} サーバー一覧
         */
        getAll: () => APIManager.request('/api/servers'),
        
        /**
         * 単一サーバー取得
         * @param {string} id - サーバーID
         * @returns {Promise<Object>} サーバー情報
         */
        get: (id) => APIManager.request(`/api/servers/${id}`),
        
        /**
         * サーバー作成/更新
         * @param {Object} data - サーバーデータ
         * @returns {Promise<Object>} 作成/更新されたサーバー情報
         */
        save: (data) => {
            const method = data.id ? 'PUT' : 'POST';
            const url = data.id ? `/api/servers/${data.id}` : '/api/servers';
            return APIManager.request(url, {
                method,
                body: JSON.stringify(data)
            });
        },
        
        /**
         * サーバー削除
         * @param {string} id - サーバーID
         * @returns {Promise} 削除結果
         */
        delete: (id) => APIManager.request(`/api/servers/${id}`, { method: 'DELETE' }),
        
        /**
         * サーバー一括削除
         * @param {Array<string>} ids - サーバーID配列
         * @returns {Promise} 削除結果
         */
        bulkDelete: (ids) => APIManager.request('/bulk_delete_servers', {
            method: 'POST',
            body: JSON.stringify({ server_ids: ids })
        })
    },
    
    // SSHキー関連APIエンドポイント
    sshKeys: {
        /**
         * 全SSHキー取得
         * @returns {Promise<Array>} SSHキー一覧
         */
        getAll: () => APIManager.request('/api/ssh_keys'),
        
        /**
         * 単一SSHキー取得
         * @param {string} id - SSHキーID
         * @returns {Promise<Object>} SSHキー情報
         */
        get: (id) => APIManager.request(`/api/ssh_keys/${id}`),
        
        /**
         * SSHキー削除
         * @param {string} id - SSHキーID
         * @returns {Promise} 削除結果
         */
        delete: (id) => APIManager.request(`/api/ssh_keys/${id}`, { method: 'DELETE' }),
        
        /**
         * SSHキー一括削除
         * @param {Array<string>} ids - SSHキーID配列
         * @returns {Promise} 削除結果
         */
        bulkDelete: (ids) => APIManager.request('/api/ssh_keys/bulk_delete', {
            method: 'POST',
            body: JSON.stringify({ ids: ids })
        }),
        
        /**
         * SSHキーアップロード
         * @param {FormData} formData - アップロードするファイルデータ
         * @returns {Promise<Object>} アップロード結果
         */
        upload: (formData) => APIManager.request('/api/ssh_keys/upload', {
            method: 'POST',
            body: formData
        }),
        
        /**
         * SSHキー作成
         * @param {Object} keyData - SSHキーデータ
         * @returns {Promise<Object>} 作成結果
         */
        create: (keyData) => APIManager.request('/api/ssh_keys', {
            method: 'POST',
            body: JSON.stringify(keyData)
        }),
        
        /**
         * SSHキー更新
         * @param {string} id - SSHキーID
         * @param {Object} keyData - 更新するSSHキーデータ
         * @returns {Promise<Object>} 更新結果
         */
        update: (id, keyData) => APIManager.request(`/api/ssh_keys/${id}`, {
            method: 'PUT',
            body: JSON.stringify(keyData)
        })
    },
    
    // Extra Import関連APIエンドポイント
    extraImport: {
        /**
         * Extra ImportのURL取得
         * @returns {Promise<Object>} URL情報
         */
        getUrl: () => APIManager.request('/api/config/extra_import_url'),
        
        /**
         * Extra ImportのURL設定
         * @param {string} url - インポートURL
         * @returns {Promise<Object>} 設定結果
         */
        setUrl: (url) => APIManager.request('/api/config/extra_import_url', {
            method: 'POST',
            body: JSON.stringify({ url: url })
        }),
        
        /**
         * Extra Importアクションの確認
         * @param {string} action - アクション ('delete_all', 'keep_all', 'cancel', etc.)
         * @param {string} [serverId] - 単一サーバーの場合のサーバーID
         * @returns {Promise<Object>} 確認結果
         */
        confirm: (action, serverId = null) => {
            const body = { action };
            if (serverId) body.server_id = serverId;
            return APIManager.request('/api/extra_import_url/confirm', {
                method: 'POST',
                body: JSON.stringify(body)
            });
        }
    },

    // バックアップ関連APIエンドポイント
    backup: {
        /**
         * バックアップファイル一覧取得
         * @returns {Promise<Array>} バックアップファイル一覧
         */
        getAll: () => APIManager.request('/api/backups'),
        
        /**
         * バックアップファイル一覧取得（エイリアス）
         * @returns {Promise<Array>} バックアップファイル一覧
         */
        getFiles: () => APIManager.request('/api/backups'),
        
        /**
         * バックアップファイル削除
         * @param {string} filename - 削除するバックアップファイル名
         * @returns {Promise<Object>} 削除結果
         */
        delete: (filename) => APIManager.request(`/api/backups/delete/${encodeURIComponent(filename)}`, {
            method: 'DELETE'
        }),
        
        /**
         * バックアップからの復元
         * @param {string} filename - バックアップファイル名
         * @returns {Promise<Object>} 復元結果
         */
        restore: (filename) => APIManager.request('/api/backup/restore', {
            method: 'POST',
            body: JSON.stringify({ filename })
        }),
        
        /**
         * 設定のエクスポート
         * @returns {Promise<Blob>} エクスポートされたファイル
         */
        export: () => APIManager.request('/api/config/export'),
        
        /**
         * 設定のインポート
         * @param {FormData} formData - インポートするファイルデータ
         * @returns {Promise<Object>} インポート結果
         */
        import: (formData) => APIManager.request('/api/config/import', {
            method: 'POST',
            body: formData
        })
    }
};

// モジュールはutils.jsで一元管理されるため、直接エクスポートは削除
