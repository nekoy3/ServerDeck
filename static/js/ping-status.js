// Ping状態管理とSocket.IO
window.PingStatus = {
    socket: null,

    // Socket.IOクライアントの初期化
    initialize: function() {
        this.socket = io();

        this.socket.on('ping_status_update', (data) => {
            this.updatePingStatus(data.server_id, data);
        });

        this.socket.on('extra_import_finished', () => {
            console.log('Received extra_import_finished event. Reloading servers.');
            ServerManagement.loadServersForConfigModal();
            ServerManagement.updateMainPageServerCards();
        });

        // 初回ロード時にPingステータスを更新
        this.updatePingStatus();
    },

    // Pingステータスの更新関数
    updatePingStatus: function(serverId = null, data = null) {
        const updateSingleBox = (box, statusData) => {
            const statusTextSpan = box.querySelector('.status-text');
            const pingDetailsSpan = box.querySelector('.ping-details');

            box.classList.remove('online', 'offline', 'checking', 'na', 'disabled');

            if (statusData.status === 'online') {
                box.classList.add('online');
                if (statusTextSpan) statusTextSpan.textContent = 'Online';
                if (pingDetailsSpan) {
                    pingDetailsSpan.textContent = ` (${statusData.response_time !== null ? statusData.response_time.toFixed(1) + ' ms' : 'N/A'}, ${statusData.packet_loss !== null ? statusData.packet_loss + '%' : 'N/A'} loss)`;
                }
            } else if (statusData.status === 'offline') {
                box.classList.add('offline');
                if (statusTextSpan) statusTextSpan.textContent = 'Offline';
                if (pingDetailsSpan) pingDetailsSpan.textContent = '';
            } else if (statusData.status === 'checking') {
                box.classList.add('checking');
                if (statusTextSpan) statusTextSpan.textContent = 'Checking...';
                if (pingDetailsSpan) pingDetailsSpan.textContent = '';
            } else if (statusData.status === 'disabled') {
                box.classList.add('disabled');
                if (statusTextSpan) statusTextSpan.textContent = 'Disabled';
                if (pingDetailsSpan) pingDetailsSpan.textContent = '';
            } else {
                box.classList.add('na');
                if (statusTextSpan) statusTextSpan.textContent = 'N/A';
                if (pingDetailsSpan) pingDetailsSpan.textContent = '';
            }
        };

        if (serverId && data) {
            // Update a single box based on provided data (e.g., from SocketIO)
            const box = document.getElementById(`ping-status-${serverId}`);
            if (box) {
                updateSingleBox(box, data);
            }
        } else {
            // Fetch status for all boxes (initial load or periodic refresh)
            document.querySelectorAll('.ping-status-box').forEach(box => {
                const currentServerId = box.id.replace('ping-status-', '');
                
                if (window.APIManager) {
                    window.APIManager.get(`/api/ping_status/${currentServerId}`)
                        .then(statusData => {
                            updateSingleBox(box, statusData);
                        })
                        .catch(error => {
                            console.error('Error fetching ping status for', currentServerId, ':', error);
                            updateSingleBox(box, { status: 'error', response_time: null, packet_loss: null });
                        });
                } else {
                    // Fallback to direct fetch if APIManager is not available
                    fetch(`/api/ping_status/${currentServerId}`)
                        .then(response => response.json())
                        .then(statusData => {
                            updateSingleBox(box, statusData);
                        })
                        .catch(error => {
                            console.error('Error fetching ping status for', currentServerId, ':', error);
                            updateSingleBox(box, { status: 'error', response_time: null, packet_loss: null });
                        });
                }
            });
        }
    }
};
