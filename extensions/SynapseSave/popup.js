// SynapseSave - Popup Script

let currentTabId = null;
let currentWindowId = null;
let stats = { tabsSnoozed: 0, ramSaved: 0 };

document.addEventListener('DOMContentLoaded', async () => {
    try {
        try {
            const win = await chrome.windows.getCurrent();
            currentWindowId = win.id;
        } catch (error) {
            console.error('Error getting current window:', error);
            currentWindowId = null;
        }
        
        await refreshAll();
        setupEventListeners();

        const searchInput = document.getElementById('tabSearch');
        if (searchInput) {
            searchInput.addEventListener('input', () => filterTabs(searchInput.value));
        }
    } catch (error) {
        console.error('Error initializing popup:', error);
        showToast('Error loading extension', 'error');
    }
});

let allOpenTabs = [];
let allSnoozedTabs = [];

async function refreshAll() {
    const openList = document.getElementById('openTabsList');
    const snoozedList = document.getElementById('snoozedList');
    const scrollPosOpen = openList ? openList.scrollTop : 0;
    const scrollPosSnoozed = snoozedList ? snoozedList.scrollTop : 0;

    await Promise.all([loadStats(), loadTabGroups(), loadTabs(), loadSnoozedTabs()]);
    updateStats();

    if (openList) openList.scrollTop = scrollPosOpen;
    if (snoozedList) snoozedList.scrollTop = scrollPosSnoozed;
}

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
    const result = await chrome.storage.local.get(['snoozedTabs', 'snoozedBundles']);
    const snoozedTabs = result.snoozedTabs || [];
    const bundles = result.snoozedBundles || [];
    
    // Count tabs in bundles
    const bundleTabCount = bundles.reduce((sum, bundle) => sum + (bundle.tabs ? bundle.tabs.length : 0), 0);
    
    stats.tabsSnoozed = snoozedTabs.length + bundleTabCount;
    stats.ramSaved = stats.tabsSnoozed * 75; // ~75MB avg
}

let currentGroupId = null;
let currentGroupData = null;

async function loadTabGroups() {
    try {
        const tabs = await chrome.tabs.query({ currentWindow: true });
        let windowId;
        try {
            const win = await chrome.windows.getCurrent();
            windowId = win.id;
        } catch (error) {
            console.error('Error getting window for groups:', error);
            const tabGroupsSection = document.getElementById('tabGroupsSection');
            if (tabGroupsSection) tabGroupsSection.style.display = 'none';
            return;
        }
        const groups = await chrome.tabGroups.query({ windowId: windowId });
        
        // Filter groups that have tabs
        const groupsWithTabs = [];
        for (const group of groups) {
            const groupTabs = tabs.filter(tab => 
                tab.groupId === group.id && 
                !tab.url.startsWith('chrome://') && 
                !tab.url.startsWith('edge://') &&
                !tab.url.startsWith('about:') &&
                !tab.url.startsWith('chrome-extension://')
            );
            
            if (groupTabs.length > 0) {
                groupsWithTabs.push({
                    group: group,
                    tabs: groupTabs
                });
            }
        }
        
        const tabGroupsSection = document.getElementById('tabGroupsSection');
        const tabGroupsList = document.getElementById('tabGroupsList');
        const tabGroupCount = document.getElementById('tabGroupCount');
        
        if (groupsWithTabs.length === 0) {
            tabGroupsSection.style.display = 'none';
            return;
        }
        
        tabGroupsSection.style.display = 'block';
        tabGroupCount.textContent = groupsWithTabs.length;
        tabGroupsList.innerHTML = '';
        
        const fragment = document.createDocumentFragment();
        groupsWithTabs.forEach(({ group, tabs }) => {
            fragment.appendChild(createTabGroupItem(group, tabs));
        });
        tabGroupsList.appendChild(fragment);
    } catch (error) {
        const tabGroupsSection = document.getElementById('tabGroupsSection');
        if (tabGroupsSection) tabGroupsSection.style.display = 'none';
    }
}

function createTabGroupItem(group, tabs) {
    const groupItem = document.createElement('div');
    groupItem.className = 'tab-group-item';
    
    const header = document.createElement('div');
    header.className = 'tab-group-header';
    
    const groupInfo = document.createElement('div');
    groupInfo.className = 'tab-group-info';
    
    const colorEl = document.createElement('div');
    colorEl.className = 'tab-group-color';
    colorEl.style.backgroundColor = getGroupColorHex(group.color);
    
    const nameEl = document.createElement('div');
    nameEl.className = 'tab-group-name';
    nameEl.textContent = group.title || 'Untitled Group';
    nameEl.title = group.title || 'Untitled Group';
    
    groupInfo.appendChild(colorEl);
    groupInfo.appendChild(nameEl);
    
    const countBadge = document.createElement('div');
    countBadge.className = 'tab-group-count';
    countBadge.textContent = `${tabs.length}`;
    
    const actionsContainer = document.createElement('div');
    actionsContainer.className = 'tab-group-actions';
    
    const snoozeBtn = document.createElement('button');
    snoozeBtn.className = 'btn btn-primary btn-small';
    snoozeBtn.textContent = 'Snooze';
    snoozeBtn.title = `Snooze all ${tabs.length} tab${tabs.length > 1 ? 's' : ''} in this group as a bundle`;
    snoozeBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        currentGroupId = group.id;
        currentGroupData = { group, tabs };
        openBundleNameModal();
    });
    
    actionsContainer.appendChild(snoozeBtn);
    
    header.appendChild(groupInfo);
    header.appendChild(countBadge);
    header.appendChild(actionsContainer);
    
    groupItem.appendChild(header);
    
    return groupItem;
}

function getGroupColorHex(color) {
    const colorMap = {
        'grey': '#9aa0a6',
        'blue': '#1a73e8',
        'red': '#ea4335',
        'yellow': '#fbbc04',
        'green': '#34a853',
        'pink': '#f28b82',
        'purple': '#a142f4',
        'cyan': '#5ac8fa',
        'orange': '#ff9500'
    };
    return colorMap[color] || colorMap['grey'];
}

function openBundleNameModal() {
    const modal = document.getElementById('bundleNameModal');
    const input = document.getElementById('bundleNameInput');
    if (modal && input) {
        modal.classList.add('active');
        input.value = currentGroupData?.group?.title || '';
        input.focus();
        input.select();
    }
}

function closeBundleNameModal() {
    const modal = document.getElementById('bundleNameModal');
    if (modal) {
        modal.classList.remove('active');
        currentGroupId = null;
        currentGroupData = null;
        const input = document.getElementById('bundleNameInput');
        if (input) input.value = '';
        document.querySelectorAll('#bundleNameModal .snooze-option').forEach(opt => {
            opt.classList.remove('selected');
        });
    }
}

// --- TAB MANAGEMENT ---

async function loadTabs() {
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
    
    try {
        const faviconUrl = new URL(chrome.runtime.getURL("/_favicon/"));
        faviconUrl.searchParams.set("pageUrl", tab.url);
        faviconUrl.searchParams.set("size", "32");
        
        const img = document.createElement('img');
        img.src = faviconUrl.toString();
        img.alt = '';
        img.onerror = () => {
            faviconEl.textContent = '🌐';
            faviconEl.style.fontSize = '10px';
            faviconEl.style.display = 'flex';
            faviconEl.style.alignItems = 'center';
            faviconEl.style.justifyContent = 'center';
        };
        faviconEl.appendChild(img);
    } catch (error) {
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
    const result = await chrome.storage.local.get(['snoozedTabs', 'snoozedBundles']);
    allSnoozedTabs = result.snoozedTabs || [];
    const bundles = result.snoozedBundles || [];

    allSnoozedTabs.sort((a, b) => a.wakeTime - b.wakeTime);
    bundles.sort((a, b) => a.wakeTime - b.wakeTime);

    const snoozedList = document.getElementById('snoozedList');
    const snoozedTabCount = document.getElementById('snoozedTabCount');
    
    if (!snoozedList || !snoozedTabCount) return;
    
    snoozedTabCount.textContent = allSnoozedTabs.length + bundles.length;
    snoozedList.innerHTML = '';
    
    if (allSnoozedTabs.length === 0 && bundles.length === 0) {
        snoozedList.innerHTML = `<div class="empty-state"><div class="empty-icon">💤</div><p class="empty-title">No snoozed tabs</p><p class="empty-hint">Snooze tabs to see them here</p></div>`;
        return;
    }
    
    const fragment = document.createDocumentFragment();
    bundles.forEach(bundle => fragment.appendChild(createBundleItem(bundle)));
    allSnoozedTabs.forEach(tab => fragment.appendChild(createSnoozedItem(tab)));
    
    snoozedList.appendChild(fragment);
}

function createBundleItem(bundle) {
    const item = document.createElement('div');
    item.className = 'bundle-item';
    
    const header = document.createElement('div');
    header.className = 'bundle-header';
    
    const nameContainer = document.createElement('div');
    nameContainer.style.flex = '1';
    nameContainer.style.minWidth = '0';
    
    const name = document.createElement('div');
    name.className = 'bundle-name';
    name.textContent = bundle.name || 'Untitled Bundle';
    
    const tabsCount = document.createElement('div');
    tabsCount.className = 'bundle-tabs-count';
    const tabCount = bundle.tabs ? bundle.tabs.length : 0;
    tabsCount.textContent = `${tabCount} tab${tabCount !== 1 ? 's' : ''}`;
    
    nameContainer.appendChild(name);
    nameContainer.appendChild(tabsCount);
    
    const time = document.createElement('div');
    time.className = 'bundle-time';
    time.innerHTML = formatTimeUntil(bundle.wakeTime);
    
    header.appendChild(nameContainer);
    header.appendChild(time);
    
    const actions = document.createElement('div');
    actions.className = 'bundle-actions';
    
    const openBtn = document.createElement('button');
    openBtn.className = 'btn btn-primary btn-small';
    openBtn.textContent = 'Open Bundle';
    openBtn.addEventListener('click', () => reopenBundle(bundle.bundleId));
    
    const delBtn = document.createElement('button');
    delBtn.className = 'btn btn-danger btn-small delete-btn';
    delBtn.textContent = 'Delete';
    delBtn.addEventListener('click', () => deleteBundle(bundle.bundleId));
    
    actions.appendChild(openBtn);
    actions.appendChild(delBtn);
    
    item.appendChild(header);
    item.appendChild(actions);
    
    return item;
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

function snoozeTab(tabId) {
    currentTabId = tabId;
    const modal = document.getElementById('snoozeModal');
    if (modal) {
        modal.classList.add('active');
    }
}

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

async function performSnooze(tabId, wakeTime, timeOption) {
    try {
        const tab = await chrome.tabs.get(tabId).catch(() => null);
        if (!tab) {
            console.error(`Tab ${tabId} not found`);
            return;
        }

        let groupInfo = null;
        if (tab.groupId && tab.groupId !== chrome.tabs.TAB_GROUP_ID_NONE) {
            groupInfo = await getGroupProperties(tab.groupId);
        }

        const result = await chrome.storage.local.get(['snoozedTabs']);
        const snoozedTabs = result.snoozedTabs || [];
        
        snoozedTabs.push({
            tabId: tab.id,
            url: tab.url,
            title: tab.title,
            favIconUrl: tab.favIconUrl,
            wakeTime: wakeTime,
            snoozedAt: Date.now(),
            timeOption: timeOption,
            groupId: groupInfo ? groupInfo.id : null,
            groupInfo: groupInfo
        });
        await chrome.storage.local.set({ snoozedTabs });

        try {
            await chrome.alarms.create(`snooze_${tab.id}_${wakeTime}`, { when: wakeTime });
        } catch (alarmError) {
            console.error('Error creating alarm:', alarmError);
            const updated = snoozedTabs.filter(st => st.tabId !== tab.id);
            await chrome.storage.local.set({ snoozedTabs: updated });
            throw alarmError;
        }

        try {
            await chrome.tabs.remove(tab.id);
        } catch (removeError) {
            console.error('Error removing tab:', removeError);
        }
    } catch (error) {
        console.error('Error in performSnooze:', error);
        throw error;
    }
}

async function batchSnooze(timeOption) {
    chrome.runtime.sendMessage(
        { action: 'batchSnooze', timeOption: timeOption, windowId: currentWindowId },
        () => {}
    );
    window.close();
}

async function restoreGroupFromPopup(tabData, newTabId) {
    if (!tabData.groupInfo && !tabData.groupId) return;
    try {
        await new Promise(resolve => setTimeout(resolve, 300));
        let newTab;
        try { newTab = await chrome.tabs.get(newTabId); } catch(e) { return; }
        
        let groupInfo = tabData.groupInfo || { title: '', color: 'grey' };
        let foundGroup = null;
        
        if (groupInfo.title) {
            const windowGroups = await chrome.tabGroups.query({ windowId: newTab.windowId });
            foundGroup = windowGroups.find(g => g.title === groupInfo.title);
        }
        
        if (!foundGroup && tabData.groupId) {
            try {
                const groupById = await chrome.tabGroups.get(tabData.groupId);
                if (groupById && groupById.windowId === newTab.windowId) {
                    foundGroup = groupById;
                }
            } catch (e) {}
        }
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
    } catch(e) {}
}

async function reopenTab(tabId) {
    try {
        const result = await chrome.storage.local.get(['snoozedTabs']);
        let snoozedTabs = result.snoozedTabs || [];
        const targetTab = snoozedTabs.find(st => st.tabId === tabId);
        
        if (!targetTab) {
            showToast('Tab not found', 'error');
            return;
        }
        
        let newTab;
        try {
            newTab = await chrome.tabs.create({ url: targetTab.url, active: false });
        } catch (createError) {
            console.error('Error creating tab:', createError);
            showToast('Error opening tab', 'error');
            return;
        }
        
        if (targetTab.groupId || targetTab.groupInfo) {
            try {
                await restoreGroupFromPopup(targetTab, newTab.id);
            } catch (groupError) {
                console.error('Error restoring group:', groupError);
            }
        }
        
        try {
            chrome.alarms.clear(`snooze_${tabId}_${targetTab.wakeTime}`);
            snoozedTabs = snoozedTabs.filter(st => st.tabId !== tabId);
            await chrome.storage.local.set({ snoozedTabs });
        } catch (cleanupError) {
            console.error('Error during cleanup:', cleanupError);
        }
        
        await refreshAll();
        showToast('Tab reopened', 'success');
    } catch (error) {
        console.error('Error in reopenTab:', error);
        showToast('Error reopening tab', 'error');
    }
}

async function deleteSnooze(tabId) {
    try {
        const result = await chrome.storage.local.get(['snoozedTabs']);
        const snoozedTabs = result.snoozedTabs || [];
        const targetTab = snoozedTabs.find(st => st.tabId === tabId);
        
        if (!targetTab) {
            showToast('Tab not found', 'error');
            return;
        }
        
        try {
            chrome.alarms.clear(`snooze_${tabId}_${targetTab.wakeTime}`);
        } catch (alarmError) {
            console.error('Error clearing alarm:', alarmError);
        }
        
        const updated = snoozedTabs.filter(st => st.tabId !== tabId);
        await chrome.storage.local.set({ snoozedTabs: updated });
        
        await refreshAll();
        showToast('Snooze cancelled', 'success');
    } catch (error) {
        console.error('Error in deleteSnooze:', error);
        showToast('Error deleting snooze', 'error');
    }
}

async function reopenBundle(bundleId) {
    const result = await chrome.storage.local.get(['snoozedBundles']);
    const bundles = result.snoozedBundles || [];
    const bundle = bundles.find(b => b.bundleId === bundleId);
    
    if (!bundle) {
        showToast('Bundle not found', 'error');
        return;
    }
    
    const bundleName = bundle.name;
    const bundleWakeTime = bundle.wakeTime;
    
    const removeBundle = async () => {
        try {
            const currentResult = await chrome.storage.local.get(['snoozedBundles']);
            const currentBundles = currentResult.snoozedBundles || [];
            const updated = currentBundles.filter(b => b.bundleId !== bundleId);
            await chrome.storage.local.set({ snoozedBundles: updated });
            
            bundle.tabs.forEach(tab => {
                chrome.alarms.clear(`snooze_${tab.tabId}_${bundleWakeTime}`);
            });
            return true;
        } catch (e) {
            console.error('Error removing bundle:', e);
            return false;
        }
    };
    
    try {
        const response = await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({ action: 'restoreBundle', bundleId: bundleId }, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }
                resolve(response);
            });
        });
        
        if (response && response.success) {
            const checkResult = await chrome.storage.local.get(['snoozedBundles']);
            const stillExists = checkResult.snoozedBundles?.some(b => b.bundleId === bundleId);
            
            if (stillExists) {
                await removeBundle();
            }
            
            await refreshAll();
            showToast(`Bundle "${bundleName}" reopened`, 'success');
        } else {
            const errorMsg = response?.message || 'Unknown error occurred';
            console.error('Bundle restore error:', errorMsg);
            showToast(`Error: ${errorMsg}`, 'error');
        }
    } catch (error) {
        console.error('Error in reopenBundle:', error);
        const checkResult = await chrome.storage.local.get(['snoozedBundles']);
        const stillExists = checkResult.snoozedBundles?.some(b => b.bundleId === bundleId);
        
        if (!stillExists) {
            await refreshAll();
            showToast(`Bundle "${bundleName}" reopened`, 'success');
        } else {
            showToast(`Error: ${error.message}`, 'error');
        }
    }
}

async function deleteBundle(bundleId) {
    try {
        const result = await chrome.storage.local.get(['snoozedBundles']);
        const bundles = result.snoozedBundles || [];
        const bundle = bundles.find(b => b.bundleId === bundleId);
        
        if (!bundle) {
            showToast('Bundle not found', 'error');
            return;
        }
        
        if (bundle.tabs && Array.isArray(bundle.tabs)) {
            for (const tab of bundle.tabs) {
                try {
                    chrome.alarms.clear(`snooze_${tab.tabId}_${bundle.wakeTime}`);
                } catch (alarmError) {
                    console.error(`Error clearing alarm for tab ${tab.tabId}:`, alarmError);
                }
            }
        }
        
        const updated = bundles.filter(b => b.bundleId !== bundleId);
        await chrome.storage.local.set({ snoozedBundles: updated });
        
        await refreshAll();
        showToast('Bundle deleted', 'success');
    } catch (error) {
        console.error('Error in deleteBundle:', error);
        showToast('Error deleting bundle', 'error');
    }
}


function calculateWakeTime(option) {
    const now = new Date();
    let wakeTime = new Date();
    const dayOfWeek = now.getDay();
    
    switch(option) {
        case 'oneday':
            wakeTime = new Date(now.getTime() + (24 * 60 * 60 * 1000));
            break;
        case 'nextweek':
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
    
    if (tabsSnoozedEl) tabsSnoozedEl.textContent = stats.tabsSnoozed;
    if (ramSavedEl) ramSavedEl.textContent = `${stats.ramSaved} MB`;
}

function formatTimeUntil(timestamp) {
    const diff = timestamp - Date.now();
    if (diff <= 0) return 'Ready';
    
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    const remainingMins = mins % 60;
    
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
    // Unified modal close handlers with ESC key support
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const snoozeModal = document.getElementById('snoozeModal');
            const bundleModal = document.getElementById('bundleNameModal');
            if (snoozeModal?.classList.contains('active')) {
                closeModal();
            } else if (bundleModal?.classList.contains('active')) {
                closeBundleNameModal();
            }
        }
    });

    const closeModalBtn = document.getElementById('closeModalBtn');
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeModal();
        });
    }
    
    const closeBundleModalBtn = document.getElementById('closeBundleModalBtn');
    if (closeBundleModalBtn) {
        closeBundleModalBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeBundleNameModal();
        });
    }
    
    const modal = document.getElementById('snoozeModal');
    if (modal) {
        const overlay = modal.querySelector('.modal-overlay');
        if (overlay) {
            overlay.addEventListener('click', () => closeModal());
        }
        const modalContent = modal.querySelector('.modal-content');
        if (modalContent) {
            modalContent.addEventListener('click', (e) => e.stopPropagation());
        }
    }
    
    const bundleModal = document.getElementById('bundleNameModal');
    if (bundleModal) {
        const overlay = bundleModal.querySelector('.modal-overlay');
        if (overlay) {
            overlay.addEventListener('click', () => closeBundleNameModal());
        }
        const modalContent = bundleModal.querySelector('.modal-content');
        if (modalContent) {
            modalContent.addEventListener('click', (e) => e.stopPropagation());
        }
        
        const bundleNameInput = document.getElementById('bundleNameInput');
        if (bundleNameInput) {
            bundleNameInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const selectedOption = bundleModal.querySelector('.snooze-option.selected');
                    if (selectedOption) {
                        document.getElementById('snoozeBundleBtn').click();
                    }
                }
            });
        }
    }
    
    const snoozeBundleBtn = document.getElementById('snoozeBundleBtn');
    if (snoozeBundleBtn) {
        snoozeBundleBtn.addEventListener('click', async () => {
            if (!currentGroupData) return;
            
            const bundleNameInput = document.getElementById('bundleNameInput');
            const bundleName = bundleNameInput.value.trim() || currentGroupData.group.title || 'Untitled Bundle';
            
            const selectedOption = document.querySelector('#bundleNameModal .snooze-option.selected');
            if (!selectedOption) {
                showToast('Please select a snooze time', 'error');
                return;
            }
            
            const timeOption = selectedOption.dataset.time;
            const wakeTime = calculateWakeTime(timeOption);
            
            const validTabs = [];
            for (const tab of currentGroupData.tabs) {
                try {
                    const freshTab = await chrome.tabs.get(tab.id);
                    if (freshTab && !freshTab.url.startsWith('chrome://') && 
                        !freshTab.url.startsWith('edge://') && 
                        !freshTab.url.startsWith('about:') &&
                        !freshTab.url.startsWith('chrome-extension://')) {
                        validTabs.push({
                            id: freshTab.id,
                            url: freshTab.url,
                            title: freshTab.title,
                            favIconUrl: freshTab.favIconUrl
                        });
                    }
                } catch (e) {}
            }
            
            if (validTabs.length === 0) {
                showToast('No valid tabs to snooze', 'error');
                return;
            }
            
            chrome.runtime.sendMessage({
                action: 'snoozeBundle',
                bundleName: bundleName,
                groupId: currentGroupData.group.id,
                tabs: validTabs,
                groupInfo: {
                    id: currentGroupData.group.id,
                    title: currentGroupData.group.title,
                    color: currentGroupData.group.color,
                    collapsed: currentGroupData.group.collapsed
                },
                timeOption: timeOption,
                wakeTime: wakeTime
            }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error('Chrome runtime error:', chrome.runtime.lastError);
                    showToast(`Error: ${chrome.runtime.lastError.message}`, 'error');
                    return;
                }
                
                if (response && response.success) {
                    closeBundleNameModal();
                    refreshAll();
                    showToast(`Bundle "${bundleName}" snoozed!`, 'success');
                    setTimeout(() => window.close(), 500);
                } else {
                    const errorMsg = response?.message || 'Unknown error occurred';
                    console.error('Bundle snooze error:', errorMsg);
                    showToast(`Error: ${errorMsg}`, 'error');
                }
            });
        });
    }
    
    const bundleModalBody = document.querySelector('#bundleNameModal .modal-body');
    if (bundleModalBody) {
        bundleModalBody.addEventListener('click', (e) => {
            const option = e.target.closest('.snooze-option');
            if (!option) return;
            e.stopPropagation();
            document.querySelectorAll('#bundleNameModal .snooze-option').forEach(o => o.classList.remove('selected'));
            option.classList.add('selected');
        });
    }
    
    const snoozeAllBtn = document.getElementById('snoozeAllBtn');
    if (snoozeAllBtn) {
        snoozeAllBtn.addEventListener('click', () => batchSnooze('oneday'));
    }
    
    const modalBody = document.querySelector('.modal-body');
    if (modalBody) {
        modalBody.addEventListener('click', async (e) => {
            const option = e.target.closest('.snooze-option');
            if (!option) return;
            e.stopPropagation();
            document.querySelectorAll('.snooze-option').forEach(o => o.classList.remove('selected'));
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

function closeModal() {
    const modal = document.getElementById('snoozeModal');
    if (modal) {
        modal.classList.remove('active');
        currentTabId = null;
        document.querySelectorAll('.snooze-option').forEach(opt => opt.classList.remove('selected'));
    }
}

document.addEventListener('visibilitychange', async () => {
    if (!document.hidden) {
        await refreshAll();
    }
});


