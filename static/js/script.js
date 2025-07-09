document.addEventListener('DOMContentLoaded', function() {
    const configLink = document.getElementById('configLink');
    const configModal = new bootstrap.Modal(document.getElementById('configModal'));
    const configModalBody = document.getElementById('configModalBody');
    const themeBody = document.getElementById('theme-body'); // Get the body element
    const darkModeToggle = document.getElementById('darkModeToggle'); // Get the toggle switch

    // Function to apply the theme
    function applyTheme(theme) {
        if (theme === 'dark') {
            themeBody.classList.add('dark-theme');
            darkModeToggle.checked = true;
        } else {
            themeBody.classList.remove('dark-theme');
            darkModeToggle.checked = false;
        }
    }

    // Load saved theme from localStorage or default to light
    const savedTheme = localStorage.getItem('theme') || 'light';
    applyTheme(savedTheme);

    // Event listener for theme toggle switch
    darkModeToggle.addEventListener('change', function() {
        if (this.checked) {
            applyTheme('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            applyTheme('light');
            localStorage.setItem('theme', 'light');
        }
    });

    // --- Ping Status Monitoring ---
    async function updatePingStatus(serverId) {
        const pingStatusBox = document.getElementById(`ping-status-${serverId}`);

        if (!pingStatusBox) {
            return; // Element not found, perhaps server card not rendered yet or removed
        }

        pingStatusBox.textContent = 'CHECKING';
        pingStatusBox.className = 'ping-status-box checking'; // Grey for checking

        try {
            const response = await fetch(`/api/ping_status/${serverId}`);
            const data = await response.json();
            const status = data.status;

            if (status === 'online') {
                pingStatusBox.textContent = 'ONLINE';
                pingStatusBox.className = 'ping-status-box online';
            } else if (status === 'offline') {
                pingStatusBox.textContent = 'OFFLINE';
                pingStatusBox.className = 'ping-status-box offline';
            } else {
                pingStatusBox.textContent = 'N/A';
                pingStatusBox.className = 'ping-status-box na';
            }
        } catch (error) {
            console.error(`Error fetching ping status for ${serverId}:`, error);
            pingStatusBox.textContent = 'ERROR';
            pingStatusBox.className = 'ping-status-box na'; // Use N/A style for error
        }
    }

    // Initial ping status update for all servers
    const serverCards = document.querySelectorAll('.server-card[data-server-id]');
    serverCards.forEach(card => {
        const serverId = card.dataset.serverId;
        updatePingStatus(serverId);
    });

    // Periodically update ping status (e.g., every 30 seconds)
    setInterval(() => {
        document.querySelectorAll('.server-card[data-server-id]').forEach(card => {
            const serverId = card.dataset.serverId;
            updatePingStatus(serverId);
        });
    }, 30000); // 30 seconds

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
        const serverSshKeyIdSelect = document.getElementById('serverSshKeyId'); // Changed from Path to Id
        const serverDescriptionInput = document.getElementById('serverDescription');
        const serverTagsInput = document.getElementById('serverTags');

        // Field groups for dynamic display
        const hostGroup = document.getElementById('hostGroup');
        const portGroup = document.getElementById('portGroup');
        const urlGroup = document.getElementById('urlGroup');
        const usernameGroup = document.getElementById('usernameGroup');
        const authMethodGroup = document.getElementById('authMethodGroup');
        const passwordGroup = document.getElementById('passwordGroup');
        const sshKeySelectGroup = document.getElementById('sshKeySelectGroup'); // Changed from Path to Select

        // SSH Key Management Elements
        const manageSshKeysBtn = document.getElementById('manageSshKeysBtn');
        const sshKeyModal = new bootstrap.Modal(document.getElementById('sshKeyModal'));
        const sshKeyList = document.getElementById('sshKeyList');
        const addSshKeyBtn = document.getElementById('addSshKeyBtn');
        const sshKeyForm = document.getElementById('sshKeyForm');
        const sshKeyIdInput = document.getElementById('sshKeyId');
        const sshKeyNameInput = document.getElementById('sshKeyName');
        const sshKeyPathInput = document.getElementById('sshKeyPath');
        const sshKeyFileInput = document.getElementById('sshKeyFile'); // New: SSH Key File Input
        const cancelSshKeyEditBtn = document.getElementById('cancelSshKeyEditBtn');
        let editingSshKeyId = null;

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

        async function attachEventListeners() {
            // Edit buttons
            document.querySelectorAll('.edit-btn').forEach(button => {
                button.onclick = async (event) => {
                    const serverId = event.target.dataset.id;
                    editingServerId = serverId;
                    await populateSshKeySelect(); // Populate SSH keys before opening modal
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
                addServerCard.onclick = async () => {
                    editingServerId = null; // Reset for new server
                    serverForm.reset(); // Clear form
                    serverIdInput.readOnly = false; // ID should be editable for new server
                    await populateSshKeySelect(); // Populate SSH keys before opening modal
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
                    serverSshKeyIdSelect.value = server.ssh_key_id || ''; // Set selected SSH key
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
            sshKeySelectGroup.style.display = 'none'; // Changed from Path to Select

            // Show relevant fields based on type
            if (type === 'ssh' || type === 'network_device') {
                hostGroup.style.display = 'block';
                portGroup.style.display = 'block';
                usernameGroup.style.display = 'block';
                authMethodGroup.style.display = 'block';
                // Further toggle based on auth method
                if (serverAuthMethodSelect.value === 'password') {
                    passwordGroup.style.display = 'block';
                }

                else {
                    sshKeySelectGroup.style.display = 'block'; // Show SSH key select
                }
            }

            else if (type === 'url') {
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

            // Ensure ID is correctly set for both new and existing servers
            if (editingServerId) {
                serverData.id = editingServerId;
            } else if (serverIdInput.value) {
                serverData.id = serverIdInput.value;
            } else {
                serverData.id = `server-${Date.now()}`;
            }

            for (let [key, value] of formData.entries()) {
                if (key === 'tags') {
                    serverData[key] = value.split(',').map(tag => tag.trim()).filter(tag => tag !== '');
                } else if (key === 'port') {
                    serverData[key] = parseInt(value, 10);
                } else if (key !== 'id') { // Exclude 'id' as it's handled above
                    serverData[key] = value;
                }
            }

            // Ensure required fields (id, name, type) are not deleted if empty, as they are validated by backend
            const requiredFields = ['id', 'name', 'type'];
            for (const key in serverData) {
                if (!requiredFields.includes(key) && (serverData[key] === '' || serverData[key] === null || (Array.isArray(serverData[key]) && serverData[key].length === 0))) {
                    delete serverData[key];
                }
            }

            // Handle password field: only send if it's not empty
            if (serverPasswordInput.value === '') {
                delete serverData.password;
            }

            // If SSH key authentication is selected, ensure ssh_key_id is sent and ssh_key_path is not
            if (serverData.auth_method === 'key') {
                serverData.ssh_key_id = serverSshKeyIdSelect.value; // Use selected SSH key ID
                delete serverData.ssh_key_path; // Ensure old field is not sent
            } else {
                delete serverData.ssh_key_id; // Ensure ssh_key_id is not sent if not using key auth
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

        // --- SSH Key Management Logic ---

        // Populate SSH Key Select dropdown
        async function populateSshKeySelect() {
            try {
                const response = await fetch('/api/ssh_keys');
                const sshKeys = await response.json();
                serverSshKeyIdSelect.innerHTML = '<option value="">選択してください</option>'; // Clear and add default
                sshKeys.forEach(key => {
                    const option = document.createElement('option');
                    option.value = key.id;
                    option.textContent = key.name;
                    serverSshKeyIdSelect.appendChild(option);
                });
            } catch (error) {
                console.error('Error fetching SSH keys for select:', error);
            }
        }

        // Fetch and render SSH keys in the management modal
        async function fetchAndRenderSshKeys() {
            try {
                const response = await fetch('/api/ssh_keys');
                const sshKeys = await response.json();
                sshKeyList.innerHTML = ''; // Clear existing list
                if (sshKeys.length === 0) {
                    sshKeyList.innerHTML = '<p class="text-muted">登録されたSSHキーはありません。</p>';
                } else {
                    sshKeys.forEach(key => {
                        const keyItem = `
                            <div class="list-group-item d-flex justify-content-between align-items-center">
                                <div>
                                    <strong>${key.name}</strong><br>
                                    <small>${key.path}</small>
                                </div>
                                <div>
                                    <button class="btn btn-sm btn-info edit-ssh-key-btn" data-id="${key.id}">編集</button>
                                    <button class="btn btn-sm btn-danger delete-ssh-key-btn" data-id="${key.id}">削除</button>
                                </div>
                            </div>
                        `;
                        sshKeyList.insertAdjacentHTML('beforeend', keyItem);
                    });
                }
                attachSshKeyEventListeners();
            } catch (error) {
                console.error('Error fetching SSH keys:', error);
                alert('SSHキーの読み込みに失敗しました。');
            }
        }

        // Attach event listeners for SSH key management buttons
        function attachSshKeyEventListeners() {
            document.querySelectorAll('.edit-ssh-key-btn').forEach(button => {
                button.onclick = async (event) => {
                    const keyId = event.target.dataset.id;
                    editingSshKeyId = keyId;
                    const response = await fetch('/api/ssh_keys');
                    const sshKeys = await response.json();
                    const key = sshKeys.find(k => k.id === keyId);
                    if (key) {
                        sshKeyIdInput.value = key.id;
                        sshKeyNameInput.value = key.name;
                        sshKeyPathInput.value = key.path;
                        cancelSshKeyEditBtn.style.display = 'inline-block';
                    }
                };
            });

            document.querySelectorAll('.delete-ssh-key-btn').forEach(button => {
                button.onclick = async (event) => {
                    const keyId = event.target.dataset.id;
                    if (confirm(`ID: ${keyId} のSSHキーを削除してもよろしいですか？`)) {
                        try {
                            const response = await fetch(`/api/ssh_keys/${keyId}`, {
                                method: 'DELETE'
                            });
                            if (response.ok) {
                                fetchAndRenderSshKeys();
                                populateSshKeySelect(); // Update server form select
                            } else {
                                const errorData = await response.json();
                                alert(`SSHキーの削除に失敗しました: ${errorData.error || response.statusText}`);
                            }
                        } catch (error) {
                            console.error('Error deleting SSH key:', error);
                            alert('SSHキーの削除中にエラーが発生しました。');
                        }
                    }
                };
            });
        }

        // Handle SSH Key Form Submission
        sshKeyForm.addEventListener('submit', async function(event) {
            event.preventDefault();

            const formData = new FormData(sshKeyForm);
            const keyData = {};

            // Validate that either path or file is provided
            if (!sshKeyPathInput.value && sshKeyFileInput.files.length === 0) {
                alert('SSHキーのパスを入力するか、ファイルをアップロードしてください。');
                return; // Stop submission
            }

            let finalKeyPath = ''; // Variable to hold the determined path

            // If a file is selected, upload it first
            if (sshKeyFileInput.files.length > 0) {
                const file = sshKeyFileInput.files[0];
                const uploadFormData = new FormData();
                uploadFormData.append('file', file);

                try {
                    const uploadResponse = await fetch('/api/ssh_keys/upload', {
                        method: 'POST',
                        body: uploadFormData
                    });

                    if (uploadResponse.ok) {
                        const uploadResult = await uploadResponse.json();
                        finalKeyPath = uploadResult.path; // Set the path from the upload response
                    } else {
                        const errorData = await uploadResponse.json();
                        alert(`ファイルのアップロードに失敗しました: ${errorData.error || uploadResponse.statusText}`);
                        return; // Stop submission if upload fails
                    }
                } catch (error) {
                    console.error('Error uploading file:', error);
                    alert('ファイルのアップロード中にエラーが発生しました。');
                    return; // Stop submission if upload fails
                }
            } else if (sshKeyPathInput.value) {
                finalKeyPath = sshKeyPathInput.value; // Set from input field
            }

            // Now, populate keyData with other form entries, but ensure 'path' is set from finalKeyPath
            for (let [key, value] of formData.entries()) {
                if (key !== 'file' && key !== 'path') { // Exclude 'file' and 'path' from direct form data processing
                    keyData[key] = value;
                }
            }
            keyData.path = finalKeyPath; // Explicitly set the path

            // Generate a unique ID for new SSH keys if not provided
            if (!editingSshKeyId && !keyData.id) {
                keyData.id = `sshkey-${Date.now()}`;
            }

            const method = editingSshKeyId ? 'PUT' : 'POST';
            const url = editingSshKeyId ? `/api/ssh_keys/${editingSshKeyId}` : '/api/ssh_keys';

            try {
                const response = await fetch(url, {
                    method: method,
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(keyData)
                });

                if (response.ok) {
                    sshKeyForm.reset();
                    editingSshKeyId = null;
                    cancelSshKeyEditBtn.style.display = 'none';
                    fetchAndRenderSshKeys();
                    populateSshKeySelect(); // Update server form select
                } else {
                    const errorData = await response.json();
                    alert(`SSHキーの保存に失敗しました: ${errorData.error || response.statusText}`);
                }
            } catch (error) {
                console.error('Error saving SSH key:', error);
                alert('SSHキーの保存中にエラーが発生しました。');
            }
        });

        // Add New SSH Key button click
        addSshKeyBtn.addEventListener('click', () => {
            editingSshKeyId = null;
            sshKeyForm.reset();
            sshKeyIdInput.value = ''; // Ensure ID is clear for new entry
            cancelSshKeyEditBtn.style.display = 'none';
        });

        // Cancel SSH Key Edit button click
        cancelSshKeyEditBtn.addEventListener('click', () => {
            editingSshKeyId = null;
            sshKeyForm.reset();
            sshKeyIdInput.value = '';
            cancelSshKeyEditBtn.style.display = 'none';
        });

        // Manage SSH Keys button click
        manageSshKeysBtn.addEventListener('click', () => {
            fetchAndRenderSshKeys();
            sshKeyModal.show();
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
