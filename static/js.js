// Modified socket.io implementation with responsive design support
const socket = io();

// DOM Elements
const chat = document.getElementById('chat');
const input = document.getElementById('input');
const addressInput = document.getElementById('address-input');
const contextInput = document.getElementById('context-input');
const tempInput = document.getElementById('temperature-input');
const roleList = document.getElementById('role-list');
const settingsWindow = document.getElementById('settings-window');
const conversationArea = document.querySelector('.conversation-area');
const chatListContainer = document.querySelector('.chat-list-container'); // New container for chat list

// Model selector
const modelSelect = document.getElementById('model-select');

// Buttons
const addChatButton = document.getElementById('add-chat');
const sendButton = document.getElementById('send');
const stopButton = document.getElementById('stop-button');
const openConversationsButton = document.getElementById('open-conversations');
const openSettingsButton = document.getElementById('open-settings');
const clearContextButton = document.getElementById('clear-context');
const saveChatButton = document.getElementById('save-chat-button');
const loadChatButton = document.getElementById('load-chat-button');

// Performance metrics elements
const totalTokensElement = document.getElementById('total-tokens');
const tokensPerSecondElement = document.getElementById('tokens-per-second');
const generationTimeElement = document.getElementById('generation-time');

// Chat management variables
const MAX_CHATS = 12;
const chatMessages = {};
const chatTitles = {};
const chatSettings = {};
let chatCounter = 0;
let selectedRole = null;
let currentStreamingMessage = null;
let currentStreamingChatId = null;
let isNewMessage = true;
let generationStopped = false;


// Initialize the app
    // Create initial chat
    createNewChat();
    // Set up responsive behavior
    adjustUIForScreenSize();

// Set up all event listeners
    // Button events
    sendButton.addEventListener('click', handleSendMessage);
    input.addEventListener('keypress', e => { if (e.key === 'Enter') handleSendMessage(); });
    stopButton.addEventListener('click', handleStopGeneration);
    addChatButton.addEventListener('click', () => createNewChat());
    clearContextButton.addEventListener('click', handleClearContext);
    openConversationsButton.addEventListener('click', toggleConversationArea);
    openSettingsButton.addEventListener('click', toggleSettingsWindow);
    saveChatButton.addEventListener('click', saveCurrentChat);
    loadChatButton.addEventListener('click', handleLoadChat);
    
    // Settings change events
    modelSelect.addEventListener('change', handleModelChange);
    addressInput.addEventListener('change', handleAddressChange);
    contextInput.addEventListener('change', handleContextChange);
    tempInput.addEventListener('change', handleTemperatureChange);
    // Request available models and roles
    socket.emit('get_available_models');
    socket.emit('get_roles');
    
    // Auto-close sidebar events
    setupAutoCloseSidebars();
    
    // Window resize event
    window.addEventListener('resize', adjustUIForScreenSize);


// Toggle conversation area visibility
function toggleConversationArea() {
    if (window.getComputedStyle(conversationArea).display === 'none') {
        // Close settings window if open on mobile
        if (window.innerWidth <= 768) {
            settingsWindow.style.display = 'none';
        }
        
        // Show conversation area
        conversationArea.style.display = 'flex';
        
        // Clear any existing auto-close timeouts
        clearAutoCloseTimeouts();
    } else {
        conversationArea.style.display = 'none';
    }
}

// Toggle settings window visibility
function toggleSettingsWindow() {
    if (window.getComputedStyle(settingsWindow).display === 'none') {
        // Close conversation area if open on mobile
        if (window.innerWidth <= 768) {
            conversationArea.style.display = 'none';
        }
        
        // Show settings window
        settingsWindow.style.display = 'block';
        
        // Clear any existing auto-close timeouts
        clearAutoCloseTimeouts();
    } else {
        settingsWindow.style.display = 'none';
    }
}

// Adjust UI based on screen size
function adjustUIForScreenSize() {
    const windowWidth = window.innerWidth;
    
    // Adjust font sizes and layouts for different screen sizes
    if (windowWidth <= 480) {
        // Extra small screens
        document.documentElement.style.setProperty('--font-size-base', '14px');
        document.documentElement.style.setProperty('--spacing-md', '8px');
        
        // Ensure only one panel is visible on very small screens
        if (window.getComputedStyle(conversationArea).display !== 'none') {
            settingsWindow.style.display = 'none';
        }
    } else if (windowWidth <= 768) {
        // Small screens
        document.documentElement.style.setProperty('--font-size-base', '16px');
        document.documentElement.style.setProperty('--spacing-md', '12px');
    } else {
        // Larger screens
        document.documentElement.style.setProperty('--font-size-base', '18px');
        document.documentElement.style.setProperty('--spacing-md', '16px');
    }
    
    // Adjust chat header and message containers
    adjustChatHeader();
    
    // Make sure buttons are properly sized
    adjustButtonSizes();
}

// Adjust chat header based on available space
function adjustChatHeader() {
    const header = document.querySelector('.chat-header');
    const title = document.querySelector('.chat-header-title');
    if (!header || !title) return;
    
    const availableWidth = header.offsetWidth - 100; // Account for buttons
    
    // Adjust title size if needed
    if (availableWidth < 300) {
        title.style.fontSize = 'clamp(1rem, 4vw, 1.5rem)';
    } else {
        title.style.fontSize = '';  // Reset to CSS default
    }
}

// Adjust button sizes based on screen width
function adjustButtonSizes() {
    const windowWidth = window.innerWidth;
    
    if (windowWidth <= 480) {
        // Smaller buttons on small screens
        sendButton.style.width = '40px';
        sendButton.style.height = '40px';
    } else {
        // Default sizes on larger screens
        sendButton.style.width = '';
        sendButton.style.height = '';
    }
}

// Handle sending a message
function handleSendMessage() {
    // Reset performance metrics
    totalTokensElement.textContent = '0';
    tokensPerSecondElement.textContent = '0';
    generationTimeElement.textContent = '0';

    const message = input.value.trim();
    if (!message) return;
    
    // Show stop button and reset state
    sendButton.style.display = 'none';
    stopButton.style.display = 'block';
    generationStopped = false;
    isNewMessage = true;

    const currentChatId = window.currentChatId || 1;
    const chatConfig = chatSettings[currentChatId] || {};
    
    // Send message to server
    socket.emit('send_message', { 
        message, 
        model: chatConfig.model || modelSelect.value, 
        address: chatConfig.address || addressInput.value.trim(),
        context: chatConfig.context || contextInput.value.trim(),
        temperature: chatConfig.temperature || tempInput.value.trim(),
        role: chatConfig.role || selectedRole,
        chatId: currentChatId 
    });
    
    // Clear input field
    input.value = '';
}

// Handle stopping message generation
function handleStopGeneration() {
    const currentChatId = window.currentChatId || 1;
    generationStopped = true;

    // Tell server to stop generation
    socket.emit('generation-stopped', {
        chatId: currentChatId
    });
    
    stopButton.style.display = 'none';
    sendButton.style.display = 'block';


    
}

// Handle clearing context
function handleClearContext() {
    const currentChatId = window.currentChatId || 1;
    socket.emit('clear-context', {
        chatId: currentChatId
    });
    
    // Provide feedback
    appendMessage('Context has been cleared!', 'system', currentChatId);
}

// Handle model change
function handleModelChange() {
    const currentChatId = window.currentChatId || 1;
    const selectedModel = modelSelect.options[modelSelect.selectedIndex].textContent;
    
    // Save model choice for this chat
    if (chatSettings[currentChatId]) {
        chatSettings[currentChatId].model = modelSelect.value;
    }
    
    // Inform server about model change
    socket.emit('change_model', { 
        model: modelSelect.value,
        address: addressInput.value.trim(),
        chatId: currentChatId
    });
    
    // Update chat title
    updateChatTitle(currentChatId);
    
    // Update chat list element
    updateChatListUI(currentChatId);
}

// Handle address change
function handleAddressChange() {
    const currentChatId = window.currentChatId || 1;
    const address = addressInput.value.trim();
    
    if (chatSettings[currentChatId]) {
        chatSettings[currentChatId].address = address;
    }
    
    if (address) {
        socket.emit('change_address', { 
            address: address,
            model: modelSelect.value,
            chatId: currentChatId
        });
    }
}

// Handle context length change
function handleContextChange() {
    const currentChatId = window.currentChatId || 1;
    const context = contextInput.value.trim();
    
    if (chatSettings[currentChatId]) {
        chatSettings[currentChatId].context = context;
    }
    
    if (context) {
        socket.emit('change_context', { 
            context_lenght: context,
            chatId: currentChatId
        });
    }
}

// Handle temperature change
function handleTemperatureChange() {
    const currentChatId = window.currentChatId || 1;
    const temp = tempInput.value.trim();
    
    if (chatSettings[currentChatId]) {
        chatSettings[currentChatId].temperature = temp;
    }
    
    if (temp) {
        socket.emit('change_temp', { 
            temp: temp,
            chatId: currentChatId
        });
    }
}

// Create a new chat
function createNewChat() {
    // Check if we've reached the maximum number of chats
    if (Object.keys(chatMessages).length >= MAX_CHATS) {
        alert(`You've reached the maximum limit of ${MAX_CHATS} chats!`);
        return;
    }
    
    // Increment counter for new chat ID
    chatCounter++;
    const newChatId = chatCounter;
    const chatName = generateChatName(newChatId);

    // Initialize settings for this chat
    chatSettings[newChatId] = {
        model: "",
        address: "http://localhost:11434",
        context: "",
        temperature: "",
        role: "None"
    };

    // Create chat element
    const newChat = document.createElement('div');
    newChat.classList.add('msg');
    newChat.id = `chat-${newChatId}`;
    newChat.setAttribute('data-chat-id', newChatId);
    
    newChat.innerHTML = `
        <div class="msg-detail">
            <div class="msg-username">${chatName}</div>
            <div class="msg-message">New conversation</div>
        </div>
        <button class="delete-chat" data-chat-id="${newChatId}">&times;</button>
    `;
    
    // Initialize messages and title for the new chat
    chatMessages[newChatId] = [];
    chatTitles[newChatId] = [{ header: chatName }];
    
    // Add click event to open chat
    newChat.addEventListener('click', (e) => {
        // Don't open chat if delete button was clicked
        if (!e.target.classList.contains('delete-chat')) {
            openChat(newChatId);
        }
    });

    // Add delete button event
    const deleteButton = newChat.querySelector('.delete-chat');
    deleteButton.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteChat(newChatId);
    });
    
    // Add the new chat to the UI
    chatListContainer.appendChild(newChat);

    // Open the new chat
    openChat(newChatId);
}

// Open a specific chat
function openChat(chatId) {
    // Convert chatId to number if it's a string
    chatId = parseInt(chatId, 10);
    
    // Remove active class from all chats
    document.querySelectorAll('.msg').forEach((msg) => {
        msg.classList.remove('active');
    });
    
    // Add active class to selected chat
    const selectedChat = document.querySelector(`[data-chat-id="${chatId}"]`);
    if (selectedChat) {
        selectedChat.classList.add('active');
    }
    
    // Update current chat ID
    window.currentChatId = chatId;
    
    // Update chat content
    updateChatMessages(chatId);
    
    // Update chat title
    updateChatTitle(chatId);

    // Update settings UI with chat-specific settings
    updateSettingsUI(chatId);

    // Focus on input
    input.focus();
    
    // On mobile, close the conversation sidebar after selecting a chat
    if (window.innerWidth <= 768) {
        conversationArea.style.display = 'none';
    }
}

// Update chat messages in the main view
function updateChatMessages(chatId) {
    const messages = chatMessages[chatId] || [];
    chat.innerHTML = ''; // Clear existing messages
    
    messages.forEach((msg) => {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', msg.sender);
        
        // Format AI messages
        if (msg.sender === 'ai') {
            messageElement.setAttribute('data-raw-content', msg.message);
            messageElement.appendChild(formatMessage(msg.message));
        } else {
            // User messages stay as plain text
            messageElement.textContent = msg.message;
        }
        
        chat.appendChild(messageElement);
    });
    
    // Reset streaming tracking after loading a different chat
    currentStreamingMessage = null;
    currentStreamingChatId = null;
    
    // Scroll to the most recent message
    chat.scrollTop = chat.scrollHeight;
}

// Update settings UI with chat-specific settings
function updateSettingsUI(chatId) {
    if (chatSettings[chatId]) {
        // Update UI elements with this chat's settings
        modelSelect.value = chatSettings[chatId].model || '';
        addressInput.value = chatSettings[chatId].address || '';
        contextInput.value = chatSettings[chatId].context || '';
        tempInput.value = chatSettings[chatId].temperature || '';
        
        // Update role selection if applicable
        if (chatSettings[chatId].role) {
            const roleRadio = document.querySelector(`input[name="role"][value="${chatSettings[chatId].role}"]`);
            if (roleRadio) {
                roleRadio.checked = true;
                selectedRole = chatSettings[chatId].role;
            }
        }
    }
}

// Update the chat title in the header
function updateChatTitle(chatId) {
    const chatTitle = chatTitles[chatId] ? chatTitles[chatId][0].header : 'Chat';
    const chatHeader = document.querySelector('.chat-header-title');
    if (chatHeader) {
        chatHeader.textContent = chatTitle;
    }
}

// Update chat list UI when changes occur
function updateChatListUI(chatId) {
    // Generate the new title
    const newTitle = generateChatName(chatId);
    
    // Update the title in memory
    if (chatTitles[chatId]) {
        chatTitles[chatId][0].header = newTitle;
    }
    
    // Update the chat list element
    const chatElement = document.querySelector(`[data-chat-id="${chatId}"]`);
    if (chatElement) {
        const usernameElement = chatElement.querySelector('.msg-username');
        if (usernameElement) {
            usernameElement.textContent = newTitle;
        }
    }
    
    // Update chat header
    updateChatTitle(chatId);
}

// Delete a chat
function deleteChat(chatId) {
    // Don't allow deleting the last chat
    if (Object.keys(chatMessages).length <= 1) {
        alert("You can't delete the only chat!");
        return;
    }
    
    // Remove chat from UI
    const chatElement = document.querySelector(`[data-chat-id="${chatId}"]`);
    if (chatElement) {
        chatElement.remove();
    }
    
    // Remove from memory
    delete chatMessages[chatId];
    delete chatTitles[chatId];
    delete chatSettings[chatId];
    
    // If current chat was deleted, open another one
    if (window.currentChatId === chatId) {
        const firstChatId = Object.keys(chatMessages)[0];
        if (firstChatId) {
            openChat(firstChatId);
        }
    }
}

// Generate a chat name based on model and ID
function generateChatName(chatId) {
    const selectedOption = modelSelect.options[modelSelect.selectedIndex];
    const modelName = selectedOption ? selectedOption.textContent : 'Chat';
    
    return `${modelName}'s chat ${chatId}`;
}

// Update chat preview in the sidebar
function updateChatPreview(chatId, message) {
    const chatElement = document.querySelector(`[data-chat-id="${chatId}"]`);
    if (chatElement) {
        const msgPreview = chatElement.querySelector('.msg-message');
        if (msgPreview) {
            // Truncate message if too long
            msgPreview.textContent = message.length > 30 ? message.substring(0, 27) + '...' : message;
        }
    }
}

// Handle incoming messages from server
socket.on('message', (data) => {
    const chatId = data.chatId || window.currentChatId || 1;

    if (data.sender === 'ai') {
        // Check if this is the start of a new AI response
        const newMessage = isNewMessage;
        isNewMessage = false;
        const isEndOfStream = data.isEndOfStream || false;

        // Hide stop button when AI is done generating
        if (isEndOfStream) {
            stopButton.style.display = 'none';
            sendButton.style.display = 'block';
        }
        
        appendStreamingMessage(data.message, data.sender, chatId, newMessage, isEndOfStream);
        
        // Only update the preview when it's a new message or end of stream
        if (newMessage || isEndOfStream) {
            updateChatPreview(chatId, data.message);
        }
    } else {
        appendMessage(data.message, data.sender, chatId, true);
        // If it's a user message, next AI message will be new
        isNewMessage = true;
    }
});

// Handle token statistics updates
socket.on('token_stats', (data) => {
    if (data.total_tokens !== undefined) {
        totalTokensElement.textContent = data.total_tokens;
    }
    
    if (data.tokens_per_second !== undefined) {
        tokensPerSecondElement.textContent = data.tokens_per_second.toFixed(2);
    }
    
    if (data.generation_time !== undefined) {
        generationTimeElement.textContent = data.generation_time.toFixed(2);
    }
});

// Handle available models response
socket.on('available_models', (data) => {
    // Clear existing options
    modelSelect.innerHTML = '';
    
    // Add options for each model
    data.models.forEach((model, index) => {
        const option = document.createElement('option');
        option.value = model.id || model;
        option.textContent = model.name || model;
        
        // Set as selected if it's the default model
        if (data.default_model && (model.id === data.default_model || model === data.default_model)) {
            option.selected = true;
        }

        modelSelect.appendChild(option);
    });
    
    // Select first model if no default specified
    if (!data.default_model && modelSelect.options.length > 0) {
        modelSelect.options[0].selected = true;
    }
    
    // Update first chat title
    updateChatListUI(1);
});

// Handle available roles response
socket.on('available_roles', (data) => {
    roleList.innerHTML = ''; // Clear previous list

    // Create radio buttons for each role
    data.roles.forEach((role, index) => {
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'role';
        radio.value = role;
        radio.id = `role-${index}`;

        // Check if this role was previously selected
        const currentChatId = window.currentChatId || 1;
        if (chatSettings[currentChatId] && chatSettings[currentChatId].role === role) {
            radio.checked = true;
        } else if (selectedRole === role) {
            radio.checked = true;
        }

        const label = document.createElement('label');
        label.htmlFor = `role-${index}`;
        label.textContent = role;

        // Role selection handler
        radio.addEventListener('change', () => {
            selectedRole = role;
            
            const currentChatId = window.currentChatId || 1;
            if (!chatSettings[currentChatId]) {
                chatSettings[currentChatId] = {};
            }
            chatSettings[currentChatId].role = role;
            
            socket.emit('set_role', { 
                selected_role: role,
                chatId: currentChatId
            });
        });

        // Add to role list
        roleList.appendChild(radio);
        roleList.appendChild(label);
        roleList.appendChild(document.createElement('br'));
    });
});

// Append streaming message (for AI responses)
function appendStreamingMessage(messageChunk, sender, chatId, isNewMessage = false, isEndOfStream = false, saveMessage = true) {
    

    // Skip if generation is stopped and not end of stream
    if (generationStopped && !isEndOfStream) {
        stopButton.style.display = 'none';
        sendButton.style.display = 'block';
        return;
    }
    else {
        sendButton.style.display = 'none';
        stopButton.style.display = 'block';
    }
    
    // Reset flag at end of stream
    if (isEndOfStream) {
        generationStopped = false;
    }
    
    // Create new message element or continue streaming to existing one
    if (isNewMessage || currentStreamingChatId !== chatId) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', sender);
        
        if (sender === 'ai') {
            messageElement.setAttribute('data-raw-content', messageChunk);
            messageElement.appendChild(formatMessage(messageChunk));
        } else {
            messageElement.textContent = messageChunk;
        }
        
        chat.appendChild(messageElement);
        
        currentStreamingMessage = messageElement;
        currentStreamingChatId = chatId;
        
        // Save new message in memory
        if (saveMessage && chatMessages[chatId]) {
            chatMessages[chatId].push({ sender, message: messageChunk });
        }
    } else if (currentStreamingMessage) {
        // Get current content and update it
        const currentContent = currentStreamingMessage.getAttribute('data-raw-content') || '';
        const updatedContent = currentContent + messageChunk;
        currentStreamingMessage.setAttribute('data-raw-content', updatedContent);
        
        // Clear and reformat content
        currentStreamingMessage.innerHTML = '';
        currentStreamingMessage.appendChild(formatMessage(updatedContent));
        
        // Update stored message
        if (saveMessage && chatMessages[chatId] && chatMessages[chatId].length > 0) {
            const lastIndex = chatMessages[chatId].length - 1;
            chatMessages[chatId][lastIndex].message = updatedContent;
        }
        
        // Reset at end of stream
        if (isEndOfStream) {
            stopButton.style.display = 'none';
            sendButton.style.display = 'block';
            currentStreamingMessage = null;
            currentStreamingChatId = null;
        }
    }
    
    // Scroll to bottom
    chat.scrollTop = chat.scrollHeight;
}

// Append complete message (for user messages and system messages)
function appendMessage(message, sender, chatId, saveMessage = true) {

    const messageElement = document.createElement('div');
    messageElement.classList.add('message', sender);
    
    if (sender === 'ai') {
        messageElement.setAttribute('data-raw-content', message);
        messageElement.appendChild(formatMessage(message));
    } else {
        messageElement.textContent = message;
    }

    chat.appendChild(messageElement);
    chat.scrollTop = chat.scrollHeight;

    // Save message if requested
    if (saveMessage && chatMessages[chatId]) {
        chatMessages[chatId].push({ sender, message });
        updateChatPreview(chatId, message);
    }
}

// Elaborate text message (for user messages and system messages)
function formatMessage(text) {
    const container = document.createElement('div');
    container.className = 'formatted-message';
   
    // Process the text with code blocks, headings, lists, etc.
    const lines = text.split('\n');
    let inCodeBlock = false;
    let codeContent = '';
    let currentList = null;
   
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Handle code blocks
        if (line.trim().startsWith('```')) {
            if (!inCodeBlock) {
                inCodeBlock = true;
                
                if (currentList) {
                    container.appendChild(currentList);
                    currentList = null;
                }
            } else {
                inCodeBlock = false;
                
                const pre = document.createElement('pre');
                pre.textContent = codeContent;
                container.appendChild(pre);
                
                codeContent = '';
            }
            continue;
        }
        
        // Collect content inside code block
        if (inCodeBlock) {
            codeContent += line + '\n';
            continue;
        }
        
        // Process headings
        if (line.startsWith('# ')) {
            if (currentList) {
                container.appendChild(currentList);
                currentList = null;
            }
            
            const h1 = document.createElement('h1');
            h1.textContent = line.substring(2);
            container.appendChild(h1);
        }
        else if (line.startsWith('## ')) {
            if (currentList) {
                container.appendChild(currentList);
                currentList = null;
            }
            
            const h2 = document.createElement('h2');
            h2.textContent = line.substring(3);
            container.appendChild(h2);
        }
        else if (line.startsWith('### ')) {
            if (currentList) {
                container.appendChild(currentList);
                currentList = null;
            }
            
            const h3 = document.createElement('h3');
            h3.textContent = line.substring(4);
            container.appendChild(h3);
        }
        // Handle list items
        else if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
            if (!currentList) {
                currentList = document.createElement('ul');
            }
            
            const li = document.createElement('li');
            const itemContent = line.trim().substring(2);
            li.innerHTML = processInlineFormatting(itemContent);
            currentList.appendChild(li);
        }
        // Regular text
        else if (line.trim() !== '') {
            if (currentList) {
                container.appendChild(currentList);
                currentList = null;
            }
            
            const formattedLine = processInlineFormatting(line);
            
            const p = document.createElement('p');
            p.innerHTML = formattedLine;
            container.appendChild(p);
        }
        // Empty line
        else {
            if (currentList) {
                container.appendChild(currentList);
                currentList = null;
            }
        }
    }
    
    // Add any remaining list or code block
    if (currentList) {
        container.appendChild(currentList);
    }
    
    if (inCodeBlock && codeContent) {
        const pre = document.createElement('pre');
        pre.textContent = codeContent;
        container.appendChild(pre);
    }
    
    return container;
}

// Process inline formatting (code, bold)
function processInlineFormatting(text) {
    // Handle inline code
    let formatted = text.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Handle bold text
    formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<span style="font-weight: bold; font-size: 1.1em;">$1</span>');
    
    return formatted;
}

// Save current chat
function saveCurrentChat() {
    const currentChatId = window.currentChatId || 1;
    
    try {
        // Prepare settings
        const settings = chatSettings[currentChatId] || {};
        const simplifiedSettings = {
            model: settings.model || modelSelect.value,
            address: settings.address || addressInput.value.trim(),
            context: settings.context || contextInput.value.trim(),
            temperature: settings.temperature || tempInput.value.trim(),
            role: settings.role || selectedRole
        };
        
        // Prepare messages
        const messages = (chatMessages[currentChatId] || []).map(msg => ({
            sender: msg.sender,
            message: msg.message
        }));
        
        // Create chat data object
        const chatData = {
            id: currentChatId,
            title: chatTitles[currentChatId] ? chatTitles[currentChatId][0].header : 'Unnamed Chat',
            messages: messages,
            settings: simplifiedSettings
        };
        
        // Send to server
        socket.emit('save_chat', {
            chatData: chatData,
            filePath: './chat_history.json',
        });
        
        // Show feedback
        appendMessage(`Saving chat "${chatData.title}"...`, 'system', currentChatId, false);
    } catch (error) {
        console.error("Error preparing chat data:", error);
        appendMessage(`Error preparing chat data: ${error.message}`, 'system', currentChatId, false);
    }
}

// Set up auto-close behavior for sidebars
let conversationAreaTimeout = null;
let settingsWindowTimeout = null;
const AUTO_CLOSE_DELAY = 700; // 0.7 seconds delay before closing

function setupAutoCloseSidebars() {
    // For conversation area
    conversationArea.addEventListener('mouseenter', () => {
        clearTimeout(conversationAreaTimeout);
    });
    
    conversationArea.addEventListener('mouseleave', () => {
        // Only auto-close on desktop - on mobile we want more deliberate control
        if (window.innerWidth > 768) {
            conversationAreaTimeout = setTimeout(() => {
                conversationArea.style.display = 'none';
            }, AUTO_CLOSE_DELAY);
        }
    });
    
    // For settings window
    settingsWindow.addEventListener('mouseenter', () => {
        clearTimeout(settingsWindowTimeout);
    });
    
    settingsWindow.addEventListener('mouseleave', () => {
        // Only auto-close on desktop - on mobile we want more deliberate control
        if (window.innerWidth > 768) {
            settingsWindowTimeout = setTimeout(() => {
                settingsWindow.style.display = 'none';
            }, AUTO_CLOSE_DELAY);
        }
    });
    
    // For chat list container specifically (as a child of conversationArea)
    chatListContainer.addEventListener('mouseenter', () => {
        clearTimeout(conversationAreaTimeout);
    });
    
    chatListContainer.addEventListener('mouseleave', (e) => {
        // Make sure we're not moving to another element within the conversation area
        if (!conversationArea.contains(e.relatedTarget)) {
            if (window.innerWidth > 768) {
                conversationAreaTimeout = setTimeout(() => {
                    conversationArea.style.display = 'none';
                }, AUTO_CLOSE_DELAY);
            }
        }
    });
}

// Clear any auto-close timeouts
function clearAutoCloseTimeouts() {
    clearTimeout(conversationAreaTimeout);
    clearTimeout(settingsWindowTimeout);
}

// Handle load chat button click
function handleLoadChat() {
    // Request list of saved chats
    getSavedChats();
}

// Get saved chats list
function getSavedChats() {
    socket.emit('get_saved_chats', {
        filePath: './chat_history.json'
    });
    
    // Show feedback
    appendMessage("Retrieving saved chats...", 'system', window.currentChatId || 1, false);
}

// Load a specific chat
function loadChat(chatId) {
    socket.emit('load_chat', {
        chatId: chatId,
        filePath: './chat_history.json'
    });
    
    // Show feedback
    appendMessage(`Loading chat ${chatId}...`, 'system', window.currentChatId || 1, false);
}





// Socket event handler for receiving the list of saved chats
socket.on('saved_chats_list', (data) => {
    if (data.success) {
        console.log("Received saved chats:", data.chats);
        displaySavedChats(data.chats);
    } else {
        console.error("Error loading saved chats:", data.error);
        appendMessage(`Error loading saved chats: ${data.error}`, 'system', window.currentChatId || 1, false);
    }
});

// Socket event handler for chat load results
socket.on('chat_loaded', (data) => {
    if (data.success) {
        // console.log("Chat loaded successfully:", data.chatData);
        // Convert Python dict to JSON
        const currentChatId = data.chatData.id || window.currentChatId || 1;
        chatMessages[currentChatId] = [];

        // Set and update the chat title
        chatTitles[currentChatId] = [{
            header: data.chatData.title || 'Loaded Chat'
        }];
        updateChatTitle(currentChatId);

        // Load the chat settings
        chatSettings[currentChatId].model = data.chatData.model;
        chatSettings[currentChatId].address = data.chatData.address;
        chatSettings[currentChatId].context = data.chatData.context;
        chatSettings[currentChatId].temperature = data.chatData.temperature;
        // Update UI elements if they exist
            if (modelSelect) modelSelect.value = data.chatData.model || modelSelect.value;
            if (addressInput) addressInput.value = data.chatData.address || addressInput.value;
            if (contextInput) contextInput.value = data.chatData.context || contextInput.value;
            if (tempInput) tempInput.value = data.chatData.temperature || tempInput.value;
        // Update role if applicable
            if (data.chatData.role) {
                selectedRole = data.chatData.role;
                // Update role UI if needed
                updateRoleUI(selectedRole);
            }

            if (typeof data.chatData === 'object' && data.chatData !== null) {
            // Use it directly
            data.chatData.messages.forEach(msg => {
                appendMessage(msg.content, msg.sender, currentChatId, true);
            });
        

            // Switch to the loaded chat
            openChat(currentChatId);                 

    } 
    else {
        console.error("Error loading chat:", data.chatData.error);
        appendMessage(`Error loading chat: ${data.chatData.error}`, 'system', window.currentChatId || 1, false);
    }
}});

// Function to display saved chats (implementation depends on your UI)
function displaySavedChats(chats) {
    // This is a placeholder - implement according to your UI
    console.log("Displaying saved chats:", chats);
    
    // Example: Show list in a system message
    if (chats.length === 0) {
        appendMessage("No saved chats found.", 'system', window.currentChatId || 1, false);
    } else {
        let chatsList = "Available saved chats:\n";
        chats.forEach(chat => {
            chatsList += `- ${chat.title} (ID: ${chat.id})\n`;
        });
        appendMessage(chatsList, 'system', window.currentChatId || 1, false);
    }
    
    // Note: In a real implementation, you would populate a dropdown menu or list
    // from which users can select a chat to load
}
// Helper function to update the UI based on the selected role
// Implement according to your application's needs
function updateRoleUI(role) {
    chatSettings[currentChatId].role = role;
                                
    // Send selected role to server with current chat ID
    socket.emit('set_role', { 
        selected_role: role,
        chatId: currentChatId
    });
}
