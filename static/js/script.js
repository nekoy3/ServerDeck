document.addEventListener('DOMContentLoaded', function() {
    const configLink = document.getElementById('configLink');
    const configModal = new bootstrap.Modal(document.getElementById('configModal'));
    const configModalBody = document.getElementById('configModalBody');

    // Function to initialize config page logic after content is loaded
    function initializeConfigPageLogic() {
        const serverList = document.getElementById('server-list');
        const serverModal = new bootstrap.Modal(document.getElementById('serverModal'));
        const serverForm = document.getElementById('serverForm');
        let editingServerId = null;

        // Form fields
        const serverIdInput = document.getElementById('serverId');
        const serverNameInput = document.getElementById('serverName');
        const serverTypeSelect = document.getElementById('serverType');
        const serverHostInput = document.getElementById('serverHost');
        const serverPortInput = document.getElementById('serverPort');
        const serverUrlInput = document.getElementById('serverUrl');
        const serverUsernameInput = document.getElementById('serverUsername');
        const serverAuthMethodSelect = document.getElementById('serverAuthMethod');
        const serverPasswordInput = document.getElementById('serverPassword');
        const serverSshKeyPathInput = document.getElementById('serverSshKeyPath');
        const serverDescriptionInput = document.getElementById('serverDescription');
        const serverTagsInput = document.getElementById('serverTags');

        // Field groups for dynamic display
        const hostGroup = document.getElementById('hostGroup');
        const portGroup = document.getElementById('portGroup');
        const urlGroup = document.getElementById('urlGroup');
        const usernameGroup = document.getElementById('usernameGroup');
        const authMethodGroup = document.getElementById('authMethodGroup');
        const passwordGroup = document.getElementById('passwordGroup');
        const sshKeyPathGroup = document.getElementById('sshKeyPathGroup');

        // Function to fetch servers and render them
        async function fetchAndRenderServers() {
            try {
                const response = await fetch('/api/servers');
                const servers = await response.json();
                renderServers(servers);
            } catch (error) {
                console.error('Error fetching servers:', error);
                alert('サーバー設定の読み込みに失敗しました。');
            }
        }

        // Function to render server cards
        function renderServers(servers) {
            serverList.innerHTML = ''; // Clear existing cards

            servers.forEach(server => {
                const cardHtml = `
                    <div class="col-md-4">
                        <div class="card server-card config-server-card" data-id="${server.id}">
                            <div class="card-body server-card-body d-flex align-items-center">
                                <i class="server-card-icon fas ${getIconClass(server.type)}"></i>
                                <div>
                                    <h5 class="card-title server-card-title">${server.name}</h5>
                                    <p class="card-text server-card-text"><strong>タイプ:</strong> ${server.type ? getTypeDisplayName(server.type) : ''}</p>
                                    ${server.host ? `<p class="card-text server-card-text"><strong>ホスト:</strong> ${server.host}</p>` : ''}
                                    ${server.url ? `<p class="card-text server-card-text"><strong>URL:</strong> <a href="${server.url}" target="_blank">${server.url}</a></p>` : ''}
                                    ${server.description ? `<p class="card-text server-card-text">${server.description}</p>` : ''}
                                    ${server.tags && server.tags.length > 0 ? `
                                    <div class="server-card-tags">
                                        ${server.tags.map(tag => `<span class="badge bg-secondary">${tag}</span>`).join('')}
                                    </div>` : ''}
                                </div>
                            </div>
                            <div class="card-footer">
                                <button class="btn btn-sm btn-info edit-btn" data-id="${server.id}">編集</button>
                                <button class="btn btn-sm btn-danger delete-btn" data-id="${server.id}">削除</button>
                            </div>
                        </div>
                    </div>
                `;
                serverList.insertAdjacentHTML('beforeend', cardHtml);
            });

            // Add the "Add New Server" card
            const addCardHtml = `
                <div class="col-md-4">
                    <div class="card server-card add-server-card" id="addServerCard">
                        <div class="card-body d-flex justify-content-center align-items-center">
                            <i class="fas fa-plus-circle"></i>
                        </div>
                    </div>
                </div>
            `;
            serverList.insertAdjacentHTML('beforeend', addCardHtml);

            // Attach event listeners to new elements
            attachEventListeners();
        }

        function getIconClass(type) {
            switch (type) {
                case 'ssh': return 'fa-terminal ssh';
                case 'url': return 'fa-globe url';
                case 'network_device': return 'fa-network-wired network_device';
                default: return 'fa-server';
            }
        }

        function getTypeDisplayName(type) {
            switch (type) {
                case 'ssh': return 'SSHサーバー';
                case 'url': return 'URLサービス';
                case 'network_device': return 'ネットワークデバイス';
                default: return type;
            }
        }

        function attachEventListeners() {
            // Edit buttons
            document.querySelectorAll('.edit-btn').forEach(button => {
                button.onclick = (event) => {
                    const serverId = event.target.dataset.id;
                    editingServerId = serverId;
                    populateModalForEdit(serverId);
                    serverModal.show();
                };
            });

            // Delete buttons
            document.querySelectorAll('.delete-btn').forEach(button => {
                button.onclick = async (event) => {
                    const serverId = event.target.dataset.id;
                    if (confirm(`ID: ${serverId} のサーバーを削除してもよろしいですか？`)) {
                        try {
                            const response = await fetch(`/api/servers/${serverId}`, {
                                method: 'DELETE'
                            });
                            if (response.ok) {
                                fetchAndRenderServers(); // Re-render list
                            } else {
                                const errorData = await response.json();
                                alert(`サーバーの削除に失敗しました: ${errorData.error || response.statusText}`);
                            }
                        } catch (error) {
                            console.error('Error deleting server:', error);
                            alert('サーバーの削除中にエラーが発生しました。');
                        }
                    }
                };
            });

            // Add New Server card
            const addServerCard = document.getElementById('addServerCard');
            if (addServerCard) {
                addServerCard.onclick = () => {
                    editingServerId = null; // Reset for new server
                    serverForm.reset(); // Clear form
                    serverIdInput.readOnly = false; // ID should be editable for new server
                    serverModal.show();
                    toggleFormFields(); // Show default fields for new server
                };
            }
        }

        // Populate modal for editing
        async function populateModalForEdit(serverId) {
            try {
                const response = await fetch('/api/servers');
                const servers = await response.json();
                const server = servers.find(s => s.id === serverId);

                if (server) {
                    serverIdInput.value = server.id;
                    serverIdInput.readOnly = true; // ID should not be editable when editing
                    serverNameInput.value = server.name || '';
                    serverTypeSelect.value = server.type || 'ssh'; // Default to ssh if not set
                    serverHostInput.value = server.host || '';
                    serverPortInput.value = server.port || 22;
                    serverUrlInput.value = server.url || '';
                    serverUsernameInput.value = server.username || '';
                    serverAuthMethodSelect.value = server.auth_method || 'password';
                    serverPasswordInput.value = ''; // Never pre-fill password for security
                    serverSshKeyPathInput.value = server.ssh_key_path || '';
                    serverDescriptionInput.value = server.description || '';
                    serverTagsInput.value = (server.tags && server.tags.length > 0) ? server.tags.join(', ') : '';

                    toggleFormFields(); // Adjust fields based on type
                } else {
                    alert('編集するサーバーが見つかりませんでした。');
                    serverModal.hide();
                }
            } catch (error) {
                console.error('Error populating modal:', error);
                alert('サーバーデータの読み込みに失敗しました。');
            }
        }

        // Toggle form fields based on server type
        function toggleFormFields() {
            const type = serverTypeSelect.value;

            // Hide all by default
            hostGroup.style.display = 'none';
            portGroup.style.display = 'none';
            urlGroup.style.display = 'none';
            usernameGroup.style.display = 'none';
            authMethodGroup.style.display = 'none';
            passwordGroup.style.display = 'none';
            sshKeyPathGroup.style.display = 'none';

            // Show relevant fields based on type
            if (type === 'ssh' || type === 'network_device') {
                hostGroup.style.display = 'block';
                portGroup.style.display = 'block';
                usernameGroup.style.display = 'block';
                authMethodGroup.style.display = 'block';
                // Further toggle based on auth method
                if (serverAuthMethodSelect.value === 'password') {
                    passwordGroup.style.display = 'block';
                } else {
                    sshKeyPathGroup.style.display = 'block';
                }
            } else if (type === 'url') {
                urlGroup.style.display = 'block';
            }
        }

        // Event listener for type select change
        serverTypeSelect.addEventListener('change', toggleFormFields);
        serverAuthMethodSelect.addEventListener('change', toggleFormFields);

        // Handle form submission
        serverForm.addEventListener('submit', async function(event) {
            event.preventDefault();

            const formData = new FormData(serverForm);
            const serverData = {};
            for (let [key, value] of formData.entries()) {
                if (key === 'tags') {
                    serverData[key] = value.split(',').map(tag => tag.trim()).filter(tag => tag !== '');
                } else if (key === 'port') {
                    serverData[key] = parseInt(value, 10);
                } else {
                    serverData[key] = value;
                }
            }

            // Remove empty string values for optional fields
            for (const key in serverData) {
                if (serverData[key] === '' || serverData[key] === null || (Array.isArray(serverData[key]) && serverData[key].length === 0)) {
                    delete serverData[key];
                }
            }

            // Handle password field: only send if it's not empty
            if (serverPasswordInput.value === '') {
                delete serverData.password;
            }

            const method = editingServerId ? 'PUT' : 'POST';
            const url = editingServerId ? `/api/servers/${editingServerId}` : '/api/servers';

            try {
                const response = await fetch(url, {
                    method: method,
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(serverData)
                });

                if (response.ok) {
                    serverModal.hide();
                    fetchAndRenderServers(); // Re-render list
                } else {
                    const errorData = await response.json();
                    alert(`サーバーの保存に失敗しました: ${errorData.error || response.statusText}`);
                }
            } catch (error) {
                console.error('Error saving server:', error);
                alert('サーバーの保存中にエラーが発生しました。');
            }
        });

        // Initial fetch and render when config modal content is loaded
        fetchAndRenderServers();
    }

    // Event listener for config link click
    configLink.addEventListener('click', async function(event) {
        event.preventDefault();
        try {
            const response = await fetch('/config');
            const htmlContent = await response.text();
            configModalBody.innerHTML = htmlContent;
            configModal.show();
            initializeConfigPageLogic(); // Initialize JS for the loaded content
        } catch (error) {
            console.error('Error loading config page:', error);
            alert('設定ページの読み込みに失敗しました。');
        }
    });
});
