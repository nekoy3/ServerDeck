/**
 * 共通ユーティリティ関数
 * 汎用的なヘルパー関数とUI操作
 */
window.CommonUtils = {
    /**
     * 認証フィールドの表示を切り替える
     * @param {string} authMethod - 認証方法 ('password' or 'ssh_key')
     */
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

    /**
     * SSHキーのドロップダウンをロードする
     * @param {string} selectedKeyId - 選択するSSHキーID
     */
    loadSshKeysForEditModal: function(selectedKeyId) {
        const sshKeySelect = document.getElementById('editServerSshKeyId');
        if (!sshKeySelect) return;

        if (window.APIManager) {
            window.APIManager.sshKeys.getAll()
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
        } else {
            // フォールバック（APIManagerが無い場合）
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
        }
    },

    /**
     * 共通エラーハンドリング
     * @param {Error} error - エラーオブジェクト
     * @param {string} userMessage - ユーザーに表示するメッセージ
     */
    handleApiError: function(error, userMessage = 'エラーが発生しました') {
        console.error('API Error:', error);
        const message = error.message || JSON.stringify(error) || userMessage;
        if (window.NotificationManager && window.NotificationManager.showNotification) {
            window.NotificationManager.showNotification(`${userMessage}: ${message}`, 'error');
        } else {
            alert(`${userMessage}: ${message}`);
        }
    },

    /**
     * 共通の確認ダイアログ
     * @param {string} message - 確認メッセージ
     * @param {Function} callback - OKが押された時のコールバック
     */
    confirm: function(message, callback) {
        if (confirm(message)) {
            callback();
        }
    },

    /**
     * クリップボードにテキストをコピー
     * @param {string} text - コピーするテキスト
     */
    copyToClipboard: function(text) {
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text).then(function() {
                if (window.NotificationManager && window.NotificationManager.showNotification) {
                    window.NotificationManager.showNotification('URLをクリップボードにコピーしました', 'success');
                } else {
                    alert('URLをクリップボードにコピーしました');
                }
            }).catch(function(err) {
                console.error('クリップボードコピーエラー:', err);
                CommonUtils.fallbackCopyToClipboard(text);
            });
        } else {
            CommonUtils.fallbackCopyToClipboard(text);
        }
    },

    /**
     * フォールバック用クリップボードコピー
     * @param {string} text - コピーするテキスト
     */
    fallbackCopyToClipboard: function(text) {
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
                if (window.NotificationManager && window.NotificationManager.showNotification) {
                    window.NotificationManager.showNotification('URLをクリップボードにコピーしました', 'success');
                } else {
                    alert('URLをクリップボードにコピーしました');
                }
            } else {
                if (window.NotificationManager && window.NotificationManager.showNotification) {
                    window.NotificationManager.showNotification('クリップボードコピーに失敗しました', 'error');
                } else {
                    alert('クリップボードコピーに失敗しました');
                }
            }
        } catch (err) {
            console.error('フォールバッククリップボードコピーエラー:', err);
            if (window.NotificationManager && window.NotificationManager.showNotification) {
                window.NotificationManager.showNotification('クリップボードコピーに失敗しました', 'error');
            } else {
                alert('クリップボードコピーに失敗しました');
            }
        } finally {
            document.body.removeChild(textArea);
        }
    },

    /**
     * URLパラメータを解析する
     * @returns {Object} URLパラメータのオブジェクト
     */
    getUrlParams: function() {
        const urlParams = new URLSearchParams(window.location.search);
        const params = {};
        for (const [key, value] of urlParams) {
            params[key] = value;
        }
        return params;
    },

    /**
     * URLパラメータを削除する
     * @param {string} param - 削除するパラメータ名
     */
    removeUrlParam: function(param) {
        const url = new URL(window.location);
        url.searchParams.delete(param);
        window.history.replaceState({}, '', url);
    },

    /**
     * 要素が存在するかチェック
     * @param {string} selector - CSS セレクター
     * @returns {boolean} 要素が存在するかどうか
     */
    elementExists: function(selector) {
        return document.querySelector(selector) !== null;
    },

    /**
     * 要素が表示されるまで待機
     * @param {string} selector - CSS セレクター
     * @param {number} timeout - タイムアウト時間（ミリ秒）
     * @returns {Promise<Element>} 要素が見つかった時に解決されるPromise
     */
    waitForElement: function(selector, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const element = document.querySelector(selector);
            if (element) {
                resolve(element);
                return;
            }

            const observer = new MutationObserver((mutations, obs) => {
                const element = document.querySelector(selector);
                if (element) {
                    obs.disconnect();
                    resolve(element);
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });

            // タイムアウト処理
            setTimeout(() => {
                observer.disconnect();
                reject(new Error(`Element ${selector} not found within ${timeout}ms`));
            }, timeout);
        });
    },

    /**
     * 配列をチャンクに分割
     * @param {Array} array - 分割する配列
     * @param {number} size - チャンクサイズ
     * @returns {Array<Array>} チャンクに分割された配列
     */
    chunkArray: function(array, size) {
        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    },

    /**
     * デバウンス関数
     * @param {Function} func - 実行する関数
     * @param {number} wait - 待機時間（ミリ秒）
     * @returns {Function} デバウンスされた関数
     */
    debounce: function(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
};

// グローバル関数として公開（下位互換性のため）
window.copyToClipboard = window.CommonUtils.copyToClipboard;

// モジュールはutils.jsで一元管理されるため、直接エクスポートは削除
