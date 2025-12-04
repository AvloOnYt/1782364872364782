// Connect to SocketIO
const socket = io();

// Store clients data
let clients = {};
let currentTab = 'overview';

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    loadInitialData();
    setupEventListeners();
    setupSocketListeners();
    setupTabListeners();
});

// Load initial data from REST API
async function loadInitialData() {
    try {
        // Load clients
        const clientsResponse = await fetch('/api/clients');
        clients = await clientsResponse.json();
        updateClientsList();
        updateTargetDropdown();
        updateClientTabs();

        // Load command history
        const historyResponse = await fetch('/api/history');
        const history = await historyResponse.json();
        history.forEach(entry => addHistoryEntry(entry));
    } catch (error) {
        console.error('Error loading initial data:', error);
    }
}

// Setup event listeners
function setupEventListeners() {
    const sendBtn = document.getElementById('send-command-btn');
    const commandInput = document.getElementById('command-input');

    sendBtn.addEventListener('click', sendCommand);
    
    // Allow Enter to send command (Ctrl+Enter for new line)
    commandInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.ctrlKey && !e.shiftKey) {
            e.preventDefault();
            sendCommand();
        }
    });
}

// Setup SocketIO listeners
function setupSocketListeners() {
    socket.on('connect', () => {
        console.log('Connected to server');
        socket.emit('get_clients');
    });

    socket.on('client_update', (updatedClients) => {
        clients = updatedClients;
        updateClientsList();
        updateTargetDropdown();
        updateClientTabs();
    });

    socket.on('command_response', (response) => {
        addHistoryEntry(response);
        // Also add to individual client tab if exists
        addHistoryToClientTab(response);
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from server');
    });
}

// Setup tab listeners
function setupTabListeners() {
    document.getElementById('tabs-nav').addEventListener('click', (e) => {
        if (e.target.classList.contains('tab-button')) {
            const tabName = e.target.dataset.tab;
            switchTab(tabName);
        }
    });
}

// Switch between tabs
function switchTab(tabName) {
    currentTab = tabName;
    
    // Update button states
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.tab === tabName) {
            btn.classList.add('active');
        }
    });
    
    // Update content visibility
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
        if (content.dataset.tabContent === tabName) {
            content.classList.add('active');
        }
    });
}

// Update client tabs
function updateClientTabs() {
    const tabsNav = document.getElementById('tabs-nav');
    const tabsContent = document.getElementById('tabs-content');
    
    // Get existing client tabs (skip overview)
    const existingTabs = Array.from(tabsNav.querySelectorAll('.tab-button'))
        .filter(btn => btn.dataset.tab !== 'overview')
        .map(btn => btn.dataset.tab);
    
    const currentClients = Object.keys(clients);
    
    // Remove tabs for disconnected clients
    existingTabs.forEach(tabId => {
        if (!currentClients.includes(tabId)) {
            // Remove tab button
            const tabBtn = tabsNav.querySelector(`[data-tab="${tabId}"]`);
            if (tabBtn) tabBtn.remove();
            
            // Remove tab content
            const tabContent = tabsContent.querySelector(`[data-tab-content="${tabId}"]`);
            if (tabContent) tabContent.remove();
        }
    });
    
    // Add tabs for new clients
    currentClients.forEach(clientId => {
        if (!existingTabs.includes(clientId)) {
            createClientTab(clientId);
        } else {
            // Update existing tab
            updateClientTabContent(clientId);
        }
    });
}

// Create a new client tab
function createClientTab(clientId) {
    const client = clients[clientId];
    const tabsNav = document.getElementById('tabs-nav');
    const tabsContent = document.getElementById('tabs-content');
    
    // Create tab button
    const tabButton = document.createElement('button');
    tabButton.className = 'tab-button px-6 py-3 font-semibold text-gray-300 hover:bg-gray-700';
    tabButton.dataset.tab = clientId;
    
    const shortId = clientId.substring(0, 8).toUpperCase();
    const statusDot = client.online 
        ? '<span class="inline-block w-2 h-2 bg-green-500 rounded-full mr-2"></span>'
        : '<span class="inline-block w-2 h-2 bg-gray-500 rounded-full mr-2"></span>';
    
    tabButton.innerHTML = `${statusDot}${shortId}`;
    tabsNav.appendChild(tabButton);
    
    // Create tab content
    const tabContent = document.createElement('div');
    tabContent.className = 'tab-content';
    tabContent.dataset.tabContent = clientId;
    tabContent.innerHTML = `
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <!-- Client Info Panel -->
            <div class="bg-gray-800 rounded-lg shadow-xl p-6">
                <h2 class="text-xl font-bold text-white mb-4 border-b border-gray-700 pb-2">CLIENT INFO</h2>
                <div class="space-y-3 text-sm">
                    <div>
                        <span class="text-gray-400">Client ID:</span>
                        <span class="text-white font-mono block mt-1">${clientId}</span>
                    </div>
                    <div>
                        <span class="text-gray-400">Hostname:</span>
                        <span class="text-white block mt-1">${client.hostname}</span>
                    </div>
                    <div>
                        <span class="text-gray-400">IP Address:</span>
                        <span class="text-white block mt-1">${client.ip}</span>
                    </div>
                    <div>
                        <span class="text-gray-400">Operating System:</span>
                        <span class="text-white block mt-1">${client.os}</span>
                    </div>
                    <div>
                        <span class="text-gray-400">Status:</span>
                        <span class="text-white block mt-1">
                            ${statusDot}
                            <span class="client-status-${clientId}">${client.online ? 'Online' : 'Offline'}</span>
                        </span>
                    </div>
                    <div>
                        <span class="text-gray-400">Last Seen:</span>
                        <span class="text-white block mt-1">${new Date(client.last_seen).toLocaleString()}</span>
                    </div>
                    <div>
                        <span class="text-gray-400">Queued Commands:</span>
                        <span class="text-white block mt-1 client-queued-${clientId}">${client.queued_commands ? client.queued_commands.length : 0}</span>
                    </div>
                    <div class="border-t border-gray-700 pt-3">
                        <div class="flex items-center justify-between">
                            <span class="text-gray-400">Live Screen Preview</span>
                            <button 
                                id="screen-toggle-${clientId}"
                                onclick="toggleScreenStreamUI('${clientId}')"
                                class="relative inline-flex items-center h-6 rounded-full w-11 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 bg-gray-700"
                                data-enabled="false"
                            >
                                <span class="inline-block w-4 h-4 transform transition-transform bg-white rounded-full translate-x-1"></span>
                            </button>
                        </div>
                    </div>
                </div>
                
                <!-- Live Screen Preview -->
                <div id="screen-preview-${clientId}" class="mt-4 hidden">
                    <div class="flex items-center justify-between mb-2">
                        <div class="text-gray-400 text-xs">Screen Preview (Real-time ~60 FPS)</div>
                        <button 
                            onclick="enlargeScreenPreview('${clientId}')"
                            class="text-gray-400 hover:text-white transition-colors p-1 rounded hover:bg-gray-700"
                            title="Enlarge preview"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                            </svg>
                        </button>
                    </div>
                    <div class="bg-gray-900 rounded overflow-hidden flex items-center justify-center cursor-pointer" style="min-height: 200px;" onclick="enlargeScreenPreview('${clientId}')">
                        <img 
                            id="screen-image-${clientId}" 
                            alt="Screen preview"
                            class="w-full h-auto hidden"
                            style="max-height: 400px; object-fit: contain;"
                        >
                        <div id="screen-loading-${clientId}" class="text-gray-500 text-center p-8">
                            <div class="text-2xl mb-2">📡</div>
                            <div>Waiting for screen data...</div>
                        </div>
                    </div>
                    <div id="screen-status-${clientId}" class="text-gray-500 text-xs mt-2 text-center">
                        Stream starting...
                    </div>
                </div>
            </div>

            <!-- Command Center for this client -->
            <div class="lg:col-span-2 space-y-6">
                <!-- Quick Commands Library -->
                <div class="bg-gray-800 rounded-lg shadow-xl p-6">
                    <h2 class="text-xl font-bold text-white mb-4 border-b border-gray-700 pb-2">QUICK COMMANDS</h2>
                    
                    <!-- Command Category Tabs -->
                    <div class="flex flex-wrap gap-2 mb-4 border-b border-gray-700" id="cmd-categories-${clientId}">
                        <!-- Categories will be populated here -->
                    </div>
                    
                    <!-- Command Buttons -->
                    <div id="cmd-buttons-${clientId}" class="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-64 overflow-y-auto">
                        <!-- Command buttons will be populated here -->
                    </div>
                </div>

                <!-- Manual Command Input -->
                <div class="bg-gray-800 rounded-lg shadow-xl p-6">
                    <h2 class="text-xl font-bold text-white mb-4 border-b border-gray-700 pb-2">CUSTOM COMMAND</h2>
                    
                    <div class="mb-4">
                        <label for="command-input-${clientId}" class="block text-gray-300 mb-2">Command:</label>
                        <textarea 
                            id="command-input-${clientId}" 
                            rows="3"
                            class="w-full px-4 py-2 bg-gray-700 text-white rounded focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                            placeholder="Enter custom command for this client..."
                        ></textarea>
                    </div>

                    <button 
                        onclick="sendCommandToClient('${clientId}')"
                        class="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded transition duration-200"
                    >
                        Send to ${shortId}
                    </button>
                </div>

                <!-- Command History for this client -->
                <div class="bg-gray-800 rounded-lg shadow-xl p-6">
                    <div class="flex justify-between items-center mb-4 border-b border-gray-700 pb-2">
                        <h2 class="text-xl font-bold text-white">COMMAND HISTORY</h2>
                        <button 
                            onclick="clearClientHistory('${clientId}')"
                            class="bg-red-600 hover:bg-red-700 text-white text-sm font-semibold py-1 px-3 rounded transition duration-200"
                            title="Clear all command history for this client"
                        >
                            Clear History
                        </button>
                    </div>
                    <div id="command-history-${clientId}" class="space-y-2 max-h-96 overflow-y-auto font-mono text-sm">
                        <p class="text-gray-500 text-center">No commands yet</p>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    tabsContent.appendChild(tabContent);
    
    // Initialize command library for this client
    initializeCommandLibrary(clientId);
    
    // Setup image error handler
    setupImageErrorHandler(clientId);
}

// Initialize command library for a client
function initializeCommandLibrary(clientId) {
    const categories = getCommandCategories();
    const categoriesDiv = document.getElementById(`cmd-categories-${clientId}`);
    const buttonsDiv = document.getElementById(`cmd-buttons-${clientId}`);
    
    if (!categoriesDiv || !buttonsDiv) return;
    
    // Create category tabs
    categories.forEach((category, index) => {
        const categoryTab = document.createElement('button');
        categoryTab.className = `cmd-category-tab px-4 py-2 text-sm text-gray-300 ${index === 0 ? 'active' : ''}`;
        categoryTab.textContent = category;
        categoryTab.onclick = () => switchCommandCategory(clientId, category);
        categoriesDiv.appendChild(categoryTab);
    });
    
    // Show first category by default
    if (categories.length > 0) {
        showCommandCategory(clientId, categories[0]);
    }
}

// Switch command category
function switchCommandCategory(clientId, category) {
    const categoriesDiv = document.getElementById(`cmd-categories-${clientId}`);
    if (!categoriesDiv) return;
    
    // Update active state
    Array.from(categoriesDiv.children).forEach(tab => {
        tab.classList.remove('active');
        if (tab.textContent === category) {
            tab.classList.add('active');
        }
    });
    
    // Show commands for this category
    showCommandCategory(clientId, category);
}

// Show commands for a category
function showCommandCategory(clientId, category) {
    const buttonsDiv = document.getElementById(`cmd-buttons-${clientId}`);
    if (!buttonsDiv) return;
    
    const commands = getCommandsByCategory(category);
    buttonsDiv.innerHTML = '';
    
    commands.forEach(cmd => {
        const button = document.createElement('button');
        button.className = 'cmd-button bg-gray-700 hover:bg-gray-600 text-white p-3 rounded text-left';
        button.innerHTML = `
            <div class="font-semibold text-sm">${cmd.name}</div>
            <div class="text-xs text-gray-400 mt-1">${cmd.description}</div>
        `;
        button.onclick = () => executeQuickCommand(clientId, cmd.command, cmd.name);
        buttonsDiv.appendChild(button);
    });
}

// Execute a quick command
function executeQuickCommand(clientId, command, commandName) {
    console.log(`Executing quick command "${commandName}" on ${clientId}: ${command}`);
    
    socket.emit('send_command', {
        target: clientId,
        command: command
    });
    
    // Optional: Show notification
    const notification = document.createElement('div');
    notification.className = 'fixed top-4 right-4 bg-blue-600 text-white px-6 py-3 rounded shadow-lg z-50';
    notification.textContent = `Executing: ${commandName}`;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 2000);
}

// Update client tab content (for status changes)
function updateClientTabContent(clientId) {
    const client = clients[clientId];
    const tabButton = document.querySelector(`[data-tab="${clientId}"]`);
    
    if (tabButton) {
        const shortId = clientId.substring(0, 8).toUpperCase();
        const statusDot = client.online 
            ? '<span class="inline-block w-2 h-2 bg-green-500 rounded-full mr-2"></span>'
            : '<span class="inline-block w-2 h-2 bg-gray-500 rounded-full mr-2"></span>';
        
        tabButton.innerHTML = `${statusDot}${shortId}`;
    }
    
    // Update status text
    const statusSpan = document.querySelector(`.client-status-${clientId}`);
    if (statusSpan) {
        statusSpan.textContent = client.online ? 'Online' : 'Offline';
    }
    
    // Update queued count
    const queuedSpan = document.querySelector(`.client-queued-${clientId}`);
    if (queuedSpan) {
        queuedSpan.textContent = client.queued_commands ? client.queued_commands.length : 0;
    }
}

// Send command to specific client from their tab
function sendCommandToClient(clientId) {
    const commandInput = document.getElementById(`command-input-${clientId}`);
    const command = commandInput.value.trim();
    
    if (!command) {
        alert('Please enter a command');
        return;
    }
    
    socket.emit('send_command', {
        target: clientId,
        command: command
    });
    
    // Clear input
    commandInput.value = '';
}

// Update clients list UI (Overview tab)
function updateClientsList() {
    const clientsList = document.getElementById('clients-list');
    clientsList.innerHTML = '';

    const clientIds = Object.keys(clients);
    
    if (clientIds.length === 0) {
        clientsList.innerHTML = '<p class="text-gray-500 text-center">No clients connected</p>';
        return;
    }

    clientIds.forEach(clientId => {
        const client = clients[clientId];
        const queuedCount = client.queued_commands ? client.queued_commands.length : 0;
        
        const clientDiv = document.createElement('div');
        clientDiv.className = 'bg-gray-700 p-3 rounded cursor-pointer hover:bg-gray-600 transition';
        clientDiv.onclick = () => switchTab(clientId);
        
        const statusDot = client.online 
            ? '<span class="inline-block w-3 h-3 bg-green-500 rounded-full mr-2"></span>'
            : '<span class="inline-block w-3 h-3 bg-gray-500 rounded-full mr-2"></span>';
        
        const statusText = client.online ? 'Online' : 'Offline';
        const queuedText = queuedCount > 0 ? ` (${queuedCount} queued)` : '';
        
        clientDiv.innerHTML = `
            <div class="flex items-start">
                ${statusDot}
                <div class="flex-1">
                    <div class="text-white font-semibold text-sm">${clientId.substring(0, 8).toUpperCase()}</div>
                    <div class="text-gray-400 text-xs">${client.hostname}</div>
                    <div class="text-gray-500 text-xs mt-1">${statusText}${queuedText}</div>
                    <div class="text-gray-600 text-xs">${client.os}</div>
                </div>
            </div>
        `;
        
        clientsList.appendChild(clientDiv);
    });
}

// Update target dropdown (Overview tab)
function updateTargetDropdown() {
    const targetSelect = document.getElementById('target-select');
    const currentValue = targetSelect.value;
    
    // Clear existing options except "All Clients"
    targetSelect.innerHTML = '<option value="all">All Clients</option>';
    
    // Add client options
    Object.keys(clients).forEach(clientId => {
        const client = clients[clientId];
        const option = document.createElement('option');
        option.value = clientId;
        option.textContent = `${clientId.substring(0, 8).toUpperCase()} - ${client.hostname}`;
        targetSelect.appendChild(option);
    });
    
    // Restore previous selection if still valid
    if (currentValue !== 'all' && clients[currentValue]) {
        targetSelect.value = currentValue;
    }
}

// Send command (from Overview tab)
function sendCommand() {
    const target = document.getElementById('target-select').value;
    const command = document.getElementById('command-input').value.trim();
    
    if (!command) {
        alert('Please enter a command');
        return;
    }
    
    socket.emit('send_command', {
        target: target,
        command: command
    });
    
    // Clear input
    document.getElementById('command-input').value = '';
}

// Add entry to command history (Overview tab)
function addHistoryEntry(entry) {
    const historyDiv = document.getElementById('command-history');
    if (!historyDiv) return;
    
    // Check if this is an update to an existing entry
    const existingEntry = historyDiv.querySelector(`[data-command-id="${entry.id}"]`);
    
    const timestamp = new Date(entry.timestamp).toLocaleTimeString();
    const clientId = entry.client_id ? entry.client_id.substring(0, 8).toUpperCase() : 'UNKNOWN';
    
    let statusIcon = '';
    let statusClass = '';
    let outputText = entry.output || '';
    
    switch (entry.status) {
        case 'success':
            statusIcon = '✓';
            statusClass = 'text-green-400';
            break;
        case 'failed':
            statusIcon = '✗';
            statusClass = 'text-red-400';
            break;
        case 'queued':
            statusIcon = '⏳';
            statusClass = 'text-yellow-400';
            break;
        case 'pending':
            statusIcon = '⏳';
            statusClass = 'text-blue-400';
            outputText = 'Executing...';
            break;
        default:
            statusIcon = '?';
            statusClass = 'text-gray-400';
    }
    
    const commandText = entry.command || '(response)';
    
    const entryHTML = `
        <div class="text-gray-400 text-xs mb-1">[${timestamp}] ${clientId}</div>
        ${entry.command ? `<div class="text-white mb-1">&gt; ${commandText}</div>` : ''}
        <div class="${statusClass}">
            ${statusIcon} ${entry.status.charAt(0).toUpperCase() + entry.status.slice(1)}: 
            <span class="text-gray-300">${outputText}</span>
        </div>
    `;
    
    if (existingEntry) {
        // Update existing entry
        existingEntry.innerHTML = entryHTML;
    } else {
        // Create new entry
        const entryDiv = document.createElement('div');
        entryDiv.className = 'bg-gray-700 p-3 rounded';
        entryDiv.setAttribute('data-command-id', entry.id);
        entryDiv.innerHTML = entryHTML;
        historyDiv.insertBefore(entryDiv, historyDiv.firstChild);
    }
    
    // Limit history to 100 entries
    while (historyDiv.children.length > 100) {
        historyDiv.removeChild(historyDiv.lastChild);
    }
}

// Add entry to individual client tab history
function addHistoryToClientTab(entry) {
    if (!entry.client_id) return;
    
    const clientHistoryDiv = document.getElementById(`command-history-${entry.client_id}`);
    if (!clientHistoryDiv) return;
    
    // Remove "no commands" message if present
    const noCommandsMsg = clientHistoryDiv.querySelector('.text-gray-500');
    if (noCommandsMsg) {
        noCommandsMsg.remove();
    }
    
    // Check if this is an update to an existing entry
    const existingEntry = clientHistoryDiv.querySelector(`[data-command-id="${entry.id}"]`);
    
    const timestamp = new Date(entry.timestamp).toLocaleTimeString();
    
    let statusIcon = '';
    let statusClass = '';
    let outputText = entry.output || '';
    
    switch (entry.status) {
        case 'success':
            statusIcon = '✓';
            statusClass = 'text-green-400';
            break;
        case 'failed':
            statusIcon = '✗';
            statusClass = 'text-red-400';
            break;
        case 'queued':
            statusIcon = '⏳';
            statusClass = 'text-yellow-400';
            break;
        case 'pending':
            statusIcon = '⏳';
            statusClass = 'text-blue-400';
            outputText = 'Executing...';
            break;
        default:
            statusIcon = '?';
            statusClass = 'text-gray-400';
    }
    
    const commandText = entry.command || '(response)';
    
    const entryHTML = `
        <div class="text-gray-400 text-xs mb-1">[${timestamp}]</div>
        ${entry.command ? `<div class="text-white mb-1">&gt; ${commandText}</div>` : ''}
        <div class="${statusClass}">
            ${statusIcon} ${entry.status.charAt(0).toUpperCase() + entry.status.slice(1)}: 
            <span class="text-gray-300">${outputText}</span>
        </div>
    `;
    
    if (existingEntry) {
        // Update existing entry
        existingEntry.innerHTML = entryHTML;
    } else {
        // Create new entry
        const entryDiv = document.createElement('div');
        entryDiv.className = 'bg-gray-700 p-3 rounded';
        entryDiv.setAttribute('data-command-id', entry.id);
        entryDiv.innerHTML = entryHTML;
        clientHistoryDiv.insertBefore(entryDiv, clientHistoryDiv.firstChild);
    }
    
    // Limit history to 50 entries per client
    while (clientHistoryDiv.children.length > 50) {
        clientHistoryDiv.removeChild(clientHistoryDiv.lastChild);
    }
}

// Clear command history for a specific client
function clearClientHistory(clientId) {
    const clientHistoryDiv = document.getElementById(`command-history-${clientId}`);
    if (!clientHistoryDiv) return;
    
    // Confirm before clearing
    if (!confirm(`Clear all command history for client ${clientId.substring(0, 8).toUpperCase()}?`)) {
        return;
    }
    
    // Clear the history
    clientHistoryDiv.innerHTML = '<p class="text-gray-500 text-center">No commands yet</p>';
    
    // Show notification
    const notification = document.createElement('div');
    notification.className = 'fixed top-4 right-4 bg-green-600 text-white px-6 py-3 rounded shadow-lg z-50';
    notification.textContent = 'History cleared';
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 2000);
}

// Toggle screen streaming for a client
function toggleScreenStream(clientId, enabled) {
    console.log(`[DEBUG] ${enabled ? 'Enabling' : 'Disabling'} screen stream for ${clientId}`);
    
    // Reset status when enabling
    if (enabled) {
        const statusElement = document.getElementById(`screen-status-${clientId}`);
        const loadingElement = document.getElementById(`screen-loading-${clientId}`);
        const imageElement = document.getElementById(`screen-image-${clientId}`);
        
        if (statusElement) {
            statusElement.textContent = 'Stream starting...';
            statusElement.className = 'text-gray-500 text-xs mt-2 text-center';
        }
        if (loadingElement) {
            loadingElement.classList.remove('hidden');
        }
        if (imageElement) {
            imageElement.classList.add('hidden');
        }
    }
    
    socket.emit('toggle_screen_stream', {
        client_id: clientId,
        enabled: enabled
    });
    
    console.log(`[DEBUG] Sent toggle_screen_stream event to server`);
    
    const previewDiv = document.getElementById(`screen-preview-${clientId}`);
    if (previewDiv) {
        if (enabled) {
            previewDiv.classList.remove('hidden');
        } else {
            previewDiv.classList.add('hidden');
        }
    }
    
    // Show notification
    const notification = document.createElement('div');
    notification.className = 'fixed top-4 right-4 bg-blue-600 text-white px-6 py-3 rounded shadow-lg z-50';
    notification.textContent = `Screen streaming ${enabled ? 'enabled' : 'disabled'}`;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 2000);
}

// Handle incoming screen frames
socket.on('screen_frame', (data) => {
    const clientId = data.client_id;
    const imageData = data.image;
    const timestamp = data.timestamp;
    
    console.log(`[DEBUG] Received screen frame for ${clientId}, data length: ${imageData ? imageData.length : 0}`);
    
    const imageElement = document.getElementById(`screen-image-${clientId}`);
    const statusElement = document.getElementById(`screen-status-${clientId}`);
    const loadingElement = document.getElementById(`screen-loading-${clientId}`);
    
    if (imageElement && imageData) {
        // Set image source
        imageElement.src = `data:image/jpeg;base64,${imageData}`;
        
        // Show image, hide loading
        imageElement.classList.remove('hidden');
        if (loadingElement) {
            loadingElement.classList.add('hidden');
        }
        
        // Update timestamp
        if (statusElement) {
            const time = new Date(timestamp).toLocaleTimeString();
            const statusText = `Last updated: ${time}`;
            statusElement.textContent = statusText;
            
            // Update modal if open
            updateModalIfOpen(clientId, imageElement.src, statusText);
        }
    } else {
        console.error(`[ERROR] No image data received for ${clientId}`);
        if (statusElement) {
            statusElement.textContent = 'Error: No image data received';
            statusElement.className = 'text-red-500 text-xs mt-2 text-center';
        }
    }
});

// Add error handler for image loading
function setupImageErrorHandler(clientId) {
    const imageElement = document.getElementById(`screen-image-${clientId}`);
    if (imageElement) {
        imageElement.onerror = function() {
            console.error(`[ERROR] Failed to load image for ${clientId}`);
            const statusElement = document.getElementById(`screen-status-${clientId}`);
            if (statusElement) {
                statusElement.textContent = 'Error: Failed to load image';
                statusElement.className = 'text-red-500 text-xs mt-2 text-center';
            }
        };
    }
}

// Toggle screen stream UI (for switch button)
function toggleScreenStreamUI(clientId) {
    const toggleBtn = document.getElementById(`screen-toggle-${clientId}`);
    const isEnabled = toggleBtn.getAttribute('data-enabled') === 'true';
    const newState = !isEnabled;
    
    // Update button state
    toggleBtn.setAttribute('data-enabled', newState);
    
    // Update button appearance
    if (newState) {
        toggleBtn.classList.remove('bg-gray-700');
        toggleBtn.classList.add('bg-blue-600');
        toggleBtn.querySelector('span').classList.remove('translate-x-1');
        toggleBtn.querySelector('span').classList.add('translate-x-6');
    } else {
        toggleBtn.classList.remove('bg-blue-600');
        toggleBtn.classList.add('bg-gray-700');
        toggleBtn.querySelector('span').classList.remove('translate-x-6');
        toggleBtn.querySelector('span').classList.add('translate-x-1');
    }
    
    // Call the original toggle function
    toggleScreenStream(clientId, newState);
}

// Enlarge screen preview in modal
let currentModalClientId = null;

function enlargeScreenPreview(clientId) {
    const imageElement = document.getElementById(`screen-image-${clientId}`);
    const statusElement = document.getElementById(`screen-status-${clientId}`);
    const modal = document.getElementById('screen-modal');
    const modalImage = document.getElementById('modal-screen-image');
    const modalClientName = document.getElementById('modal-client-name');
    const modalStatus = document.getElementById('modal-screen-status');
    
    if (!imageElement || !modal) return;
    
    // Get client info
    const clients = Array.from(document.querySelectorAll('[data-client-id]'));
    const clientDiv = clients.find(c => c.getAttribute('data-client-id') === clientId);
    const clientName = clientDiv ? clientDiv.textContent.trim() : 'Unknown Client';
    
    // Set modal content
    currentModalClientId = clientId;
    modalClientName.textContent = `${clientName} - Screen Preview`;
    modalStatus.textContent = statusElement ? statusElement.textContent : 'Loading...';
    modalImage.src = imageElement.src || '';
    
    // Show modal
    modal.classList.remove('hidden');
    
    // Prevent body scroll
    document.body.style.overflow = 'hidden';
}

function closeScreenModal() {
    const modal = document.getElementById('screen-modal');
    modal.classList.add('hidden');
    currentModalClientId = null;
    
    // Restore body scroll
    document.body.style.overflow = '';
}

// Close modal on ESC key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeScreenModal();
    }
});

// Update modal image when new frame arrives (if modal is open)
function updateModalIfOpen(clientId, imageSrc, statusText) {
    if (currentModalClientId === clientId) {
        const modalImage = document.getElementById('modal-screen-image');
        const modalStatus = document.getElementById('modal-screen-status');
        
        if (modalImage && imageSrc) {
            modalImage.src = imageSrc;
        }
        if (modalStatus && statusText) {
            modalStatus.textContent = statusText;
        }
    }
}
