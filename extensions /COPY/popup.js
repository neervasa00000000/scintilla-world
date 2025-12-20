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
    phone: /(?:(?:\+?61|0)[2-478](?:[ -]?[0-9]){8})|(?:\+?61|0)4(?:[ -]?[0-9]){8}|(?:\(0[2-478]\)(?:[ -]?[0-9]){8})|\b\d{4}[ -]?\d{3}[ -]?\d{3}\b/g
};

const filterInvalid = {
    emails: (email) => {
        const lower = email.toLowerCase();
        const invalid = ['example.com', 'test.com', 'placeholder.com', 'noreply', 'mailto:', 'http'];
        return !invalid.some(inv => lower.includes(inv)) && email.includes('.') && email.includes('@');
    },
    phones: (phone) => {
        const digits = phone.replace(/\D/g, ''); // FIXED: \D instead of \\D
        return digits.length >= 8 && digits.length <= 15 && new Set(digits).size > 2;
    }
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
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
        firstName: document.getElementById('firstName'),
        lastName: document.getElementById('lastName'),
        companyName: document.getElementById('companyName'),
        emailList: document.getElementById('emailList'),
        phoneList: document.getElementById('phoneList'),
        emailCount: document.getElementById('emailCount'),
        phoneCount: document.getElementById('phoneCount'),
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
        csvImportInput: document.getElementById('csvImportInput'),
        emailClientSelect: document.getElementById('emailClientSelect'),
        scanPageBtn: document.getElementById('scanPageBtn'),
        totalRecordsDisplay: document.getElementById('totalRecordsDisplay')
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
    el.resetBtn.addEventListener('click', clearAll);
    el.exportBtn.addEventListener('click', exportCSV);
    el.clearInputsBtn.addEventListener('click', clearInputs);
    el.addBtn.addEventListener('click', addRecord);
    el.assignNameBtn.addEventListener('click', assignName);
    el.editTemplateBtn.addEventListener('click', () => el.templateEditor.style.display = 'block');
    el.closeEditorBtn.addEventListener('click', () => el.templateEditor.style.display = 'none');
    el.saveTemplateBtn.addEventListener('click', saveTemplate);
    el.newTemplateBtn.addEventListener('click', () => { state.currentTemplateId = null; el.templateName.value = ''; el.templateSubject.value = ''; el.templateBody.value = ''; });
    el.startCampaignBtn.addEventListener('click', startCampaign);
    el.skipContactBtn.addEventListener('click', skipContact);
    el.csvImportInput.addEventListener('change', handleCSVImport);
    el.tabButtons.forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));
    el.emailClientSelect.addEventListener('change', (e) => {
        state.emailClient = e.target.value;
        try {
            chrome.storage.local.set({ copy_emailClient: state.emailClient });
        } catch (error) {
            console.error('Storage error on saving email client:', error);
            showToast('Failed to save email client preference', 'error');
        }
        if (state.campaignActive) updateCampaignPreview();
    });

    el.pasteArea.addEventListener('paste', (e) => {
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

    el.pasteArea.addEventListener('input', () => scanText(el.pasteArea.innerText));

    document.addEventListener('mouseup', (e) => {
        if (e.target.closest('button') || e.target.closest('.chip')) return;
        const sel = window.getSelection();
        const text = sel.toString().trim();
        if (text.length > 1 && el.pasteArea.contains(sel.anchorNode)) {
            state.selection = text;
            const rect = sel.getRangeAt(0).getBoundingClientRect();
            el.floatMenu.style.display = 'flex';
            el.floatMenu.style.top = `${rect.top - 45}px`;
            el.floatMenu.style.left = `${rect.left}px`;
        } else if (!el.floatMenu.contains(e.target)) {
            el.floatMenu.style.display = 'none';
        }
    });

    el.openEmailLink.addEventListener('click', () => {
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
    });

    if (el.scanPageBtn) {
        el.scanPageBtn.addEventListener('click', async () => {
            chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
                if (chrome.runtime.lastError) {
                    showToast("Cannot scan this page", "error");
                    return;
                }
                try {
                    // Ensure the content script is injected before sending message
                    await chrome.scripting.executeScript({
                        target: { tabId: tabs[0].id },
                        files: ['content.js']
                    });
                    const response = await chrome.tabs.sendMessage(tabs[0].id, { action: "extractFromPage" });
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
        });
    }
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

    if (record.emails.length === 0 && record.phones.length === 0) {
        showToast("No email or phone found for this contact", "error");
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
    for (let i = state.records.length - 1; i >= 0; i--) {
        const r = state.records[i];
        const div = document.createElement('div');
        div.className = 'record-item';
        div.innerHTML = `<div class="record-header"><b>${escapeHTML(r.f)} ${escapeHTML(r.l)}</b> <small>${escapeHTML(r.company || '')}</small></div>`;
        el.recordsList.appendChild(div);
    }
    el.countDisplay.innerText = state.records.length;
    if (el.totalRecordsDisplay) el.totalRecordsDisplay.innerText = `Total Records: ${state.records.length}`;
}

function exportCSV() {
    if (!state.records.length) return showToast('No data', 'error');
    const head = 'First Name,Last Name,Email,Company,Phone,Status,Last Sent\n';
    const body = state.records.map(r => {
        const s = (v) => `"${(v || '').toString().replace(/"/g, '""')}"`;
        return `${s(r.f)},${s(r.l)},${s(r.emails[0])},${s(r.company)},${s(r.phones[0])},${s(r.status)},${s(r.lastSent)}`;
    }).join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([head + body], { type: 'text/csv' }));
    link.download = `copy_export_${Date.now()}.csv`;
    link.click();
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
    
    el.previewBody.innerText = `Subject: ${sub}\n\n${bod}`;
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
    d.innerText = m;
    el.toastContainer.appendChild(d);
    setTimeout(() => d.remove(), 2500);
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
    return { added: 0, updated: 0 };
  }

  // Fast lookup: email(lowercased) -> record index
  const emailIndex = new Map();
  state.records.forEach((rec, idx) => {
    (rec.emails || []).forEach(email => {
      if (email) emailIndex.set(email.toLowerCase(), idx); // Only index non-empty emails
    });
  });

  let added = 0;
  let updated = 0;

  importedRecords.forEach((imp) => {
    // Normalise imported shape
    const importedEmails = (imp.emails || []).map(e => String(e).toLowerCase()).filter(Boolean);
    const importedPhones = (imp.phones || []).map(p => String(p).trim()).filter(Boolean);

    let existingIndex = -1;
    // Only attempt to merge if mergeExisting is true AND there are imported emails
    if (mergeExisting && importedEmails.length > 0) {
      for (const em of importedEmails) {
        if (emailIndex.has(em)) {
          existingIndex = emailIndex.get(em);
          break;
        }
      }
    }

    if (mergeExisting && existingIndex !== -1) {
      // Update existing record, only filling in missing pieces
      const existing = state.records[existingIndex];

      if (!existing.f && imp.f) existing.f = imp.f;
      if (!existing.l && imp.l) existing.l = imp.l;
      if (!existing.company && imp.company) existing.company = imp.company;

      // Merge emails
      const existingEmailsSet = new Set((existing.emails || []).map(e => e.toLowerCase()));
      importedEmails.forEach(e => {
        if (!existingEmailsSet.has(e)) {
          existing.emails.push(e);
          existingEmailsSet.add(e);
        }
      });

      // Merge phones
      const existingPhonesSet = new Set((existing.phones || []).map(p => p.trim()));
      importedPhones.forEach(p => {
        if (!existingPhonesSet.has(p)) {
          existing.phones.push(p);
          existingPhonesSet.add(p);
        }
      });

      updated += 1;
    } else {
      // Create new record (always if no merge or no email for merge)
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

      // Update email index for future merges within same import (only for new record's emails)
      newRecord.emails.forEach(e => {
        emailIndex.set(e.toLowerCase(), state.records.length - 1);
      });
    }
  });

  return { added, updated };
}

// Minimal parser stub for CSV to records
function parseCSVToRecords(csvText) {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const records = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = line.split(','); // simple split; upgrade if you need full CSV quoting support

    const get = (name) => {
      const idx = headers.indexOf(name);
      return idx === -1 ? '' : (values[idx] || '').trim();
    };

    const emailsStr = get('emails');
    const phonesStr = get('phones');

    records.push({
      f: get('first name'),
      l: get('last name'),
      company: get('company'),
      emails: emailsStr ? emailsStr.split(';').map(e => e.trim()).filter(Boolean) : [],
      phones: phonesStr ? phonesStr.split(';').map(p => p.trim()).filter(Boolean) : [],
      status: get('status') || 'New',
      lastSent: get('last sent') || ''
    });
  }

  return records;
}


function handleCSVImport(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = (event) => {
    try {
      const text = event.target.result;
      const importedRecords = parseCSVToRecords(text);

      if (!importedRecords.length) {
        showToast('No records found in CSV', 'error');
        return;
      }

      let mergeExisting = false;
      if (state.mergeAction === null) { // Only ask if preference is not set
        mergeExisting = confirm(
          'Some contacts may already exist.\n\n' +
          'OK = Update existing contacts (merge by email/phone)\n' +
          'Cancel = Always create new contacts'
        );
        state.mergeAction = mergeExisting ? 'update' : 'duplicate';
      } else if (state.mergeAction === 'update') {
        mergeExisting = true;
      }

      const { added, updated } = mergeImportedRecords(importedRecords, mergeExisting);

      try {
        chrome.storage.local.set({ copy_records: state.records }, renderRecords);
        showToast(
          mergeExisting
            ? `Imported ${added} new, updated ${updated} existing`
            : `Imported ${added} new contacts`,
          'success'
        );
      } catch (error) {
        console.error('Storage error after CSV import:', error);
        showToast('Failed to save imported data', 'error');
      }
    } catch (err) {
      console.error('CSV import error:', err);
      showToast('Failed to import CSV', 'error');
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