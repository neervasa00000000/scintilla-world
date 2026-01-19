// Main coordinator for COPY extension
// This file initializes all tools and coordinates between them

// Initialize all element references
function initializeElements() {
    el = {
        // Common elements
        toastContainer: getElementByIdOrLog('toastContainer'),
        tabButtons: document.querySelectorAll('.tab-btn'),
        extractTab: getElementByIdOrLog('extractTab'),
        automationTab: getElementByIdOrLog('automationTab'),
        calendarTab: getElementByIdOrLog('calendarTab'),
        notesTab: getElementByIdOrLog('notesTab'),
        
        // Extract tool elements
        pasteArea: getElementByIdOrLog('pasteArea'),
        floatMenu: getElementByIdOrLog('floatMenu'),
        recordsList: getElementByIdOrLog('recordsList'),
        emptyState: getElementByIdOrLog('emptyState'),
        countDisplay: getElementByIdOrLog('countDisplay'),
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
        csvImportInput: getElementByIdOrLog('csvImportInput'),
        scanPageBtn: getElementByIdOrLog('scanPageBtn'),
        downloadPageBtn: getElementByIdOrLog('downloadPageBtn'),
        totalRecordsDisplay: getElementByIdOrLog('totalRecordsDisplay'),
        
        // Automation tool elements
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
        emailClientSelect: getElementByIdOrLog('emailClientSelect'),
        
        // Calendar tool elements
        calendarInput: getElementByIdOrLog('calendarInput'),
        calendarGenerateBtn: getElementByIdOrLog('calendarGenerateBtn'),
        calendarResult: getElementByIdOrLog('calendarResult'),
        
        // Notes tool elements
        notesInput: getElementByIdOrLog('notesInput'),
        notesDeadlineInput: getElementByIdOrLog('notesDeadlineInput'),
        notesAddBtn: getElementByIdOrLog('notesAddBtn'),
        notesList: getElementByIdOrLog('notesList')
    };
}

// Setup event listeners for all tools
function setupEventListeners() {
    // Tab switching
    if (el.tabButtons && el.tabButtons.forEach) {
        el.tabButtons.forEach(btn =>
            btn.addEventListener('click', () => switchTab(btn.dataset.tab))
        );
    }
    
    // Extract tool event listeners
    safelyOn(el.resetBtn, 'click', clearAll);
    safelyOn(el.exportBtn, 'click', exportCSV);
    safelyOn(el.clearInputsBtn, 'click', clearInputs);
    safelyOn(el.addBtn, 'click', addRecord);
    safelyOn(el.assignNameBtn, 'click', assignName);
    safelyOn(el.csvImportInput, 'change', handleCSVImport);
    safelyOn(el.scanPageBtn, 'click', handleScanPageClick);
    safelyOn(el.downloadPageBtn, 'click', handleDownloadPageClick);
    
    // Paste area events
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
    
    // Text selection for name assignment
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
    
    // Automation tool event listeners
    safelyOn(el.editTemplateBtn, 'click', () => {
        if (el.templateEditor) el.templateEditor.style.display = 'block';
    });
    safelyOn(el.closeEditorBtn, 'click', () => {
        if (el.templateEditor) el.templateEditor.style.display = 'none';
    });
    safelyOn(el.saveTemplateBtn, 'click', saveTemplate);
    safelyOn(el.newTemplateBtn, 'click', () => {
        state.currentTemplateId = null;
        if (el.templateName) el.templateName.value = '';
        if (el.templateSubject) el.templateSubject.value = '';
        if (el.templateBody) el.templateBody.value = '';
    });
    safelyOn(el.startCampaignBtn, 'click', startCampaign);
    safelyOn(el.skipContactBtn, 'click', skipContact);
    safelyOn(el.openEmailLink, 'click', handleOpenEmailLink);
    
    safelyOn(el.emailClientSelect, 'change', (e) => {
        state.emailClient = e.target.value;
        try {
            chrome.storage.local.set({ copy_emailClient: state.emailClient });
        } catch (error) {
            console.error('Storage error on saving email client:', error);
            showToast('Failed to save email client preference', 'error');
        }
        if (state.campaignActive) restoreCampaignUI();
    });
    
    // Calendar tool event listeners are set up in calendar.js initCalendar()
}

// Load state from storage
function loadState() {
    try {
        chrome.storage.local.get(['copy_records', 'copy_templates', 'copy_emailClient', 'copy_campaignState', 'copy_notes'], (res) => {
            state.records = res.copy_records || [];
            state.templates = res.copy_templates || [{ id: Date.now(), name: 'Default', subject: 'Hello {name}', body: 'Hi {name}, noticed your work at {company}...' }];
            state.emailClient = res.copy_emailClient || 'default';
            state.notes = res.copy_notes || [];
            
            if (res.copy_campaignState) {
                state.campaignActive = res.copy_campaignState.active;
                state.campaignIndex = res.copy_campaignState.index;
                state.currentTemplateId = res.copy_campaignState.templateId;
            }

            // Initialize UI
            if (el.emailClientSelect) el.emailClientSelect.value = state.emailClient;
            
            // Render initial state
            if (typeof renderRecords === 'function') renderRecords();
            if (typeof renderTemplates === 'function') renderTemplates();
            if (state.campaignActive && typeof restoreCampaignUI === 'function') restoreCampaignUI();
            
            // Initialize notes after state is loaded
            if (typeof initNotes === 'function') {
                initNotes();
            }
        });
    } catch (error) {
        console.error('Storage error on load:', error);
        showToast('Failed to load data', 'error');
    }
}

// Initialize everything when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initializeElements();
    setupEventListeners();
    loadState();
    
    // Initialize each tool
    if (typeof initExtract === 'function') initExtract();
    if (typeof initAutomation === 'function') initAutomation();
    if (typeof initCalendar === 'function') initCalendar();
    
    // Notes initialization is now handled in loadState() callback to ensure data is loaded first
});

