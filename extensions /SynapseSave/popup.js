// SynapseSave - Optimized Popup Script

let currentTabId = null;
let stats = { tabsSnoozed: 0, ramSaved: 0, timeSaved: 0 };

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await refreshAll();
    setupEventListeners();
});

// --- CORE DATA LOADING ---

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
    const result = await chrome.storage.local.get(['snoozedTabs']);
    const snoozedTabs = result.snoozedTabs || [];
    
    stats.tabsSnoozed = snoozedTabs.length;
    stats.ramSaved = snoozedTabs.length * 75; // ~75MB avg
    stats.timeSaved = Math.floor(snoozedTabs.length * 0.5);
}

// --- TAB MANAGEMENT ---

async function loadTabs() {
    const tabs = await chrome.tabs.query({});
    const openTabsList = document.getElementById('openTabsList');
    const openTabCount = document.getElementById('openTabCount');
    
    const filteredTabs = tabs.filter(tab => 
        !tab.url.startsWith('chrome://') && 
        !tab.url.startsWith('edge://') &&
        !tab.url.startsWith('about:')
    );
    
    openTabCount.textContent = filteredTabs.length;
    openTabsList.innerHTML = ''; // Clear current list
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
    
    // MODERN FAVICON FETCHING (MV3)
    const faviconUrl = new URL(chrome.runtime.getURL("/_favicon/"));
    faviconUrl.searchParams.set("pageUrl", tab.url);
    faviconUrl.searchParams.set("size", "32");
    
    const tabInfo = document.createElement('div');
    tabInfo.className = 'tab-info';
    
    const faviconEl = document.createElement('div');
    faviconEl.className = 'tab-favicon';
    const img = document.createElement('img');
    img.src = faviconUrl.toString();
    img.alt = '';
    img.onerror = function() {
        faviconEl.textContent = '🌐';
        faviconEl.style.fontSize = '10px';
    };
    faviconEl.appendChild(img);
    
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
    const result = await chrome.storage.local.get(['snoozedTabs']);
    const snoozedTabs = result.snoozedTabs || [];
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
    const wakeDate = new Date(snoozedTab.wakeTime);
    const wakeTimeStr = wakeDate.toLocaleString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
    });
    
    const header = document.createElement('div');
    header.className = 'snoozed-header';
    
    const title = document.createElement('div');
    title.className = 'snoozed-title';
    title.textContent = snoozedTab.title || 'Untitled';
    title.title = snoozedTab.title || 'Untitled';
    
    const time = document.createElement('div');
    time.className = 'snoozed-time';
    time.innerHTML = `⏰ ${timeUntil}<br><span style="font-size: 0.6rem; opacity: 0.7;">${wakeTimeStr}</span>`;
    time.title = `Will wake at: ${wakeTimeStr}`;
    
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

// 1. Snooze Single
function snoozeTab(tabId) {
    currentTabId = tabId;
    const modal = document.getElementById('snoozeModal');
    if (modal) {
        modal.classList.add('active');
    }
}

// 2. Perform Snooze (Optimized Logic)
async function performSnooze(tabId, wakeTime, timeOption) {
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    if (!tab) return;

    // Get tab group ID if tab belongs to a group
    let groupId = null;
    if (tab.groupId && tab.groupId !== chrome.tabs.TAB_GROUP_ID_NONE) {
        groupId = tab.groupId;
    }

    // 1. Update Storage
    const result = await chrome.storage.local.get(['snoozedTabs']);
    const snoozedTabs = result.snoozedTabs || [];
    
    snoozedTabs.push({
        tabId: tab.id,
        url: tab.url,
        title: tab.title,
        favIconUrl: tab.favIconUrl, // Backup
        wakeTime: wakeTime,
        snoozedAt: Date.now(),
        timeOption: timeOption,
        groupId: groupId // Store original group ID
    });
    await chrome.storage.local.set({ snoozedTabs });

    // 2. Set Alarm
    await chrome.alarms.create(`snooze_${tab.id}_${wakeTime}`, { when: wakeTime });

    // 3. Close Tab
    await chrome.tabs.remove(tab.id);
}

// 3. BATCH ACTION: Clear All / Weekend
// This is the biggest performance fix. It does all logic first, then refreshes UI ONCE.
async function batchSnooze(timeOption) {
    const tabs = await chrome.tabs.query({ currentWindow: true }); // Only snooze tabs in current window usually
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
    const result = await chrome.storage.local.get(['snoozedTabs']);
    const snoozedTabs = result.snoozedTabs || [];

    // Prepare all data promises
    const snoozePromises = filteredTabs.map(async (tab) => {
        // Get tab group ID if tab belongs to a group
        let groupId = null;
        if (tab.groupId && tab.groupId !== chrome.tabs.TAB_GROUP_ID_NONE) {
            groupId = tab.groupId;
        }
        
        snoozedTabs.push({
            tabId: tab.id,
            url: tab.url,
            title: tab.title,
            favIconUrl: tab.favIconUrl,
            wakeTime: wakeTime,
            snoozedAt: Date.now(),
            timeOption: timeOption,
            groupId: groupId // Store original group ID
        });
        
        // Create alarm
        await chrome.alarms.create(`snooze_${tab.id}_${wakeTime}`, { when: wakeTime });
        
        // Close tab
        return chrome.tabs.remove(tab.id);
    });

    // Wait for all tabs to close and alarms to set
    await Promise.all(snoozePromises);
    
    // Save storage once
    await chrome.storage.local.set({ snoozedTabs });

    // Refresh UI once
    await refreshAll();
    showToast(`Snoozed ${filteredTabs.length} tabs!`, 'success');
}

async function reopenTab(tabId) {
    const result = await chrome.storage.local.get(['snoozedTabs']);
    let snoozedTabs = result.snoozedTabs || [];
    const targetTab = snoozedTabs.find(st => st.tabId === tabId);
    
    if (targetTab) {
        // Create the tab
        const newTab = await chrome.tabs.create({ 
            url: targetTab.url, 
            active: false 
        });
        
        // Restore to original group if it had one
        if (targetTab.groupId !== null && targetTab.groupId !== undefined) {
            try {
                // Check if the group still exists
                const group = await chrome.tabGroups.get(targetTab.groupId).catch(() => null);
                if (group) {
                    // Group exists, add tab back to it
                    await chrome.tabs.group({
                        groupId: targetTab.groupId,
                        tabIds: [newTab.id]
                    });
                } else {
                    // Group doesn't exist anymore, try to create a new group with the same properties
                    // Note: We can't restore exact group properties, but we can at least group it
                    // For now, we'll just leave it ungrouped if the original group is gone
                }
            } catch (error) {
                // If grouping fails, tab will just open normally (not grouped)
                console.log('Could not restore tab to group:', error);
            }
        }
        
        // Cleanup
        chrome.alarms.clear(`snooze_${tabId}_${targetTab.wakeTime}`);
        snoozedTabs = snoozedTabs.filter(st => st.tabId !== tabId);
        await chrome.storage.local.set({ snoozedTabs });
        
        await refreshAll();
        showToast('Tab reopened', 'success');
    }
}

async function deleteSnooze(tabId) {
    const result = await chrome.storage.local.get(['snoozedTabs']);
    const snoozedTabs = result.snoozedTabs || [];
    const targetTab = snoozedTabs.find(st => st.tabId === tabId);
    
    if (targetTab) {
        chrome.alarms.clear(`snooze_${tabId}_${targetTab.wakeTime}`);
        const updated = snoozedTabs.filter(st => st.tabId !== tabId);
        await chrome.storage.local.set({ snoozedTabs: updated });
        
        await refreshAll();
        showToast('Snooze cancelled', 'success');
    }
}

async function closeTab(tabId) {
    await chrome.tabs.remove(tabId);
    await refreshAll();
}

// --- UTILS ---

function calculateWakeTime(option) {
    const now = new Date();
    let wakeTime = new Date();
    const dayOfWeek = now.getDay();
    
    switch(option) {
        case 'oneday':
            // Add exactly 24 hours from now (not a fixed time)
            wakeTime = new Date(now.getTime() + (24 * 60 * 60 * 1000));
            break;
        case 'nextweek':
            // Add exactly 7 days from now at 9:00 AM
            wakeTime = new Date(now);
            wakeTime.setDate(now.getDate() + 7);
            wakeTime.setHours(9, 0, 0, 0);
            wakeTime.setMinutes(0);
            wakeTime.setSeconds(0);
            wakeTime.setMilliseconds(0);
            break;
    }
    
    return wakeTime.getTime();
}

function updateStats() {
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
    const remainingHours = hours % 24;
    const remainingMins = mins % 60;
    
    // More accurate display
    if (days > 0) {
        if (remainingHours > 0) {
            return `${days}d ${remainingHours}h`;
        }
        return `${days}d`;
    }
    if (hours > 0) {
        if (remainingMins > 0) {
            return `${hours}h ${remainingMins}m`;
        }
        return `${hours}h`;
    }
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

function setupEventListeners() {
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
    
    // Quick Actions - USING THE NEW BATCH FUNCTION
    const clearAllBtn = document.getElementById('clearAllBtn');
    if (clearAllBtn) {
        clearAllBtn.addEventListener('click', () => batchSnooze('oneday'));
    }
    
    // Snooze Options - Use event delegation for better performance
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
                await refreshAll(); // Refresh UI only after single snooze
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

// Also refresh when popup becomes visible (in case it was already open)
document.addEventListener('visibilitychange', async () => {
    if (!document.hidden) {
        await refreshAll();
    }
});

