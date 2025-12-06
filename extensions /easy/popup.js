// State
const state = {
    records: [],
    currentEmails: new Set(),
    currentPhones: new Set(),
    selection: ""
};

// DOM Elements Cache
let el = {};

// Patterns
const patterns = {
    email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    // Australian phone format + generic fallback
    phone: /(?:(?:\+?61|0)[2-478](?:[ -]?[0-9]){8})|(?:\+?61|0)4(?:[ -]?[0-9]){8}|(?:\(0[2-478]\)(?:[ -]?[0-9]){8})|\b\d{4}[ -]?\d{3}[ -]?\d{3}\b/g
};

// Filter out common UI elements and invalid data
const filterInvalid = {
    emails: (email) => {
        const lower = email.toLowerCase();
        const invalid = [
            'example.com', 'test.com', 'sample.com', 'placeholder.com',
            'your-email', 'email@', '@example', 'noreply', 'no-reply',
            'mailto:', 'http', 'www.', 'localhost'
        ];
        return !invalid.some(inv => lower.includes(inv)) && 
               email.length > 5 && 
               email.includes('@') && 
               email.split('@')[1] && 
               email.split('@')[1].includes('.');
    },
    phones: (phone) => {
        const digits = phone.replace(/\D/g, '');
        return digits.length >= 8 && 
               digits.length <= 15 && 
               !/^(\d)\1+$/.test(digits) && // Not all same digits
               !phone.includes('http') &&
               !phone.includes('www');
    }
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // 1. Cache Elements
    el = {
        pasteArea: document.getElementById('pasteArea'),
        floatMenu: document.getElementById('floatMenu'),
        recordsList: document.getElementById('recordsList'),
        emptyState: document.getElementById('emptyState'),
        countDisplay: document.getElementById('countDisplay'),
        toastContainer: document.getElementById('toastContainer'),
        resetBtn: document.getElementById('resetBtn'),
        exportBtn: document.getElementById('exportBtn'),
        clearInputsBtn: document.getElementById('clearInputsBtn'),
        addBtn: document.getElementById('addBtn'),
        assignNameBtn: document.getElementById('assignNameBtn'),
        inputs: { 
            first: document.getElementById('firstName'), 
            last: document.getElementById('lastName') 
        },
        lists: { 
            email: document.getElementById('emailList'), 
            phone: document.getElementById('phoneList') 
        },
        counts: { 
            email: document.getElementById('emailCount'), 
            phone: document.getElementById('phoneCount') 
        }
    };

    // 2. Load Data
    chrome.storage.local.get(['extractflow_records'], (result) => {
        if (result.extractflow_records) {
            state.records = result.extractflow_records;
            renderRecords();
        }
    });

    // 3. Attach Event Listeners
    setupEventListeners();

    // 4. Initial Render
    renderChips();
    updateStats();
});

function setupEventListeners() {
    // Button Clicks
    el.resetBtn.addEventListener('click', clearAll);
    el.exportBtn.addEventListener('click', downloadCSV);
    el.clearInputsBtn.addEventListener('click', clearInputs);
    el.addBtn.addEventListener('click', addRecord);
    el.assignNameBtn.addEventListener('click', assignName);

    // Text Input Handling
    el.pasteArea.addEventListener('paste', (e) => {
        e.preventDefault();
        const text = (e.clipboardData || window.clipboardData).getData('text');
        
        // Insert text manually to strip HTML formatting from clipboard
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        selection.deleteFromDocument();
        selection.getRangeAt(0).insertNode(document.createTextNode(text));
        selection.collapseToEnd();

        // Hide context menu if visible
        el.floatMenu.style.display = 'none';
        
        // Scan with a slight delay to allow DOM to update
        setTimeout(() => scanText(el.pasteArea.innerText), 50);
    });

    el.pasteArea.addEventListener('input', () => {
        el.floatMenu.style.display = 'none';
        scanText(el.pasteArea.innerText);
    });

    // Context Menu Logic
    document.addEventListener('mouseup', (e) => {
        // Ignore clicks on buttons or chips
        if (e.target.closest('button') || e.target.closest('.chip') || e.target.closest('.card-header')) {
            el.floatMenu.style.display = 'none';
            return;
        }
        
        const sel = window.getSelection();
        const text = sel.toString().trim();
        
        // Show menu if text selected inside pasteArea
        if (text.length > 2 && el.pasteArea.contains(sel.anchorNode) && !el.floatMenu.contains(e.target)) {
            state.selection = text;
            const range = sel.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            
            el.floatMenu.style.display = 'flex'; // Changed to flex to match CSS
            // Position safely within viewport
            const top = rect.top - 50;
            const left = rect.left + (rect.width / 2) - 80;
            
            el.floatMenu.style.top = `${Math.max(5, top)}px`;
            el.floatMenu.style.left = `${Math.max(5, Math.min(left, window.innerWidth - 170))}px`;
        } else if (!el.floatMenu.contains(e.target)) {
            el.floatMenu.style.display = 'none';
        }
    });

    // Hide context menu when clicking outside
    document.addEventListener('mousedown', (e) => {
        if (el.floatMenu && !el.floatMenu.contains(e.target)) {
            el.floatMenu.style.display = 'none';
        }
    });

    // Event Delegation for Delete Buttons in the dynamic list
    el.recordsList.addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('.delete-btn');
        if (deleteBtn) {
            const id = parseInt(deleteBtn.dataset.id);
            deleteRec(id);
        }
    });
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        info: 'fa-info-circle'
    };
    
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <i class="fa-solid ${icons[type] || icons.success} toast-icon"></i>
        <span class="toast-message">${message}</span>
    `;
    
    el.toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function scanText(text) {
    if (!text) return;
    
    let cleanText = text
        .replace(/https?:\/\/[^\s]+/gi, ' ') 
        .replace(/www\.[^\s]+/gi, ' ') 
        .replace(/mailto:[^\s]+/gi, ' ')
        // Remove common UI words to prevent false positives in names
        .replace(/\b(CLICK|BUTTON|MENU|NAV|COPY|PASTE|EDIT|DELETE|SAVE|CANCEL)\b/gi, ' '); 
    
    const emails = cleanText.match(patterns.email) || [];
    const phones = cleanText.match(patterns.phone) || [];
    let added = 0;
    
    emails.forEach(e => {
        const trimmed = e.trim().toLowerCase();
        if (filterInvalid.emails(trimmed) && !state.currentEmails.has(trimmed)) {
            state.currentEmails.add(trimmed);
            added++;
        }
    });
    
    phones.forEach(p => {
        const clean = p.trim();
        if (filterInvalid.phones(clean) && !state.currentPhones.has(clean)) {
            state.currentPhones.add(clean);
            added++;
        }
    });
    
    if (added > 0) {
        renderChips();
        updateStats();
        const total = state.currentEmails.size + state.currentPhones.size;
        showToast(`Found new data. Total: ${total}`, 'info');
    }
}

function updateStats() {
    el.counts.email.innerText = state.currentEmails.size;
    el.counts.phone.innerText = state.currentPhones.size;
}

function assignName() {
    const parts = state.selection.split(' ');
    el.inputs.first.value = parts[0] || '';
    el.inputs.last.value = parts.slice(1).join(' ') || '';
    el.floatMenu.style.display = 'none';
    window.getSelection().removeAllRanges();
    el.inputs.first.focus();
    showToast('Name assigned', 'success');
}

function renderChips() {
    renderList(el.lists.email, state.currentEmails, 'chip-email');
    renderList(el.lists.phone, state.currentPhones, 'chip-phone');
}

function renderList(container, set, chipClass) {
    container.innerHTML = '';
    
    set.forEach(item => {
        const chip = document.createElement('div');
        chip.className = `chip ${chipClass}`;
        
        const span = document.createElement('span');
        span.textContent = item;
        
        const icon = document.createElement('i');
        icon.className = "fa-solid fa-xmark chip-remove";
        
        // Individual chip removal
        chip.addEventListener('click', (e) => {
            e.stopPropagation();
            set.delete(item);
            renderChips();
            updateStats();
        });
        chip.appendChild(span);
        chip.appendChild(icon);
        container.appendChild(chip);
    });
}

function addRecord() {
    const f = el.inputs.first ? el.inputs.first.value.trim() : '';
    const l = el.inputs.last ? el.inputs.last.value.trim() : '';
    const emails = Array.from(state.currentEmails);
    const phones = Array.from(state.currentPhones);
    
    if (emails.length === 0 && phones.length === 0) {
        showToast('Add at least one email or phone number', 'error');
        return;
    }
    
    const newRecord = {
        id: Date.now(),
        f: f,
        l: l,
        emails: [...emails],
        phones: [...phones]
    };
    
    state.records.push(newRecord);
    renderRecords();
    
    chrome.storage.local.set({ extractflow_records: state.records }, () => {
        if (chrome.runtime.lastError) {
            console.error(chrome.runtime.lastError);
            showToast('Error saving', 'error');
        } else {
            clearInputs();
            showToast('Record saved', 'success');
        }
    });
}

function renderRecords() {
    el.recordsList.innerHTML = '';
    const count = state.records.length;
    
    el.countDisplay.innerText = count;
    el.emptyState.style.display = count ? 'none' : 'flex';
    
    if (count === 0) return;
    
    // Newest first
    const reversedRecords = [...state.records].reverse();
    
    reversedRecords.forEach((r, index) => {
        const record = document.createElement('div');
        record.className = 'record-item';
        record.style.animationDelay = `${index * 0.05}s`;
        
        // Escape HTML to prevent XSS
        const escape = (str) => str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
        
        const eChips = (r.emails || []).map(e => 
            `<span class="record-chip record-chip-email">${escape(e)}</span>`
        ).join('');
        
        const pChips = (r.phones || []).map(p => 
            `<span class="record-chip record-chip-phone">${escape(p)}</span>`
        ).join('');
        
        const name = (r.f || r.l) ? `${escape(r.f)} ${escape(r.l)}` : 'Unknown Contact';
        
        // Note: onclick is removed. We use class="delete-btn" and data-id
        record.innerHTML = `
            <div class="record-header">
                <div style="flex: 1;">
                    <div class="record-name">${name}</div>
                    <div class="record-chips">
                        ${eChips} ${pChips}
                    </div>
                </div>
                <button class="btn btn-secondary btn-icon delete-btn" data-id="${r.id}" style="width: 24px; height: 24px; padding: 0;" title="Delete">
                    <i class="fa-solid fa-trash" style="font-size: 11px; pointer-events: none;"></i>
                </button>
            </div>
        `;
        
        el.recordsList.appendChild(record);
    });
}

function deleteRec(id) {
    state.records = state.records.filter(r => r.id !== id);
    renderRecords();
    chrome.storage.local.set({ extractflow_records: state.records });
    showToast('Record deleted', 'info');
}

function clearInputs() {
    el.inputs.first.value = '';
    el.inputs.last.value = '';
    state.currentEmails.clear();
    state.currentPhones.clear();
    renderChips();
    updateStats();
}

function clearAll() {
    // Custom modal could be better, but confirm is native and safe in popup
    // Note: Chrome extensions usually allow confirm(), but custom UI is better.
    // Since we are in a popup, simple is good.
    state.records = [];
    state.currentEmails.clear();
    state.currentPhones.clear();
    renderRecords();
    clearInputs();
    el.pasteArea.innerText = '';
    chrome.storage.local.remove('extractflow_records', () => {
        showToast('All data cleared', 'info');
    });
}

function downloadCSV() {
    if (!state.records.length) {
        showToast('No records to export', 'error');
        return;
    }
    
    const csvHeader = 'First Name,Last Name,Emails,Phones\n';
    const csvRows = state.records.map(r => {
        // Handle commas in content by wrapping in quotes
        const safe = (str) => `"${(str || '').replace(/"/g, '""')}"`;
        return `${safe(r.f)},${safe(r.l)},${safe(r.emails.join('; '))},${safe(r.phones.join('; '))}`;
    }).join('\n');
    
    const blob = new Blob([csvHeader + csvRows], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `extractflow_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('CSV exported', 'success');
}
