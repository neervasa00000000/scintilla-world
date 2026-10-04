// SynapseSave - Popup Script

let currentTabId = null;
let currentWindowId = null;
let snoozeTarget = 'tab';
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
        setupDynamicUpdates();

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
let allSnoozedBundles = [];
let cleanupSuggestions = [];
let cleanupSelectedTabIds = new Set();
let cleanupSubmitting = false;
let cleanupTriggerElement = null;
let cleanupRunId = 0;
let dynamicRefreshTimer = null;
let refreshInFlight = false;
let refreshQueued = false;
let clockTimer = null;

const SNOOZE_DURATIONS = {
    '24hours': { days: 1, label: '24 hours' },
    '7days': { days: 7, label: '7 days' },
    '60days': { days: 60, label: '60 days' },
    '90days': { days: 90, label: '90 days' }
};

const DAY_MS = 24 * 60 * 60 * 1000;
const CLEANUP_SCORES = {
    inactive7Days: 30,
    open14Days: 20,
    lowActivation: 20,
    duplicate: 30,
    searchResults: 15,
    pinned: -40,
    frequentUse: -30,
    recentlyActive: -25,
    acceptedDomain: 8,
    rejectedDomain: -12,
    keep: -50
};
const SEARCH_HOSTS = ['bing.com', 'duckduckgo.com', 'search.yahoo.com', 'ecosia.org', 'search.brave.com'];

function alarmNameForTab(tabId, wakeTime) {
    return `snooze_${tabId}_${wakeTime}`;
}

function isSnoozableUrl(url) {
    if (!url) return false;
    return !url.startsWith('chrome://') &&
        !url.startsWith('edge://') &&
        !url.startsWith('about:') &&
        !url.startsWith('chrome-extension://');
}

async function refreshAll() {
    const openList = document.getElementById('openTabsList');
    const snoozedList = document.getElementById('snoozedList');
    const scrollPosOpen = openList ? openList.scrollTop : 0;
    const scrollPosSnoozed = snoozedList ? snoozedList.scrollTop : 0;

    await Promise.all([loadStats(), loadTabGroups(), loadTabs(), loadSnoozedTabs()]);
    updateStats();

    const searchInput = document.getElementById('tabSearch');
    if (searchInput?.value) filterTabs(searchInput.value);

    if (openList) openList.scrollTop = scrollPosOpen;
    if (snoozedList) snoozedList.scrollTop = scrollPosSnoozed;
    updateDynamicTimes();
}

function scheduleDynamicRefresh() {
    clearTimeout(dynamicRefreshTimer);
    dynamicRefreshTimer = setTimeout(runDynamicRefresh, 150);
}

async function runDynamicRefresh() {
    if (refreshInFlight) {
        refreshQueued = true;
        return;
    }

    refreshInFlight = true;
    try {
        await refreshAll();
    } catch (error) {
        console.debug('[SynapseSave] live refresh failed:', error.message);
    } finally {
        refreshInFlight = false;
        if (refreshQueued) {
            refreshQueued = false;
            scheduleDynamicRefresh();
        }
    }
}

function setupDynamicUpdates() {
    const refresh = () => scheduleDynamicRefresh();
    chrome.tabs.onCreated.addListener(refresh);
    chrome.tabs.onRemoved.addListener(refresh);
    chrome.tabs.onUpdated.addListener(refresh);
    chrome.tabs.onMoved.addListener(refresh);
    chrome.tabs.onActivated.addListener(refresh);

    if (chrome.tabGroups) {
        chrome.tabGroups.onCreated?.addListener(refresh);
        chrome.tabGroups.onUpdated?.addListener(refresh);
        chrome.tabGroups.onRemoved?.addListener(refresh);
        chrome.tabGroups.onMoved?.addListener(refresh);
    }

    chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName !== 'local') return;
        if (changes.snoozedTabs || changes.snoozedBundles) refresh();
    });

    updateDynamicTimes();
    clockTimer = setInterval(updateDynamicTimes, 30 * 1000);
    window.addEventListener('unload', () => {
        clearTimeout(dynamicRefreshTimer);
        clearInterval(clockTimer);
    }, { once: true });
}

function filterTabs(query) {
    const lowerCaseQuery = query.toLowerCase();

    const filteredOpenTabs = allOpenTabs.filter(tab =>
        (tab.title && tab.title.toLowerCase().includes(lowerCaseQuery)) ||
        (tab.url && tab.url.toLowerCase().includes(lowerCaseQuery))
    );

    const emptyTitle = lowerCaseQuery ? 'No matching tabs' : 'No tabs to manage';
    const emptyHint = lowerCaseQuery ? 'Try a different search' : 'Open some tabs to get started';
    renderTabs(filteredOpenTabs, 'openTabsList', 'openTabCount', emptyTitle, '📑', emptyHint);
}

function setActiveView(view, focusTab = false) {
    const tabs = Array.from(document.querySelectorAll('.view-tab'));
    const panels = document.querySelectorAll('[data-panel]');

    tabs.forEach(tab => {
        const isActive = tab.dataset.view === view;
        tab.classList.toggle('active', isActive);
        tab.setAttribute('aria-selected', String(isActive));
        tab.tabIndex = isActive ? 0 : -1;
        if (isActive && focusTab) tab.focus();
    });

    panels.forEach(panel => {
        panel.hidden = panel.dataset.panel !== view;
    });
}

function renderSnoozedSection(tabsToRender, bundlesToRender) {
    const snoozedList = document.getElementById('snoozedList');
    const snoozedTabCount = document.getElementById('snoozedTabCount');

    if (!snoozedList || !snoozedTabCount) return;

    snoozedTabCount.textContent = tabsToRender.length + bundlesToRender.length;
    snoozedList.innerHTML = '';

    if (tabsToRender.length === 0 && bundlesToRender.length === 0) {
        snoozedList.innerHTML = `<div class="empty-state"><div class="empty-icon">💤</div><p class="empty-title">No snoozed tabs</p><p class="empty-hint">Snooze tabs to see them here</p></div>`;
        return;
    }

    const fragment = document.createDocumentFragment();
    bundlesToRender.forEach(bundle => fragment.appendChild(createBundleItem(bundle)));
    tabsToRender.forEach(tab => fragment.appendChild(createSnoozedItem(tab)));
    snoozedList.appendChild(fragment);
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
            const tabGroupCount = document.getElementById('tabGroupCount');
            if (tabGroupCount) tabGroupCount.textContent = '0';
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
        
        const tabGroupsList = document.getElementById('tabGroupsList');
        const tabGroupCount = document.getElementById('tabGroupCount');
        
        if (groupsWithTabs.length === 0) {
            tabGroupCount.textContent = '0';
            tabGroupsList.innerHTML = '<div class="empty-state"><div class="empty-icon">📦</div><p class="empty-title">No tab groups</p><p class="empty-hint">Chrome tab groups will appear here</p></div>';
            return;
        }
        
        tabGroupCount.textContent = groupsWithTabs.length;
        tabGroupsList.innerHTML = '';
        
        const fragment = document.createDocumentFragment();
        groupsWithTabs.forEach(({ group, tabs }) => {
            fragment.appendChild(createTabGroupItem(group, tabs));
        });
        tabGroupsList.appendChild(fragment);
    } catch (error) {
        const tabGroupCount = document.getElementById('tabGroupCount');
        const tabGroupsList = document.getElementById('tabGroupsList');
        if (tabGroupCount) tabGroupCount.textContent = '0';
        if (tabGroupsList) {
            tabGroupsList.innerHTML = '<div class="empty-state"><div class="empty-icon">📦</div><p class="empty-title">Groups unavailable</p><p class="empty-hint">Close and reopen the extension to try again</p></div>';
        }
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
            opt.setAttribute('aria-pressed', 'false');
        });
    }
}

// --- TAB MANAGEMENT ---

async function loadTabs() {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const snoozedResult = await chrome.storage.local.get(['snoozedTabs']);
    const snoozedTabs = snoozedResult.snoozedTabs || [];
    const snoozedTabIds = new Set(snoozedTabs.map(st => st.tabId));

    allOpenTabs = tabs.filter(tab => {
        if (!isSnoozableUrl(tab.url)) return false;
        // Tab still open but already in snoozed storage (close failed or popup died mid-snooze)
        if (snoozedTabIds.has(tab.id)) return false;
        return true;
    });

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
    allSnoozedBundles = result.snoozedBundles || [];

    allSnoozedTabs.sort((a, b) => a.wakeTime - b.wakeTime);
    allSnoozedBundles.sort((a, b) => a.wakeTime - b.wakeTime);

    renderSnoozedSection(allSnoozedTabs, allSnoozedBundles);
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
    time.dataset.wakeTime = String(bundle.wakeTime);
    time.textContent = formatTimeUntil(bundle.wakeTime);
    time.title = formatReturnDate(bundle.wakeTime);
    
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
    title.textContent = tab.title || tab.url || 'Untitled tab';
    
    const time = document.createElement('div');
    time.className = 'snoozed-time';
    time.dataset.wakeTime = String(tab.wakeTime);
    time.textContent = formatTimeUntil(tab.wakeTime);
    time.title = formatReturnDate(tab.wakeTime);
    
    header.appendChild(title);
    header.appendChild(time);
    
    const actions = document.createElement('div');
    actions.className = 'snoozed-actions';
    
    const openBtn = document.createElement('button');
    openBtn.className = 'btn btn-primary btn-small';
    openBtn.textContent = 'Open Now';
    const snoozeKey = tab.snoozeId || tab.tabId;
    openBtn.addEventListener('click', () => reopenTab(snoozeKey));
    
    const delBtn = document.createElement('button');
    delBtn.className = 'btn btn-danger btn-small delete-btn';
    delBtn.textContent = 'Delete';
    delBtn.addEventListener('click', () => deleteSnooze(snoozeKey));
    
    actions.appendChild(openBtn);
    actions.appendChild(delBtn);
    
    item.appendChild(header);
    item.appendChild(actions);
    
    return item;
}

function snoozeTab(tabId) {
    currentTabId = tabId;
    snoozeTarget = 'tab';
    const modal = document.getElementById('snoozeModal');
    const title = document.getElementById('snoozeModalTitle');
    const prompt = modal?.querySelector('.snooze-prompt');
    if (modal) {
        if (title) title.textContent = 'Snooze tab';
        if (prompt) prompt.textContent = 'Choose when to bring it back';
        modal.classList.add('active');
        modal.querySelector('.snooze-option')?.focus();
    }
}

function sendBackgroundMessage(payload) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(payload, (response) => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
                return;
            }
            resolve(response);
        });
    });
}

async function performSnooze(tabId, wakeTime, timeOption) {
    const response = await sendBackgroundMessage({
        action: 'snoozeSingleTab',
        tabId,
        wakeTime,
        timeOption
    });
    if (!response || !response.success) {
        throw new Error(response?.message || 'Failed to snooze tab');
    }
    return response;
}

async function batchSnooze(timeOption) {
    const response = await sendBackgroundMessage({
        action: 'batchSnooze',
        timeOption,
        windowId: currentWindowId
    });
    if (!response || !response.success) {
        throw new Error(response?.message || 'Failed to snooze tabs');
    }
    return response;
}

async function snoozeSelectedCleanupTabs(timeOption) {
    const tabIds = Array.from(cleanupSelectedTabIds);
    const response = await sendBackgroundMessage({
        action: 'snoozeSelectedTabs',
        tabIds,
        timeOption
    });
    if (!response || !response.success) {
        throw new Error(response?.message || 'Failed to snooze selected tabs');
    }
    try {
        await recordCleanupDecisions(response.closedTabIds || tabIds, tabIds);
    } catch (error) {
        console.debug('[SynapseSave] cleanup learning update failed:', error.message);
    }
    return response;
}

function getTabDomain(url) {
    try {
        return new URL(url).hostname.replace(/^www\./, '');
    } catch (error) {
        return '';
    }
}

function normalizeCleanupUrl(url) {
    try {
        const parsed = new URL(url);
        parsed.hash = '';
        ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid', 'mc_cid', 'mc_eid'].forEach(param => parsed.searchParams.delete(param));
        parsed.searchParams.sort();
        return `${parsed.origin}${parsed.pathname.replace(/\/$/, '')}${parsed.search}`;
    } catch (error) {
        return url || '';
    }
}

function isSearchResultsUrl(url) {
    try {
        const parsed = new URL(url);
        const host = parsed.hostname.replace(/^www\./, '');
        const isGoogleSearch = host.startsWith('google.');
        const isKnownSearch = isGoogleSearch || SEARCH_HOSTS.some(searchHost =>
            host === searchHost || host.endsWith(`.${searchHost}`)
        );
        return isKnownSearch && (parsed.searchParams.has('q') || parsed.searchParams.has('p'));
    } catch (error) {
        return false;
    }
}

function getSearchQuery(url) {
    try {
        const parsed = new URL(url);
        return parsed.searchParams.get('q') || parsed.searchParams.get('p') || '';
    } catch (error) {
        return '';
    }
}

function formatDays(days) {
    if (days < 1) return 'today';
    return `${Math.floor(days)} day${Math.floor(days) === 1 ? '' : 's'}`;
}

function getCleanupCategory(score, signals) {
    if (signals.duplicate) return 'duplicates';
    if (signals.searchResults) return 'oldSearches';
    if (signals.veryOld) return 'forgotten';
    if (signals.inactive) return 'inactive';
    return score >= 70 ? 'strong' : 'suggested';
}

function getConfidence(score) {
    if (score >= 70) return 'Strong';
    if (score >= 50) return 'Suggested';
    return 'Low';
}

async function buildCleanupSuggestions() {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const result = await chrome.storage.local.get(['tabMetadata', 'cleanupLearning', 'cleanupKeeps']);
    const metadata = result.tabMetadata || {};
    const learning = result.cleanupLearning || {};
    const keeps = result.cleanupKeeps || { urls: {}, domains: {} };
    const activeTabs = tabs.filter(tab => isSnoozableUrl(tab.url));
    const duplicateGroups = activeTabs.reduce((map, tab) => {
        const key = normalizeCleanupUrl(tab.url);
        if (!map[key]) map[key] = [];
        map[key].push(tab);
        return map;
    }, {});
    const duplicateKeepers = Object.fromEntries(Object.entries(duplicateGroups).map(([key, groupTabs]) => {
        const keeper = [...groupTabs].sort((a, b) => {
            const aKept = Boolean(keeps.urls?.[key] || keeps.domains?.[getTabDomain(a.url)]);
            const bKept = Boolean(keeps.urls?.[key] || keeps.domains?.[getTabDomain(b.url)]);
            const aProtected = Number(a.active) * 8 + Number(a.pinned) * 4 + Number(a.audible) * 2 + Number(aKept);
            const bProtected = Number(b.active) * 8 + Number(b.pinned) * 4 + Number(b.audible) * 2 + Number(bKept);
            const aLastActive = metadata[a.id]?.lastActive || a.lastAccessed || 0;
            const bLastActive = metadata[b.id]?.lastActive || b.lastAccessed || 0;
            return bProtected - aProtected || bLastActive - aLastActive;
        })[0];
        return [key, keeper?.id];
    }));

    const now = Date.now();
    const suggestions = activeTabs.map(tab => {
        const meta = metadata[tab.id] || {};
        const domain = getTabDomain(tab.url);
        const firstSeen = meta.firstSeen || now;
        const lastActive = meta.lastActive || tab.lastAccessed || (tab.active ? now : firstSeen);
        const ageDays = Math.max(0, (now - firstSeen) / DAY_MS);
        const inactiveDays = Math.max(0, (now - lastActive) / DAY_MS);
        const activationCount = meta.activationCount || (tab.active ? 1 : 0);
        const duplicateKey = normalizeCleanupUrl(tab.url);
        const duplicateCount = duplicateGroups[duplicateKey]?.length || 0;
        const domainLearning = learning.domains?.[domain] || {};
        const accepted = Number(domainLearning.accepted) || 0;
        const rejected = Number(domainLearning.rejected) || 0;
        const isKept = keeps.urls?.[duplicateKey] || keeps.domains?.[domain];
        const signals = {
            inactive: inactiveDays >= 7,
            veryOld: ageDays >= 14 && activationCount < 2,
            lowActivation: activationCount < 2,
            duplicate: duplicateCount > 1 && duplicateKeepers[duplicateKey] !== tab.id,
            searchResults: isSearchResultsUrl(tab.url),
            frequentUse: activationCount >= 6,
            recentlyActive: inactiveDays < 1
        };

        let score = 0;
        const reasons = [];

        if (signals.inactive) {
            score += CLEANUP_SCORES.inactive7Days;
            reasons.push(`Inactive for ${formatDays(inactiveDays)}`);
        }
        if (ageDays >= 14) {
            score += CLEANUP_SCORES.open14Days;
            reasons.push(`Open for ${formatDays(ageDays)}`);
        }
        if (signals.lowActivation) {
            score += CLEANUP_SCORES.lowActivation;
            reasons.push(activationCount === 1 ? 'Visited once' : 'Rarely visited');
        }
        if (signals.duplicate) {
            score += CLEANUP_SCORES.duplicate;
            reasons.push(`${duplicateCount} copies of this page are open`);
        }
        if (signals.searchResults) {
            score += CLEANUP_SCORES.searchResults;
            const query = getSearchQuery(tab.url);
            reasons.push(query ? `Search results for "${query}"` : 'Old search results page');
        }
        if (tab.pinned) score += CLEANUP_SCORES.pinned;
        if (signals.frequentUse) score += CLEANUP_SCORES.frequentUse;
        if (signals.recentlyActive && !signals.duplicate) score += CLEANUP_SCORES.recentlyActive;
        if (accepted > rejected) score += Math.min(24, (accepted - rejected) * CLEANUP_SCORES.acceptedDomain);
        if (rejected > accepted) score -= Math.min(36, (rejected - accepted) * Math.abs(CLEANUP_SCORES.rejectedDomain));
        if (isKept) score += CLEANUP_SCORES.keep;

        const protectedTab = tab.active || tab.pinned || tab.audible || !isSnoozableUrl(tab.url) || isKept;
        return {
            tab,
            score,
            reasons,
            domain,
            ageDays,
            inactiveDays,
            activationCount,
            duplicateKey,
            duplicateCount,
            category: getCleanupCategory(score, signals),
            confidence: getConfidence(score),
            protectedTab
        };
    })
        .filter(item => !item.protectedTab && item.score >= 50 && item.reasons.length > 0)
        .sort((a, b) => b.score - a.score || b.inactiveDays - a.inactiveDays);
    return { suggestions, openTabCount: activeTabs.length };
}

function getCleanupCategoryLabel(category) {
    const labels = {
        inactive: 'Inactive',
        duplicates: 'Duplicates',
        oldSearches: 'Old searches',
        forgotten: 'Forgotten',
        strong: 'Strong suggestions',
        suggested: 'Suggested'
    };
    return labels[category] || 'Suggested';
}

function getCleanupSummaryCounts(suggestions) {
    return suggestions.reduce((counts, suggestion) => {
        counts[suggestion.category] = (counts[suggestion.category] || 0) + 1;
        return counts;
    }, {});
}

function renderCleanupSummary(suggestions, openTabCount = allOpenTabs.length) {
    const summary = document.getElementById('cleanupSummary');
    const subtitle = document.getElementById('cleanupSubtitle');
    if (!summary || !subtitle) return;

    summary.innerHTML = '';
    subtitle.textContent = `You have ${openTabCount} open tab${openTabCount === 1 ? '' : 's'}.`;

    if (suggestions.length === 0) {
        summary.innerHTML = '<div class="cleanup-empty"><strong>No cleanup suggestions right now.</strong><span>Your current tabs look intentional enough to leave alone.</span></div>';
        return;
    }

    const counts = getCleanupSummaryCounts(suggestions);
    Object.entries(counts).forEach(([category, count]) => {
        const item = document.createElement('div');
        item.className = 'cleanup-summary-item';
        item.innerHTML = `<strong>${count}</strong><span>${getCleanupCategoryLabel(category)}</span>`;
        summary.appendChild(item);
    });
}

function createCleanupSuggestionItem(suggestion) {
    const row = document.createElement('label');
    row.className = 'cleanup-item';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = cleanupSelectedTabIds.has(suggestion.tab.id);
    checkbox.dataset.tabId = String(suggestion.tab.id);

    const favicon = document.createElement('div');
    favicon.className = 'tab-favicon cleanup-favicon';
    const img = document.createElement('img');
    try {
        const faviconUrl = new URL(chrome.runtime.getURL('/_favicon/'));
        faviconUrl.searchParams.set('pageUrl', suggestion.tab.url);
        faviconUrl.searchParams.set('size', '32');
        img.src = faviconUrl.toString();
        img.alt = '';
        favicon.appendChild(img);
    } catch (error) {
        favicon.textContent = '🌐';
    }

    const content = document.createElement('div');
    content.className = 'cleanup-item-content';

    const title = document.createElement('div');
    title.className = 'cleanup-item-title';
    title.textContent = suggestion.tab.title || suggestion.tab.url;
    title.title = suggestion.tab.title || suggestion.tab.url;

    const meta = document.createElement('div');
    meta.className = 'cleanup-item-meta';
    meta.textContent = `${suggestion.domain || 'Tab'} · ${suggestion.confidence} · Score ${suggestion.score}`;

    const why = document.createElement('div');
    why.className = 'cleanup-item-why';
    why.textContent = suggestion.reasons.slice(0, 3).join(' · ');

    content.appendChild(title);
    content.appendChild(meta);
    content.appendChild(why);

    row.appendChild(checkbox);
    row.appendChild(favicon);
    row.appendChild(content);
    return row;
}

function renderCleanupSuggestions() {
    const results = document.getElementById('cleanupResults');
    const toolbar = document.getElementById('cleanupReviewToolbar');
    const footer = document.getElementById('cleanupFooter');
    if (!results || !toolbar || !footer) return;

    results.innerHTML = '';
    toolbar.hidden = cleanupSuggestions.length === 0;
    footer.hidden = cleanupSuggestions.length === 0;

    if (cleanupSuggestions.length === 0) {
        updateCleanupSelectedCount();
        return;
    }

    const grouped = cleanupSuggestions.reduce((map, suggestion) => {
        if (!map[suggestion.category]) map[suggestion.category] = [];
        map[suggestion.category].push(suggestion);
        return map;
    }, {});

    Object.entries(grouped).forEach(([category, suggestions]) => {
        const group = document.createElement('section');
        group.className = 'cleanup-group';
        const heading = document.createElement('h4');
        heading.textContent = `${getCleanupCategoryLabel(category)} — ${suggestions.length}`;
        group.appendChild(heading);
        suggestions.forEach(suggestion => group.appendChild(createCleanupSuggestionItem(suggestion)));
        results.appendChild(group);
    });

    updateCleanupSelectedCount();
}

function updateCleanupSelectedCount() {
    const selectedCount = document.getElementById('cleanupSelectedCount');
    const selectAll = document.getElementById('cleanupSelectAll');
    if (selectedCount) {
        selectedCount.textContent = `${cleanupSelectedTabIds.size} selected`;
    }
    if (selectAll) {
        selectAll.checked = cleanupSuggestions.length > 0 && cleanupSelectedTabIds.size === cleanupSuggestions.length;
        selectAll.indeterminate = cleanupSelectedTabIds.size > 0 && cleanupSelectedTabIds.size < cleanupSuggestions.length;
    }
}

async function openCleanupModal() {
    const modal = document.getElementById('cleanupModal');
    const results = document.getElementById('cleanupResults');
    if (!modal) return;
    const runId = ++cleanupRunId;
    cleanupTriggerElement = document.activeElement;
    modal.classList.add('active');
    document.querySelector('.container')?.setAttribute('inert', '');
    document.getElementById('closeCleanupModalBtn')?.focus();
    if (results) results.innerHTML = '<div class="cleanup-empty"><strong>Checking your open tabs...</strong><span>Reviewing tab activity...</span></div>';
    try {
        const cleanupResult = await buildCleanupSuggestions();
        if (runId !== cleanupRunId || !modal.classList.contains('active')) return;
        cleanupSuggestions = cleanupResult.suggestions;
        cleanupSelectedTabIds = new Set(cleanupSuggestions.map(suggestion => suggestion.tab.id));
        renderCleanupSummary(cleanupSuggestions, cleanupResult.openTabCount);
        renderCleanupSuggestions();
    } catch (error) {
        if (runId !== cleanupRunId || !modal.classList.contains('active')) return;
        cleanupSuggestions = [];
        cleanupSelectedTabIds = new Set();
        document.getElementById('cleanupReviewToolbar')?.setAttribute('hidden', '');
        document.getElementById('cleanupFooter')?.setAttribute('hidden', '');
        if (results) results.innerHTML = '<div class="cleanup-empty"><strong>Could not check tabs.</strong><span>Close this window and try again.</span></div>';
        throw error;
    }
}

function closeCleanupModal() {
    if (cleanupSubmitting) return;
    const modal = document.getElementById('cleanupModal');
    if (!modal) return;
    cleanupRunId += 1;
    modal.classList.remove('active');
    document.querySelector('.container')?.removeAttribute('inert');
    cleanupSuggestions = [];
    cleanupSelectedTabIds = new Set();
    document.querySelectorAll('#cleanupModal .snooze-option').forEach(opt => {
        opt.classList.remove('selected');
        opt.setAttribute('aria-pressed', 'false');
    });
    cleanupTriggerElement?.focus();
    cleanupTriggerElement = null;
}

async function recordCleanupDecisions(acceptedTabIds, selectedTabIds) {
    const accepted = new Set(acceptedTabIds);
    const selected = new Set(selectedTabIds);
    const result = await chrome.storage.local.get(['cleanupLearning']);
    const cleanupLearning = result.cleanupLearning || { domains: {} };
    cleanupLearning.domains = cleanupLearning.domains || {};
    cleanupSuggestions.forEach(suggestion => {
        const domain = suggestion.domain || 'unknown';
        if (!cleanupLearning.domains[domain]) cleanupLearning.domains[domain] = { accepted: 0, rejected: 0 };
        const domainLearning = cleanupLearning.domains[domain];
        domainLearning.accepted = Number(domainLearning.accepted) || 0;
        domainLearning.rejected = Number(domainLearning.rejected) || 0;
        if (accepted.has(suggestion.tab.id)) {
            domainLearning.accepted = Math.min(100, domainLearning.accepted + 1);
        } else if (!selected.has(suggestion.tab.id)) {
            domainLearning.rejected = Math.min(100, domainLearning.rejected + 1);
        }
    });
    await chrome.storage.local.set({ cleanupLearning });
}

function setCleanupSubmitting(isSubmitting) {
    cleanupSubmitting = isSubmitting;
    document.querySelectorAll('#cleanupModal .snooze-option, #cleanupModal input').forEach(control => {
        control.disabled = isSubmitting;
    });
    const closeButton = document.getElementById('closeCleanupModalBtn');
    if (closeButton) closeButton.disabled = isSubmitting;
}

async function reopenTab(snoozeIdOrTabId) {
    try {
        const response = await sendBackgroundMessage({
            action: 'restoreSingleTab',
            snoozeId: snoozeIdOrTabId,
            tabId: snoozeIdOrTabId
        });

        if (response && response.success) {
            await refreshAll();
            showToast('Tab reopened', 'success');
            return;
        }

        const check = await chrome.storage.local.get(['snoozedTabs']);
        const stillSnoozed = (check.snoozedTabs || []).some(
            st => st.snoozeId === snoozeIdOrTabId || st.tabId === snoozeIdOrTabId
        );
        if (!stillSnoozed) {
            await refreshAll();
            showToast('Tab reopened', 'success');
            return;
        }

        showToast(response?.message || 'Error reopening tab', 'error');
    } catch (error) {
        console.error('Error in reopenTab:', error);
        showToast(error.message || 'Error reopening tab', 'error');
    }
}

async function deleteSnooze(snoozeIdOrTabId) {
    try {
        const response = await sendBackgroundMessage({
            action: 'deleteSingleSnooze',
            snoozeId: snoozeIdOrTabId,
            tabId: snoozeIdOrTabId
        });

        if (response && response.success) {
            await refreshAll();
            showToast('Snooze cancelled', 'success');
            return;
        }

        showToast(response?.message || 'Error deleting snooze', 'error');
    } catch (error) {
        console.error('Error in deleteSnooze:', error);
        showToast(error.message || 'Error deleting snooze', 'error');
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
                chrome.alarms.clear(alarmNameForTab(tab.tabId, bundleWakeTime));
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
                    chrome.alarms.clear(alarmNameForTab(tab.tabId, bundle.wakeTime));
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
    const duration = SNOOZE_DURATIONS[option] || SNOOZE_DURATIONS['24hours'];
    return Date.now() + (duration.days * 24 * 60 * 60 * 1000);
}

function getSnoozeDurationLabel(option) {
    return (SNOOZE_DURATIONS[option] || SNOOZE_DURATIONS['24hours']).label;
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
    return mins > 0 ? `${mins}m` : '<1m';
}

function formatReturnDate(timestamp) {
    const value = Number(timestamp);
    if (!Number.isFinite(value)) return '';
    return new Intl.DateTimeFormat(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    }).format(new Date(value));
}

function updateDynamicTimes() {
    document.querySelectorAll('[data-wake-time]').forEach(element => {
        const wakeTime = Number(element.dataset.wakeTime);
        element.textContent = formatTimeUntil(wakeTime);
        element.title = formatReturnDate(wakeTime);
    });
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
    const viewTabs = Array.from(document.querySelectorAll('.view-tab'));
    viewTabs.forEach((tab, index) => {
        tab.addEventListener('click', () => setActiveView(tab.dataset.view));
        tab.addEventListener('keydown', (event) => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            let nextIndex = index;
            if (event.key === 'ArrowLeft') nextIndex = (index - 1 + viewTabs.length) % viewTabs.length;
            if (event.key === 'ArrowRight') nextIndex = (index + 1) % viewTabs.length;
            if (event.key === 'Home') nextIndex = 0;
            if (event.key === 'End') nextIndex = viewTabs.length - 1;
            setActiveView(viewTabs[nextIndex].dataset.view, true);
        });
    });

    // Unified modal close handlers with ESC key support
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const snoozeModal = document.getElementById('snoozeModal');
            const bundleModal = document.getElementById('bundleNameModal');
            const cleanupModal = document.getElementById('cleanupModal');
            if (cleanupModal?.classList.contains('active')) {
                closeCleanupModal();
            } else if (snoozeModal?.classList.contains('active')) {
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

    const smartCleanupBtn = document.getElementById('smartCleanupBtn');
    if (smartCleanupBtn) {
        smartCleanupBtn.addEventListener('click', async () => {
            smartCleanupBtn.disabled = true;
            try {
                await openCleanupModal();
            } catch (error) {
                console.error('Smart Cleanup failed:', error);
                showToast(error.message || 'Could not run Smart Cleanup', 'error');
            } finally {
                smartCleanupBtn.disabled = false;
            }
        });
    }

    const closeCleanupModalBtn = document.getElementById('closeCleanupModalBtn');
    if (closeCleanupModalBtn) {
        closeCleanupModalBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeCleanupModal();
        });
    }

    const cleanupModal = document.getElementById('cleanupModal');
    if (cleanupModal) {
        cleanupModal.querySelector('.modal-overlay')?.addEventListener('click', () => closeCleanupModal());
        cleanupModal.querySelector('.modal-content')?.addEventListener('click', (e) => e.stopPropagation());
    }

    const cleanupSelectAll = document.getElementById('cleanupSelectAll');
    if (cleanupSelectAll) {
        cleanupSelectAll.addEventListener('change', () => {
            cleanupSelectedTabIds = cleanupSelectAll.checked
                ? new Set(cleanupSuggestions.map(suggestion => suggestion.tab.id))
                : new Set();
            renderCleanupSuggestions();
        });
    }

    const cleanupResults = document.getElementById('cleanupResults');
    if (cleanupResults) {
        cleanupResults.addEventListener('change', (e) => {
            const checkbox = e.target.closest('input[type="checkbox"][data-tab-id]');
            if (!checkbox) return;
            const tabId = Number(checkbox.dataset.tabId);
            if (checkbox.checked) {
                cleanupSelectedTabIds.add(tabId);
            } else {
                cleanupSelectedTabIds.delete(tabId);
            }
            updateCleanupSelectedCount();
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
                    if (freshTab && isSnoozableUrl(freshTab.url)) {
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
            document.querySelectorAll('#bundleNameModal .snooze-option').forEach(o => {
                o.classList.remove('selected');
                o.setAttribute('aria-pressed', 'false');
            });
            option.classList.add('selected');
            option.setAttribute('aria-pressed', 'true');
        });
    }
    
    const snoozeAllBtn = document.getElementById('snoozeAllBtn');
    if (snoozeAllBtn) {
        snoozeAllBtn.addEventListener('click', () => {
            currentTabId = null;
            snoozeTarget = 'all';
            const modal = document.getElementById('snoozeModal');
            const title = document.getElementById('snoozeModalTitle');
            const prompt = modal?.querySelector('.snooze-prompt');
            if (title) title.textContent = 'Snooze all tabs';
            if (prompt) prompt.textContent = 'Choose when to bring them back';
            modal?.classList.add('active');
            modal?.querySelector('.snooze-option')?.focus();
        });
    }
    
    const modalBody = document.querySelector('#snoozeModal .modal-body');
    if (modalBody) {
        modalBody.addEventListener('click', async (e) => {
            const option = e.target.closest('.snooze-option');
            if (!option) return;
            e.stopPropagation();
            document.querySelectorAll('#snoozeModal .snooze-option').forEach(o => {
                o.classList.remove('selected');
                o.setAttribute('aria-pressed', 'false');
            });
            option.classList.add('selected');
            option.setAttribute('aria-pressed', 'true');
            
            const timeOption = option.dataset.time;
            const time = calculateWakeTime(timeOption);
            
            if (time && (currentTabId || snoozeTarget === 'all')) {
                const isAllTabs = snoozeTarget === 'all';
                option.disabled = true;
                try {
                    if (isAllTabs) {
                        await batchSnooze(timeOption);
                    } else {
                        await performSnooze(currentTabId, time, timeOption);
                    }
                    closeModal();
                    currentTabId = null;
                    await refreshAll();
                    const subject = isAllTabs ? 'Tabs' : 'Tab';
                    showToast(`${subject} snoozed for ${getSnoozeDurationLabel(timeOption)}`, 'success');
                    if (isAllTabs) setTimeout(() => window.close(), 500);
                } catch (snoozeError) {
                    console.error('Snooze failed:', snoozeError);
                    showToast(snoozeError.message || 'Failed to snooze tab', 'error');
                } finally {
                    option.disabled = false;
                }
            }
        });
    }

    const cleanupFooter = document.getElementById('cleanupFooter');
    if (cleanupFooter) {
        cleanupFooter.addEventListener('click', async (e) => {
            const option = e.target.closest('.snooze-option');
            if (!option || cleanupSubmitting) return;
            e.stopPropagation();
            if (cleanupSelectedTabIds.size === 0) {
                showToast('Select at least one tab', 'error');
                return;
            }

            document.querySelectorAll('#cleanupModal .snooze-option').forEach(o => {
                o.classList.remove('selected');
                o.setAttribute('aria-pressed', 'false');
            });
            option.classList.add('selected');
            option.setAttribute('aria-pressed', 'true');
            setCleanupSubmitting(true);

            try {
                const timeOption = option.dataset.time;
                const response = await snoozeSelectedCleanupTabs(timeOption);
                const count = response.count || cleanupSelectedTabIds.size;
                const skippedCount = response.skippedTabIds?.length || 0;
                setCleanupSubmitting(false);
                closeCleanupModal();
                await refreshAll();
                const message = skippedCount > 0
                    ? `${count} snoozed; ${skippedCount} left open`
                    : `${count} tab${count === 1 ? '' : 's'} snoozed for ${getSnoozeDurationLabel(timeOption)}`;
                showToast(message, 'success');
            } catch (error) {
                console.error('Cleanup snooze failed:', error);
                showToast(error.message || 'Could not snooze selected tabs', 'error');
            } finally {
                setCleanupSubmitting(false);
            }
        });
    }
}

function closeModal() {
    const modal = document.getElementById('snoozeModal');
    if (modal) {
        modal.classList.remove('active');
        currentTabId = null;
        snoozeTarget = 'tab';
        document.querySelectorAll('#snoozeModal .snooze-option').forEach(opt => {
            opt.classList.remove('selected');
            opt.setAttribute('aria-pressed', 'false');
        });
    }
}

document.addEventListener('visibilitychange', async () => {
    if (!document.hidden) {
        await refreshAll();
    }
});
