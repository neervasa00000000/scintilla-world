// Tab Amnesty Desktop - Main Application Script
// Adapted from Chrome Extension for Electron

let currentTabId = null;
let stats = { tabsSnoozed: 0, ramSaved: 0, timeSaved: 0 };
let tabs = []; // Store tabs in memory for desktop app
let snoozedTabs = []; // Store snoozed tabs

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await refreshAll();
    setupEventListeners();
    
    // Simulate some demo tabs for desktop app
    if (tabs.length === 0) {
        loadDemoTabs();
    }
});

// Load demo tabs for desktop app
function loadDemoTabs() {
    // Check if we have stored tabs
    const stored = localStorage.getItem('tabAmnestyTabs');
    if (stored) {
        tabs = JSON.parse(stored);
    } else {
        // Load initial demo tabs
        tabs = [
            { id: 1, url: 'https://example.com', title: 'Example Website', favIconUrl: '' },
            { id: 2, url: 'https://github.com', title: 'GitHub', favIconUrl: '' },
            { id: 3, url: 'https://stackoverflow.com', title: 'Stack Overflow', favIconUrl: '' }
        ];
        localStorage.setItem('tabAmnestyTabs', JSON.stringify(tabs));
    }
    refreshAll();
}

// Refresh all data
async function refreshAll() {
    // 1. Preserve scroll positions
    const openList = document.getElementById('openTabsList');
    const snoozedList = document.getElementById('snoozedList');
    const scrollPosOpen = openList ? openList.scrollTop : 0;
    const scrollPosSnoozed = snoozedList ? snoozedList.scrollTop : 0;

    // 2. Load data
    await Promise.all([loadStats(), loadTabs(), loadSnoozedTabs()]);
    updateStats();

    // 3. Restore scroll positions
    if (document.getElementById('openTabsList')) document.getElementById('openTabsList').scrollTop = scrollPosOpen;
    if (document.getElementById('snoozedList')) document.getElementById('snoozedList').scrollTop = scrollPosSnoozed;
}

async function loadStats() {
    // Load from localStorage for desktop app
    const stored = localStorage.getItem('tabAmnestyStats');
    if (stored) {
        stats = JSON.parse(stored);
    } else {
        stats.tabsSnoozed = snoozedTabs.length;
        stats.ramSaved = snoozedTabs.length * 75;
        stats.timeSaved = Math.floor(snoozedTabs.length * 0.5);
    }
}

// --- TAB MANAGEMENT ---

async function loadTabs() {
    const openTabsList = document.getElementById('openTabsList');
    const openTabCount = document.getElementById('openTabCount');
    
    // Load from localStorage
    const stored = localStorage.getItem('tabAmnestyTabs');
    if (stored) {
        tabs = JSON.parse(stored);
    }
    
    const filteredTabs = tabs.filter(tab => 
        !tab.url.startsWith('chrome://') && 
        !tab.url.startsWith('edge://') &&
        !tab.url.startsWith('about:')
    );
    
    openTabCount.textContent = filteredTabs.length;
    openTabsList.innerHTML = '';
    
    if (filteredTabs.length === 0) {
        openTabsList.innerHTML = `<div class="empty-state"><div class="empty-icon">📑</div><p class="empty-title">No tabs to manage</p><p class="empty-hint">Open some tabs to get started</p></div>`;
        return;
    }
    
    // PERFORMANCE: Use DocumentFragment to minimize reflows
    const fragment = document.createDocumentFragment();
    filteredTabs.forEach(tab => fragment.appendChild(createTabItem(tab)));
    openTabsList.appendChild(fragment);
}

function createTabItem(tab) {
    const tabItem = document.createElement('div');
    tabItem.className = 'tab-item';
    tabItem.dataset.tabId = tab.id;
    
    const tabInfo = document.createElement('div');
    tabInfo.className = 'tab-info';
    
    const faviconEl = document.createElement('div');
    faviconEl.className = 'tab-favicon';
    
    // Try to get favicon from URL
    try {
        const url = new URL(tab.url);
        const faviconUrl = `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=32`;
        const img = document.createElement('img');
        img.src = faviconUrl;
        img.alt = '';
        img.onerror = function() {
            faviconEl.textContent = '🌐';
            faviconEl.style.fontSize = '10px';
        };
        faviconEl.appendChild(img);
    } catch (e) {
        faviconEl.textContent = '🌐';
        faviconEl.style.fontSize = '10px';
    }
    
    const titleEl = document.createElement('div');
    titleEl.className = 'tab-title';
    titleEl.textContent = tab.title || tab.url;
    titleEl.title = tab.title || tab.url;
    
    tabInfo.appendChild(faviconEl);
    tabInfo.appendChild(titleEl);
    
    const actions = document.createElement('div');
    actions.className = 'tab-actions';
    
    const snoozeBtn = document.createElement('button');
    snoozeBtn.className = 'btn btn-primary snooze-btn';
    snoozeBtn.textContent = 'Snooze';
    snoozeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        snoozeTab(tab.id);
    });
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'btn btn-danger close-btn';
    closeBtn.textContent = 'Close';
    closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeTab(tab.id);
    });
    
    actions.appendChild(snoozeBtn);
    actions.appendChild(closeBtn);
    
    tabItem.appendChild(tabInfo);
    tabItem.appendChild(actions);
    
    return tabItem;
}

async function loadSnoozedTabs() {
    // Load from localStorage
    const stored = localStorage.getItem('tabAmnestySnoozed');
    if (stored) {
        snoozedTabs = JSON.parse(stored);
    }
    
    const snoozedList = document.getElementById('snoozedList');
    const countBadge = document.getElementById('snoozedTabCount');
    
    countBadge.textContent = snoozedTabs.length;
    snoozedList.innerHTML = '';
    
    if (snoozedTabs.length === 0) {
        snoozedList.innerHTML = `<div class="empty-state"><div class="empty-icon">💤</div><p class="empty-title">No snoozed tabs</p><p class="empty-hint">Snooze tabs to see them here</p></div>`;
        return;
    }

    // Sort by wake time (soonest first)
    snoozedTabs.sort((a, b) => a.wakeTime - b.wakeTime);
    
    const fragment = document.createDocumentFragment();
    snoozedTabs.forEach(tab => fragment.appendChild(createSnoozedItem(tab)));
    snoozedList.appendChild(fragment);
}

function createSnoozedItem(snoozedTab) {
    const item = document.createElement('div');
    item.className = 'snoozed-item';
    item.dataset.tabId = snoozedTab.tabId;
    
    const timeUntil = formatTimeUntil(snoozedTab.wakeTime);
    
    const header = document.createElement('div');
    header.className = 'snoozed-header';
    
    const title = document.createElement('div');
    title.className = 'snoozed-title';
    title.textContent = snoozedTab.title || 'Untitled';
    title.title = snoozedTab.title || 'Untitled';
    
    const time = document.createElement('div');
    time.className = 'snoozed-time';
    time.innerHTML = `⏰ ${timeUntil}`;
    
    header.appendChild(title);
    header.appendChild(time);
    
    const actions = document.createElement('div');
    actions.className = 'snoozed-actions';
    
    const reopenBtn = document.createElement('button');
    reopenBtn.className = 'btn btn-primary btn-small reopen-btn';
    reopenBtn.textContent = 'Open Now';
    reopenBtn.addEventListener('click', () => reopenTab(snoozedTab.tabId));
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-danger btn-small delete-btn';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', () => deleteSnooze(snoozedTab.tabId));
    
    actions.appendChild(reopenBtn);
    actions.appendChild(deleteBtn);
    
    item.appendChild(header);
    item.appendChild(actions);
    
    return item;
}

// --- ACTIONS ---

function snoozeTab(tabId) {
    currentTabId = tabId;
    const modal = document.getElementById('snoozeModal');
    if (modal) {
        modal.classList.add('active');
    }
}

async function performSnooze(tabId, wakeTime, timeOption) {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;

    // Add to snoozed tabs
    snoozedTabs.push({
        tabId: tab.id,
        url: tab.url,
        title: tab.title,
        favIconUrl: tab.favIconUrl,
        wakeTime: wakeTime,
        snoozedAt: Date.now(),
        timeOption: timeOption
    });
    
    // Save to localStorage
    localStorage.setItem('tabAmnestySnoozed', JSON.stringify(snoozedTabs));
    
    // Schedule wake-up (using setTimeout for desktop)
    const delay = wakeTime - Date.now();
    if (delay > 0) {
        setTimeout(() => {
            wakeUpTab(tabId, wakeTime);
        }, delay);
    }
    
    // Remove from open tabs
    tabs = tabs.filter(t => t.id !== tabId);
    localStorage.setItem('tabAmnestyTabs', JSON.stringify(tabs));
}

function wakeUpTab(tabId, wakeTime) {
    const snoozedTab = snoozedTabs.find(st => st.tabId === tabId && st.wakeTime === wakeTime);
    if (snoozedTab) {
        // Show notification (desktop notification)
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Tab Amnesty', {
                body: `"${snoozedTab.title}" is ready to reopen!`,
                icon: 'lazy-sleep.png'
            });
        }
        
        // Optionally auto-open
        // reopenTab(tabId);
    }
}

// BATCH ACTION: Clear All / Weekend
async function batchSnooze(timeOption) {
    const filteredTabs = tabs.filter(tab => 
        !tab.url.startsWith('chrome://') && 
        !tab.url.startsWith('edge://') &&
        !tab.url.startsWith('chrome-extension://') &&
        !tab.url.startsWith('about:')
    );
    
    if (filteredTabs.length === 0) {
        showToast('No tabs to snooze', 'error');
        return;
    }

    const wakeTime = calculateWakeTime(timeOption);

    // Prepare all snoozes
    filteredTabs.forEach(tab => {
        snoozedTabs.push({
            tabId: tab.id,
            url: tab.url,
            title: tab.title,
            favIconUrl: tab.favIconUrl,
            wakeTime: wakeTime,
            snoozedAt: Date.now(),
            timeOption: timeOption
        });
        
        // Schedule wake-up
        const delay = wakeTime - Date.now();
        if (delay > 0) {
            setTimeout(() => {
                wakeUpTab(tab.id, wakeTime);
            }, delay);
        }
    });

    // Remove from open tabs
    tabs = tabs.filter(tab => !filteredTabs.includes(tab));
    
    // Save to localStorage
    localStorage.setItem('tabAmnestySnoozed', JSON.stringify(snoozedTabs));
    localStorage.setItem('tabAmnestyTabs', JSON.stringify(tabs));

    // Refresh UI once
    await refreshAll();
    showToast(`Snoozed ${filteredTabs.length} tabs!`, 'success');
}

async function reopenTab(tabId) {
    const targetTab = snoozedTabs.find(st => st.tabId === tabId);
    
    if (targetTab) {
        // Add back to open tabs
        tabs.push({
            id: targetTab.tabId,
            url: targetTab.url,
            title: targetTab.title,
            favIconUrl: targetTab.favIconUrl
        });
        
        // Remove from snoozed
        snoozedTabs = snoozedTabs.filter(st => st.tabId !== tabId);
        
        // Save to localStorage
        localStorage.setItem('tabAmnestyTabs', JSON.stringify(tabs));
        localStorage.setItem('tabAmnestySnoozed', JSON.stringify(snoozedTabs));
        
        await refreshAll();
        showToast('Tab reopened', 'success');
    }
}

async function deleteSnooze(tabId) {
    const targetTab = snoozedTabs.find(st => st.tabId === tabId);
    
    if (targetTab) {
        snoozedTabs = snoozedTabs.filter(st => st.tabId !== tabId);
        localStorage.setItem('tabAmnestySnoozed', JSON.stringify(snoozedTabs));
        
        await refreshAll();
        showToast('Snooze cancelled', 'success');
    }
}

async function closeTab(tabId) {
    tabs = tabs.filter(t => t.id !== tabId);
    localStorage.setItem('tabAmnestyTabs', JSON.stringify(tabs));
    await refreshAll();
    showToast('Tab closed', 'success');
}

// --- UTILS ---

function calculateWakeTime(option) {
    const now = new Date();
    let wakeTime = new Date();
    const dayOfWeek = now.getDay();
    
    switch(option) {
        case 'tonight':
            wakeTime.setHours(21, 0, 0, 0);
            if (wakeTime <= now) wakeTime.setDate(wakeTime.getDate() + 1);
            break;
        case 'tomorrow':
            wakeTime.setDate(now.getDate() + 1);
            wakeTime.setHours(9, 0, 0, 0);
            break;
        case 'weekend':
            let daysUntilSat = (6 - dayOfWeek + 7) % 7;
            if (daysUntilSat === 0) daysUntilSat = 7;
            wakeTime.setDate(now.getDate() + daysUntilSat);
            wakeTime.setHours(9, 0, 0, 0);
            break;
        case 'nextweek':
            let daysUntilMon = (1 - dayOfWeek + 7) % 7;
            if (daysUntilMon === 0) daysUntilMon = 7;
            wakeTime.setDate(now.getDate() + daysUntilMon);
            wakeTime.setHours(9, 0, 0, 0);
            break;
    }
    
    return wakeTime.getTime();
}

function updateStats() {
    stats.tabsSnoozed = snoozedTabs.length;
    stats.ramSaved = snoozedTabs.length * 75;
    stats.timeSaved = Math.floor(snoozedTabs.length * 0.5);
    
    localStorage.setItem('tabAmnestyStats', JSON.stringify(stats));
    
    const tabsSnoozedEl = document.getElementById('tabsSnoozed');
    const ramSavedEl = document.getElementById('ramSaved');
    const timeSavedEl = document.getElementById('timeSaved');
    
    if (tabsSnoozedEl) tabsSnoozedEl.textContent = stats.tabsSnoozed;
    if (ramSavedEl) ramSavedEl.textContent = `${stats.ramSaved} MB`;
    if (timeSavedEl) timeSavedEl.textContent = `${stats.timeSaved}h`;
}

function formatTimeUntil(timestamp) {
    const diff = timestamp - Date.now();
    if (diff <= 0) return 'Ready';
    
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${mins % 60}m`;
    return `${mins}m`;
}

function showToast(msg, type = 'success') {
    const toast = document.getElementById('toast');
    const toastIcon = document.getElementById('toastIcon');
    const toastMessage = document.getElementById('toastMessage');
    
    if (!toast || !toastIcon || !toastMessage) return;
    
    toastMessage.textContent = msg;
    toastIcon.textContent = type === 'success' ? '✓' : '✕';
    
    if (type === 'success') {
        toastIcon.style.color = 'var(--success)';
        toast.style.borderColor = 'var(--success)';
    } else {
        toastIcon.style.color = 'var(--danger)';
        toast.style.borderColor = 'var(--danger)';
    }
    
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// Add new tab function
function addNewTab() {
    const url = prompt('Enter URL or website name:');
    if (!url) return;
    
    let tabUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        tabUrl = 'https://' + url;
    }
    
    const newTab = {
        id: Date.now(),
        url: tabUrl,
        title: url,
        favIconUrl: ''
    };
    
    tabs.push(newTab);
    localStorage.setItem('tabAmnestyTabs', JSON.stringify(tabs));
    refreshAll();
    showToast('Tab added!', 'success');
}

function setupEventListeners() {
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
    
    // Add Tab button
    const addTabBtn = document.getElementById('addTabBtn');
    if (addTabBtn) {
        addTabBtn.addEventListener('click', addNewTab);
    }
    
    // Modal close button
    const closeModalBtn = document.getElementById('closeModalBtn');
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeModal();
        });
    }
    
    // Modal overlay - close on click
    const modal = document.getElementById('snoozeModal');
    if (modal) {
        const overlay = modal.querySelector('.modal-overlay');
        if (overlay) {
            overlay.addEventListener('click', (e) => {
                e.stopPropagation();
                closeModal();
            });
        }
        
        // Prevent modal content clicks from closing modal
        const modalContent = modal.querySelector('.modal-content');
        if (modalContent) {
            modalContent.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }
    }
    
    // Quick Actions
    const clearAllBtn = document.getElementById('clearAllBtn');
    if (clearAllBtn) {
        clearAllBtn.addEventListener('click', () => batchSnooze('tomorrow'));
    }
    
    const snoozeWeekendBtn = document.getElementById('snoozeWeekendBtn');
    if (snoozeWeekendBtn) {
        snoozeWeekendBtn.addEventListener('click', () => batchSnooze('weekend'));
    }
    
    // Snooze Options - Use event delegation
    const modalBody = document.querySelector('.modal-body');
    if (modalBody) {
        modalBody.addEventListener('click', async (e) => {
            const option = e.target.closest('.snooze-option');
            if (!option) return;
            
            e.stopPropagation();
            
            // Remove selected state from all options
            document.querySelectorAll('.snooze-option').forEach(o => o.classList.remove('selected'));
            // Add selected state to clicked option
            option.classList.add('selected');
            
            const timeOption = option.dataset.time;
            const time = calculateWakeTime(timeOption);
            
            if (currentTabId && time) {
                await performSnooze(currentTabId, time, timeOption);
                closeModal();
                await refreshAll();
                showToast('Tab snoozed!', 'success');
            }
        });
    }
}

// Close modal function
function closeModal() {
    const modal = document.getElementById('snoozeModal');
    if (modal) {
        modal.classList.remove('active');
        currentTabId = null;
        document.querySelectorAll('.snooze-option').forEach(opt => {
            opt.classList.remove('selected');
        });
    }
}

// Check for tabs that should wake up
setInterval(() => {
    const now = Date.now();
    snoozedTabs.forEach(tab => {
        if (tab.wakeTime <= now && tab.wakeTime > now - 60000) { // Within last minute
            wakeUpTab(tab.tabId, tab.wakeTime);
        }
    });
}, 60000); // Check every minute

