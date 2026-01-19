// Common shared state, patterns, and helper functions for COPY extension

// Shared state object - accessible by all tools
const state = {
    records: [],
    currentEmails: new Set(),
    currentPhones: new Set(),
    selection: "",
    templates: [],
    currentTemplateId: null,
    campaignActive: false,
    campaignIndex: 0,
    emailClient: 'default',
    mergeAction: null, // 'update', 'duplicate', or 'ask'
    notes: []
};

// Shared element references
let el = {};

// Patterns for extraction
const patterns = {
    email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    phone: /(?:(?:\\+?61|0)[2-478](?:[ -]?[0-9]){8})|(?:\\+?61|0)4(?:[ -]?[0-9]){8}|(?:\\(0[2-478]\\)(?:[ -]?[0-9]){8})|\\b\\d{4}[ -]?\\d{3}[ -]?\\d{3}\\b/g
};

// Validation filters
const filterInvalid = {
    emails: (email) => {
        const lower = email.toLowerCase();
        const invalid = ['example.com', 'test.com', 'placeholder.com', 'noreply', 'mailto:', 'http'];
        return !invalid.some(inv => lower.includes(inv)) && email.includes('.') && email.includes('@');
    },
    phones: (phone) => {
        const digits = phone.replace(/\\D/g, '');
        return digits.length >= 8 && digits.length <= 15 && new Set(digits).size > 2;
    }
};

// Helper functions
function getElementByIdOrLog(id) {
    const element = document.getElementById(id);
    if (!element) {
        console.error(`Element with ID '${id}' not found.`);
    }
    return element;
}

function safelyOn(el, event, handler) {
  if (el) el.addEventListener(event, handler);
}

function isRestrictedURL(url) {
    return url.startsWith('chrome://') || url.startsWith('chrome-extension://');
}

function sanitizeInput(str) {
    return str.replace(/[<>]/g, "").trim(); // Simple XSS prevention
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Toast notification system
function showToast(m, t = 'success') {
    if (!el.toastContainer) return;
    const d = document.createElement('div');
    d.className = `toast toast-${t}`;
    // Handle multi-line messages
    if (m.includes('\n')) {
        d.style.whiteSpace = 'pre-line';
        d.style.maxWidth = '300px';
        d.style.fontSize = '11px';
        d.style.lineHeight = '1.4';
    }
    d.innerText = m;
    el.toastContainer.appendChild(d);
    // Longer timeout for detailed messages
    const timeout = m.includes('\n') ? 5000 : 2500;
    setTimeout(() => d.remove(), timeout);
}

// Tab switching
function switchTab(id) {
    if (!el.tabButtons) return;
    el.tabButtons.forEach(b => b.classList.toggle('active', b.dataset.tab === id));
    if (el.extractTab) el.extractTab.classList.toggle('active', id === 'extract');
    if (el.automationTab) el.automationTab.classList.toggle('active', id === 'automation');
    if (el.calendarTab) el.calendarTab.classList.toggle('active', id === 'calendar');
    if (el.notesTab) {
        el.notesTab.classList.toggle('active', id === 'notes');
    }
}

// Helper to get records with emails
function getRecordsWithEmails() { 
    return state.records.filter(r => r.emails?.length > 0); 
}

