// Automation Tool - Logic for email campaign automation

// Initialize automation tool
function initAutomation() {
    // Event listeners are set up in popup-main.js
}

// Start email campaign
function startCampaign() {
    const emails = getRecordsWithEmails();
    if (!emails.length) return showToast('No emails found', 'error');
    state.campaignActive = true;
    state.campaignIndex = 0;
    saveCampaignState();
    restoreCampaignUI();
}

// Restore campaign UI
function restoreCampaignUI() {
    const records = getRecordsWithEmails();
    if (state.campaignIndex >= records.length) return endCampaign();
    
    if (el.startCampaignBtn) el.startCampaignBtn.style.display = 'none';
    if (el.progressBar) el.progressBar.style.display = 'block';
    if (el.currentContactCard) el.currentContactCard.style.display = 'block';
    if (el.campaignEmptyState) el.campaignEmptyState.style.display = 'none';
    
    const contact = records[state.campaignIndex];
    const template = state.templates.find(t => t.id == el.templateSelect.value) || state.templates[0];
    
    if (el.currentContactName) el.currentContactName.innerText = `${contact.f} ${contact.l}`;
    if (el.currentContactEmail) el.currentContactEmail.innerText = contact.emails[0];
    if (el.currentContactStatus) el.currentContactStatus.innerText = contact.status;
    
    const name = contact.f || 'there';
    const comp = contact.company || 'your company';
    const sub = template.subject.replace(/{name}/g, name).replace(/{company}/g, comp);
    const bod = template.body.replace(/{name}/g, name).replace(/{company}/g, comp);
    
    if (el.previewBody) el.previewBody.innerText = `Subject: ${sub}\n\n${bod}`;
    if (el.openEmailLink) {
        el.openEmailLink.href = state.emailClient === 'gmail' 
            ? `https://mail.google.com/mail/?view=cm&to=${contact.emails[0]}&su=${encodeURIComponent(sub)}&body=${encodeURIComponent(bod)}`
            : `mailto:${contact.emails[0]}?subject=${encodeURIComponent(sub)}&body=${encodeURIComponent(bod)}`;
    }
    
    if (el.progressFill) el.progressFill.style.width = `${((state.campaignIndex + 1) / records.length) * 100}%`;
    if (el.campaignStatus) el.campaignStatus.innerText = `Contact ${state.campaignIndex + 1} of ${records.length}`;
    if (el.totalRecordsDisplay) el.totalRecordsDisplay.innerText = `Total Records: ${state.records.length}`;
}

// Skip current contact
function skipContact() { 
    state.campaignIndex++; 
    saveCampaignState(); 
    restoreCampaignUI(); 
}

// End campaign
function endCampaign() {
    state.campaignActive = false;
    try {
        chrome.storage.local.remove('copy_campaignState');
    } catch (error) {
        console.error('Storage error on ending campaign:', error);
        showToast('Failed to end campaign', 'error');
    }
    if (el.startCampaignBtn) el.startCampaignBtn.style.display = 'block';
    if (el.progressBar) el.progressBar.style.display = 'none';
    if (el.currentContactCard) el.currentContactCard.style.display = 'none';
    if (el.campaignEmptyState) el.campaignEmptyState.style.display = 'flex';
    if (el.campaignStatus) el.campaignStatus.innerText = 'Finished';
}

// Handle open email link
function handleOpenEmailLink() {
    const records = getRecordsWithEmails();
    if (state.campaignIndex < records.length) {
        const idx = state.records.findIndex(r => r.id === records[state.campaignIndex].id);
        if (idx >= 0) {
            state.records[idx].status = 'Sent';
            state.records[idx].lastSent = new Date().toISOString();
            chrome.storage.local.set({ copy_records: state.records }, () => {
                if (typeof renderRecords === 'function') renderRecords();
            });
        }
    }
    state.campaignIndex++;
    saveCampaignState();
    restoreCampaignUI();
}

// Save email template
function saveTemplate() {
    const t = { 
        id: Date.now(), 
        name: el.templateName.value, 
        subject: el.templateSubject.value, 
        body: el.templateBody.value 
    };
    state.templates.push(t);
    try {
        chrome.storage.local.set({ copy_templates: state.templates }, () => { 
            renderTemplates(); 
            if (el.templateEditor) el.templateEditor.style.display = 'none'; 
        });
    } catch (error) {
        console.error('Storage error on saving template:', error);
        showToast('Failed to save template', 'error');
    }
}

// Render templates dropdown
function renderTemplates() {
    if (!el.templateSelect) return;
    el.templateSelect.innerHTML = state.templates.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
}

// Save campaign state
function saveCampaignState() {
    try {
        chrome.storage.local.set({ 
            copy_campaignState: { 
                active: state.campaignActive, 
                index: state.campaignIndex, 
                templateId: el.templateSelect ? el.templateSelect.value : null
            }
        });
    } catch (error) {
        console.error('Storage error on saving campaign state:', error);
        showToast('Failed to save campaign state', 'error');
    }
}


