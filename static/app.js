import { StorageDB } from './db.js';
import { renderMarkdown, enhanceCodeBlocks } from './markdown.js';
import { initTheme, applyTheme } from './theme.js';

let currentChatId = null;
let currentMessages = [];
let attachedImages = []; // Stores Base64 images for multimodal input

// DOM Elements
const messagesContainer = document.getElementById('messagesContainer');
const promptInput = document.getElementById('promptInput');
const sendBtn = document.getElementById('sendBtn');
const newChatBtn = document.getElementById('newChatBtn');
const chatHistoryList = document.getElementById('chatHistoryList');
const settingsModal = document.getElementById('settingsModal');
const authModal = document.getElementById('authModal');
const fileAttachInput = document.getElementById('fileAttachInput');
const attachmentPreview = document.getElementById('attachmentPreview');

const CLAUDE_SVG = `<svg class="claude-icon" width="20" height="20" viewBox="0 0 24 24" fill="#D97706"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>`;

document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    setupEventListeners();
    await checkAuthStatus();
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

    if (closeSidebarBtn) closeSidebarBtn.addEventListener('click', closeSidebar);
    if (overlay) overlay.addEventListener('click', closeSidebar);

    // Input Typing Handler
    promptInput.addEventListener('input', () => {
        promptInput.style.height = 'auto';
        promptInput.style.height = promptInput.scrollHeight + 'px';

        const hasContent = promptInput.value.trim().length > 0 || attachedImages.length > 0;
        sendBtn.disabled = !hasContent;

        const charCounter = document.getElementById('charCounter');
        if (charCounter) charCounter.innerText = `${promptInput.value.length}/4000`;
    });

    promptInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!sendBtn.disabled) sendMessage();
        }
    });

    sendBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (!sendBtn.disabled) sendMessage();
    });

    if (newChatBtn) newChatBtn.addEventListener('click', createNewChat);

    // File Attachment Logic (Base64 Conversion)
    if (fileAttachInput) {
        fileAttachInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            files.forEach(file => {
                if (file.type.startsWith('image/')) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        attachedImages.push(event.target.result);
                        renderAttachmentPreviews();
                        sendBtn.disabled = false;
                    };
                    reader.readAsDataURL(file);
                }
            });
            fileAttachInput.value = '';
        });
    }

    // Auth Modal Handlers
    const openAuthModalBtn = document.getElementById('openAuthModalBtn');
    const closeAuthBtn = document.getElementById('closeAuthBtn');
    const toggleAuthMode = document.getElementById('toggleAuthMode');
    const authSubmitBtn = document.getElementById('authSubmitBtn');
    let isSignUpMode = false;

    if (openAuthModalBtn) {
        openAuthModalBtn.addEventListener('click', () => {
            closeSidebar();
            if (authModal) authModal.showModal();
        });
    }

    if (closeAuthBtn) closeAuthBtn.addEventListener('click', () => authModal.close());

    if (toggleAuthMode) {
        toggleAuthMode.addEventListener('click', (e) => {
            e.preventDefault();
            isSignUpMode = !isSignUpMode;
            document.getElementById('authTitle').innerText = isSignUpMode ? 'Sign Up' : 'Sign In';
            authSubmitBtn.innerText = isSignUpMode ? 'Create Account' : 'Sign In';
            toggleAuthMode.innerText = isSignUpMode ? 'Sign In' : 'Sign Up';
            document.getElementById('authErrorMsg').innerText = '';
        });
    }

    if (authSubmitBtn) {
        authSubmitBtn.addEventListener('click', async () => {
            const email = document.getElementById('authEmail').value;
            const password = document.getElementById('authPassword').value;
            const errorMsg = document.getElementById('authErrorMsg');

            const endpoint = isSignUpMode ? '/api/auth/signup' : '/api/auth/login';

            try {
                const res = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                const data = await res.json();

                if (!res.ok) {
                    errorMsg.innerText = data.error || 'Authentication failed.';
                    return;
                }

                errorMsg.innerText = '';
                authModal.close();
                await checkAuthStatus();
            } catch (err) {
                errorMsg.innerText = 'Network connection error.';
            }
        });
    }

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

function renderAttachmentPreviews() {
    if (!attachmentPreview) return;
    attachmentPreview.innerHTML = '';
    attachedImages.forEach((imgSrc, index) => {
        const item = document.createElement('div');
        item.className = 'preview-item';
        item.innerHTML = `
            <img src="${imgSrc}" alt="Attachment">
            <button class="remove-btn" data-index="${index}">✕</button>
        `;
        attachmentPreview.appendChild(item);
    });

    attachmentPreview.querySelectorAll('.remove-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.target.getAttribute('data-index'));
            attachedImages.splice(idx, 1);
            renderAttachmentPreviews();
            if (attachedImages.length === 0 && promptInput.value.trim().length === 0) {
                sendBtn.disabled = true;
            }
        });
    });
}

async function checkAuthStatus() {
    const profileBar = document.getElementById('userProfileBar');
    if (!profileBar) return;

    try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();

        if (data.authenticated) {
            profileBar.innerHTML = `
                <div class="user-info">
                    <span class="user-email">${data.user}</span>
                    <button class="btn-logout" id="logoutBtn">Logout</button>
                </div>
            `;
            document.getElementById('logoutBtn').addEventListener('click', async () => {
                await fetch('/api/auth/logout', { method: 'POST' });
                await checkAuthStatus();
            });
        } else {
            profileBar.innerHTML = `<button class="btn-auth" id="openAuthModalBtn">Sign In / Register</button>`;
            document.getElementById('openAuthModalBtn').addEventListener('click', () => authModal.showModal());
        }
    } catch (e) { }
}

async function createNewChat() {
    currentChatId = Date.now().toString();
    currentMessages = [];
    messagesContainer.innerHTML = `
        <div class="welcome-screen" id="welcomeScreen">
            <h2>What can I help with today?</h2>
        </div>
    `;
    await loadHistoryUI();
}

async function sendMessage() {
    const text = promptInput.value.trim();
    if (!text && attachedImages.length === 0) return;

    if (!currentChatId) currentChatId = Date.now().toString();

    const currentReqImages = [...attachedImages];

    // 1. Render User Message
    appendMessageUI('user', text, currentReqImages);
    currentMessages.push({ role: 'user', content: text });

    // Clear input
    promptInput.value = '';
    promptInput.style.height = 'auto';
    attachedImages = [];
    renderAttachmentPreviews();
    sendBtn.disabled = true;

    // 2. Render Assistant Thinking Placeholder with Claude Branding
    const botMsgNode = appendMessageUI('assistant', '<div class="thinking-state">' + CLAUDE_SVG + ' <span>Thinking...</span></div>');
    const bubble = botMsgNode.querySelector('.message-bubble');

    let fullResponse = '';

    try {
        const response = await fetch('/api/chat/stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: currentMessages,
                images: currentReqImages,
                model: localStorage.getItem('preferred-model') || 'anthropic/claude-3-haiku',
                apiKeyOverride: localStorage.getItem('api-key-override') || ''
            })
        });

        if (!response.ok) {
            const errData = await response.json();
            bubble.innerHTML = `<span style="color: #ef4444;">Error: ${errData.error || 'Server request failed.'}</span>`;
            return;
        }

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
                    } catch (e) { }
                }
            }
        }

        // Add Interactive Actions Bar to Bot Output
        appendBotActions(botMsgNode, fullResponse);

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
        bubble.innerHTML = `<span style="color: #ef4444;">Connection Error: Check server connection.</span>`;
    }
}

function appendMessageUI(role, content, images = []) {
    const welcome = document.querySelector('.welcome-screen');
    if (welcome) welcome.remove();

    const row = document.createElement('div');
    row.className = `message-row ${role}`;

    let imagesMarkup = '';
    if (images.length > 0) {
        imagesMarkup = `<div class="msg-images-grid">${images.map(img => `<img src="${img}" alt="Attached Image">`).join('')}</div>`;
    }

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';

    if (role === 'assistant') {
        bubble.innerHTML = content.includes('thinking-state') ? content : renderMarkdown(content);
    } else {
        bubble.innerHTML = imagesMarkup + `<div>${escapeHtml(content)}</div>`;
    }

    row.appendChild(bubble);
    messagesContainer.appendChild(row);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    if (role === 'assistant' && !content.includes('thinking-state')) {
        enhanceCodeBlocks(bubble);
    }

    return row;
}

function appendBotActions(rowNode, textContent) {
    const actionsBar = document.createElement('div');
    actionsBar.className = 'bot-actions-bar';
    actionsBar.innerHTML = `
        <button class="action-btn copy-btn" title="Copy text">📋</button>
        <button class="action-btn listen-btn" title="Listen response">🔊</button>
        <button class="action-btn thumb-up-btn" title="Good response">👍</button>
        <button class="action-btn thumb-down-btn" title="Bad response">👎</button>
        <button class="action-btn reload-btn" title="Regenerate">🔄</button>
    `;

    rowNode.appendChild(actionsBar);

    // Copy Button Logic
    actionsBar.querySelector('.copy-btn').addEventListener('click', (e) => {
        navigator.clipboard.writeText(textContent);
        e.target.innerText = '✅';
        setTimeout(() => e.target.innerText = '📋', 2000);
    });

    // Speech Voice Output
    actionsBar.querySelector('.listen-btn').addEventListener('click', () => {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(textContent);
            window.speechSynthesis.speak(utterance);
        }
    });

    // Feedback
    actionsBar.querySelector('.thumb-up-btn').addEventListener('click', (e) => {
        e.target.style.color = '#10B981';
    });
    actionsBar.querySelector('.thumb-down-btn').addEventListener('click', (e) => {
        e.target.style.color = '#EF4444';
    });

    // Regenerate Response
    actionsBar.querySelector('.reload-btn').addEventListener('click', () => {
        if (currentMessages.length > 0) {
            if (currentMessages[currentMessages.length - 1].role === 'assistant') {
                currentMessages.pop();
            }
            rowNode.remove();
            sendMessage();
        }
    });
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
    currentMessages.forEach(msg => {
        const node = appendMessageUI(msg.role, msg.content);
        if (msg.role === 'assistant') appendBotActions(node, msg.content);
    });
    loadHistoryUI();
}

function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}