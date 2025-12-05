// State
const state = {
    records: [],
    currentEmails: new Set(),
    currentPhones: new Set(),
    selection: ""
};

// DOM Elements
const el = {
    pasteArea: document.getElementById('pasteArea'),
    floatMenu: document.getElementById('floatMenu'),
    recordsList: document.getElementById('recordsList'),
    emptyState: document.getElementById('emptyState'),
    countSpan: document.getElementById('count'),
    countDisplay: document.getElementById('countDisplay'),
    toastContainer: document.getElementById('toastContainer'),
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

// Patterns
const patterns = {
    email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    phone: /(?:(?:\+?61|0)[2-478](?:[ -]?[0-9]){8})|(?:\+?61|0)4(?:[ -]?[0-9]){8}|(?:\(0[2-478]\)(?:[ -]?[0-9]){8})|\b\d{4}[ -]?\d{3}[ -]?\d{3}\b/g
};

// Filter out common UI elements and invalid data
const filterInvalid = {
    emails: (email) => {
        const lower = email.toLowerCase();
        // Filter out common UI/placeholder emails
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
        // Remove all non-digits for validation
        const digits = phone.replace(/\D/g, '');
        // Must be between 8-15 digits and not all same number
        return digits.length >= 8 && 
               digits.length <= 15 && 
               !/^(\d)\1+$/.test(digits) &&
               !phone.includes('http') &&
               !phone.includes('www');
    }
};

// Toast Notification
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
    setTimeout(() => toast.remove(), 3000);
}

// Load saved data
chrome.storage.local.get(['extractflow_records'], (result) => {
    if (result.extractflow_records) {
        state.records = result.extractflow_records;
        renderRecords();
    }
});

// Load Sample Data
function loadSampleData() {
    const sample = `INVOICE #001
To: Elon Musk
Contact: elon@mars.x
Phone: 0499 123 456

INVOICE #002
To: Jeff Bezos
Email: jeff@amazon.prime
Direct: (02) 9911 2233`;
    
    el.pasteArea.innerText = sample;
    scanText(sample);
    showToast('Sample data loaded', 'info');
}

// Event Listeners
el.pasteArea.addEventListener('paste', (e) => {
    const text = (e.clipboardData || window.clipboardData).getData('text');
    setTimeout(() => scanText(el.pasteArea.innerText), 50);
});

el.pasteArea.addEventListener('input', () => {
    scanText(el.pasteArea.innerText);
});

// Scan Text
function scanText(text) {
    if (!text) return;
    
    // Clean text - remove common UI elements and noise
    let cleanText = text
        .replace(/https?:\/\/[^\s]+/gi, ' ') // Remove URLs
        .replace(/www\.[^\s]+/gi, ' ') // Remove www links
        .replace(/mailto:[^\s]+/gi, ' ') // Remove mailto links
        .replace(/[A-Z]{3,}\s+[A-Z]{3,}/g, ' ') // Remove multiple all-caps words (UI labels)
        .replace(/\b(CLICK|BUTTON|MENU|NAV|SEARCH|FILTER|SORT|EXPORT|IMPORT|DELETE|EDIT|SAVE|CANCEL|SUBMIT|RESET|CLEAR|ADD|REMOVE|UPDATE|CREATE|VIEW|DETAILS|SHOW|HIDE|TOGGLE|NEXT|PREVIOUS|BACK|FORWARD|HOME|ABOUT|CONTACT|HELP|SUPPORT|SETTINGS|PROFILE|ACCOUNT|LOGOUT|DASHBOARD|PAGE|TAB|PANEL|MODAL|POPUP|DROPDOWN|SELECT|OPTION|INPUT|TEXTAREA|FORM|LABEL|PLACEHOLDER|ERROR|SUCCESS|WARNING|INFO|NOTIFICATION|ALERT|MESSAGE|TITLE|SUBTITLE|HEADING|DESCRIPTION|CONTENT|BODY|DIV|SPAN|IMG|A|BUTTON|NAV|HEADER|FOOTER|SECTION|ARTICLE|ASIDE|MAIN)\b/gi, ' ') // Remove common UI terms
        .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, ' ') // Remove IP addresses
        .replace(/\b\d{4,5}\b/g, ' '); // Remove standalone 4-5 digit numbers (likely not phones)
    
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
        const emailCount = state.currentEmails.size;
        const phoneCount = state.currentPhones.size;
        if (emailCount > 0 || phoneCount > 0) {
            showToast(`Found ${emailCount} email${emailCount !== 1 ? 's' : ''}, ${phoneCount} phone${phoneCount !== 1 ? 's' : ''}`, 'info');
        }
    }
}

// Update Stats
function updateStats() {
    el.counts.email.innerText = state.currentEmails.size;
    el.counts.phone.innerText = state.currentPhones.size;
}

// Context Menu
document.addEventListener('mouseup', (e) => {
    const sel = window.getSelection();
    const text = sel.toString().trim();
    
    if (text.length > 0 && el.pasteArea.contains(sel.anchorNode)) {
        state.selection = text;
        const rect = sel.getRangeAt(0).getBoundingClientRect();
        el.floatMenu.style.display = 'block';
        el.floatMenu.style.left = `${rect.left + (rect.width / 2) - 80}px`;
        el.floatMenu.style.top = `${rect.top - 50}px`;
    } else if (!el.floatMenu.contains(e.target)) {
        el.floatMenu.style.display = 'none';
    }
});

// Assign Name
function assignName() {
    const parts = state.selection.split(' ');
    el.inputs.first.value = parts[0] || '';
    el.inputs.last.value = parts.slice(1).join(' ') || '';
    el.floatMenu.style.display = 'none';
    window.getSelection().removeAllRanges();
    el.inputs.first.focus();
    showToast('Name assigned', 'success');
}

// Render Chips
function renderChips() {
    renderList(el.lists.email, state.currentEmails, 'chip-email');
    renderList(el.lists.phone, state.currentPhones, 'chip-phone');
}

function renderList(container, set, chipClass) {
    container.innerHTML = '';
    
    if (set.size === 0) {
        container.innerHTML = '<span class="empty-state">No data...</span>';
        return;
    }
    
    set.forEach(item => {
        const chip = document.createElement('div');
        chip.className = `chip ${chipClass}`;
        chip.innerHTML = `
            <span>${item}</span>
            <i class="fa-solid fa-xmark chip-remove"></i>
        `;
        
        chip.onclick = (e) => {
            e.stopPropagation();
            set.delete(item);
            renderChips();
            updateStats();
            showToast('Removed', 'info');
        };
        
        container.appendChild(chip);
    });
}

// Add Record
function addRecord() {
    const f = el.inputs.first.value.trim();
    const l = el.inputs.last.value.trim();
    
    if (!f && state.currentEmails.size === 0 && state.currentPhones.size === 0) {
        showToast('Add at least one field', 'error');
        return;
    }
    
    // Button animation
    const btn = document.getElementById('addBtn');
    btn.style.transform = 'scale(0.95)';
    setTimeout(() => btn.style.transform = '', 150);
    
    state.records.push({
        id: Date.now(),
        f,
        l,
        emails: Array.from(state.currentEmails),
        phones: Array.from(state.currentPhones)
    });
    
    renderRecords();
    clearInputs();
    chrome.storage.local.set({ extractflow_records: state.records });
    showToast('Record added', 'success');
}

// Render Records
function renderRecords() {
    el.recordsList.innerHTML = '';
    const count = state.records.length;
    
    el.countSpan.innerText = count;
    el.countDisplay.innerText = count;
    el.emptyState.style.display = count ? 'none' : 'flex';
    
    if (count === 0) return;
    
    state.records.forEach((r, index) => {
        const record = document.createElement('div');
        record.className = 'record-item';
        record.style.animationDelay = `${index * 0.03}s`;
        
        const eChips = r.emails.map(e => 
            `<span class="record-chip record-chip-email">${e}</span>`
        ).join('');
        
        const pChips = r.phones.map(p => 
            `<span class="record-chip record-chip-phone">${p}</span>`
        ).join('');
        
        record.innerHTML = `
            <div class="record-header">
                <div>
                    <div class="record-name">${r.f || 'Unknown'} ${r.l || ''}</div>
                    <div class="record-chips">
                        ${eChips} ${pChips}
                    </div>
                </div>
                <button onclick="deleteRec(${r.id})" class="btn btn-secondary btn-icon" style="width: 24px; height: 24px; padding: 0;" title="Delete">
                    <i class="fa-solid fa-trash" style="font-size: 11px;"></i>
                </button>
            </div>
        `;
        
        el.recordsList.appendChild(record);
    });
}

// Delete Record
function deleteRec(id) {
    state.records = state.records.filter(r => r.id !== id);
    renderRecords();
    chrome.storage.local.set({ extractflow_records: state.records });
    showToast('Record deleted', 'info');
}

// Clear Inputs
function clearInputs() {
    el.inputs.first.value = '';
    el.inputs.last.value = '';
    state.currentEmails.clear();
    state.currentPhones.clear();
    renderChips();
    updateStats();
}

// Clear All
function clearAll() {
    if (confirm("Clear all data? This cannot be undone.")) {
        state.records = [];
        renderRecords();
        clearInputs();
        el.pasteArea.innerText = '';
        chrome.storage.local.remove('extractflow_records');
        showToast('All data cleared', 'info');
    }
}

// Download CSV
function downloadCSV() {
    if (!state.records.length) {
        showToast('No records to export', 'error');
        return;
    }
    
    const csv = [
        'First Name,Last Name,Emails,Phones',
        ...state.records.map(r => 
            `"${r.f}","${r.l}","${r.emails.join('; ')}","${r.phones.join('; ')}"`
        )
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `extractflow_${Date.now()}.csv`;
    link.click();
    showToast('CSV exported', 'success');
}
