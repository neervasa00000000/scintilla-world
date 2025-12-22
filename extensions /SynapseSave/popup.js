// SynapseSave - Optimized Popup Script

let currentTabId = null;
let currentWindowId = null; // Store current window ID
let stats = { tabsSnoozed: 0, ramSaved: 0, timeSaved: 0 };

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    // Get current window ID for batch operations
    const win = await chrome.windows.getCurrent();
    currentWindowId = win.id;
    
    await refreshAll();
    setupEventListeners();

    const searchInput = document.getElementById('tabSearch');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            filterTabs(searchInput.value);
        });
    }
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

let allOpenTabs = []; // To store all open tabs for filtering
let allSnoozedTabs = []; // To store all snoozed tabs for filtering

function filterTabs(query) {
    const lowerCaseQuery = query.toLowerCase();

    const filteredOpenTabs = allOpenTabs.filter(tab =>
        (tab.title && tab.title.toLowerCase().includes(lowerCaseQuery)) ||
        (tab.url && tab.url.toLowerCase().includes(lowerCaseQuery))
    );

    const filteredSnoozedTabs = allSnoozedTabs.filter(tab =>
        (tab.title && tab.title.toLowerCase().includes(lowerCaseQuery)) ||
        (tab.url && tab.url.toLowerCase().includes(lowerCaseQuery))
    );

    renderTabs(filteredOpenTabs, 'openTabsList', 'openTabCount', 'No tabs to manage', '📑', 'Open some tabs to get started');
    renderTabs(filteredSnoozedTabs, 'snoozedList', 'snoozedTabCount', 'No snoozed tabs', '💤', 'Snooze tabs to see them here', true);
}

// Helper to render tabs (for both open and snoozed)
function renderTabs(tabsToRender, listId, countId, emptyTitle, emptyIcon, emptyHint, isSnoozed = false) {
    const listElement = document.getElementById(listId);
    const countElement = document.getElementById(countId);

    if (!listElement || !countElement) return;

    countElement.textContent = tabsToRender.length;
    listElement.innerHTML = '';

    if (tabsToRender.length === 0) {
        listElement.innerHTML = `<div class="empty-state"><div class="empty-icon">${emptyIcon}</div><p class="empty-title">${emptyTitle}</p><p class="empty-hint">${emptyHint}</p></div>`;
        return;
    }

    const fragment = document.createDocumentFragment();
    tabsToRender.forEach(tab => {
        if (isSnoozed) {
            fragment.appendChild(createSnoozedItem(tab));
        } else {
            fragment.appendChild(createTabItem(tab));
        }
    });
    listElement.appendChild(fragment);
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
    // Limit duplicates to current window only
    const tabs = await chrome.tabs.query({ currentWindow: true });
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
    
    // Action buttons container
    const actionsContainer = document.createElement('div');
    actionsContainer.className = 'duplicate-actions';
    actionsContainer.style.display = 'flex';
    actionsContainer.style.gap = '8px';
    
    // Snooze button - snooze ALL duplicates (all tabs from this domain)
    const snoozeBtn = document.createElement('button');
    snoozeBtn.className = 'btn btn-primary btn-small';
    snoozeBtn.textContent = 'Snooze';
    snoozeBtn.title = `Snooze all ${tabs.length} tab${tabs.length > 1 ? 's' : ''} from ${domain}`;
    snoozeBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        // Snooze ALL tabs from this domain
        if (tabs.length > 0) {
            // Use default 1 day snooze
            const wakeTime = calculateWakeTime('oneday');
            for (const tab of tabs) {
                await performSnooze(tab.id, wakeTime, 'oneday');
            }
            await refreshAll();
            showToast(`Snoozed ${tabs.length} tab${tabs.length > 1 ? 's' : ''}`, 'success');
        }
    });
    
    // Cleanup button - close all duplicates (keep first, close rest)
    const cleanupBtn = document.createElement('button');
    cleanupBtn.className = 'btn btn-danger btn-small close-all-duplicates-btn';
    cleanupBtn.textContent = 'Cleanup';
    cleanupBtn.title = `Close ${tabs.length - 1} duplicate tab${tabs.length > 2 ? 's' : ''} from ${domain} (keeping 1 open)`;
    cleanupBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        // Keep the first tab open, close the rest (duplicates)
        const tabsToClose = tabs.slice(1); // Skip first tab
        const tabIds = tabsToClose.map(t => t.id);
        if (tabIds.length > 0) {
            await chrome.tabs.remove(tabIds);
            await refreshAll();
            showToast(`Closed ${tabIds.length} duplicates`, 'success');
        }
    });
    
    actionsContainer.appendChild(snoozeBtn);
    actionsContainer.appendChild(cleanupBtn);
    
    header.appendChild(urlInfo);
    header.appendChild(countBadge);
    header.appendChild(actionsContainer);
    
    group.appendChild(header);
    
    return group;
}

// --- TAB MANAGEMENT ---

async function loadTabs() {
    // FIX: Only query tabs for the CURRENT WINDOW to avoid confusion
    const tabs = await chrome.tabs.query({ currentWindow: true });

    allOpenTabs = tabs.filter(tab =>
        !tab.url.startsWith('chrome://') &&
        !tab.url.startsWith('edge://') &&
        !tab.url.startsWith('about:')
    );

    renderTabs(allOpenTabs, 'openTabsList', 'openTabCount', 'No tabs to manage', '📑', 'Open some tabs to get started');
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
    
    actions.appendChild(snoozeBtn);
    
    tabItem.appendChild(tabInfo);
    tabItem.appendChild(actions);
    
    return tabItem;
}

async function loadSnoozedTabs() {
    const result = await chrome.storage.local.get(['snoozedTabs']);
    allSnoozedTabs = result.snoozedTabs || [];

    // Sort by wake time (soonest first)
    allSnoozedTabs.sort((a, b) => a.wakeTime - b.wakeTime);

    renderTabs(allSnoozedTabs, 'snoozedList', 'snoozedTabCount', 'No snoozed tabs', '💤', 'Snooze tabs to see them here', true);
}

function createSnoozedItem(tab) {
    const item = document.createElement('div');
    item.className = 'snoozed-item';
    
    const header = document.createElement('div');
    header.className = 'snoozed-header';
    
    const title = document.createElement('div');
    title.className = 'snoozed-title';
    title.textContent = tab.title;
    
    const time = document.createElement('div');
    time.className = 'snoozed-time';
    time.innerHTML = formatTimeUntil(tab.wakeTime);
    
    header.appendChild(title);
    header.appendChild(time);
    
    const actions = document.createElement('div');
    actions.className = 'snoozed-actions';
    
    const openBtn = document.createElement('button');
    openBtn.className = 'btn btn-primary btn-small';
    openBtn.textContent = 'Open Now';
    openBtn.addEventListener('click', () => reopenTab(tab.tabId));
    
    const delBtn = document.createElement('button');
    delBtn.className = 'btn btn-danger btn-small delete-btn';
    delBtn.textContent = 'Delete';
    delBtn.addEventListener('click', () => deleteSnooze(tab.tabId));
    
    actions.appendChild(openBtn);
    actions.appendChild(delBtn);
    
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
    // FIX: Send the Window ID so background script knows which window to target
    chrome.runtime.sendMessage(
        { action: 'batchSnooze', timeOption: timeOption, windowId: currentWindowId },
        (response) => {
            // Response is handled, but popup is already closed
            // Background script handles everything
        }
    );
    
    // Close popup immediately to prevent crash if user clicks away
    window.close();
}

// --- LOGIC FIX: Always find group by NAME first ---
async function restoreGroupFromPopup(tabData, newTabId) {
    if (!tabData.groupInfo && !tabData.groupId) return;
    try {
        await new Promise(resolve => setTimeout(resolve, 300));
        let newTab;
        try { newTab = await chrome.tabs.get(newTabId); } catch(e) { return; }
        
        let groupInfo = tabData.groupInfo || { title: '', color: 'grey' };
        let foundGroup = null;
        
        // 1. SEARCH BY NAME ("Group B") in the CURRENT WINDOW
        if (groupInfo.title) {
            const windowGroups = await chrome.tabGroups.query({ windowId: newTab.windowId });
            foundGroup = windowGroups.find(g => g.title === groupInfo.title);
        }
        
        // 2. Fallback to ID
        if (!foundGroup && tabData.groupId) {
             try {
                const groupById = await chrome.tabGroups.get(tabData.groupId);
                if (groupById && groupById.windowId === newTab.windowId) {
                    foundGroup = groupById;
                }
            } catch (e) {}
        }
        
        // 3. ACTION
        if (foundGroup) {
            await chrome.tabs.group({ groupId: foundGroup.id, tabIds: [newTabId] });
        } else {
            const newGroupId = await chrome.tabs.group({ tabIds: [newTabId] });
            const updateData = {};
            if (groupInfo.title) updateData.title = groupInfo.title;
            if (groupInfo.color) updateData.color = groupInfo.color;
            if (Object.keys(updateData).length > 0) {
                await chrome.tabGroups.update(newGroupId, updateData);
            }
        }
    } catch(e) { console.log('Popup Restore Group Error', e); }
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
        
        if (targetTab.groupId || targetTab.groupInfo) {
             // Local restore logic
             await restoreGroupFromPopup(targetTab, newTab.id);
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

    const snoozeAllBtn = document.getElementById('snoozeAllBtn');
    if (snoozeAllBtn) {
        snoozeAllBtn.addEventListener('click', () => batchSnooze('oneday')); // Assuming default snooze all is one day
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

