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
    await Promise.all([loadStats(), loadDuplicateTabs(), loadTabs(), loadSnoozedTabs()]);
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

// --- DUPLICATE TAB DETECTION ---

async function loadDuplicateTabs() {
    const tabs = await chrome.tabs.query({});
    const filteredTabs = tabs.filter(tab => 
        !tab.url.startsWith('chrome://') && 
        !tab.url.startsWith('edge://') &&
        !tab.url.startsWith('about:') &&
        !tab.url.startsWith('chrome-extension://')
    );
    
    // Group tabs by domain (hostname) instead of full URL
    // This way all YouTube tabs are grouped together, all Facebook tabs, etc.
    const domainGroups = {};
    filteredTabs.forEach(tab => {
        try {
            const url = new URL(tab.url);
            // Normalize domain: remove 'www.' prefix for cleaner grouping
            const domain = url.hostname.replace(/^www\./, '');
            
            if (!domainGroups[domain]) {
                domainGroups[domain] = [];
            }
            domainGroups[domain].push(tab);
        } catch (error) {
            // Skip invalid URLs
            console.log('Invalid URL:', tab.url);
        }
    });
    
    // Find duplicates (domains with more than 1 tab)
    const duplicates = Object.entries(domainGroups)
        .filter(([domain, tabs]) => tabs.length > 1)
        .map(([domain, tabs]) => ({ domain, tabs }));
    
    const duplicateSection = document.getElementById('duplicateTabsSection');
    const duplicateGroupsList = document.getElementById('duplicateGroupsList');
    const duplicateTabCount = document.getElementById('duplicateTabCount');
    
    if (duplicates.length === 0) {
        duplicateSection.style.display = 'none';
        return;
    }
    
    duplicateSection.style.display = 'block';
    
    // Calculate total duplicate tabs (excluding one from each group)
    const totalDuplicates = duplicates.reduce((sum, group) => sum + (group.tabs.length - 1), 0);
    duplicateTabCount.textContent = totalDuplicates;
    
    duplicateGroupsList.innerHTML = '';
    
    const fragment = document.createDocumentFragment();
    duplicates.forEach(({ domain, tabs }) => {
        fragment.appendChild(createDuplicateGroup(domain, tabs));
    });
    duplicateGroupsList.appendChild(fragment);
}

function createDuplicateGroup(domain, tabs) {
    const group = document.createElement('div');
    group.className = 'duplicate-group';
    
    const header = document.createElement('div');
    header.className = 'duplicate-group-header';
    
    const urlInfo = document.createElement('div');
    urlInfo.className = 'duplicate-url-info';
    
    // Get favicon from first tab's URL
    const faviconEl = document.createElement('div');
    faviconEl.className = 'tab-favicon';
    try {
        const firstTabUrl = tabs[0].url;
        const faviconUrl = new URL(chrome.runtime.getURL("/_favicon/"));
        faviconUrl.searchParams.set("pageUrl", firstTabUrl);
        faviconUrl.searchParams.set("size", "16");
        const img = document.createElement('img');
        img.src = faviconUrl.toString();
        img.alt = '';
        img.onerror = () => {
            faviconEl.textContent = '🌐';
            faviconEl.style.fontSize = '8px';
            faviconEl.style.display = 'flex';
            faviconEl.style.alignItems = 'center';
            faviconEl.style.justifyContent = 'center';
        };
        faviconEl.appendChild(img);
    } catch (error) {
        faviconEl.textContent = '🌐';
        faviconEl.style.fontSize = '8px';
        faviconEl.style.display = 'flex';
        faviconEl.style.alignItems = 'center';
        faviconEl.style.justifyContent = 'center';
    }
    
    const urlText = document.createElement('div');
    urlText.className = 'duplicate-url-text';
    urlText.textContent = domain;
    urlText.title = `${tabs.length} tabs from ${domain}`;
    
    urlInfo.appendChild(faviconEl);
    urlInfo.appendChild(urlText);
    
    const countBadge = document.createElement('div');
    countBadge.className = 'duplicate-count-badge';
    countBadge.textContent = `${tabs.length}x`;
    
    const closeAllBtn = document.createElement('button');
    closeAllBtn.className = 'btn btn-danger btn-small close-all-duplicates-btn';
    closeAllBtn.textContent = 'Close All';
    closeAllBtn.title = `Close all ${tabs.length} duplicate tabs from ${domain}`;
    closeAllBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const tabIds = tabs.map(t => t.id);
        await chrome.tabs.remove(tabIds);
        await refreshAll();
        showToast(`Closed ${tabs.length} duplicate tabs from ${domain}`, 'success');
    });
    
    header.appendChild(urlInfo);
    header.appendChild(countBadge);
    header.appendChild(closeAllBtn);
    
    group.appendChild(header);
    
    return group;
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
    
    const tabInfo = document.createElement('div');
    tabInfo.className = 'tab-info';
    
    const faviconEl = document.createElement('div');
    faviconEl.className = 'tab-favicon';
    
    // MODERN FAVICON FETCHING (MV3) with improved error handling
    // Chrome's _favicon/ API handles CORS internally, but may log CORS warnings in console
    // These warnings occur when Chrome's internal favicon service tries to fetch from
    // domains with strict CORS policies (e.g., ahrefs.com, gstatic.com). These warnings
    // are informational only and don't affect functionality - favicons will still display
    // if available through Chrome's cache or fallback mechanisms.
    try {
        const faviconUrl = new URL(chrome.runtime.getURL("/_favicon/"));
        faviconUrl.searchParams.set("pageUrl", tab.url);
        faviconUrl.searchParams.set("size", "32");
        
    const img = document.createElement('img');
    img.src = faviconUrl.toString();
    img.alt = '';
        
        // Improved error handling with fallback
    img.onerror = function() {
            // Fallback to emoji icon if favicon fails to load
            faviconEl.textContent = '🌐';
            faviconEl.style.fontSize = '10px';
            faviconEl.style.display = 'flex';
            faviconEl.style.alignItems = 'center';
            faviconEl.style.justifyContent = 'center';
        };
        
        faviconEl.appendChild(img);
    } catch (error) {
        // Fallback if favicon URL creation fails
        faviconEl.textContent = '🌐';
        faviconEl.style.fontSize = '10px';
        faviconEl.style.display = 'flex';
        faviconEl.style.alignItems = 'center';
        faviconEl.style.justifyContent = 'center';
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
    time.innerHTML = `<span style="color: var(--success);">⏰</span> ${timeUntil}<br><span style="font-size: 0.6rem; opacity: 0.7;">${wakeTimeStr}</span>`;
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

// Helper function to get group properties
async function getGroupProperties(groupId) {
    if (!groupId || groupId === chrome.tabs.TAB_GROUP_ID_NONE) {
        return null;
    }
    try {
        const group = await chrome.tabGroups.get(groupId);
        return {
            id: group.id,
            title: group.title,
            color: group.color,
            collapsed: group.collapsed
        };
    } catch (error) {
        return null;
    }
}

// 2. Perform Snooze (Optimized Logic)
async function performSnooze(tabId, wakeTime, timeOption) {
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    if (!tab) return;

    // Get tab group properties if tab belongs to a group
    let groupInfo = null;
    if (tab.groupId && tab.groupId !== chrome.tabs.TAB_GROUP_ID_NONE) {
        groupInfo = await getGroupProperties(tab.groupId);
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
        groupId: groupInfo ? groupInfo.id : null,
        groupInfo: groupInfo // Store full group properties for restoration
    });
    await chrome.storage.local.set({ snoozedTabs });

    // 2. Set Alarm
    await chrome.alarms.create(`snooze_${tab.id}_${wakeTime}`, { when: wakeTime });

    // 3. Close Tab
    await chrome.tabs.remove(tab.id);
}

// 3. BATCH ACTION: Clear All / Weekend
// Crash Fixed: Now fires a message to background.js and closes the popup immediately.
// It will no longer fail if the user clicks away.
async function batchSnooze(timeOption) {
    // Send message to background.js to handle batch snooze
    chrome.runtime.sendMessage(
        { action: 'batchSnooze', timeOption: timeOption },
        (response) => {
            // Response is handled, but popup is already closed
            // Background script handles everything
        }
    );
    
    // Close popup immediately to prevent crash if user clicks away
    window.close();
}

// Helper function to restore or recreate a group
async function restoreGroup(tab, newTabId) {
    // Handle old tabs that might only have groupId without groupInfo
    if (!tab.groupInfo && !tab.groupId) {
        return; // No group info to restore
    }

    try {
        // Small delay to ensure tab is fully initialized before grouping
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Verify tab still exists before grouping
        try {
            await chrome.tabs.get(newTabId);
        } catch (e) {
            console.log('Tab no longer exists, cannot group');
            return;
        }

        // First, check if the original group still exists
        let targetGroupId = tab.groupId;
        if (targetGroupId && targetGroupId !== chrome.tabs.TAB_GROUP_ID_NONE) {
            try {
                const existingGroup = await chrome.tabGroups.get(targetGroupId);
                if (existingGroup) {
                    // Group exists, add tab back to it
                    await chrome.tabs.group({
                        groupId: targetGroupId,
                        tabIds: [newTabId]
                    });
                    return;
                }
            } catch (e) {
                // Group doesn't exist, will recreate below
            }
        }

        // Group doesn't exist, need to recreate it
        // For old tabs without groupInfo, try to get group info from storage or use groupId as key
        let groupInfo = tab.groupInfo;
        if (!groupInfo && tab.groupId) {
            // Try to get group info if available, otherwise use minimal info
            groupInfo = {
                id: tab.groupId,
                title: '',
                color: 'grey'
            };
        }

        if (!groupInfo) {
            return; // Can't restore without group info
        }

        // Check if we've already recreated this group for another tab
        const storage = await chrome.storage.local.get(['recreatedGroups']);
        const recreatedGroups = storage.recreatedGroups || {};
        
        // Create a unique key: use original groupId if available, otherwise use title+color
        // This ensures tabs from the same original group go to the same recreated group
        const groupKey = tab.groupId 
            ? `group_${tab.groupId}` 
            : `${groupInfo.title || 'Untitled'}_${groupInfo.color || 'grey'}`;
        
        if (recreatedGroups[groupKey]) {
            // We've already recreated this group, add tab to it
            try {
                await chrome.tabs.group({
                    groupId: recreatedGroups[groupKey],
                    tabIds: [newTabId]
                });
                return;
            } catch (e) {
                // Recreated group might have been deleted, create new one below
                delete recreatedGroups[groupKey];
            }
        }

        // IMPORTANT: Before creating a new group, check if a group with the same title already exists
        // This prevents duplicate groups when reopening tabs after long periods (6+ days)
        if (groupInfo.title) {
            try {
                const allGroups = await chrome.tabGroups.query({});
                const existingGroup = allGroups.find(g => g.title === groupInfo.title);
                
                if (existingGroup) {
                    // Group with same title exists, add tab to it instead of creating duplicate
                    await chrome.tabs.group({
                        groupId: existingGroup.id,
                        tabIds: [newTabId]
                    });
                    // Update the recreatedGroups mapping so future tabs use this existing group
                    recreatedGroups[groupKey] = existingGroup.id;
                    await chrome.storage.local.set({ recreatedGroups });
                    return;
                }
            } catch (e) {
                // If query fails, continue to create new group below
                console.log('Could not query existing groups:', e);
            }
        }

        // Create a new group with the stored properties
        const newGroupId = await chrome.tabs.group({ tabIds: [newTabId] });
        
        // Update the group with stored properties
        const updateData = {};
        if (groupInfo.title) {
            updateData.title = groupInfo.title;
        }
        if (groupInfo.color) {
            updateData.color = groupInfo.color;
        }
        if (groupInfo.collapsed !== undefined) {
            updateData.collapsed = groupInfo.collapsed;
        }
        
        if (Object.keys(updateData).length > 0) {
            await chrome.tabGroups.update(newGroupId, updateData);
        }
        
        // Store the mapping so other tabs from the same group can use it
        recreatedGroups[groupKey] = newGroupId;
        await chrome.storage.local.set({ recreatedGroups });
    } catch (error) {
        // If grouping fails, tab will just open normally (not grouped)
        console.log('Could not restore tab to group:', error);
    }
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
        
        // Wait a bit for tab to be fully created, then restore group
        // Restore to original group if it had one
        if (targetTab.groupId || targetTab.groupInfo) {
            await restoreGroup(targetTab, newTab.id);
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

