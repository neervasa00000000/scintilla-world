// State
const state = {
    records: [],
    currentEmails: new Set(),
    currentPhones: new Set(),
    selection: ""
};

// DOM
const el = {
    pasteArea: document.getElementById('pasteArea'),
    floatMenu: document.getElementById('floatMenu'),
    recordsList: document.getElementById('recordsList'),
    emptyState: document.getElementById('emptyState'),
    countSpan: document.getElementById('count'),
    countDisplay: document.getElementById('countDisplay'),
    toastContainer: document.getElementById('toastContainer'),
    inputs: { first: document.getElementById('firstName'), last: document.getElementById('lastName') },
    lists: { email: document.getElementById('emailList'), phone: document.getElementById('phoneList') },
    counts: { email: document.getElementById('emailCount'), phone: document.getElementById('phoneCount') }
};

const patterns = {
    email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    phone: /(?:(?:\+?61|0)[2-478](?:[ -]?[0-9]){8})|(?:\+?61|0)4(?:[ -]?[0-9]){8}|(?:\(0[2-478]\)(?:[ -]?[0-9]){8})|\b\d{4}[ -]?\d{3}[ -]?\d{3}\b/g
};

// Toast notification
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    const colors = {
        success: { bg: 'bg-emerald-500', icon: 'fa-check-circle' },
        error: { bg: 'bg-red-500', icon: 'fa-exclamation-circle' },
        info: { bg: 'bg-blue-500', icon: 'fa-info-circle' }
    };
    const color = colors[type] || colors.success;
    toast.className = `toast ${color.bg} px-4 py-2.5 rounded-lg shadow-xl mb-2 pointer-events-auto`;
    toast.innerHTML = `
        <div class="flex items-center gap-2">
            <i class="fa-solid ${color.icon} text-xs"></i>
            <span class="text-xs font-semibold">${message}</span>
        </div>
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

// Functions
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

el.pasteArea.addEventListener('paste', (e) => {
    const text = (e.clipboardData || window.clipboardData).getData('text');
    setTimeout(() => scanText(el.pasteArea.innerText), 50);
});

el.pasteArea.addEventListener('input', () => {
    scanText(el.pasteArea.innerText);
});

function scanText(text) {
    if(!text) return;
    const emails = text.match(patterns.email) || [];
    const phones = text.match(patterns.phone) || [];
    let added = 0;
    
    emails.forEach(e => {
        if(!state.currentEmails.has(e.trim())) { 
            state.currentEmails.add(e.trim()); 
            added++; 
        }
    });
    
    phones.forEach(p => {
        const clean = p.trim();
        if(clean.length > 6 && !state.currentPhones.has(clean)) { 
            state.currentPhones.add(clean); 
            added++; 
        }
    });
    
    if(added > 0) {
        renderChips();
        updateStats();
    }
}

function updateStats() {
    el.counts.email.innerText = state.currentEmails.size;
    el.counts.phone.innerText = state.currentPhones.size;
}

document.addEventListener('mouseup', (e) => {
    const sel = window.getSelection();
    const text = sel.toString().trim();
    if(text.length > 0 && el.pasteArea.contains(sel.anchorNode)) {
        state.selection = text;
        const rect = sel.getRangeAt(0).getBoundingClientRect();
        el.floatMenu.style.display = 'block';
        el.floatMenu.style.left = `${rect.left + (rect.width/2) - 70}px`;
        el.floatMenu.style.top = `${rect.top - 45}px`;
    } else if (!el.floatMenu.contains(e.target)) {
        el.floatMenu.style.display = 'none';
    }
});

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
    renderList(el.lists.email, state.currentEmails, 'chip');
    renderList(el.lists.phone, state.currentPhones, 'chip chip-phone');
}

function renderList(container, set, chipClass) {
    container.innerHTML = '';
    if(set.size === 0) {
        container.innerHTML = '<span class="text-xs text-zinc-500 italic">No data...</span>';
        return;
    }
    set.forEach(item => {
        const div = document.createElement('div');
        div.className = `${chipClass} px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 cursor-pointer text-white`;
        div.innerHTML = `
            <span class="flex-1">${item}</span>
            <i class="fa-solid fa-xmark text-[10px] opacity-60 hover:opacity-100"></i>
        `;
        div.onclick = (e) => {
            e.stopPropagation();
            set.delete(item); 
            renderChips();
            updateStats();
            showToast('Removed', 'info');
        };
        container.appendChild(div);
    });
}

function addRecord() {
    const f = el.inputs.first.value.trim();
    const l = el.inputs.last.value.trim();
    if(!f && state.currentEmails.size === 0 && state.currentPhones.size === 0) {
        showToast('Add at least one field', 'error');
        return;
    }
    
    const btn = document.getElementById('addBtn');
    btn.style.transform = 'scale(0.95)';
    setTimeout(() => btn.style.transform = '', 150);
    
    state.records.push({
        id: Date.now(),
        f, l, 
        emails: Array.from(state.currentEmails),
        phones: Array.from(state.currentPhones)
    });
    
    renderRecords();
    clearInputs();
    chrome.storage.local.set({ extractflow_records: state.records });
    showToast('Record added', 'success');
}

function renderRecords() {
    el.recordsList.innerHTML = '';
    const count = state.records.length;
    el.countSpan.innerText = count;
    el.countDisplay.innerText = count;
    el.emptyState.style.display = count ? 'none' : 'flex';
    
    state.records.forEach((r, index) => {
        const div = document.createElement('div');
        div.className = 'record-card rounded-lg p-3';
        div.style.animationDelay = `${index * 0.03}s`;
        
        const eChips = r.emails.map(e => 
            `<span class="inline-flex items-center px-2 py-1 rounded-md bg-purple-500/20 text-purple-300 text-[10px] font-medium border border-purple-500/30 mr-1 mb-1">${e}</span>`
        ).join('');
        
        const pChips = r.phones.map(p => 
            `<span class="inline-flex items-center px-2 py-1 rounded-md bg-emerald-500/20 text-emerald-300 text-[10px] font-medium border border-emerald-500/30 mr-1 mb-1">${p}</span>`
        ).join('');

        div.innerHTML = `
            <div class="flex items-start justify-between gap-2">
                <div class="flex-1 min-w-0">
                    <div class="font-semibold text-sm text-white mb-2">${r.f || 'Unknown'} ${r.l || ''}</div>
                    <div class="flex flex-wrap gap-1">
                        ${eChips} ${pChips}
                    </div>
                </div>
                <button onclick="deleteRec(${r.id})" class="w-7 h-7 rounded-lg bg-red-500/20 hover:bg-red-500/30 active:bg-red-500/40 text-red-400 flex items-center justify-center text-xs btn flex-shrink-0 border border-red-500/30">
                    <i class="fa-solid fa-trash text-[10px]"></i>
                </button>
            </div>
        `;
        el.recordsList.appendChild(div);
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
    if(confirm("Clear all data? This cannot be undone.")) {
        state.records = [];
        renderRecords();
        clearInputs();
        el.pasteArea.innerText = '';
        chrome.storage.local.remove('extractflow_records');
        showToast('All data cleared', 'info');
    }
}

function downloadCSV() {
    if(!state.records.length) {
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

