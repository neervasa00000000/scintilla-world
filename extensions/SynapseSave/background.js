// SynapseSave - Background Service Worker

const DAY_MS = 24 * 60 * 60 * 1000;
const CLEANUP_GRACE_DAYS = 90;
const restoringBundleIds = new Set();
const restoredGroupIds = new Map();

const SNOOZE_DURATIONS = {
    '24hours': 1,
    '7days': 7,
    '60days': 60,
    '90days': 90,
    oneday: 1,
    nextweek: 7
};

const TAB_METADATA_KEY = 'tabMetadata';
const CLEANUP_KEEP_TAB_MENU = 'snipsnooze-keep-tab';
const CLEANUP_KEEP_SITE_MENU = 'snipsnooze-keep-site';
let tabMetadataQueue = Promise.resolve();

function isSnoozableUrl(url) {
    if (!url) return false;
    return !url.startsWith('chrome://') &&
        !url.startsWith('edge://') &&
        !url.startsWith('about:') &&
        !url.startsWith('chrome-extension://');
}

function getDomain(url) {
    try {
        return new URL(url).hostname.replace(/^www\./, '');
    } catch (error) {
        return '';
    }
}

async function getTabMetadataStore() {
    const result = await chrome.storage.local.get([TAB_METADATA_KEY]);
    return result[TAB_METADATA_KEY] || {};
}

async function saveTabMetadataStore(tabMetadata) {
    await chrome.storage.local.set({ [TAB_METADATA_KEY]: tabMetadata });
}

function updateTabMetadataStore(mutator) {
    const update = tabMetadataQueue.then(async () => {
        const tabMetadata = await getTabMetadataStore();
        const changed = await mutator(tabMetadata);
        if (changed !== false) await saveTabMetadataStore(tabMetadata);
    });
    tabMetadataQueue = update.catch(() => {});
    return update;
}

async function upsertTabMetadata(tab, options = {}) {
    if (!tab || !tab.id) return;
    if (!isSnoozableUrl(tab.url)) {
        await removeTabMetadata(tab.id);
        return;
    }

    const now = Date.now();
    await updateTabMetadataStore((tabMetadata) => {
        const current = tabMetadata[tab.id] || {};
        const sameUrl = current.url === tab.url;
        const becameActive = options.activated || Boolean(tab.active && (!sameUrl || !current.lastActive));

        tabMetadata[tab.id] = {
            tabId: tab.id,
            windowId: tab.windowId,
            groupId: tab.groupId,
            url: tab.url,
            domain: getDomain(tab.url),
            title: tab.title || tab.url,
            pinned: Boolean(tab.pinned),
            firstSeen: sameUrl ? (current.firstSeen || now) : now,
            lastSeen: now,
            lastActive: becameActive ? now : (sameUrl ? (current.lastActive || tab.lastAccessed || now) : (tab.lastAccessed || now)),
            activationCount: (sameUrl ? (current.activationCount || 0) : 0) + (becameActive ? 1 : 0)
        };
    });
}

async function removeTabMetadata(tabId) {
    await updateTabMetadataStore((tabMetadata) => {
        if (!tabMetadata[tabId]) return false;
        delete tabMetadata[tabId];
        return true;
    });
}

async function syncOpenTabMetadata() {
    try {
        await updateTabMetadataStore(async (tabMetadata) => {
            const tabs = await chrome.tabs.query({});
            const openTabIds = new Set();
            const now = Date.now();
            for (const tab of tabs) {
                if (!tab.id || !isSnoozableUrl(tab.url)) continue;
                openTabIds.add(String(tab.id));
                const current = tabMetadata[tab.id] || {};
                const sameUrl = current.url === tab.url;
                tabMetadata[tab.id] = {
                    tabId: tab.id,
                    windowId: tab.windowId,
                    groupId: tab.groupId,
                    url: tab.url,
                    domain: getDomain(tab.url),
                    title: tab.title || tab.url,
                    pinned: Boolean(tab.pinned),
                    firstSeen: sameUrl ? (current.firstSeen || now) : now,
                    lastSeen: now,
                    lastActive: tab.active ? now : (sameUrl ? (current.lastActive || tab.lastAccessed || now) : (tab.lastAccessed || now)),
                    activationCount: sameUrl ? (current.activationCount || (tab.active ? 1 : 0)) : (tab.active ? 1 : 0)
                };
            }

            Object.keys(tabMetadata).forEach(tabId => {
                if (!openTabIds.has(tabId)) delete tabMetadata[tabId];
            });
        });
    } catch (error) {
        console.debug('[SynapseSave] tab metadata sync failed:', error.message);
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

// Helper function to calculate wake time
function calculateWakeTime(option) {
    const days = SNOOZE_DURATIONS[option] || SNOOZE_DURATIONS['24hours'];
    return Date.now() + (days * DAY_MS);
}

function normalizeWakeTime(wakeTime, option) {
    const requestedWakeTime = Number(wakeTime);
    const fallbackWakeTime = calculateWakeTime(option);

    if (!Number.isFinite(requestedWakeTime) || requestedWakeTime <= Date.now()) {
        return fallbackWakeTime;
    }

    return requestedWakeTime;
}

function parseSnoozeAlarmName(alarmName) {
    const match = /^snooze_(\d+)_(\d+)$/.exec(alarmName);
    if (!match) return null;
    return { tabId: parseInt(match[1], 10), wakeTime: parseInt(match[2], 10) };
}

function alarmNameForTab(tabId, wakeTime) {
    return `snooze_${tabId}_${wakeTime}`;
}

function createSnoozeId() {
    return `s_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

async function getExistingWindowId(windowId) {
    if (!Number.isInteger(windowId)) return null;
    try {
        const window = await chrome.windows.get(windowId);
        return window.type === 'normal' ? window.id : null;
    } catch (error) {
        return null;
    }
}

function findSnoozedEntry(snoozedTabs, id) {
    if (!id) return null;
    const bySnoozeId = snoozedTabs.find(st => st.snoozeId === id);
    if (bySnoozeId) return bySnoozeId;
    return snoozedTabs.find(st => st.tabId === id) || null;
}

function removeSnoozedEntry(snoozedTabs, target) {
    if (!target) return snoozedTabs;
    if (target.snoozeId) {
        return snoozedTabs.filter(st => st.snoozeId !== target.snoozeId);
    }
    return snoozedTabs.filter(st => !(st.tabId === target.tabId && st.wakeTime === target.wakeTime));
}

/** Re-create alarms after SW restart / extension update (storage is source of truth). */
async function reschedulePendingAlarms() {
    const result = await chrome.storage.local.get(['snoozedTabs', 'snoozedBundles']);
    const snoozedTabs = result.snoozedTabs || [];
    const bundles = result.snoozedBundles || [];
    const now = Date.now();

    for (const tab of snoozedTabs) {
        if (!tab.tabId || !tab.wakeTime) continue;
        const name = alarmNameForTab(tab.tabId, tab.wakeTime);
        try {
            const existing = await chrome.alarms.get(name);
            if (!existing) {
                await chrome.alarms.create(name, { when: Math.max(tab.wakeTime, now + 1000) });
            }
        } catch (e) {
            console.debug('[SynapseSave] alarm reschedule tab:', e.message);
        }
    }

    for (const bundle of bundles) {
        if (!bundle.wakeTime || !bundle.tabs) continue;
        for (const tab of bundle.tabs) {
            if (!tab.tabId) continue;
            const name = alarmNameForTab(tab.tabId, bundle.wakeTime);
            try {
                const existing = await chrome.alarms.get(name);
                if (!existing) {
                    await chrome.alarms.create(name, { when: Math.max(bundle.wakeTime, now + 1000) });
                }
            } catch (e) {
                console.debug('[SynapseSave] alarm reschedule bundle tab:', e.message);
            }
        }
    }
}

chrome.runtime.onStartup.addListener(() => {
    reschedulePendingAlarms();
    syncOpenTabMetadata();
});

chrome.runtime.onInstalled.addListener(() => {
    reschedulePendingAlarms();
    syncOpenTabMetadata();
    createCleanupContextMenus();
});

reschedulePendingAlarms();
syncOpenTabMetadata();
createCleanupContextMenus();

function createCleanupContextMenus() {
    if (!chrome.contextMenus) return;
    chrome.contextMenus.removeAll(() => {
        chrome.contextMenus.create({
            id: CLEANUP_KEEP_TAB_MENU,
            title: 'Always Keep this tab',
            contexts: ['page']
        });
        chrome.contextMenus.create({
            id: CLEANUP_KEEP_SITE_MENU,
            title: 'Always Keep this website',
            contexts: ['page']
        });
    });
}

async function addCleanupKeep(tab, scope) {
    if (!tab?.url || !isSnoozableUrl(tab.url)) return;
    const result = await chrome.storage.local.get(['cleanupKeeps']);
    const cleanupKeeps = result.cleanupKeeps || { urls: {}, domains: {} };
    cleanupKeeps.urls = cleanupKeeps.urls || {};
    cleanupKeeps.domains = cleanupKeeps.domains || {};
    const normalizedUrl = (() => {
        try {
            const parsed = new URL(tab.url);
            parsed.hash = '';
            ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid', 'mc_cid', 'mc_eid'].forEach(param => parsed.searchParams.delete(param));
            parsed.searchParams.sort();
            return `${parsed.origin}${parsed.pathname.replace(/\/$/, '')}${parsed.search}`;
        } catch (error) {
            return tab.url;
        }
    })();
    const domain = getDomain(tab.url);

    if (scope === 'site' && domain) {
        cleanupKeeps.domains[domain] = Date.now();
    } else {
        cleanupKeeps.urls[normalizedUrl] = Date.now();
    }

    await chrome.storage.local.set({ cleanupKeeps });
}

if (chrome.contextMenus) {
    chrome.contextMenus.onClicked.addListener((info, tab) => {
        if (info.menuItemId === CLEANUP_KEEP_TAB_MENU) {
            addCleanupKeep(tab, 'tab').catch(error => console.debug('[SynapseSave] keep tab failed:', error.message));
        }
        if (info.menuItemId === CLEANUP_KEEP_SITE_MENU) {
            addCleanupKeep(tab, 'site').catch(error => console.debug('[SynapseSave] keep site failed:', error.message));
        }
    });
}

chrome.tabs.onCreated.addListener((tab) => {
    upsertTabMetadata(tab).catch(error => console.debug('[SynapseSave] tab create metadata:', error.message));
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (!changeInfo.url && !changeInfo.title && changeInfo.pinned === undefined && changeInfo.groupId === undefined) return;
    upsertTabMetadata(tab).catch(error => console.debug('[SynapseSave] tab update metadata:', error.message));
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
    chrome.tabs.get(tabId)
        .then(tab => upsertTabMetadata(tab, { activated: true }))
        .catch(error => console.debug('[SynapseSave] tab active metadata:', error.message));
});

chrome.tabs.onRemoved.addListener((tabId) => {
    removeTabMetadata(tabId).catch(error => console.debug('[SynapseSave] tab remove metadata:', error.message));
});

// Snooze bundle function - handles snoozing a group of tabs as a named bundle
async function snoozeBundle(request) {
    try {
        const { bundleName, tabs, groupInfo, timeOption } = request;
        const wakeTime = normalizeWakeTime(request.wakeTime, timeOption);
        
        if (!tabs || tabs.length === 0) {
            return { success: false, message: 'No tabs to snooze' };
        }
        
        // Validate that tabs still exist before proceeding
        const validTabs = [];
        for (const tab of tabs) {
            try {
                const liveTab = await chrome.tabs.get(tab.id);
                validTabs.push(liveTab);
            } catch (e) {
                // Tab no longer exists, skip it
                console.log(`Tab ${tab.id} no longer exists, skipping`);
            }
        }
        
        if (validTabs.length === 0) {
            return { success: false, message: 'No valid tabs to snooze' };
        }
        
        // Get existing bundles
        const result = await chrome.storage.local.get(['snoozedBundles']);
        const bundles = result.snoozedBundles || [];
        
        // Create bundle ID
        const bundleId = `bundle_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
        
        // Prepare tab data with group info
        const tabData = validTabs.map(tab => ({
            tabId: tab.id,
            url: tab.url,
            title: tab.title,
            favIconUrl: tab.favIconUrl,
            windowId: tab.windowId,
            groupInfo: groupInfo
        }));
        
        // Create bundle object
        const bundle = {
            bundleId: bundleId,
            name: bundleName,
            tabs: tabData,
            groupInfo: groupInfo,
            windowId: validTabs[0].windowId,
            wakeTime: wakeTime,
            snoozedAt: Date.now(),
            timeOption: timeOption
        };
        
        bundles.push(bundle);

        // Persist before closing tabs so a crash cannot lose snoozed state
        await chrome.storage.local.set({ snoozedBundles: bundles });
        
        try {
            await Promise.all(tabData.map(tab =>
                chrome.alarms.create(alarmNameForTab(tab.tabId, wakeTime), { when: wakeTime })
            ));
        } catch (alarmError) {
            await Promise.all(tabData.map(tab =>
                chrome.alarms.clear(alarmNameForTab(tab.tabId, wakeTime))
            ));
            await chrome.storage.local.set({
                snoozedBundles: bundles.filter(item => item.bundleId !== bundleId)
            });
            return { success: false, message: alarmError.message || 'Could not schedule bundle' };
        }

        const tabIds = validTabs.map(t => t.id);
        try {
            await chrome.tabs.remove(tabIds);
        } catch (closeError) {
            await Promise.all(tabData.map(tab =>
                chrome.alarms.clear(alarmNameForTab(tab.tabId, wakeTime))
            ));
            await chrome.storage.local.set({
                snoozedBundles: bundles.filter(item => item.bundleId !== bundleId)
            });
            return { success: false, message: closeError.message || 'Could not close bundle tabs' };
        }
        
        return { success: true, bundleId: bundleId, count: validTabs.length };
    } catch (error) {
        console.error('Error in snoozeBundle:', error);
        return { success: false, message: error.message || 'Unknown error occurred' };
    }
}

// Restore bundle function - reopens all tabs in a bundle and restores group
async function restoreBundle(bundleId) {
    if (restoringBundleIds.has(bundleId)) {
        return { success: true, message: 'Bundle restore already in progress' };
    }

    restoringBundleIds.add(bundleId);
    try {
        const result = await chrome.storage.local.get(['snoozedBundles']);
        const bundles = result.snoozedBundles || [];
        const bundle = bundles.find(b => b.bundleId === bundleId);
        
        if (!bundle) {
            return { success: false, message: 'Bundle not found' };
        }
        
        if (!bundle.tabs || bundle.tabs.length === 0) {
            return { success: false, message: 'Bundle has no tabs' };
        }

        const targetWindowId = await getExistingWindowId(bundle.windowId || bundle.tabs[0].windowId);
        
        // Create all tabs
        const tabPromises = bundle.tabs.map(async (tabData) => {
            try {
                const newTab = await chrome.tabs.create({
                    url: tabData.url,
                    active: false,
                    ...(targetWindowId ? { windowId: targetWindowId } : {})
                });
                return { tabData, newTab, success: true };
            } catch (error) {
                console.error(`Error creating tab for ${tabData.url}:`, error);
                return { tabData, newTab: null, success: false, error: error.message };
            }
        });
        
        const results = await Promise.all(tabPromises);
        const createdTabs = results.filter(r => r.success && r.newTab);
        
        if (createdTabs.length === 0) {
            return { success: false, message: 'Failed to create any tabs' };
        }
        
        // Wait a bit for tabs to initialize
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Restore group if it existed
        if (bundle.groupInfo && createdTabs.length > 0) {
            try {
                const firstTab = createdTabs[0].newTab;
                const windowId = firstTab.windowId;
                const tabIds = createdTabs.map(ct => ct.newTab.id);
                
                // Try to find existing group by name in the window
                let foundGroup = null;
                if (bundle.groupInfo.title) {
                    try {
                        const windowGroups = await chrome.tabGroups.query({ windowId: windowId });
                        foundGroup = windowGroups.find(g => g.title === bundle.groupInfo.title);
                    } catch (e) {
                        console.log('Error searching groups:', e);
                    }
                }
                
                if (foundGroup) {
                    // Add tabs to existing group
                    await chrome.tabs.group({ groupId: foundGroup.id, tabIds: tabIds });
                } else {
                    // Create new group
                    const newGroupId = await chrome.tabs.group({ tabIds: tabIds });
                    const updateData = {};
                    if (bundle.groupInfo.title) updateData.title = bundle.groupInfo.title;
                    if (bundle.groupInfo.color) updateData.color = bundle.groupInfo.color;
                    if (bundle.groupInfo.collapsed !== undefined) updateData.collapsed = bundle.groupInfo.collapsed;
                    
                    if (Object.keys(updateData).length > 0) {
                        await chrome.tabGroups.update(newGroupId, updateData);
                    }
                }
            } catch (error) {
                console.log('Error restoring group:', error);
                // Continue even if group restoration fails
            }
        }
        
        // Activate the first tab
        if (createdTabs.length > 0) {
            try {
                await chrome.tabs.update(createdTabs[0].newTab.id, { active: true });
                await chrome.windows.update(createdTabs[0].newTab.windowId, { focused: true });
            } catch (e) {
                console.log('Error activating restored bundle:', e);
            }
        }
        
        // Remove bundle from storage after successful restore
        // This ensures the bundle is removed even if the popup callback fails
        try {
            const updatedBundles = bundles.filter(b => b.bundleId !== bundleId);
            await chrome.storage.local.set({ snoozedBundles: updatedBundles });
            
            // Clear alarms for the bundle
            bundle.tabs.forEach(tab => {
                chrome.alarms.clear(alarmNameForTab(tab.tabId, bundle.wakeTime));
            });
        } catch (e) {
            console.error('Error removing bundle from storage:', e);
            // Continue even if removal fails - popup will handle it
        }
        
        return { success: true, count: createdTabs.length };
    } catch (error) {
        console.error('Error in restoreBundle:', error);
        return { success: false, message: error.message || 'Unknown error occurred' };
    } finally {
        restoringBundleIds.delete(bundleId);
    }
}

// Single-tab snooze — runs in the service worker so closing the tab cannot kill the popup mid-flight
async function snoozeSingleTab(tabId, wakeTime, timeOption) {
    try {
        wakeTime = normalizeWakeTime(wakeTime, timeOption);
        let tab;
        try {
            tab = await chrome.tabs.get(tabId);
        } catch (e) {
            return { success: false, message: 'Tab no longer exists' };
        }

        if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') ||
            tab.url.startsWith('chrome-extension://') || tab.url.startsWith('about:')) {
            return { success: false, message: 'This tab cannot be snoozed' };
        }

        let groupInfo = null;
        if (tab.groupId && tab.groupId !== chrome.tabs.TAB_GROUP_ID_NONE) {
            groupInfo = await getGroupProperties(tab.groupId);
        }

        const result = await chrome.storage.local.get(['snoozedTabs']);
        const snoozedTabs = result.snoozedTabs || [];

        const entry = {
            snoozeId: createSnoozeId(),
            tabId: tab.id,
            url: tab.url,
            title: tab.title,
            favIconUrl: tab.favIconUrl,
            wakeTime: wakeTime,
            snoozedAt: Date.now(),
            timeOption: timeOption,
            windowId: tab.windowId,
            groupId: groupInfo ? groupInfo.id : null,
            groupInfo: groupInfo
        };
        snoozedTabs.push(entry);
        await chrome.storage.local.set({ snoozedTabs });

        try {
            await chrome.alarms.create(alarmNameForTab(tab.id, wakeTime), { when: wakeTime });
        } catch (alarmError) {
            const rolledBack = removeSnoozedEntry(snoozedTabs, entry);
            await chrome.storage.local.set({ snoozedTabs: rolledBack });
            throw alarmError;
        }

        try {
            await chrome.tabs.remove(tab.id);
        } catch (removeError) {
            const rolledBack = removeSnoozedEntry(snoozedTabs, entry);
            await chrome.storage.local.set({ snoozedTabs: rolledBack });
            await chrome.alarms.clear(alarmNameForTab(tab.id, wakeTime));
            return { success: false, message: removeError.message || 'Could not close tab' };
        }

        return { success: true, snoozeId: entry.snoozeId };
    } catch (error) {
        console.error('Error in snoozeSingleTab:', error);
        return { success: false, message: error.message || 'Unknown error occurred' };
    }
}

async function restoreSingleTab(snoozeIdOrTabId) {
    try {
        const result = await chrome.storage.local.get(['snoozedTabs']);
        const snoozedTabs = result.snoozedTabs || [];
        const targetTab = findSnoozedEntry(snoozedTabs, snoozeIdOrTabId);

        if (!targetTab) {
            return { success: false, message: 'Tab not found' };
        }

        let newTab;
        try {
            const targetWindowId = await getExistingWindowId(targetTab.windowId);
            newTab = await chrome.tabs.create({
                url: targetTab.url,
                active: true,
                ...(targetWindowId ? { windowId: targetWindowId } : {})
            });
        } catch (createError) {
            return { success: false, message: createError.message || 'Could not open tab' };
        }

        try {
            await chrome.windows.update(newTab.windowId, { focused: true });
        } catch (focusError) {
            console.debug('[SynapseSave] could not focus restored tab window:', focusError.message);
        }

        if (targetTab.groupId || targetTab.groupInfo) {
            await restoreGroup(targetTab, newTab.id);
        }

        const updated = removeSnoozedEntry(snoozedTabs, targetTab);
        await chrome.storage.local.set({ snoozedTabs: updated });
        await chrome.alarms.clear(alarmNameForTab(targetTab.tabId, targetTab.wakeTime));

        return { success: true, snoozeId: targetTab.snoozeId };
    } catch (error) {
        console.error('Error in restoreSingleTab:', error);
        return { success: false, message: error.message || 'Unknown error occurred' };
    }
}

async function deleteSingleSnooze(snoozeIdOrTabId) {
    try {
        const result = await chrome.storage.local.get(['snoozedTabs']);
        const snoozedTabs = result.snoozedTabs || [];
        const targetTab = findSnoozedEntry(snoozedTabs, snoozeIdOrTabId);

        if (!targetTab) {
            return { success: false, message: 'Tab not found' };
        }

        await chrome.alarms.clear(alarmNameForTab(targetTab.tabId, targetTab.wakeTime));
        const updated = removeSnoozedEntry(snoozedTabs, targetTab);
        await chrome.storage.local.set({ snoozedTabs: updated });

        return { success: true };
    } catch (error) {
        console.error('Error in deleteSingleSnooze:', error);
        return { success: false, message: error.message || 'Unknown error occurred' };
    }
}

// Batch snooze function - handles snoozing multiple tabs
async function batchSnooze(timeOption, windowId) {
    try {
        // FIX: Use windowId if provided, otherwise fallback to lastFocusedWindow
        const query = windowId ? { windowId: windowId } : { lastFocusedWindow: true };
        const tabs = await chrome.tabs.query(query);
        const filteredTabs = tabs.filter(tab => 
            !tab.url.startsWith('chrome://') && 
            !tab.url.startsWith('edge://') && 
            !tab.url.startsWith('chrome-extension://') &&
            !tab.url.startsWith('about:')
        );
        
        if (filteredTabs.length === 0) {
            return { success: false, message: 'No tabs to snooze' };
        }

        const wakeTime = calculateWakeTime(timeOption);
        const result = await chrome.storage.local.get(['snoozedTabs']);
        const snoozedTabs = result.snoozedTabs || [];

        // Prepare all tab data first (to avoid race conditions)
        const tabDataPromises = filteredTabs.map(async (tab) => {
            // Get tab group properties if tab belongs to a group
            let groupInfo = null;
            if (tab.groupId && tab.groupId !== chrome.tabs.TAB_GROUP_ID_NONE) {
                groupInfo = await getGroupProperties(tab.groupId);
            }
            
            return {
                snoozeId: createSnoozeId(),
                tabId: tab.id,
                url: tab.url,
                title: tab.title,
                favIconUrl: tab.favIconUrl,
                wakeTime: wakeTime,
                snoozedAt: Date.now(),
                timeOption: timeOption,
                windowId: tab.windowId,
                groupId: groupInfo ? groupInfo.id : null,
                groupInfo: groupInfo
            };
        });

        const tabDataArray = await Promise.all(tabDataPromises);
        
        // Add all tabs to snoozedTabs array at once
        snoozedTabs.push(...tabDataArray);
        
        // Save storage once before creating alarms
        await chrome.storage.local.set({ snoozedTabs });

        try {
            await Promise.all(filteredTabs.map(tab =>
                chrome.alarms.create(alarmNameForTab(tab.id, wakeTime), { when: wakeTime })
            ));
        } catch (alarmError) {
            await Promise.all(filteredTabs.map(tab =>
                chrome.alarms.clear(alarmNameForTab(tab.id, wakeTime))
            ));
            const newIds = new Set(tabDataArray.map(tab => tab.snoozeId));
            await chrome.storage.local.set({
                snoozedTabs: snoozedTabs.filter(tab => !newIds.has(tab.snoozeId))
            });
            return { success: false, message: alarmError.message || 'Could not schedule tabs' };
        }

        const closeResults = await Promise.all(filteredTabs.map(async tab => {
            try {
                await chrome.tabs.remove(tab.id);
                return true;
            } catch (error) {
                console.error(`Error removing tab ${tab.id}:`, error);
                return false;
            }
        }));

        const failedIndexes = closeResults
            .map((closed, index) => closed ? -1 : index)
            .filter(index => index !== -1);
        const failedTabIds = new Set(failedIndexes.map(index => filteredTabs[index].id));
        const failedSnoozeIds = new Set(failedIndexes.map(index => tabDataArray[index].snoozeId));

        if (failedTabIds.size > 0) {
            await Promise.all(Array.from(failedTabIds, tabId =>
                chrome.alarms.clear(alarmNameForTab(tabId, wakeTime))
            ));
            const latest = await chrome.storage.local.get(['snoozedTabs']);
            await chrome.storage.local.set({
                snoozedTabs: (latest.snoozedTabs || []).filter(tab => !failedSnoozeIds.has(tab.snoozeId))
            });
        }

        const closedCount = filteredTabs.length - failedTabIds.size;
        return closedCount > 0
            ? { success: true, count: closedCount }
            : { success: false, message: 'Could not close tabs' };
    } catch (error) {
        console.error('Error in batchSnooze:', error);
        return { success: false, message: error.message || 'Unknown error occurred' };
    }
}

async function snoozeSelectedTabs(tabIds, timeOption) {
    try {
        if (!Array.isArray(tabIds) || tabIds.length === 0) {
            return { success: false, message: 'No tabs selected' };
        }

        const requestedTabIds = [...new Set(tabIds.filter(Number.isInteger))];
        const validTabs = [];
        for (const tabId of requestedTabIds) {
            try {
                const tab = await chrome.tabs.get(tabId);
                if (tab && isSnoozableUrl(tab.url) && !tab.pinned && !tab.audible && !tab.active) {
                    validTabs.push(tab);
                }
            } catch (error) {
                console.debug('[SynapseSave] selected tab missing:', error.message);
            }
        }

        if (validTabs.length === 0) {
            return { success: false, message: 'No selected tabs can be snoozed' };
        }

        const wakeTime = calculateWakeTime(timeOption);
        const result = await chrome.storage.local.get(['snoozedTabs']);
        const snoozedTabs = result.snoozedTabs || [];

        const tabDataArray = await Promise.all(validTabs.map(async (tab) => {
            let groupInfo = null;
            if (tab.groupId && tab.groupId !== chrome.tabs.TAB_GROUP_ID_NONE) {
                groupInfo = await getGroupProperties(tab.groupId);
            }

            return {
                snoozeId: createSnoozeId(),
                tabId: tab.id,
                url: tab.url,
                title: tab.title,
                favIconUrl: tab.favIconUrl,
                wakeTime: wakeTime,
                snoozedAt: Date.now(),
                timeOption: timeOption,
                windowId: tab.windowId,
                groupId: groupInfo ? groupInfo.id : null,
                groupInfo: groupInfo
            };
        }));

        snoozedTabs.push(...tabDataArray);
        await chrome.storage.local.set({ snoozedTabs });

        try {
            await Promise.all(validTabs.map(tab =>
                chrome.alarms.create(alarmNameForTab(tab.id, wakeTime), { when: wakeTime })
            ));
        } catch (alarmError) {
            await Promise.all(validTabs.map(tab =>
                chrome.alarms.clear(alarmNameForTab(tab.id, wakeTime))
            ));
            const newIds = new Set(tabDataArray.map(tab => tab.snoozeId));
            await chrome.storage.local.set({
                snoozedTabs: snoozedTabs.filter(tab => !newIds.has(tab.snoozeId))
            });
            return { success: false, message: alarmError.message || 'Could not schedule selected tabs' };
        }

        const closeResults = await Promise.all(validTabs.map(async tab => {
            try {
                await chrome.tabs.remove(tab.id);
                await removeTabMetadata(tab.id);
                return true;
            } catch (error) {
                console.error(`Error removing selected tab ${tab.id}:`, error);
                return false;
            }
        }));

        const failedIndexes = closeResults
            .map((closed, index) => closed ? -1 : index)
            .filter(index => index !== -1);
        const failedTabIds = new Set(failedIndexes.map(index => validTabs[index].id));
        const failedSnoozeIds = new Set(failedIndexes.map(index => tabDataArray[index].snoozeId));

        if (failedTabIds.size > 0) {
            await Promise.all(Array.from(failedTabIds, tabId =>
                chrome.alarms.clear(alarmNameForTab(tabId, wakeTime))
            ));
            const latest = await chrome.storage.local.get(['snoozedTabs']);
            await chrome.storage.local.set({
                snoozedTabs: (latest.snoozedTabs || []).filter(tab => !failedSnoozeIds.has(tab.snoozeId))
            });
        }

        const closedCount = validTabs.length - failedTabIds.size;
        const closedTabIds = validTabs
            .filter(tab => !failedTabIds.has(tab.id))
            .map(tab => tab.id);
        const closedTabIdSet = new Set(closedTabIds);
        const skippedTabIds = requestedTabIds.filter(tabId => !closedTabIdSet.has(tabId));
        return closedCount > 0
            ? { success: true, count: closedCount, closedTabIds, skippedTabIds }
            : { success: false, message: 'Could not close selected tabs' };
    } catch (error) {
        console.error('Error in snoozeSelectedTabs:', error);
        return { success: false, message: error.message || 'Unknown error occurred' };
    }
}

// Message listener for batch snooze and bundles
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'batchSnooze') {
        // Pass windowId from popup to ensure we snooze the correct window
        batchSnooze(request.timeOption, request.windowId).then(result => {
            sendResponse(result);
        }).catch(error => {
            sendResponse({ success: false, message: error.message });
        });
        return true; // Indicates we will send a response asynchronously
    }

    if (request.action === 'snoozeSelectedTabs') {
        snoozeSelectedTabs(request.tabIds, request.timeOption).then(result => {
            sendResponse(result);
        }).catch(error => {
            sendResponse({ success: false, message: error.message });
        });
        return true;
    }
    
    if (request.action === 'snoozeBundle') {
        snoozeBundle(request).then(result => {
            sendResponse(result);
        }).catch(error => {
            sendResponse({ success: false, message: error.message });
        });
        return true;
    }
    
    if (request.action === 'restoreBundle') {
        restoreBundle(request.bundleId).then(result => {
            sendResponse(result);
        }).catch(error => {
            sendResponse({ success: false, message: error.message });
        });
        return true;
    }

    if (request.action === 'snoozeSingleTab') {
        snoozeSingleTab(request.tabId, request.wakeTime, request.timeOption).then(result => {
            sendResponse(result);
        }).catch(error => {
            sendResponse({ success: false, message: error.message });
        });
        return true;
    }

    if (request.action === 'restoreSingleTab') {
        restoreSingleTab(request.snoozeId || request.tabId).then(result => {
            sendResponse(result);
        }).catch(error => {
            sendResponse({ success: false, message: error.message });
        });
        return true;
    }

    if (request.action === 'deleteSingleSnooze') {
        deleteSingleSnooze(request.snoozeId || request.tabId).then(result => {
            sendResponse(result);
        }).catch(error => {
            sendResponse({ success: false, message: error.message });
        });
        return true;
    }
});

// Restore individual tabs to their original or closest matching group.
async function restoreGroup(tabData, newTabId) {
    if (!tabData.groupInfo && !tabData.groupId) return;
    try {
        await new Promise(resolve => setTimeout(resolve, 300)); // Wait for tab init
        
        // 1. Identify which window the new tab is in
        let newTab;
        try { newTab = await chrome.tabs.get(newTabId); } catch (e) { return; }
        
        let groupInfo = tabData.groupInfo || { title: '', color: 'grey' };
        let foundGroup = null;
        const restoreKey = `${tabData.windowId ?? 'unknown'}:${tabData.groupId ?? 'unknown'}`;

        const rememberedGroupId = restoredGroupIds.get(restoreKey);
        if (rememberedGroupId) {
            try {
                const rememberedGroup = await chrome.tabGroups.get(rememberedGroupId);
                if (rememberedGroup.windowId === newTab.windowId) foundGroup = rememberedGroup;
            } catch (error) {
                restoredGroupIds.delete(restoreKey);
            }
        }
        
        // Prefer the original group while it still exists in the target window.
        if (!foundGroup && tabData.groupId) {
            try {
                const groupById = await chrome.tabGroups.get(tabData.groupId);
                const titleMatches = !groupInfo.title || groupById.title === groupInfo.title;
                if (groupById.windowId === newTab.windowId && titleMatches) foundGroup = groupById;
            } catch (error) {}
        }

        // Group IDs do not survive browser sessions, so fall back to a unique title/color match.
        if (!foundGroup && groupInfo.title) {
            try {
                const windowGroups = await chrome.tabGroups.query({ windowId: newTab.windowId });
                const titleMatches = windowGroups.filter(group => group.title === groupInfo.title);
                const exactMatches = titleMatches.filter(group => group.color === groupInfo.color);
                if (exactMatches.length === 1) foundGroup = exactMatches[0];
                else if (titleMatches.length === 1) foundGroup = titleMatches[0];
            } catch (error) {
                console.debug('[SynapseSave] group lookup failed:', error.message);
            }
        }
        
        // 4. ACTION
        if (foundGroup) {
            // Group B exists -> Put M in B
            await chrome.tabs.group({ groupId: foundGroup.id, tabIds: [newTabId] });
            restoredGroupIds.set(restoreKey, foundGroup.id);
        } else {
            // Group B does not exist -> Create new B and put M in it
            const newGroupId = await chrome.tabs.group({ tabIds: [newTabId] });
            const updateData = {};
            if (groupInfo.title) updateData.title = groupInfo.title;
            if (groupInfo.color) updateData.color = groupInfo.color;
            if (groupInfo.collapsed !== undefined) updateData.collapsed = groupInfo.collapsed;
            
            if (Object.keys(updateData).length > 0) {
                await chrome.tabGroups.update(newGroupId, updateData);
            }
            restoredGroupIds.set(restoreKey, newGroupId);
        }
    } catch (error) {
        console.log('Group restore failed:', error);
    }
}

// Process wake-ups sequentially so simultaneous tabs cannot race storage or group creation.
let wakeRestoreQueue = Promise.resolve();

async function handleSnoozeAlarm(alarm) {
    if (alarm.name.startsWith('snooze_')) {
        const parsed = parseSnoozeAlarmName(alarm.name);
        if (!parsed) return;
        const { tabId, wakeTime } = parsed;
        
        // Check if it's part of a bundle (optimized search)
        const bundleResult = await chrome.storage.local.get(['snoozedBundles']);
        const bundles = bundleResult.snoozedBundles || [];
        let bundle = null;
        
        // Find bundle by wakeTime first (faster), then check if tab belongs to it
        for (const b of bundles) {
            if (b.wakeTime === wakeTime && b.tabs && Array.isArray(b.tabs)) {
                if (b.tabs.some(t => t && t.tabId === tabId)) {
                    bundle = b;
                    break;
                }
            }
        }
        
        if (bundle) {
            await restoreBundle(bundle.bundleId);
        } else {
            // Regular tab wake-up
            const result = await chrome.storage.local.get(['snoozedTabs']);
            const snoozedTabs = result.snoozedTabs || [];
            const snoozedTab = snoozedTabs.find(st => st.tabId === tabId && st.wakeTime === wakeTime);
            
            if (snoozedTab) {
                await restoreSingleTab(snoozedTab.snoozeId || snoozedTab.tabId);
            }
        }
    }
}

// Listen for alarms (when tabs should wake up)
chrome.alarms.onAlarm.addListener((alarm) => {
    if (!alarm.name.startsWith('snooze_')) return;

    wakeRestoreQueue = wakeRestoreQueue
        .then(() => handleSnoozeAlarm(alarm))
        .catch(error => {
            console.error('[SynapseSave] wake-up failed:', error);
        });
});

// Clean up old snoozed tabs and bundles periodically
chrome.alarms.create('cleanup', { periodInMinutes: 60 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'cleanup') {
        const result = await chrome.storage.local.get(['snoozedTabs', 'snoozedBundles']);
        const snoozedTabs = result.snoozedTabs || [];
        const bundles = result.snoozedBundles || [];
        const now = Date.now();
        
        // Keep missed wake-ups around for a long grace period so old snoozes are recoverable.
        const updatedTabs = snoozedTabs.filter(st => {
            const daysSinceWake = (now - st.wakeTime) / DAY_MS;
            return daysSinceWake < CLEANUP_GRACE_DAYS;
        });
        
        const updatedBundles = bundles.filter(bundle => {
            const daysSinceWake = (now - bundle.wakeTime) / DAY_MS;
            return daysSinceWake < CLEANUP_GRACE_DAYS;
        });
        
        // Clear alarms for removed bundles
        const removedBundles = bundles.filter(bundle => {
            const daysSinceWake = (now - bundle.wakeTime) / DAY_MS;
            return daysSinceWake >= CLEANUP_GRACE_DAYS;
        });
        
        for (const bundle of removedBundles) {
            for (const tab of bundle.tabs) {
                chrome.alarms.clear(alarmNameForTab(tab.tabId, bundle.wakeTime));
            }
        }
        
        const removedTabs = snoozedTabs.filter(st => {
            const daysSinceWake = (now - st.wakeTime) / DAY_MS;
            return daysSinceWake >= CLEANUP_GRACE_DAYS;
        });
        for (const tab of removedTabs) {
            chrome.alarms.clear(alarmNameForTab(tab.tabId, tab.wakeTime));
        }

        if (updatedTabs.length !== snoozedTabs.length || updatedBundles.length !== bundles.length) {
            await chrome.storage.local.set({ 
                snoozedTabs: updatedTabs,
                snoozedBundles: updatedBundles
            });
        }
    }
});
