// Extract Tool - Logic for data extraction (emails, phones, names)

// Initialize extract tool
function initExtract() {
    // Event listeners are set up in popup-main.js
    // This function can be used for any extract-specific initialization
}

// Scan text for emails and phones
function scanText(text) {
    if (!text) return;
    const emails = text.match(patterns.email) || [];
    const phones = text.match(patterns.phone) || [];
    emails.forEach(e => { if (filterInvalid.emails(e)) state.currentEmails.add(e.toLowerCase()); });
    phones.forEach(p => { if (filterInvalid.phones(p)) state.currentPhones.add(p); });
    renderChips();
    updateStats();
}

// Add a new record
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

// Render records list
function renderRecords() {
    if (!el.recordsList) return;
    el.recordsList.innerHTML = '';
    if (el.emptyState) el.emptyState.style.display = state.records.length ? 'none' : 'flex';
    
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
    if (el.countDisplay) el.countDisplay.innerText = state.records.length;
    if (el.totalRecordsDisplay) el.totalRecordsDisplay.innerText = `Total Records: ${state.records.length}`;
}

// Export records to CSV
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

// Clear input fields
function clearInputs() {
    if (el.firstName) el.firstName.value = '';
    if (el.lastName) el.lastName.value = '';
    if (el.companyName) el.companyName.value = '';
    state.currentEmails.clear();
    state.currentPhones.clear();
    renderChips();
    updateStats();
}

// Update statistics display
function updateStats() {
    if (el.emailCount) el.emailCount.innerText = state.currentEmails.size;
    if (el.phoneCount) el.phoneCount.innerText = state.currentPhones.size;
}

// Render email/phone chips
function renderChips() {
    const build = (cont, set, cls) => {
        if (!cont) return;
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

// Assign name from selection
function assignName() {
    const p = state.selection.split(' ');
    if (el.firstName) el.firstName.value = p[0] || '';
    if (el.lastName) el.lastName.value = p.slice(1).join(' ') || '';
    if (el.floatMenu) el.floatMenu.style.display = 'none';
}

// Clear all records
function clearAll() {
    state.records = [];
    try {
        chrome.storage.local.remove('copy_records', renderRecords);
    } catch (error) {
        console.error('Storage error on clearing records:', error);
        showToast('Failed to clear records', 'error');
    }
}

// Scan page for content
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
        files: ['js/content.js']
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

// Download page
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

// CSV Parser - handles quoted fields
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

// CSV to records parser
function parseCSVToRecords(csvText) {
  const lines = csvText.trim().split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) return [];

  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine).map(h => h.trim().toLowerCase().replace(/^"|"$/g, ''));
  const records = [];

  const findColumn = (possibleNames) => {
    for (const name of possibleNames) {
      const idx = headers.indexOf(name.toLowerCase());
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const firstNameIdx = findColumn(['first name', 'firstname', 'fname', 'f']);
  const lastNameIdx = findColumn(['last name', 'lastname', 'lname', 'l']);
  const emailIdx = findColumn(['email', 'emails', 'e-mail', 'e-mail address']);
  const phoneIdx = findColumn(['phone', 'phones', 'phone number', 'mobile', 'tel']);
  const companyIdx = findColumn(['company', 'company name', 'organization', 'org']);
  const statusIdx = findColumn(['status', 'state']);
  const lastSentIdx = findColumn(['last sent', 'lastsent', 'last sent date', 'date sent']);
  
  const emailColumnIndices = [];
  headers.forEach((header, idx) => {
    const headerLower = header.toLowerCase();
    if (headerLower.includes('email') || headerLower.includes('e-mail') || headerLower.includes('mail')) {
      emailColumnIndices.push(idx);
    }
  });
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

      const allEmailStrings = new Set();
      
      emailColumnIndices.forEach(idx => {
        const emailStr = get(idx);
        if (emailStr) {
          allEmailStrings.add(emailStr);
        }
      });
      
      values.forEach(cellValue => {
        if (cellValue && cellValue.trim()) {
          const cellText = cellValue.trim().replace(/^"|"$/g, '');
          if (cellText.includes('@')) {
            allEmailStrings.add(cellText);
          }
        }
      });
      
      const emails = [];
      const emailSet = new Set();
      
      allEmailStrings.forEach(emailStr => {
        const separated = emailStr.split(/[;,\n\r\t]+/);
        separated.forEach(e => {
          const trimmed = e.trim();
          if (!trimmed) return;
          
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

      const phoneStr = phoneIdx !== -1 ? get(phoneIdx) : '';
      const phones = phoneStr
        ? phoneStr.split(/[;,\s]+/).map(p => p.trim()).filter(p => {
            return p && filterInvalid.phones(p);
          })
        : [];

      const firstName = firstNameIdx !== -1 ? get(firstNameIdx) : '';
      const lastName = lastNameIdx !== -1 ? get(lastNameIdx) : '';
      const company = companyIdx !== -1 ? get(companyIdx) : '';
      
      if (firstName || lastName || company || emails.length > 0 || phones.length > 0) {
        records.push({
          f: firstName,
          l: lastName,
          company: company,
          emails: emails,
          phones: phones,
          status: statusIdx !== -1 ? get(statusIdx) || 'New' : 'New',
          lastSent: lastSentIdx !== -1 ? get(lastSentIdx) : ''
        });
      }
    } catch (err) {
      console.warn(`Error parsing CSV line ${i + 1}:`, err);
    }
  }

  return records;
}

// Merge imported records
function mergeImportedRecords(importedRecords, mergeExisting) {
  if (!Array.isArray(importedRecords) || !importedRecords.length) {
    return { added: 0, updated: 0, duplicates: [] };
  }

  const emailIndex = new Map();
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
    const importedEmails = (imp.emails || []).map(e => String(e).toLowerCase()).filter(Boolean);
    const importedPhones = (imp.phones || []).map(p => String(p).trim()).filter(Boolean);
    const importedPhoneNormalized = importedPhones.map(p => p.replace(/\D/g, '')).filter(Boolean);

    let existingIndex = -1;
    let duplicateReason = '';
    
    if (mergeExisting) {
      for (const em of importedEmails) {
        if (emailIndex.has(em)) {
          existingIndex = emailIndex.get(em);
          duplicateReason = `Email: ${em}`;
          break;
        }
      }
      
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
      const existing = state.records[existingIndex];
      
      duplicates.push({
        existing: `${existing.f} ${existing.l}`.trim() || 'Unknown',
        imported: `${imp.f} ${imp.l}`.trim() || 'Unknown',
        reason: duplicateReason
      });

      if (!existing.f && imp.f) existing.f = imp.f;
      if (!existing.l && imp.l) existing.l = imp.l;
      if (!existing.company && imp.company) existing.company = imp.company;

      const existingEmailsSet = new Set((existing.emails || []).map(e => e.toLowerCase()));
      importedEmails.forEach(e => {
        if (!existingEmailsSet.has(e)) {
          existing.emails.push(e);
          existingEmailsSet.add(e);
          emailIndex.set(e, existingIndex);
        }
      });

      const existingPhonesSet = new Set((existing.phones || []).map(p => p.trim()));
      importedPhones.forEach(p => {
        const pNorm = p.replace(/\D/g, '');
        if (!existingPhonesSet.has(p) && pNorm) {
          existing.phones.push(p);
          existingPhonesSet.add(p);
          phoneIndex.set(pNorm, existingIndex);
        }
      });

      updated += 1;
    } else {
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

// Handle CSV import
function handleCSVImport(e) {
  const file = e.target.files[0];
  if (!file) return;

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

      const totalEmails = importedRecords.reduce((sum, r) => sum + (r.emails?.length || 0), 0);
      const totalRows = importedRecords.length;
      const recordsWithEmails = importedRecords.filter(r => r.emails?.length > 0).length;
      const recordsWithMultipleEmails = importedRecords.filter(r => (r.emails?.length || 0) > 1).length;
      
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
      const finalEmails = state.records.reduce((sum, r) => sum + (r.emails?.length || 0), 0);

      try {
        chrome.storage.local.set({ copy_records: state.records }, () => {
          renderRecords();
          
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
      e.target.value = '';
    }
  };

  reader.onerror = () => {
    showToast('Failed to read CSV file', 'error');
    e.target.value = '';
  };

  reader.readAsText(file);
}


