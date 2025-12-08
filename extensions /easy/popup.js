// State
const state = {
    records: [],
    currentEmails: new Set(),
    currentPhones: new Set(),
    selection: "",
    // Automation state
    templates: [],
    currentTemplateId: null,
    campaignActive: false,
    campaignIndex: 0,
    emailClient: 'default' // 'default' or 'gmail'
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
        },
        // Automation elements
        tabButtons: document.querySelectorAll('.tab-btn'),
        extractTab: document.getElementById('extractTab'),
        automationTab: document.getElementById('automationTab'),
        templateSelect: document.getElementById('templateSelect'),
        editTemplateBtn: document.getElementById('editTemplateBtn'),
        templateEditor: document.getElementById('templateEditor'),
        closeEditorBtn: document.getElementById('closeEditorBtn'),
        templateName: document.getElementById('templateName'),
        templateSubject: document.getElementById('templateSubject'),
        templateBody: document.getElementById('templateBody'),
        saveTemplateBtn: document.getElementById('saveTemplateBtn'),
        newTemplateBtn: document.getElementById('newTemplateBtn'),
        startCampaignBtn: document.getElementById('startCampaignBtn'),
        progressBar: document.getElementById('progressBar'),
        progressFill: document.getElementById('progressFill'),
        currentContactCard: document.getElementById('currentContactCard'),
        campaignEmptyState: document.getElementById('campaignEmptyState'),
        currentContactName: document.getElementById('currentContactName'),
        currentContactEmail: document.getElementById('currentContactEmail'),
        currentContactStatus: document.getElementById('currentContactStatus'),
        previewBody: document.getElementById('previewBody'),
        openEmailLink: document.getElementById('openEmailLink'),
        skipContactBtn: document.getElementById('skipContactBtn'),
        campaignStatus: document.getElementById('campaignStatus'),
        headerActions: document.getElementById('headerActions'),
        csvImportInput: document.getElementById('csvImportInput'),
        csvImportStatus: document.getElementById('csvImportStatus'),
        csvExportBtn: document.getElementById('csvExportBtn'),
        emailClientSelect: document.getElementById('emailClientSelect')
    };

    // 2. Load Data
    chrome.storage.local.get(['extractflow_records', 'extractflow_templates', 'extractflow_emailClient', 'extractflow_campaignState'], (result) => {
        if (result.extractflow_records) {
            state.records = result.extractflow_records;
            renderRecords();
        }
        if (result.extractflow_templates) {
            state.templates = result.extractflow_templates;
        } else {
            // Default template
            state.templates = [{
                id: Date.now(),
                name: 'Default Template',
                subject: 'Hello {name}',
                body: `Hi {name},

I noticed your work at {company} and I'd love to connect.

Best regards`
            }];
            saveTemplates();
        }
        if (result.extractflow_emailClient) {
            state.emailClient = result.extractflow_emailClient;
        }
        // Restore campaign state
        if (result.extractflow_campaignState) {
            const campaignState = result.extractflow_campaignState;
            state.campaignActive = campaignState.active || false;
            state.campaignIndex = campaignState.index || 0;
            state.currentTemplateId = campaignState.templateId || null;
            
            // Restore campaign UI if active
            if (state.campaignActive) {
                restoreCampaignUI();
            }
        }
        // Set email client select value
        if (el.emailClientSelect) {
            el.emailClientSelect.value = state.emailClient || 'default';
        }
        renderTemplates();
        // Update button text on load
        setTimeout(() => updateEmailButtonText(), 100);
    });

    // 3. Attach Event Listeners
    setupEventListeners();
    setupAutomationListeners();

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

// ==================== AUTOMATION FUNCTIONS ====================

function setupAutomationListeners() {
    // Tab switching
    el.tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;
            switchTab(tabId);
        });
    });

    // Template management
    el.editTemplateBtn?.addEventListener('click', () => {
        const selectedId = el.templateSelect.value;
        if (selectedId) {
            const template = state.templates.find(t => t.id == selectedId);
            if (template) {
                state.currentTemplateId = parseInt(selectedId);
                el.templateName.value = template.name;
                el.templateSubject.value = template.subject;
                el.templateBody.value = template.body;
                el.templateEditor.style.display = 'block';
            }
        } else {
            showToast('Please select a template first', 'error');
        }
    });

    el.closeEditorBtn?.addEventListener('click', () => {
        el.templateEditor.style.display = 'none';
    });

    el.saveTemplateBtn?.addEventListener('click', saveTemplate);
    el.newTemplateBtn?.addEventListener('click', () => {
        state.currentTemplateId = null;
        el.templateName.value = '';
        el.templateSubject.value = '';
        el.templateBody.value = '';
        el.templateEditor.style.display = 'block';
    });

    // Campaign
    el.startCampaignBtn?.addEventListener('click', startCampaign);
    el.skipContactBtn?.addEventListener('click', skipContact);
    el.openEmailLink?.addEventListener('click', (e) => {
        // Mark current contact as sent
        const recordsWithEmails = getRecordsWithEmails();
        if (state.campaignIndex < recordsWithEmails.length) {
            const contact = recordsWithEmails[state.campaignIndex];
            const recordIndex = state.records.findIndex(r => r.id === contact.id);
            if (recordIndex >= 0) {
                state.records[recordIndex].status = 'Sent';
                state.records[recordIndex].lastSent = new Date().toISOString();
                chrome.storage.local.set({ extractflow_records: state.records });
            }
        }
        
        // Move to next contact BEFORE opening email (so state is saved)
        state.campaignIndex++;
        const recordsWithEmailsAfter = getRecordsWithEmails();
        
        if (state.campaignIndex >= recordsWithEmailsAfter.length) {
            // Campaign will end, but save state first
            state.campaignActive = false;
            chrome.storage.local.remove('extractflow_campaignState');
        } else {
            // Save updated campaign state
            saveCampaignState();
        }
        
        // Let the link open - popup will close but state is saved
        // When user reopens popup, it will continue from next contact
    });

    el.templateSelect?.addEventListener('change', () => {
        if (state.campaignActive) {
            updateCampaignPreview();
        }
    });

    // CSV Import
    el.csvImportInput?.addEventListener('change', handleCSVImport);
    
    // CSV Export
    el.csvExportBtn?.addEventListener('click', exportCSV);
    
    // Email Client Selection
    el.emailClientSelect?.addEventListener('change', (e) => {
        state.emailClient = e.target.value;
        chrome.storage.local.set({ extractflow_emailClient: state.emailClient }, () => {
            showToast(`Email client set to ${state.emailClient === 'gmail' ? 'Gmail' : 'Apple Mail'}`, 'success');
            // Update campaign button text if campaign is active
            if (state.campaignActive && el.openEmailLink) {
                updateEmailButtonText();
            }
        });
    });
}

function updateEmailButtonText() {
    if (!el.openEmailLink) return;
    const clientName = state.emailClient === 'gmail' ? 'Gmail' : 'Email';
    const icon = el.openEmailLink.querySelector('i');
    const span = el.openEmailLink.querySelector('span');
    if (span) {
        span.textContent = `Open ${clientName} & Next`;
    }
    // Update the button text on initial load too
    if (el.openEmailLink && !state.campaignActive) {
        const currentSpan = el.openEmailLink.querySelector('span');
        if (currentSpan && currentSpan.textContent.includes('Email')) {
            currentSpan.textContent = `Open ${clientName} & Next`;
        }
    }
}

function handleCSVImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const csvText = e.target.result;
            const imported = parseCSV(csvText);
            
            if (imported.length === 0) {
                showCSVStatus('No valid contacts found in CSV', 'error');
                return;
            }

            // Add imported contacts to records
            const newRecords = imported.map(contact => ({
                id: Date.now() + Math.random(),
                f: contact.firstName || '',
                l: contact.lastName || '',
                emails: contact.email ? [contact.email] : [],
                phones: contact.phone ? [contact.phone] : [],
                company: contact.company || '',
                status: 'New'
            }));

            state.records = [...state.records, ...newRecords];
            chrome.storage.local.set({ extractflow_records: state.records }, () => {
                renderRecords();
                showCSVStatus(`Successfully imported ${newRecords.length} contact(s)`, 'success');
                showToast(`Imported ${newRecords.length} contact(s)`, 'success');
            });
        } catch (error) {
            console.error('CSV import error:', error);
            showCSVStatus('Error parsing CSV file', 'error');
            showToast('Error importing CSV', 'error');
        }
    };
    reader.readAsText(file);
    
    // Reset input
    event.target.value = '';
}

function parseCSV(csvText) {
    const lines = csvText.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    // Parse header
    const header = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]+/g, ''));
    
    // Find column indices
    const emailIndex = header.findIndex(h => h.includes('email') || h.includes('mail'));
    const firstNameIndex = header.findIndex(h => h.includes('first') || h === 'name' || h === 'f');
    const lastNameIndex = header.findIndex(h => h.includes('last') || h === 'l');
    const companyIndex = header.findIndex(h => h.includes('company') || h.includes('org') || h.includes('organization'));
    const phoneIndex = header.findIndex(h => h.includes('phone') || h.includes('mobile') || h.includes('tel'));

    if (emailIndex === -1) {
        throw new Error('No email column found in CSV');
    }

    // Parse data rows
    const contacts = [];
    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        if (values.length === 0) continue;

        const email = values[emailIndex]?.trim().replace(/['"]+/g, '');
        if (!email || !email.includes('@')) continue;

        const contact = {
            email: email,
            firstName: firstNameIndex >= 0 ? (values[firstNameIndex]?.trim().replace(/['"]+/g, '') || '') : '',
            lastName: lastNameIndex >= 0 ? (values[lastNameIndex]?.trim().replace(/['"]+/g, '') || '') : '',
            company: companyIndex >= 0 ? (values[companyIndex]?.trim().replace(/['"]+/g, '') || '') : '',
            phone: phoneIndex >= 0 ? (values[phoneIndex]?.trim().replace(/['"]+/g, '') || '') : ''
        };

        // If no separate first/last name, try to split the name field
        if (!contact.firstName && !contact.lastName && firstNameIndex >= 0) {
            const name = values[firstNameIndex]?.trim().replace(/['"]+/g, '') || '';
            if (name) {
                const nameParts = name.split(' ');
                contact.firstName = nameParts[0] || '';
                contact.lastName = nameParts.slice(1).join(' ') || '';
            }
        }

        contacts.push(contact);
    }

    return contacts;
}

function parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            values.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    values.push(current); // Add last value

    return values;
}

function showCSVStatus(message, type) {
    if (!el.csvImportStatus) return;
    
    el.csvImportStatus.textContent = message;
    el.csvImportStatus.style.display = 'block';
    el.csvImportStatus.style.color = type === 'success' ? 'var(--success)' : 'var(--danger)';
    
    setTimeout(() => {
        el.csvImportStatus.style.display = 'none';
    }, 5000);
}

function exportCSV() {
    if (!state.records.length) {
        showToast('No contacts to export', 'error');
        showCSVStatus('No contacts to export', 'error');
        return;
    }
    
    // Enhanced CSV format with all fields
    const csvHeader = 'First Name,Last Name,Email,Company,Phone,Status,Last Sent\n';
    const csvRows = state.records.map(r => {
        const safe = (str) => `"${(str || '').replace(/"/g, '""')}"`;
        const email = (r.emails && r.emails.length > 0) ? r.emails[0] : '';
        const phone = (r.phones && r.phones.length > 0) ? r.phones[0] : '';
        const status = r.status || 'New';
        const lastSent = r.lastSent ? new Date(r.lastSent).toLocaleDateString() : '';
        
        return `${safe(r.f)},${safe(r.l)},${safe(email)},${safe(r.company || '')},${safe(phone)},${safe(status)},${safe(lastSent)}`;
    }).join('\n');
    
    const blob = new Blob([csvHeader + csvRows], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `extractflow_contacts_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast(`Exported ${state.records.length} contact(s)`, 'success');
    showCSVStatus(`Exported ${state.records.length} contact(s)`, 'success');
}

function switchTab(tabId) {
    // Update tab buttons
    el.tabButtons.forEach(btn => {
        if (btn.dataset.tab === tabId) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Update tab content
    if (tabId === 'extract') {
        el.extractTab.classList.add('active');
        el.automationTab.classList.remove('active');
        el.headerActions.style.display = 'flex';
    } else if (tabId === 'automation') {
        el.extractTab.classList.remove('active');
        el.automationTab.classList.add('active');
        el.headerActions.style.display = 'none';
        renderTemplates();
        // Restore campaign UI if active
        if (state.campaignActive) {
            restoreCampaignUI();
        }
    }
}

function renderTemplates() {
    if (!el.templateSelect) return;
    
    el.templateSelect.innerHTML = '';
    if (state.templates.length === 0) {
        el.templateSelect.innerHTML = '<option value="">No templates</option>';
        return;
    }

    state.templates.forEach(t => {
        const option = document.createElement('option');
        option.value = t.id;
        option.textContent = t.name;
        el.templateSelect.appendChild(option);
    });

    if (state.currentTemplateId) {
        el.templateSelect.value = state.currentTemplateId;
    } else if (state.templates.length > 0) {
        el.templateSelect.value = state.templates[0].id;
        state.currentTemplateId = state.templates[0].id;
    }
}

function saveTemplate() {
    const name = el.templateName.value.trim();
    const subject = el.templateSubject.value.trim();
    const body = el.templateBody.value.trim();

    if (!name || !subject || !body) {
        showToast('Please fill all fields', 'error');
        return;
    }

    const template = {
        id: state.currentTemplateId || Date.now(),
        name,
        subject,
        body
    };

    if (state.currentTemplateId) {
        // Update existing
        const index = state.templates.findIndex(t => t.id == state.currentTemplateId);
        if (index >= 0) {
            state.templates[index] = template;
        }
    } else {
        // Add new
        state.templates.push(template);
        state.currentTemplateId = template.id;
    }

    saveTemplates();
    renderTemplates();
    el.templateEditor.style.display = 'none';
    showToast('Template saved', 'success');
}

function saveTemplates() {
    chrome.storage.local.set({ extractflow_templates: state.templates });
}

function startCampaign() {
    // Filter records that have emails
    const recordsWithEmails = state.records.filter(r => r.emails && r.emails.length > 0);
    
    if (recordsWithEmails.length === 0) {
        showToast('No contacts with email addresses', 'error');
        return;
    }

    if (!el.templateSelect.value) {
        showToast('Please select a template', 'error');
        return;
    }

    state.campaignActive = true;
    state.campaignIndex = 0;
    state.currentTemplateId = parseInt(el.templateSelect.value);

    saveCampaignState();
    restoreCampaignUI();
    updateCampaignPreview();
    showToast(`Campaign started with ${recordsWithEmails.length} contacts`, 'success');
}

function restoreCampaignUI() {
    if (!state.campaignActive) return;
    
    // Check if campaign should actually end
    const recordsWithEmails = getRecordsWithEmails();
    if (state.campaignIndex >= recordsWithEmails.length) {
        // Campaign is complete
        endCampaign();
        return;
    }
    
    el.startCampaignBtn.style.display = 'none';
    el.progressBar.style.display = 'block';
    el.currentContactCard.style.display = 'block';
    el.campaignEmptyState.style.display = 'none';
    
    // Set template select if we have a saved template
    if (state.currentTemplateId && el.templateSelect) {
        el.templateSelect.value = state.currentTemplateId;
    }
    
    // Update preview to show current contact
    updateCampaignPreview();
}

function saveCampaignState() {
    chrome.storage.local.set({
        extractflow_campaignState: {
            active: state.campaignActive,
            index: state.campaignIndex,
            templateId: state.currentTemplateId
        }
    });
}

function updateCampaignPreview() {
    if (!state.campaignActive) return;

    const recordsWithEmails = getRecordsWithEmails();
    if (recordsWithEmails.length === 0) {
        endCampaign();
        return;
    }

    const contact = getCurrentContact();
    if (!contact) {
        endCampaign();
        return;
    }

    const template = state.templates.find(t => t.id == state.currentTemplateId);
    if (!template) {
        showToast('Template not found', 'error');
        endCampaign();
        return;
    }

    // Update contact info
    const name = `${contact.f || ''} ${contact.l || ''}`.trim() || 'Unknown';
    const email = contact.emails && contact.emails.length > 0 ? contact.emails[0] : 'No email';
    
    if (!el.currentContactName || !el.currentContactEmail) return;
    
    el.currentContactName.textContent = name;
    el.currentContactEmail.textContent = email;
    if (el.currentContactStatus) {
        el.currentContactStatus.textContent = contact.status || 'New';
        el.currentContactStatus.className = `status-badge ${contact.status === 'Sent' ? 'sent' : 'new'}`;
    }

    // Generate preview
    const previewSubject = template.subject
        .replace(/{name}/g, name)
        .replace(/{company}/g, contact.company || 'Their Company');
    
    const previewBody = template.body
        .replace(/{name}/g, name)
        .replace(/{company}/g, contact.company || 'Their Company');

    if (el.previewBody) {
        el.previewBody.textContent = `Subject: ${previewSubject}\n\n${previewBody}`;
    }

    // Generate mailto link
    const mailtoLink = generateMailtoLink(contact, template);
    if (el.openEmailLink) {
        el.openEmailLink.href = mailtoLink;
        if (!email || email === 'No email') {
            el.openEmailLink.style.opacity = '0.5';
            el.openEmailLink.style.pointerEvents = 'none';
        } else {
            el.openEmailLink.style.opacity = '1';
            el.openEmailLink.style.pointerEvents = 'auto';
        }
        updateEmailButtonText();
    }

    // Update progress
    const progress = ((state.campaignIndex + 1) / recordsWithEmails.length) * 100;
    if (el.progressFill) {
        el.progressFill.style.width = `${progress}%`;
    }
    if (el.campaignStatus) {
        el.campaignStatus.textContent = `Contact ${state.campaignIndex + 1} of ${recordsWithEmails.length}`;
    }
    
    // Save state after updating preview
    if (state.campaignActive) {
        saveCampaignState();
    }
}

function getCurrentContact() {
    // Filter records that have emails
    const recordsWithEmails = state.records.filter(r => r.emails && r.emails.length > 0);
    if (state.campaignIndex >= recordsWithEmails.length) return null;
    return recordsWithEmails[state.campaignIndex];
}

function getRecordsWithEmails() {
    return state.records.filter(r => r.emails && r.emails.length > 0);
}

function generateMailtoLink(contact, template) {
    const email = contact.emails && contact.emails.length > 0 ? contact.emails[0] : '';
    if (!email) return '#';

    const name = `${contact.f || ''} ${contact.l || ''}`.trim() || 'Unknown';
    const company = contact.company || 'Their Company';

    const subject = template.subject
        .replace(/{name}/g, name)
        .replace(/{company}/g, company);
    
    const body = template.body
        .replace(/{name}/g, name)
        .replace(/{company}/g, company);

    if (state.emailClient === 'gmail') {
        return `https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(email)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    }

    return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function markContactAsSent() {
    const recordsWithEmails = getRecordsWithEmails();
    if (state.campaignIndex >= recordsWithEmails.length) return;
    
    const contact = recordsWithEmails[state.campaignIndex];
    // Find the contact in the main records array and update it
    const recordIndex = state.records.findIndex(r => r.id === contact.id);
    if (recordIndex >= 0) {
        state.records[recordIndex].status = 'Sent';
        state.records[recordIndex].lastSent = new Date().toISOString();
        chrome.storage.local.set({ extractflow_records: state.records });
        renderRecords(); // Update the display
    }
    
    // Save campaign state before opening email (popup might close)
    saveCampaignState();
}

function skipContact() {
    state.campaignIndex++;
    const recordsWithEmails = getRecordsWithEmails();
    
    if (state.campaignIndex >= recordsWithEmails.length) {
        endCampaign();
        return;
    }

    saveCampaignState();
    updateCampaignPreview();
}

function endCampaign() {
    state.campaignActive = false;
    state.campaignIndex = 0;
    state.currentTemplateId = null;
    
    // Clear campaign state from storage
    chrome.storage.local.remove('extractflow_campaignState');
    
    el.startCampaignBtn.style.display = 'block';
    el.progressBar.style.display = 'none';
    el.currentContactCard.style.display = 'none';
    el.campaignEmptyState.style.display = 'flex';
    if (el.campaignStatus) {
        el.campaignStatus.textContent = 'Campaign complete!';
    }
    showToast('Campaign completed', 'success');
}
