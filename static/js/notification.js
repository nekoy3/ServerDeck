// 通知システム
window.NotificationManager = {
    initialized: false,
    
    // 初期化
    initialize: function() {
        if (this.initialized) {
            console.log('NotificationManager already initialized');
            return;
        }
        
        this.createNotificationContainer();
        this.initialized = true;
        console.log('✅ NotificationManager initialized');
    },
    
    // 通知コンテナを作成
    createNotificationContainer: function() {
        if (document.getElementById('notification-container')) {
            return; // Already exists
        }
        
        const container = document.createElement('div');
        container.id = 'notification-container';
        container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            max-width: 350px;
        `;
        document.body.appendChild(container);
    },
    
    // 通知を表示
    show: function(message, type = 'info', duration = 5000) {
        this.initialize(); // 必要に応じて初期化
        
        const notification = document.createElement('div');
        notification.className = `alert alert-${type} alert-dismissible fade show`;
        notification.style.cssText = `
            margin-bottom: 10px;
            box-shadow: 0 4px 8px rgba(0,0,0,0.2);
        `;
        
        const typeIcons = {
            success: 'check-circle',
            danger: 'exclamation-triangle',
            warning: 'exclamation-circle',
            info: 'info-circle'
        };
        
        const icon = typeIcons[type] || 'info-circle';
        
        notification.innerHTML = `
            <i class="fas fa-${icon} me-2"></i>
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;
        
        const container = document.getElementById('notification-container');
        container.appendChild(notification);
        
        // 自動削除
        if (duration > 0) {
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.classList.remove('show');
                    setTimeout(() => {
                        if (notification.parentElement) {
                            notification.remove();
                        }
                    }, 150);
                }
            }, duration);
        }
        
        return notification;
    },
    
    // 成功通知
    success: function(message, duration = 4000) {
        return this.show(message, 'success', duration);
    },
    
    // エラー通知
    error: function(message, duration = 8000) {
        return this.show(message, 'danger', duration);
    },
    
    // 警告通知
    warning: function(message, duration = 6000) {
        return this.show(message, 'warning', duration);
    },
    
    // 情報通知
    info: function(message, duration = 5000) {
        return this.show(message, 'info', duration);
    },
    
    // 全通知を削除
    clearAll: function() {
        const notifications = document.querySelectorAll('#notification-container .alert');
        notifications.forEach(notification => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.remove();
                }
            }, 150);
        });
    }
};
