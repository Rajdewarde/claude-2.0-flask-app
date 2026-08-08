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

const SARATHI_SVG = `<svg class="sarathi-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><line x1="4" y1="16" x2="20" y2="16"/><path d="M7 16a5 5 0 0 1 10 0"/><line x1="12" y1="6" x2="12" y2="8.5"/><line x1="7.6" y1="8.1" x2="9.1" y2="9.9"/><line x1="16.4" y1="8.1" x2="14.9" y2="9.9"/></svg>`;

// Maps the real OpenRouter model id -> the friendly name shown in the UI.
// The dropdown in Settings uses these same values, so keep both in sync.
const MODEL_LABELS = {
    'anthropic/claude-3.5-haiku': 'Sarathi Prime',
    'anthropic/claude-3-haiku': 'Sarathi Flash'
};

let currentPlanData = null;

function updateModelBadge() {
    const badge = document.getElementById('currentModelDisplay');
    if (!badge) return;
    const modelId = localStorage.getItem('preferred-model') || 'anthropic/claude-3.5-haiku';
    badge.innerText = MODEL_LABELS[modelId] || 'Sarathi Prime';
}

async function fetchAndRenderPlan() {
    try {
        const res = await fetch('/api/plan');
        const data = await res.json();
        currentPlanData = data;

        const nameEl = document.getElementById('usagePlanName');
        const countEl = document.getElementById('usageCount');
        const fillEl = document.getElementById('usageBarFill');
        if (nameEl) nameEl.innerText = data.planLabel;
        if (countEl) countEl.innerText = `${data.used}/${data.limit}`;
        if (fillEl) {
            const pct = Math.min(100, Math.round((data.used / data.limit) * 100));
            fillEl.style.width = `${pct}%`;
        }

        updateModelSelectLocks();
    } catch (e) { /* Plan info is a nice-to-have; fail silently if offline */ }
}

function updateModelSelectLocks() {
    const modelSelect = document.getElementById('modelSelect');
    if (!modelSelect || !currentPlanData) return;
    Array.from(modelSelect.options).forEach(opt => {
        const allowed = currentPlanData.models.includes(opt.value);
        const baseLabel = MODEL_LABELS[opt.value] ? opt.innerText.replace(/^🔒 /, '') : opt.innerText;
        opt.innerText = allowed ? baseLabel.replace(/^🔒 /, '') : `🔒 ${baseLabel.replace(/^🔒 /, '')}`;
        opt.disabled = !allowed;
    });
}

function renderPlanCards() {
    const container = document.getElementById('planCardsContainer');
    if (!container || !currentPlanData) return;

    const { plans, planOrder, plan: activePlan } = currentPlanData;
    const activeIndex = planOrder.indexOf(activePlan);

    container.innerHTML = planOrder.map((planId, idx) => {
        const p = plans[planId];
        const isCurrent = planId === activePlan;
        const isDowngrade = idx < activeIndex;
        const featuresHtml = p.features.map(f => `<li>${f}</li>`).join('');
        return `
            <div class="plan-card ${planId === 'sarathi' ? 'recommended' : ''} ${isCurrent ? 'current' : ''}">
                ${planId === 'sarathi' ? '<span class="plan-card-badge">Popular</span>' : ''}
                <div class="plan-card-header">
                    <span class="plan-title">${p.label}</span>
                    <span class="plan-price">${p.price}</span>
                </div>
                <div class="plan-card-limit">${p.tagline}</div>
                <ul class="plan-card-features">${featuresHtml}</ul>
                <button class="plan-card-action" data-plan-id="${planId}" ${isCurrent ? 'disabled' : ''}>
                    ${isCurrent ? 'Current Plan' : (isDowngrade ? 'Switch back' : 'Switch to ' + p.label)}
                </button>
            </div>
        `;
    }).join('');

    container.querySelectorAll('.plan-card-action:not(:disabled)').forEach(btn => {
        btn.addEventListener('click', async () => {
            const planId = btn.getAttribute('data-plan-id');
            btn.disabled = true;
            btn.innerText = 'Switching...';
            try {
                await fetch('/api/plan', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ plan: planId })
                });
                await fetchAndRenderPlan();
                renderPlanCards();
                updateModelBadge();
            } catch (e) {
                btn.disabled = false;
                btn.innerText = 'Try again';
            }
        });
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    updateModelBadge();
    setupEventListeners();
    await checkAuthStatus();
    await loadHistoryUI();
    await fetchAndRenderPlan();
    await refreshActiveDocument();
});

// --- Document RAG (chat with a PDF/text file) --------------------------
function renderActiveDocument(doc) {
    const pill = document.getElementById('activeDocPill');
    const nameEl = document.getElementById('activeDocName');
    if (!pill || !nameEl) return;
    if (doc) {
        nameEl.innerText = doc.filename;
        pill.hidden = false;
    } else {
        pill.hidden = true;
    }
}

async function refreshActiveDocument() {
    try {
        const res = await fetch('/api/config');
        const data = await res.json();
        renderActiveDocument(data.activeDocument || null);
    } catch (e) { /* non-critical */ }
}

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

    // Document Upload (RAG) — attach a PDF/text file to chat with it
    const docAttachInput = document.getElementById('docAttachInput');
    const removeDocBtn = document.getElementById('removeDocBtn');

    if (docAttachInput) {
        docAttachInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            docAttachInput.value = '';
            if (!file) return;

            const nameEl = document.getElementById('activeDocName');
            const pill = document.getElementById('activeDocPill');
            if (nameEl) nameEl.innerText = `Reading ${file.name}...`;
            if (pill) pill.hidden = false;

            const formData = new FormData();
            formData.append('file', file);

            try {
                const res = await fetch('/api/documents/upload', { method: 'POST', body: formData });
                const data = await res.json();
                if (!res.ok) {
                    alert(data.error || 'Could not process that document.');
                    renderActiveDocument(null);
                    return;
                }
                renderActiveDocument({ filename: data.filename });
            } catch (err) {
                alert('Upload failed — check your connection.');
                renderActiveDocument(null);
            }
        });
    }

    if (removeDocBtn) {
        removeDocBtn.addEventListener('click', async () => {
            try {
                await fetch('/api/documents/clear', { method: 'POST' });
            } catch (e) { /* clear the UI regardless */ }
            renderActiveDocument(null);
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

    // Plans Modal Controls
    const openPlansBtn = document.getElementById('openPlansBtn');
    const closePlansBtn = document.getElementById('closePlansBtn');
    const usageBadge = document.getElementById('usageBadge');
    const plansModal = document.getElementById('plansModal');

    const openPlans = () => {
        closeSidebar();
        renderPlanCards();
        if (plansModal) plansModal.showModal();
    };

    if (openPlansBtn) openPlansBtn.addEventListener('click', openPlans);
    if (usageBadge) usageBadge.addEventListener('click', openPlans);
    if (closePlansBtn) closePlansBtn.addEventListener('click', () => plansModal.close());

    // Settings Modal Controls
    const openSetBtn = document.getElementById('openSettingsBtn');
    const closeSetBtn = document.getElementById('closeSettingsBtn');
    const modelSelect = document.getElementById('modelSelect');
    const apiKeyInput = document.getElementById('apiKeyInput');

    if (openSetBtn) openSetBtn.addEventListener('click', () => {
        closeSidebar();
        // Populate the form with whatever is currently saved before showing it
        if (modelSelect) modelSelect.value = localStorage.getItem('preferred-model') || 'anthropic/claude-3.5-haiku';
        if (apiKeyInput) apiKeyInput.value = localStorage.getItem('api-key-override') || '';
        settingsModal.showModal();
    });
    if (closeSetBtn) closeSetBtn.addEventListener('click', () => settingsModal.close());

    const themeSelect = document.getElementById('themeSelect');
    if (themeSelect) {
        themeSelect.addEventListener('change', (e) => applyTheme(e.target.value));
    }

    if (modelSelect) {
        modelSelect.addEventListener('change', (e) => {
            localStorage.setItem('preferred-model', e.target.value);
            updateModelBadge();
        });
    }

    if (apiKeyInput) {
        apiKeyInput.addEventListener('change', (e) => {
            const key = e.target.value.trim();
            if (key) {
                localStorage.setItem('api-key-override', key);
            } else {
                localStorage.removeItem('api-key-override');
            }
        });
    }

    const exportDataBtn = document.getElementById('exportDataBtn');
    if (exportDataBtn) {
        exportDataBtn.addEventListener('click', async () => {
            const chats = await StorageDB.getAllChats();
            const blob = new Blob([JSON.stringify(chats, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `sarathi-ai-export-${Date.now()}.json`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        });
    }

    const clearDataBtn = document.getElementById('clearDataBtn');
    if (clearDataBtn) {
        clearDataBtn.addEventListener('click', async () => {
            const confirmed = window.confirm('Delete all saved chat history on this device? This cannot be undone.');
            if (!confirmed) return;
            const chats = await StorageDB.getAllChats();
            await Promise.all(chats.map(chat => StorageDB.deleteChat(chat.id)));
            currentChatId = null;
            currentMessages = [];
            messagesContainer.innerHTML = `
                <div class="welcome-screen" id="welcomeScreen">
                    ${SARATHI_SVG.replace('sarathi-icon', 'hero-mark').replace('width="20" height="20"', 'width="52" height="52"')}
                    <h2>Where shall we go today?</h2>
                </div>
            `;
            await loadHistoryUI();
            settingsModal.close();
        });
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

async function clearActiveDocumentSilently() {
    try { await fetch('/api/documents/clear', { method: 'POST' }); } catch (e) { /* ignore */ }
    renderActiveDocument(null);
}

async function createNewChat() {
    currentChatId = Date.now().toString();
    currentMessages = [];
    messagesContainer.innerHTML = `
        <div class="welcome-screen" id="welcomeScreen">
            ${SARATHI_SVG.replace('sarathi-icon', 'hero-mark').replace('width="20" height="20"', 'width="52" height="52"')}
            <h2>Where shall we go today?</h2>
        </div>
    `;
    // A document attached in a previous thread shouldn't silently leak into a new one
    await clearActiveDocumentSilently();
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

    // 2. Render Assistant Thinking Placeholder with the Sarathi wheel mark
    const botMsgNode = appendMessageUI('assistant', '<div class="thinking-state">' + SARATHI_SVG + ' <span>Thinking...</span></div>');
    const bubble = botMsgNode.querySelector('.message-bubble');

    let fullResponse = '';

    try {
        const response = await fetch('/api/chat/stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: currentMessages,
                images: currentReqImages,
                model: localStorage.getItem('preferred-model') || 'anthropic/claude-3.5-haiku',
                apiKeyOverride: localStorage.getItem('api-key-override') || ''
            })
        });

        if (!response.ok) {
            const errData = await response.json();
            if (errData.limitReached || errData.upgradeRequired) {
                bubble.innerHTML = `
                    <div class="upgrade-prompt">
                        <span>${errData.error}</span>
                        <button class="upgrade-btn" id="inlineUpgradeBtn">View Plans</button>
                    </div>
                `;
                const btn = bubble.querySelector('#inlineUpgradeBtn');
                if (btn) btn.addEventListener('click', () => {
                    renderPlanCards();
                    document.getElementById('plansModal').showModal();
                });
            } else {
                bubble.innerHTML = `<span style="color: var(--danger-color);">Error: ${errData.error || 'Server request failed.'}</span>`;
            }
            await fetchAndRenderPlan();
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
                            bubble.innerHTML = `<span style="color: var(--danger-color);">API Error: ${parsed.error}</span>`;
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
        bubble.innerHTML = `<span style="color: var(--danger-color);">Connection Error: Check server connection.</span>`;
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
        e.target.style.color = 'var(--accent-color)';
    });
    actionsBar.querySelector('.thumb-down-btn').addEventListener('click', (e) => {
        e.target.style.color = 'var(--danger-color)';
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
    // Past chats don't remember which document (if any) was attached at the time
    clearActiveDocumentSilently();
    loadHistoryUI();
}

function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}