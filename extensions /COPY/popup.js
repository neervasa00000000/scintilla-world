// Fixed State & Patterns
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
    mergeAction: null // 'update', 'duplicate', or 'ask'
};

let el = {};

const patterns = {
    email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    phone: /(?:(?:\\+?61|0)[2-478](?:[ -]?[0-9]){8})|(?:\\+?61|0)4(?:[ -]?[0-9]){8}|(?:\\(0[2-478]\\)(?:[ -]?[0-9]){8})|\\b\\d{4}[ -]?\\d{3}[ -]?\\d{3}\\b/g
};

const filterInvalid = {
    emails: (email) => {
        const lower = email.toLowerCase();
        const invalid = ['example.com', 'test.com', 'placeholder.com', 'noreply', 'mailto:', 'http'];
        return !invalid.some(inv => lower.includes(inv)) && email.includes('.') && email.includes('@');
    },
    phones: (phone) => {
        const digits = phone.replace(/\\D/g, ''); // FIXED: \\D instead of \\\\D
        return digits.length >= 8 && digits.length <= 15 && new Set(digits).size > 2;
    }
};

// Helper functions for robust element access and event handling
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

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    el = {
        pasteArea: getElementByIdOrLog('pasteArea'),
        floatMenu: getElementByIdOrLog('floatMenu'),
        recordsList: getElementByIdOrLog('recordsList'),
        emptyState: getElementByIdOrLog('emptyState'),
        countDisplay: getElementByIdOrLog('countDisplay'),
        toastContainer: getElementByIdOrLog('toastContainer'),
        resetBtn: getElementByIdOrLog('resetBtn'),
        exportBtn: getElementByIdOrLog('exportBtn'),
        clearInputsBtn: getElementByIdOrLog('clearInputsBtn'),
        addBtn: getElementByIdOrLog('addBtn'),
        assignNameBtn: getElementByIdOrLog('assignNameBtn'),
        firstName: getElementByIdOrLog('firstName'),
        lastName: getElementByIdOrLog('lastName'),
        companyName: getElementByIdOrLog('companyName'),
        emailList: getElementByIdOrLog('emailList'),
        phoneList: getElementByIdOrLog('phoneList'),
        emailCount: getElementByIdOrLog('emailCount'),
        phoneCount: getElementByIdOrLog('phoneCount'),
        tabButtons: document.querySelectorAll('.tab-btn'),
        extractTab: getElementByIdOrLog('extractTab'),
        automationTab: getElementByIdOrLog('automationTab'),
        templateSelect: getElementByIdOrLog('templateSelect'),
        editTemplateBtn: getElementByIdOrLog('editTemplateBtn'),
        templateEditor: getElementByIdOrLog('templateEditor'),
        closeEditorBtn: getElementByIdOrLog('closeEditorBtn'),
        templateName: getElementByIdOrLog('templateName'),
        templateSubject: getElementByIdOrLog('templateSubject'),
        templateBody: getElementByIdOrLog('templateBody'),
        saveTemplateBtn: getElementByIdOrLog('saveTemplateBtn'),
        newTemplateBtn: getElementByIdOrLog('newTemplateBtn'),
        startCampaignBtn: getElementByIdOrLog('startCampaignBtn'),
        progressBar: getElementByIdOrLog('progressBar'),
        progressFill: getElementByIdOrLog('progressFill'),
        currentContactCard: getElementByIdOrLog('currentContactCard'),
        campaignEmptyState: getElementByIdOrLog('campaignEmptyState'),
        currentContactName: getElementByIdOrLog('currentContactName'),
        currentContactEmail: getElementByIdOrLog('currentContactEmail'),
        currentContactStatus: getElementByIdOrLog('currentContactStatus'),
        previewBody: getElementByIdOrLog('previewBody'),
        openEmailLink: getElementByIdOrLog('openEmailLink'),
        skipContactBtn: getElementByIdOrLog('skipContactBtn'),
        campaignStatus: getElementByIdOrLog('campaignStatus'),
        csvImportInput: getElementByIdOrLog('csvImportInput'),
        emailClientSelect: getElementByIdOrLog('emailClientSelect'),
        scanPageBtn: getElementByIdOrLog('scanPageBtn'),
        totalRecordsDisplay: getElementByIdOrLog('totalRecordsDisplay'),
        downloadPageBtn: getElementByIdOrLog('downloadPageBtn')
    };

    try {
        chrome.storage.local.get(['copy_records', 'copy_templates', 'copy_emailClient', 'copy_campaignState'], (res) => {
            state.records = res.copy_records || [];
            state.templates = res.copy_templates || [{ id: Date.now(), name: 'Default', subject: 'Hello {name}', body: 'Hi {name}, noticed your work at {company}...' }];
            state.emailClient = res.copy_emailClient || 'default';
            
            if (res.copy_campaignState) {
                state.campaignActive = res.copy_campaignState.active;
                state.campaignIndex = res.copy_campaignState.index;
                state.currentTemplateId = res.copy_campaignState.templateId;
            }

            if (el.emailClientSelect) el.emailClientSelect.value = state.emailClient;
            renderRecords();
            renderTemplates();
            if (state.campaignActive) restoreCampaignUI();
        });
    } catch (error) {
        console.error('Storage error on load:', error);
        showToast('Failed to load data', 'error');
    }

    setupEventListeners();
});

function setupEventListeners() {
  safelyOn(el.resetBtn, 'click', clearAll);
  safelyOn(el.exportBtn, 'click', exportCSV);
  safelyOn(el.clearInputsBtn, 'click', clearInputs);
  safelyOn(el.addBtn, 'click', addRecord);
  safelyOn(el.assignNameBtn, 'click', assignName);

  safelyOn(el.editTemplateBtn, 'click', () => el.templateEditor.style.display = 'block');
  safelyOn(el.closeEditorBtn, 'click', () => el.templateEditor.style.display = 'none');
  safelyOn(el.saveTemplateBtn, 'click', saveTemplate);
  safelyOn(el.newTemplateBtn, 'click', () => {
    state.currentTemplateId = null;
    el.templateName.value = '';
    el.templateSubject.value = '';
    el.templateBody.value = '';
  });

  safelyOn(el.startCampaignBtn, 'click', startCampaign);
  safelyOn(el.skipContactBtn, 'click', skipContact);
  safelyOn(el.csvImportInput, 'change', handleCSVImport);

  if (el.tabButtons && el.tabButtons.forEach) {
    el.tabButtons.forEach(btn =>
      btn.addEventListener('click', () => switchTab(btn.dataset.tab))
    );
  }

  safelyOn(el.emailClientSelect, 'change', (e) => {
    state.emailClient = e.target.value;
    try {
      chrome.storage.local.set({ copy_emailClient: state.emailClient });
    } catch (error) {
      console.error('Storage error on saving email client:', error);
      showToast('Failed to save email client preference', 'error');
    }
    if (state.campaignActive) updateCampaignPreview();
  });

  safelyOn(el.pasteArea, 'paste', (e) => {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text');
    const sel = window.getSelection();
    if (sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(document.createTextNode(text));
      sel.collapseToEnd();
    } else {
      el.pasteArea.innerText += text;
    }
    setTimeout(() => scanText(el.pasteArea.innerText), 10);
  });

  safelyOn(el.pasteArea, 'input', () => scanText(el.pasteArea.innerText));

  document.addEventListener('mouseup', (e) => {
    if (e.target.closest('button') || e.target.closest('.chip')) return;
    const sel = window.getSelection();
    const text = sel.toString().trim();
    if (text.length > 1 && el.pasteArea && el.pasteArea.contains(sel.anchorNode)) {
      state.selection = text;
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      if (el.floatMenu) {
        el.floatMenu.style.display = 'flex';
        el.floatMenu.style.top = `${rect.top - 45}px`;
        el.floatMenu.style.left = `${rect.left}px`;
      }
    } else if (el.floatMenu && !el.floatMenu.contains(e.target)) {
      el.floatMenu.style.display = 'none';
    }
  });

  safelyOn(el.openEmailLink, 'click', handleOpenEmailLink);
  safelyOn(el.scanPageBtn, 'click', handleScanPageClick);
  safelyOn(el.downloadPageBtn, 'click', handleDownloadPageClick);
}

async function handleScanPageClick() {
  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    if (chrome.runtime.lastError) {
      showToast("Cannot access tab information", "error");
      return;
    }
    const activeTab = tabs[0];
    if (isRestrictedURL(activeTab.url)) {
      showToast("Cannot scan this page (restricted URL)", "error");
      return;
    }
    try {
      await chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        files: ['content.js']
      });
      const response = await chrome.tabs.sendMessage(activeTab.id, { action: "extractFromPage" });
      if (response && response.text) {
        scanText(response.text);
        showToast("Page scanned successfully!");
      } else {
        showToast("No text extracted from page.", "info");
      }
    } catch (error) {
      console.error('Error scanning page:', error);
      showToast("Failed to scan page", "error");
    }
  });
}

async function handleDownloadPageClick() {
  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    if (chrome.runtime.lastError) {
      showToast("Cannot access tab information", "error");
      return;
    }
    const activeTab = tabs[0];
    if (isRestrictedURL(activeTab.url)) {
      showToast("Cannot download this page (restricted URL)", "error");
      return;
    }
    try {
      await chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        function: () => {
          window.print();
        }
      });
      showToast("Print dialog opened. Save as PDF to download.");
    } catch (error) {
      console.error('Error printing page:', error);
      showToast("Failed to open print dialog", "error");
    }
  });
}

function handleOpenEmailLink() {
  const records = getRecordsWithEmails();
  if (state.campaignIndex < records.length) {
    const idx = state.records.findIndex(r => r.id === records[state.campaignIndex].id);
    if (idx >= 0) {
      state.records[idx].status = 'Sent';
      state.records[idx].lastSent = new Date().toISOString();
      chrome.storage.local.set({ copy_records: state.records }, renderRecords);
    }
  }
  state.campaignIndex++;
  saveCampaignState();
  restoreCampaignUI();
}


function scanText(text) {
    if (!text) return;
    const emails = text.match(patterns.email) || [];
    const phones = text.match(patterns.phone) || [];
    emails.forEach(e => { if (filterInvalid.emails(e)) state.currentEmails.add(e.toLowerCase()); });
    phones.forEach(p => { if (filterInvalid.phones(p)) state.currentPhones.add(p); });
            renderChips();
            updateStats();
}

function sanitizeInput(str) {
    return str.replace(/[<>]/g, "").trim(); // Simple XSS prevention
}

function addRecord() {
    const f = sanitizeInput(el.firstName.value);
    const l = sanitizeInput(el.lastName.value);
    
    if (f.length === 0 || l.length === 0) {
        showToast("First and Last name are required", "error");
        return;
    }
    
    const record = {
        id: Date.now(),
        f: f,
        l: l,
        company: sanitizeInput(el.companyName.value),
        emails: Array.from(state.currentEmails),
        phones: Array.from(state.currentPhones),
        status: 'New',
        lastSent: ''
    };

    // Allow records without email/phone if they have at least a name
    if (record.emails.length === 0 && record.phones.length === 0 && !record.f && !record.l) {
        showToast("Please provide at least a name, email, or phone", "error");
        return;
    }
    
    try {
        chrome.storage.local.set({ copy_records: [...state.records, record] }, () => {
            if (chrome.runtime.lastError) {
                showToast("Failed to save to storage", "error");
            } else {
                state.records.push(record);
                renderRecords();
                clearInputs();
                showToast('Contact Saved');
            }
        });
    } catch (error) {
        console.error('Storage error on saving record:', error);
        showToast('Failed to save record', 'error');
    }
}

function renderRecords() {
    el.recordsList.innerHTML = '';
    el.emptyState.style.display = state.records.length ? 'none' : 'flex';
    
    // Build duplicate detection maps for highlighting
    const emailMap = new Map();
    const phoneMap = new Map();
    
    state.records.forEach((r, idx) => {
        (r.emails || []).forEach(email => {
            const key = email.toLowerCase();
            if (!emailMap.has(key)) emailMap.set(key, []);
            emailMap.get(key).push(idx);
        });
        (r.phones || []).forEach(phone => {
            const normalized = phone.replace(/\D/g, '');
            if (normalized) {
                if (!phoneMap.has(normalized)) phoneMap.set(normalized, []);
                phoneMap.get(normalized).push(idx);
            }
        });
    });
    
    for (let i = state.records.length - 1; i >= 0; i--) {
        const r = state.records[i];
        const div = document.createElement('div');
        div.className = 'record-item';
        
        // Check if this record has duplicates
        let hasDuplicate = false;
        let duplicateInfo = [];
        
        (r.emails || []).forEach(email => {
            const indices = emailMap.get(email.toLowerCase());
            if (indices && indices.length > 1) {
                hasDuplicate = true;
                duplicateInfo.push(`Email: ${email}`);
            }
        });
        
        (r.phones || []).forEach(phone => {
            const normalized = phone.replace(/\D/g, '');
            if (normalized) {
                const indices = phoneMap.get(normalized);
                if (indices && indices.length > 1) {
                    hasDuplicate = true;
                    duplicateInfo.push(`Phone: ${phone}`);
                }
            }
        });
        
        if (hasDuplicate) {
            div.classList.add('record-duplicate');
            div.title = `Duplicate detected: ${duplicateInfo.join(', ')}`;
        }
        
        const name = `${escapeHTML(r.f)} ${escapeHTML(r.l)}`.trim() || 'Unknown';
        const company = r.company ? `<small>${escapeHTML(r.company)}</small>` : '';
        const duplicateBadge = hasDuplicate ? '<span class="duplicate-badge" title="' + escapeHTML(duplicateInfo.join(', ')) + '">⚠ Duplicate</span>' : '';
        
        div.innerHTML = `
            <div class="record-header">
                <div>
                    <b>${name}</b> ${company}
                    ${duplicateBadge}
                </div>
            </div>
        `;
        el.recordsList.appendChild(div);
    }
    el.countDisplay.innerText = state.records.length;
    if (el.totalRecordsDisplay) el.totalRecordsDisplay.innerText = `Total Records: ${state.records.length}`;
}

function exportCSV() {
    if (!state.records.length) return showToast('No data', 'error');
    const head = 'First Name,Last Name,Email,Emails,Company,Phone,Phones,Status,Last Sent\n';
    const body = state.records.map(r => {
        const s = (v) => `"${(v || '').toString().replace(/"/g, '""')}"`;
        const emails = (r.emails || []).join(';');
        const phones = (r.phones || []).join(';');
        return `${s(r.f)},${s(r.l)},${s(r.emails[0] || '')},${s(emails)},${s(r.company)},${s(r.phones[0] || '')},${s(phones)},${s(r.status)},${s(r.lastSent)}`;
    }).join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([head + body], { type: 'text/csv' }));
    link.download = `copy_export_${Date.now()}.csv`;
    link.click();
    showToast('CSV exported successfully', 'success');
}

function startCampaign() {
    const emails = getRecordsWithEmails();
    if (!emails.length) return showToast('No emails found', 'error');
    state.campaignActive = true;
    state.campaignIndex = 0;
    saveCampaignState();
    restoreCampaignUI();
}

function restoreCampaignUI() {
    const records = getRecordsWithEmails();
    if (state.campaignIndex >= records.length) return endCampaign();
    
    el.startCampaignBtn.style.display = 'none';
    el.progressBar.style.display = 'block';
    el.currentContactCard.style.display = 'block';
    el.campaignEmptyState.style.display = 'none';
    
    const contact = records[state.campaignIndex];
    const template = state.templates.find(t => t.id == el.templateSelect.value) || state.templates[0];
    
    el.currentContactName.innerText = `${contact.f} ${contact.l}`;
    el.currentContactEmail.innerText = contact.emails[0];
    el.currentContactStatus.innerText = contact.status;
    
    const name = contact.f || 'there';
    const comp = contact.company || 'your company';
    const sub = template.subject.replace(/{name}/g, name).replace(/{company}/g, comp);
    const bod = template.body.replace(/{name}/g, name).replace(/{company}/g, comp);
    
    el.previewBody.innerText = `Subject: ${sub}\\n\\n${bod}`;
    el.openEmailLink.href = state.emailClient === 'gmail' 
        ? `https://mail.google.com/mail/?view=cm&to=${contact.emails[0]}&su=${encodeURIComponent(sub)}&body=${encodeURIComponent(bod)}`
        : `mailto:${contact.emails[0]}?subject=${encodeURIComponent(sub)}&body=${encodeURIComponent(bod)}`;
    
    el.progressFill.style.width = `${((state.campaignIndex + 1) / records.length) * 100}%`;
    el.campaignStatus.innerText = `Contact ${state.campaignIndex + 1} of ${records.length}`;
    if (el.totalRecordsDisplay) el.totalRecordsDisplay.innerText = `Total Records: ${state.records.length}`;
}

function skipContact() { state.campaignIndex++; saveCampaignState(); restoreCampaignUI(); }

function endCampaign() {
    state.campaignActive = false;
    try {
    chrome.storage.local.remove('copy_campaignState');
    } catch (error) {
        console.error('Storage error on ending campaign:', error);
        showToast('Failed to end campaign', 'error');
    }
    el.startCampaignBtn.style.display = 'block';
    el.progressBar.style.display = 'none';
    el.currentContactCard.style.display = 'none';
    el.campaignEmptyState.style.display = 'flex';
    el.campaignStatus.innerText = 'Finished';
}

function showToast(m, t = 'success') {
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

function clearInputs() {
    el.firstName.value = ''; el.lastName.value = ''; el.companyName.value = '';
    state.currentEmails.clear(); state.currentPhones.clear();
    renderChips(); updateStats();
}

function updateStats() {
    el.emailCount.innerText = state.currentEmails.size;
    el.phoneCount.innerText = state.currentPhones.size;
}

function renderChips() {
    const build = (cont, set, cls) => {
        cont.innerHTML = '';
        set.forEach(v => {
            const c = document.createElement('div');
            c.className = `chip ${cls}`;
            c.innerHTML = `<span>${v}</span><i class="fa-solid fa-xmark chip-remove"></i>`;
            c.onclick = () => { set.delete(v); renderChips(); updateStats(); };
            cont.appendChild(c);
        });
    };
    build(el.emailList, state.currentEmails, 'chip-email');
    build(el.phoneList, state.currentPhones, 'chip-phone');
}

function switchTab(id) {
    el.tabButtons.forEach(b => b.classList.toggle('active', b.dataset.tab === id));
    el.extractTab.classList.toggle('active', id === 'extract');
    el.automationTab.classList.toggle('active', id === 'automation');
}

function getRecordsWithEmails() { return state.records.filter(r => r.emails?.length > 0); }

function saveTemplate() {
    const t = { id: Date.now(), name: el.templateName.value, subject: el.templateSubject.value, body: el.templateBody.value };
    state.templates.push(t);
    try {
        chrome.storage.local.set({ copy_templates: state.templates }, () => { renderTemplates(); el.templateEditor.style.display = 'none'; });
    } catch (error) {
        console.error('Storage error on saving template:', error);
        showToast('Failed to save template', 'error');
    }
}

function renderTemplates() {
    el.templateSelect.innerHTML = state.templates.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
}

function saveCampaignState() {
    try {
        chrome.storage.local.set({ copy_campaignState: { active: state.campaignActive, index: state.campaignIndex, templateId: el.templateSelect.value }});
    } catch (error) {
        console.error('Storage error on saving campaign state:', error);
        showToast('Failed to save campaign state', 'error');
    }
}

function assignName() {
    const p = state.selection.split(' ');
    el.firstName.value = p[0] || '';
    el.lastName.value = p.slice(1).join(' ') || '';
    el.floatMenu.style.display = 'none';
}

function clearAll() {
    state.records = [];
    try {
        chrome.storage.local.remove('copy_records', renderRecords);
    } catch (error) {
        console.error('Storage error on clearing records:', error);
        showToast('Failed to clear records', 'error');
    }
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Merge imported records into existing state.records by email/phone
// If an email or phone already exists, update missing fields (name, company, emails, phones).
// If no overlap, push as new record.
function mergeImportedRecords(importedRecords, mergeExisting) {
  if (!Array.isArray(importedRecords) || !importedRecords.length) {
    return { added: 0, updated: 0, duplicates: [] };
  }

  // Fast lookup: email(lowercased) -> record index
  const emailIndex = new Map();
  // Fast lookup: phone(normalized) -> record index
  const phoneIndex = new Map();
  
  state.records.forEach((rec, idx) => {
    (rec.emails || []).forEach(email => {
      if (email) emailIndex.set(email.toLowerCase(), idx);
    });
    (rec.phones || []).forEach(phone => {
      if (phone) {
        const normalized = phone.replace(/\D/g, '');
        if (normalized) phoneIndex.set(normalized, idx);
      }
    });
  });

  let added = 0;
  let updated = 0;
  const duplicates = [];

  importedRecords.forEach((imp) => {
    // Normalise imported shape
    const importedEmails = (imp.emails || []).map(e => String(e).toLowerCase()).filter(Boolean);
    const importedPhones = (imp.phones || []).map(p => String(p).trim()).filter(Boolean);
    const importedPhoneNormalized = importedPhones.map(p => p.replace(/\D/g, '')).filter(Boolean);

    let existingIndex = -1;
    let duplicateReason = '';
    
    // Check for duplicates by email or phone
    if (mergeExisting) {
      // Check emails first
      for (const em of importedEmails) {
        if (emailIndex.has(em)) {
          existingIndex = emailIndex.get(em);
          duplicateReason = `Email: ${em}`;
          break;
        }
      }
      
      // Check phones if no email match
      if (existingIndex === -1) {
        for (const phoneNorm of importedPhoneNormalized) {
          if (phoneIndex.has(phoneNorm)) {
            existingIndex = phoneIndex.get(phoneNorm);
            const originalPhone = importedPhones.find(p => p.replace(/\D/g, '') === phoneNorm);
            duplicateReason = `Phone: ${originalPhone}`;
            break;
          }
        }
      }
    }

    if (mergeExisting && existingIndex !== -1) {
      // Update existing record, only filling in missing pieces
      const existing = state.records[existingIndex];
      
      duplicates.push({
        existing: `${existing.f} ${existing.l}`.trim() || 'Unknown',
        imported: `${imp.f} ${imp.l}`.trim() || 'Unknown',
        reason: duplicateReason
      });

      if (!existing.f && imp.f) existing.f = imp.f;
      if (!existing.l && imp.l) existing.l = imp.l;
      if (!existing.company && imp.company) existing.company = imp.company;

      // Merge emails
      const existingEmailsSet = new Set((existing.emails || []).map(e => e.toLowerCase()));
      importedEmails.forEach(e => {
        if (!existingEmailsSet.has(e)) {
          existing.emails.push(e);
          existingEmailsSet.add(e);
          emailIndex.set(e, existingIndex); // Update index
        }
      });

      // Merge phones
      const existingPhonesSet = new Set((existing.phones || []).map(p => p.trim()));
      importedPhones.forEach(p => {
        const pNorm = p.replace(/\D/g, '');
        if (!existingPhonesSet.has(p) && pNorm) {
          existing.phones.push(p);
          existingPhonesSet.add(p);
          phoneIndex.set(pNorm, existingIndex); // Update index
        }
      });

      updated += 1;
    } else {
      // Create new record (always if no merge or no duplicate found)
      const newRecord = {
        id: Date.now() + Math.floor(Math.random() * 1000000),
        f: imp.f || '',
        l: imp.l || '',
        company: imp.company || '',
        emails: importedEmails,
        phones: importedPhones,
        status: imp.status || 'New',
        lastSent: imp.lastSent || ''
      };
      state.records.push(newRecord);
      added += 1;

      // Update indices for future merges within same import
      newRecord.emails.forEach(e => {
        emailIndex.set(e.toLowerCase(), state.records.length - 1);
      });
      newRecord.phones.forEach(p => {
        const pNorm = p.replace(/\D/g, '');
        if (pNorm) phoneIndex.set(pNorm, state.records.length - 1);
      });
    }
  });

  return { added, updated, duplicates };
}

// Proper CSV parser that handles quoted fields
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // Field separator
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  // Add last field
  result.push(current.trim());
  return result;
}

// CSV parser that handles quoted fields and flexible column names
function parseCSVToRecords(csvText) {
  const lines = csvText.trim().split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) return [];

  // Parse header with proper CSV handling
  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine).map(h => h.trim().toLowerCase().replace(/^"|"$/g, ''));
  const records = [];

  // Helper to find column index by multiple possible names
  const findColumn = (possibleNames) => {
    for (const name of possibleNames) {
      const idx = headers.indexOf(name.toLowerCase());
      if (idx !== -1) return idx;
    }
    return -1;
  };

  // Find column indices
  const firstNameIdx = findColumn(['first name', 'firstname', 'fname', 'f']);
  const lastNameIdx = findColumn(['last name', 'lastname', 'lname', 'l']);
  const emailIdx = findColumn(['email', 'emails', 'e-mail', 'e-mail address']);
  const phoneIdx = findColumn(['phone', 'phones', 'phone number', 'mobile', 'tel']);
  const companyIdx = findColumn(['company', 'company name', 'organization', 'org']);
  const statusIdx = findColumn(['status', 'state']);
  const lastSentIdx = findColumn(['last sent', 'lastsent', 'last sent date', 'date sent']);
  
  // Find ALL columns that might contain emails (check all columns for email patterns)
  const emailColumnIndices = [];
  headers.forEach((header, idx) => {
    const headerLower = header.toLowerCase();
    if (headerLower.includes('email') || headerLower.includes('e-mail') || headerLower.includes('mail')) {
      emailColumnIndices.push(idx);
    }
  });
  // If no email columns found by name, use the found emailIdx
  if (emailColumnIndices.length === 0 && emailIdx !== -1) {
    emailColumnIndices.push(emailIdx);
  }

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    try {
      const values = parseCSVLine(line);
      
      const get = (idx) => {
        if (idx === -1) return '';
        const val = (values[idx] || '').trim().replace(/^"|"$/g, '');
        return val;
      };

      // Extract emails from ALL email columns and the entire row
      const allEmailStrings = new Set();
      
      // Get emails from dedicated email columns
      emailColumnIndices.forEach(idx => {
        const emailStr = get(idx);
        if (emailStr) {
          allEmailStrings.add(emailStr);
        }
      });
      
      // Also scan ALL columns for any email addresses (in case emails are in unexpected columns)
      values.forEach(cellValue => {
        if (cellValue && cellValue.trim()) {
          const cellText = cellValue.trim().replace(/^"|"$/g, '');
          // Check if this cell contains email-like content
          if (cellText.includes('@')) {
            allEmailStrings.add(cellText);
          }
        }
      });
      
      // Extract and validate all emails
      const emails = [];
      const emailSet = new Set(); // To avoid duplicates
      
      allEmailStrings.forEach(emailStr => {
        // Handle different separators: semicolon, comma, newline, tab
        const separated = emailStr.split(/[;,\n\r\t]+/);
        separated.forEach(e => {
          const trimmed = e.trim();
          if (!trimmed) return;
          
          // Try to extract emails from this string using regex
          const extracted = trimmed.match(patterns.email) || [];
          extracted.forEach(extractedEmail => {
            const email = extractedEmail.toLowerCase();
            if (filterInvalid.emails(email) && !emailSet.has(email)) {
              emailSet.add(email);
              emails.push(email);
            }
          });
        });
      });

      // Extract phones - handle both single phone and semicolon-separated
      const phoneStr = phoneIdx !== -1 ? get(phoneIdx) : '';
      const phones = phoneStr
        ? phoneStr.split(/[;,\s]+/).map(p => p.trim()).filter(p => {
            // Validate phone format
            return p && filterInvalid.phones(p);
          })
        : [];

      // Extract other fields
      const firstName = firstNameIdx !== -1 ? get(firstNameIdx) : '';
      const lastName = lastNameIdx !== -1 ? get(lastNameIdx) : '';
      const company = companyIdx !== -1 ? get(companyIdx) : '';
      
      // Import ALL records from CSV - create a record if there's ANY data
      // This ensures we don't lose any emails, even if name/company is missing
      if (firstName || lastName || company || emails.length > 0 || phones.length > 0) {
        // If we have emails but no name, create a record anyway (emails are valuable)
        records.push({
          f: firstName,
          l: lastName,
          company: company,
          emails: emails, // This array contains ALL emails found in this row
          phones: phones,
          status: statusIdx !== -1 ? get(statusIdx) || 'New' : 'New',
          lastSent: lastSentIdx !== -1 ? get(lastSentIdx) : ''
        });
      } else {
        // Log skipped rows for debugging
        console.log(`Skipped empty row ${i + 1}:`, values);
      }
    } catch (err) {
      console.warn(`Error parsing CSV line ${i + 1}:`, err);
      // Continue with next line
    }
  }

  return records;
}


function handleCSVImport(e) {
  const file = e.target.files[0];
  if (!file) return;

  // Validate file type
  if (!file.name.toLowerCase().endsWith('.csv')) {
    showToast('Please select a CSV file', 'error');
    e.target.value = '';
    return;
  }

  const reader = new FileReader();

  reader.onload = (event) => {
    try {
      const text = event.target.result;
      const importedRecords = parseCSVToRecords(text);

      if (!importedRecords.length) {
        showToast('No records found in CSV. Make sure CSV has at least one data column.', 'error');
        e.target.value = '';
        return;
      }

      // Count total emails found (before merge)
      const totalEmails = importedRecords.reduce((sum, r) => sum + (r.emails?.length || 0), 0);
      const totalRows = importedRecords.length;
      
      // Show detailed breakdown
      const recordsWithEmails = importedRecords.filter(r => r.emails?.length > 0).length;
      const recordsWithMultipleEmails = importedRecords.filter(r => (r.emails?.length || 0) > 1).length;
      
      // Always ask user about merge preference for better control
      const mergeChoice = confirm(
        `CSV Import Summary:\n` +
        `• ${totalRows} row(s) processed\n` +
        `• ${totalEmails} email(s) found\n` +
        `• ${recordsWithEmails} record(s) with emails\n` +
        `• ${recordsWithMultipleEmails} record(s) with multiple emails\n\n` +
        'OK = Merge with existing (update duplicates by email/phone)\n' +
        'Cancel = Add all as new contacts (may create duplicates)'
      );
      
      const mergeExisting = mergeChoice;
      const { added, updated, duplicates } = mergeImportedRecords(importedRecords, mergeExisting);
      
      // Count final emails after merge
      const finalEmails = state.records.reduce((sum, r) => sum + (r.emails?.length || 0), 0);

      try {
        chrome.storage.local.set({ copy_records: state.records }, () => {
          renderRecords();
          
          // Show detailed import results
          let message = '';
          if (mergeExisting) {
            message = `✓ Imported ${added} new, updated ${updated} existing\nTotal: ${finalEmails} emails in ${state.records.length} records`;
            if (duplicates.length > 0) {
              message += `\n\n${duplicates.length} duplicate(s) merged:`;
              duplicates.slice(0, 5).forEach(dup => {
                message += `\n• ${dup.imported} → ${dup.existing} (${dup.reason})`;
              });
              if (duplicates.length > 5) {
                message += `\n... and ${duplicates.length - 5} more`;
              }
            }
          } else {
            message = `✓ Imported ${added} new contacts\nTotal: ${finalEmails} emails in ${state.records.length} records`;
            if (updated > 0) {
              message += `\n⚠ ${updated} potential duplicates were still added`;
            }
          }
          
          // Warn if email count doesn't match
          if (totalEmails !== finalEmails && mergeExisting) {
            message += `\n\n⚠ Note: ${totalEmails} emails found, ${finalEmails} after merge (duplicates combined)`;
          }
          
          showToast(message, 'success');
        });
      } catch (error) {
        console.error('Storage error after CSV import:', error);
        showToast('Failed to save imported data', 'error');
      }
    } catch (err) {
      console.error('CSV import error:', err);
      showToast(`Failed to import CSV: ${err.message}`, 'error');
    } finally {
      e.target.value = ''; // reset file input
    }
  };

  reader.onerror = () => {
    showToast('Failed to read CSV file', 'error');
    e.target.value = '';
  };

  reader.readAsText(file);
}