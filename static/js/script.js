document.addEventListener('DOMContentLoaded', function() {
    const configLink = document.getElementById('configLink');
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
        attachMainPageEventListeners(); // Re-attach event listeners after potential DOM changes
    }, 30000); // 30 seconds

    // Function to attach event listeners for main page server cards
    function attachMainPageEventListeners() {
        // Setup button for new servers
        document.querySelectorAll('.server-card .setup-btn').forEach(button => {
            button.onclick = (event) => {
                const serverId = event.target.dataset.id;
                sessionStorage.setItem('setupServerId', serverId); // Store serverId temporarily
                configLink.click(); // Trigger config modal to open
            };
        });

        // Confirm delete button for deleted servers
        document.querySelectorAll('.server-card .confirm-delete-btn').forEach(button => {
            button.onclick = async (event) => {
                const serverId = event.target.dataset.id;
                if (confirm(`このサーバーをExtra Importから完全に削除してもよろしいですか？`)) {
                    try {
                        const response = await fetch(`/api/servers/${serverId}`, {
                            method: 'DELETE'
                        });
                        if (response.ok) {
                            // Re-render main page servers after deletion
                            location.reload(); // Simple reload for now
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

        // Cancel delete button (keep server) for deleted servers
        document.querySelectorAll('.server-card .cancel-delete-btn').forEach(button => {
            button.onclick = async (event) => {
                const serverId = event.target.dataset.id;
                try {
                    const response = await fetch(`/api/servers/${serverId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ is_extra: false, is_deleted: false })
                    });
                    if (response.ok) {
                        // Re-render main page servers after update
                        location.reload(); // Simple reload for now
                    } else {
                        const errorData = await response.json();
                        alert(`サーバーの維持に失敗しました: ${errorData.error || response.statusText}`);
                    }
                } catch (error) {
                    console.error('Error keeping server:', error);
                    alert('サーバーの維持中にエラーが発生しました。');
                }
            };
        });
    }

    // Initial attachment of event listeners for main page
    attachMainPageEventListeners();

    // Function to initialize config page logic after content is loaded
    function initializeConfigPageLogic(serverModal) {
        const serverList = document.getElementById('server-list');
        const serverForm = document.getElementById('serverForm');
        let editingServerId = null;

        // Check if a serverId was passed from the main page setup button
        const setupServerId = sessionStorage.getItem('setupServerId');
        if (setupServerId) {
            editingServerId = setupServerId;
            sessionStorage.removeItem('setupServerId'); // Clear it after use
            populateModalForEdit(editingServerId);
            serverModal.show();
        }

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
        const bulkDeleteSshKeysBtn = document.getElementById('bulkDeleteSshKeysBtn'); // New: Bulk Delete Button
        let editingSshKeyId = null;

        // Function to update bulk delete button state
        function updateBulkDeleteButtonState() {
            const checkedCheckboxes = document.querySelectorAll('.ssh-key-checkbox:checked');
            bulkDeleteSshKeysBtn.disabled = checkedCheckboxes.length === 0;
        }

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
                let cardClass = 'config-server-card';
                let footerHtml = '';

                if (server.is_new) {
                    cardClass += ' border-success'; // Green border for new servers
                    footerHtml = `<button class="btn btn-sm btn-success setup-btn" data-id="${server.id}">設定</button>`;
                } else if (server.is_deleted) {
                    cardClass += ' border-danger'; // Red border for deleted servers
                    footerHtml = `
                        <button class="btn btn-sm btn-danger confirm-delete-btn" data-id="${server.id}">削除</button>
                        <button class="btn btn-sm btn-secondary cancel-delete-btn" data-id="${server.id}">維持</button>
                    `;
                } else {
                    footerHtml = `
                        <button class="btn btn-sm btn-info edit-btn" data-id="${server.id}">編集</button>
                        <button class="btn btn-sm btn-danger delete-btn" data-id="${server.id}">削除</button>
                    `;
                }

                const cardHtml = `
                    <div class="col-md-4">
                        <div class="card server-card ${cardClass}" data-id="${server.id}">
                            <div class="card-body server-card-body d-flex align-items-center">
                                <i class="server-card-icon fas ${getIconClass(server.type)}"></i>
                                <div class="server-card-info">
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
                                ${footerHtml}
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
                case 'node': return 'fa-server';
                case 'virtual_machine': return 'fa-laptop';
                case 'kvm': return 'fa-boxes-stacked';
                default: return 'fa-question-circle'; // Unknown type
            }
        }

        function getTypeDisplayName(type) {
            switch (type) {
                case 'node': return 'ノード';
                case 'virtual_machine': return '仮想マシン';
                case 'network_device': return 'ネットワークデバイス';
                case 'kvm': return 'KVM';
                default: return '不明';
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
                    new bootstrap.Modal(document.getElementById('serverModal')).show(); // Initialize and show here
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
                    new bootstrap.Modal(document.getElementById('serverModal')).show(); // Initialize and show here
                    toggleFormFields(); // Show default fields for new server
                };
            }

            // Event listeners for extra import buttons
            document.querySelectorAll('.setup-btn').forEach(button => {
                button.onclick = (event) => {
                    const serverId = event.target.dataset.id;
                    editingServerId = serverId;
                    populateModalForEdit(serverId);
                    serverModal.show();
                };
            });

            document.querySelectorAll('.confirm-delete-btn').forEach(button => {
                button.onclick = async (event) => {
                    const serverId = event.target.dataset.id;
                    if (confirm(`このサーバーを削除しますか？`)) {
                        try {
                            const response = await fetch(`/api/servers/${serverId}`, { method: 'DELETE' });
                            if (response.ok) {
                                fetchAndRenderServers();
                            }
                        } catch (error) {
                            console.error('Error deleting server:', error);
                        }
                    }
                };
            });

            document.querySelectorAll('.cancel-delete-btn').forEach(button => {
                button.onclick = async (event) => {
                    const serverId = event.target.dataset.id;
                    try {
                        const response = await fetch(`/api/servers/${serverId}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ is_extra: false, is_deleted: false })
                        });
                        if (response.ok) {
                            fetchAndRenderServers();
                        }
                    } catch (error) {
                        console.error('Error keeping server:', error);
                    }
                };
            });
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
            urlGroup.style.display = 'none'; // This group will effectively be unused now
            usernameGroup.style.display = 'none';
            authMethodGroup.style.display = 'none';
            passwordGroup.style.display = 'none';
            sshKeySelectGroup.style.display = 'none';

            // Show relevant fields based on type
            // All new types (node, virtual_machine, kvm) and network_device will use host/SSH related fields
            if (['node', 'virtual_machine', 'network_device', 'kvm'].includes(type)) {
                hostGroup.style.display = 'block';
                portGroup.style.display = 'block';
                usernameGroup.style.display = 'block';
                authMethodGroup.style.display = 'block';
                // Further toggle based on auth method
                if (serverAuthMethodSelect.value === 'password') {
                    passwordGroup.style.display = 'block';
                } else {
                    sshKeySelectGroup.style.display = 'block';
                }
            }
            // No 'url' type anymore, so no 'else if (type === 'url')' block needed
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
                                <div class="form-check">
                                    <input class="form-check-input ssh-key-checkbox" type="checkbox" value="${key.id}" id="sshKeyCheck-${key.id}">
                                    <label class="form-check-label" for="sshKeyCheck-${key.id}">
                                        <strong>${key.name}</strong><br>
                                        <small>${key.path}</small>
                                    </label>
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

            // Event listener for individual checkboxes
            document.querySelectorAll('.ssh-key-checkbox').forEach(checkbox => {
                checkbox.addEventListener('change', updateBulkDeleteButtonState);
            });

            // Bulk delete button click listener
            bulkDeleteSshKeysBtn.addEventListener('click', async () => {
                const checkedCheckboxes = document.querySelectorAll('.ssh-key-checkbox:checked');
                const selectedKeyIds = Array.from(checkedCheckboxes).map(cb => cb.value);

                if (selectedKeyIds.length === 0) {
                    alert('削除するSSHキーを選択してください。');
                    return;
                }

                if (confirm(`${selectedKeyIds.length} 個のSSHキーを削除してもよろしいですか？`)) {
                    try {
                        const response = await fetch('/api/ssh_keys/bulk_delete', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ ids: selectedKeyIds })
                        });

                        if (response.ok) {
                            alert('選択されたSSHキーを削除しました。');
                            fetchAndRenderSshKeys();
                            populateSshKeySelect();
                        } else {
                            const errorData = await response.json();
                            alert(`SSHキーの一括削除に失敗しました: ${errorData.error || response.statusText}`);
                        }
                    } catch (error) {
                        console.error('Error during bulk delete:', error);
                        alert('SSHキーの一括削除中にエラーが発生しました。');
                    }
                }
            });

            // Initial update of button state when modal opens
            updateBulkDeleteButtonState();
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

        // --- Backup Management Logic ---
        const backupTabButton = document.getElementById('backup-tab');
        const backupFileList = document.getElementById('backup-file-list');
        const importForm = document.getElementById('import-form');
        const importFileInput = document.getElementById('import-file');
        const exportConfigBtn = document.getElementById('export-config-btn');

        // Function to fetch and render backup files
        async function fetchAndRenderBackups() {
            try {
                const response = await fetch('/api/backups');
                const backups = await response.json();
                backupFileList.innerHTML = ''; // Clear existing list
                if (backups.length === 0) {
                    backupFileList.innerHTML = '<p class="text-muted">バックアップファイルはありません。</p>';
                } else {
                    backups.forEach(backup => {
                        const backupItem = `
                            <div class="list-group-item d-flex justify-content-between align-items-center">
                                <div>
                                    <strong>${backup.name}</strong><br>
                                    <small>サイズ: ${(backup.size / 1024).toFixed(2)} KB | 更新日時: ${new Date(backup.last_modified).toLocaleString()}</small>
                                </div>
                                <div>
                                    <button class="btn btn-sm btn-info download-backup-btn" data-filename="${backup.name}">ダウンロード</button>
                                    <button class="btn btn-sm btn-danger delete-backup-btn" data-filename="${backup.name}">削除</button>
                                </div>
                            </div>
                        `;
                        backupFileList.insertAdjacentHTML('beforeend', backupItem);
                    });
                    attachBackupEventListeners();
                }
            } catch (error) {
                console.error('Error fetching backups:', error);
                alert('バックアップファイルの読み込みに失敗しました。');
            }
        }

        // Attach event listeners for backup buttons
        function attachBackupEventListeners() {
            document.querySelectorAll('.download-backup-btn').forEach(button => {
                button.onclick = (event) => {
                    const filename = event.target.dataset.filename;
                    window.location.href = `/api/backups/download/${filename}`;
                };
            });

            document.querySelectorAll('.delete-backup-btn').forEach(button => {
                button.onclick = async (event) => {
                    const filename = event.target.dataset.filename;
                    if (confirm(`バックアップファイル '${filename}' を削除してもよろしいですか？`)) {
                        try {
                            const response = await fetch(`/api/backups/delete/${filename}`, {
                                method: 'DELETE'
                            });
                            if (response.ok) {
                                fetchAndRenderBackups(); // Re-render list
                            } else {
                                const errorData = await response.json();
                                alert(`バックアップファイルの削除に失敗しました: ${errorData.error || response.statusText}`);
                            }
                        } catch (error) {
                            console.error('Error deleting backup:', error);
                            alert('バックアップファイルの削除中にエラーが発生しました。');
                        }
                    }
                };
            });
        }

        // Event listener for Backup tab click
        backupTabButton.addEventListener('shown.bs.tab', () => {
            fetchAndRenderBackups();
        });

        // Handle Import Form Submission
        importForm.addEventListener('submit', async function(event) {
            event.preventDefault();

            if (importFileInput.files.length === 0) {
                alert('インポートするファイルを選択してください。');
                return;
            }

            const file = importFileInput.files[0];
            const formData = new FormData();
            formData.append('file', file);

            try {
                const response = await fetch('/api/config/import', {
                    method: 'POST',
                    body: formData
                });

                if (response.ok) {
                    alert('設定が正常にインポートされました。変更を反映するにはページをリロードしてください。');
                    importFileInput.value = ''; // Clear file input
                    fetchAndRenderServers(); // Update server list after import
                } else {
                    const errorData = await response.json();
                    alert(`設定のインポートに失敗しました: ${errorData.error || response.statusText}`);
                }
            } catch (error) {
                console.error('Error importing config:', error);
                alert('設定のインポート中にエラーが発生しました。');
            }
        });

        // Handle Export Button Click
        exportConfigBtn.addEventListener('click', () => {
            window.location.href = '/api/config/export';
        });

        // --- Extra Import Logic ---
        const extraImportTab = document.getElementById('extra-import-tab');
        const extraImportForm = document.getElementById('extra-import-form');
        const extraImportUrlInput = document.getElementById('extra-import-url');

        // Extra Import Confirmation Modal elements
        const extraImportConfirmModal = new bootstrap.Modal(document.getElementById('extraImportConfirmModal'));
        const extraImportConfirmDeleteBtn = document.getElementById('extraImportConfirmDeleteBtn');
        const extraImportConfirmKeepBtn = document.getElementById('extraImportConfirmKeepBtn');
        const extraImportConfirmCancelBtn = document.getElementById('extraImportConfirmCancelBtn');

        function showExtraImportConfirmationModal() {
            extraImportConfirmModal.show();
        }

        async function sendExtraImportConfirmation(action) {
            try {
                const response = await fetch('/api/extra_import_url/confirm', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ action: action })
                });
                if (response.ok) {
                    alert('処理が完了しました。');
                    extraImportConfirmModal.hide();
                    fetchAndRenderServers(); // Re-render servers after action
                } else {
                    const errorData = await response.json();
                    alert(`処理に失敗しました: ${errorData.error || response.statusText}`);
                }
            } catch (error) {
                console.error('Error sending extra import confirmation:', error);
                alert('処理中にエラーが発生しました。');
            }
        }

        extraImportConfirmDeleteBtn.addEventListener('click', () => sendExtraImportConfirmation('delete_all'));
        extraImportConfirmKeepBtn.addEventListener('click', () => sendExtraImportConfirmation('keep_all'));
        extraImportConfirmCancelBtn.addEventListener('click', () => sendExtraImportConfirmation('cancel'));

        async function loadExtraImportUrl() {
            try {
                const response = await fetch('/api/extra_import_url');
                const data = await response.json();
                extraImportUrlInput.value = data.url || '';
            } catch (error) {
                console.error('Error loading extra import URL:', error);
            }
        }

        extraImportForm.addEventListener('submit', async function(event) {
            event.preventDefault();
            const newUrl = extraImportUrlInput.value;
            try {
                const response = await fetch('/api/extra_import_url', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ url: newUrl })
                });
                const data = await response.json();
                if (response.ok) {
                    if (data.confirmation_needed) {
                        showExtraImportConfirmationModal();
                    } else {
                        alert('URLを保存しました。');
                        // Reload servers to reflect immediate changes from import
                        fetchAndRenderServers();
                    }
                } else {
                    alert(`URLの保存に失敗しました: ${data.error || response.statusText}`);
                }
            } catch (error) {
                console.error('Error saving extra import URL:', error);
                alert('URLの保存中にエラーが発生しました。');
            }
        });

        extraImportTab.addEventListener('shown.bs.tab', () => {
            loadExtraImportUrl();
        });
    }

    // Event listener for config link click
    configLink.addEventListener('click', async function(event) {
        event.preventDefault();
        try {
            const response = await fetch('/config');
            const htmlContent = await response.text();
            configModalBody.innerHTML = htmlContent;
            // Initialize serverModal here after content is loaded
            const serverModal = new bootstrap.Modal(document.getElementById('serverModal'));

            // Re-initialize Bootstrap components within the newly loaded content
            const serversTabBtn = document.getElementById('servers-tab');
            const setupServerId = sessionStorage.getItem('setupServerId');

            if (serversTabBtn && setupServerId) {
                new bootstrap.Tab(serversTabBtn).show();
            }

            const configModal = new bootstrap.Modal(document.getElementById('configModal')); // Initialize configModal here
            configModal.show();
            initializeConfigPageLogic(serverModal); // Pass serverModal instance
        } catch (error) {
            console.error('Error loading config page:', error);
            alert('設定ページの読み込みに失敗しました。');
        }
    });

    // Initial attachment of event listeners for main page
    attachMainPageEventListeners();
});
