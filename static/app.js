import { StorageDB } from './db.js';
import { renderMarkdown, enhanceCodeBlocks } from './markdown.js';
import { initTheme, applyTheme } from './theme.js';

let currentChatId = null;
let currentMessages = [];

// DOM Elements
const messagesContainer = document.getElementById('messagesContainer');
const promptInput = document.getElementById('promptInput');
const sendBtn = document.getElementById('sendBtn');
const newChatBtn = document.getElementById('newChatBtn');
const chatHistoryList = document.getElementById('chatHistoryList');
const settingsModal = document.getElementById('settingsModal');

document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    setupEventListeners();
    await loadHistoryUI();
});

function setupEventListeners() {
    // Dynamic Mobile Overlay Creation
    let overlay = document.querySelector('.sidebar-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'sidebar-overlay';
        document.body.appendChild(overlay);
    }

    const sidebar = document.getElementById('sidebar');
    const closeSidebarBtn = document.getElementById('closeSidebarBtn');

    function openSidebar() {
        if (sidebar) sidebar.classList.add('open');
        if (overlay) overlay.classList.add('active');
    }

    function closeSidebar() {
        if (sidebar) sidebar.classList.remove('open');
        if (overlay) overlay.classList.remove('active');
    }

    // Sidebar Toggles
    const toggleBtn = document.getElementById('toggleSidebarBtn');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openSidebar();
        });
    }

    if (closeSidebarBtn) {
        closeSidebarBtn.addEventListener('click', closeSidebar);
    }

    if (overlay) {
        overlay.addEventListener('click', closeSidebar);
    }

    // Enable/Disable Send Button on typing
    promptInput.addEventListener('input', () => {
        promptInput.style.height = 'auto';
        promptInput.style.height = promptInput.scrollHeight + 'px';

        const hasText = promptInput.value.trim().length > 0;
        sendBtn.disabled = !hasText;
        if (hasText) {
            sendBtn.removeAttribute('disabled');
        } else {
            sendBtn.setAttribute('disabled', 'true');
        }

        const charCounter = document.getElementById('charCounter');
        if (charCounter) charCounter.innerText = `${promptInput.value.length}/4000`;
    });

    promptInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (promptInput.value.trim()) sendMessage();
        }
    });

    sendBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (promptInput.value.trim()) sendMessage();
    });

    if (newChatBtn) newChatBtn.addEventListener('click', createNewChat);

    // Settings Modal Controls
    const openSetBtn = document.getElementById('openSettingsBtn');
    const closeSetBtn = document.getElementById('closeSettingsBtn');
    if (openSetBtn) openSetBtn.addEventListener('click', () => {
        closeSidebar();
        settingsModal.showModal();
    });
    if (closeSetBtn) closeSetBtn.addEventListener('click', () => settingsModal.close());

    const themeSelect = document.getElementById('themeSelect');
    if (themeSelect) {
        themeSelect.addEventListener('change', (e) => applyTheme(e.target.value));
    }
}

async function createNewChat() {
    currentChatId = Date.now().toString();
    currentMessages = [];
    messagesContainer.innerHTML = `<div class="welcome-screen"><h2>What can I help with today?</h2></div>`;
    await loadHistoryUI();
}

async function sendMessage() {
    const text = promptInput.value.trim();
    if (!text) return;

    if (!currentChatId) currentChatId = Date.now().toString();

    // 1. Render User Message
    appendMessageUI('user', text);
    currentMessages.push({ role: 'user', content: text });

    promptInput.value = '';
    promptInput.style.height = 'auto';
    sendBtn.disabled = true;

    // 2. Render Assistant Placeholder
    const botMsgNode = appendMessageUI('assistant', 'Thinking...');
    const bubble = botMsgNode.querySelector('.message-bubble');

    let fullResponse = '';

    try {
        // 3. Send JSON Data to Flask Server
        const response = await fetch('/api/chat/stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: currentMessages,
                model: localStorage.getItem('preferred-model') || 'anthropic/claude-3.5-sonnet',
                apiKeyOverride: localStorage.getItem('api-key-override') || ''
            })
        });

        if (!response.ok) {
            const errData = await response.json();
            bubble.innerHTML = `<span style="color: #ef4444;">Error: ${errData.error || 'Server request failed.'}</span>`;
            return;
        }

        // 4. Stream & Parse Response (Reading Server JSON Stream)
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        bubble.innerHTML = '';

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
                const trimmedLine = line.trim();

                if (trimmedLine.startsWith('data: ')) {
                    const dataStr = trimmedLine.replace('data: ', '').trim();
                    if (dataStr === '[DONE]') break;

                    try {
                        const parsed = JSON.parse(dataStr);
                        if (parsed.text) {
                            fullResponse += parsed.text;
                            bubble.innerHTML = renderMarkdown(fullResponse);
                            enhanceCodeBlocks(bubble);
                            messagesContainer.scrollTop = messagesContainer.scrollHeight;
                        } else if (parsed.error) {
                            bubble.innerHTML = `<span style="color: #ef4444;">API Error: ${parsed.error}</span>`;
                        }
                    } catch (e) {
                        // Partial chunk parse error
                    }
                }
            }
        }

        // 5. Save Completed Response to Local History (IndexedDB)
        if (fullResponse) {
            currentMessages.push({ role: 'assistant', content: fullResponse });
            await StorageDB.saveChat({
                id: currentChatId,
                title: currentMessages[0].content.slice(0, 30) + '...',
                messages: currentMessages,
                updatedAt: Date.now()
            });
            await loadHistoryUI();
        }

    } catch (err) {
        bubble.innerHTML = `<span style="color: #ef4444;">Connection Error: Check server terminal.</span>`;
    }
}

function appendMessageUI(role, content) {
    const welcome = document.querySelector('.welcome-screen');
    if (welcome) welcome.remove();

    const row = document.createElement('div');
    row.className = `message-row ${role}`;

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.innerHTML = role === 'assistant' ? renderMarkdown(content) : escapeHtml(content);

    row.appendChild(bubble);
    messagesContainer.appendChild(row);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    if (role === 'assistant') enhanceCodeBlocks(bubble);
    return row;
}

async function loadHistoryUI() {
    const chats = await StorageDB.getAllChats();
    if (!chatHistoryList) return;
    chatHistoryList.innerHTML = '';

    chats.forEach(chat => {
        const item = document.createElement('div');
        item.className = `history-item ${chat.id === currentChatId ? 'active' : ''}`;
        item.innerText = chat.title || 'Untitled Chat';
        item.addEventListener('click', () => {
            loadChat(chat);
            // Mobile screen वर history निवडून झाल्यावर sidebar ऑटो क्लोज होईल
            const sidebar = document.getElementById('sidebar');
            const overlay = document.querySelector('.sidebar-overlay');
            if (sidebar) sidebar.classList.remove('open');
            if (overlay) overlay.classList.remove('active');
        });
        chatHistoryList.appendChild(item);
    });
}

function loadChat(chat) {
    currentChatId = chat.id;
    currentMessages = chat.messages;
    messagesContainer.innerHTML = '';
    currentMessages.forEach(msg => appendMessageUI(msg.role, msg.content));
    loadHistoryUI();
}

function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}