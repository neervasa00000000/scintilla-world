// SynapseSave - Background Service Worker

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
    const now = new Date();
    let wakeTime = new Date();
    
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

// Batch snooze function - handles snoozing multiple tabs
async function batchSnooze(timeOption, windowId) {
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

    // Prepare all data promises
    const snoozePromises = filteredTabs.map(async (tab) => {
        // Get tab group properties if tab belongs to a group
        let groupInfo = null;
        if (tab.groupId && tab.groupId !== chrome.tabs.TAB_GROUP_ID_NONE) {
            groupInfo = await getGroupProperties(tab.groupId);
        }
        
        snoozedTabs.push({
            tabId: tab.id,
            url: tab.url,
            title: tab.title,
            favIconUrl: tab.favIconUrl,
            wakeTime: wakeTime,
            snoozedAt: Date.now(),
            timeOption: timeOption,
            groupId: groupInfo ? groupInfo.id : null,
            groupInfo: groupInfo // Store full group properties for restoration
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

    return { success: true, count: filteredTabs.length };
}

// Message listener for batch snooze
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
});

// --- LOGIC FIX: Always find group by NAME first ---
async function restoreGroup(tabData, newTabId) {
    if (!tabData.groupInfo && !tabData.groupId) return;
    try {
        await new Promise(resolve => setTimeout(resolve, 300)); // Wait for tab init
        
        // 1. Identify which window the new tab is in
        let newTab;
        try { newTab = await chrome.tabs.get(newTabId); } catch (e) { return; }
        
        let groupInfo = tabData.groupInfo || { title: '', color: 'grey' };
        let foundGroup = null;
        
        // 2. SEARCH BY NAME ("Group B") in the CURRENT WINDOW
        // This solves the issue: even if days pass and ID changes, the Name usually stays.
        if (groupInfo.title) {
            try {
                const windowGroups = await chrome.tabGroups.query({ windowId: newTab.windowId });
                foundGroup = windowGroups.find(g => g.title === groupInfo.title);
            } catch (e) { console.log('Error searching groups', e); }
        }
        
        // 3. Fallback: Search by Old ID (only if Name search failed)
        if (!foundGroup && tabData.groupId) {
            try {
                const groupById = await chrome.tabGroups.get(tabData.groupId);
                if (groupById && groupById.windowId === newTab.windowId) {
                    foundGroup = groupById;
                }
            } catch (e) {}
        }
        
        // 4. ACTION
        if (foundGroup) {
            // Group B exists -> Put M in B
            await chrome.tabs.group({ groupId: foundGroup.id, tabIds: [newTabId] });
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
        }
    } catch (error) {
        console.log('Group restore failed:', error);
    }
}

// Listen for alarms (when tabs should wake up)
chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name.startsWith('snooze_')) {
        const parts = alarm.name.split('_');
        const tabId = parseInt(parts[1]);
        const wakeTime = parseInt(parts[2]);
        
        // Get snoozed tab info
        const result = await chrome.storage.local.get(['snoozedTabs']);
        const snoozedTabs = result.snoozedTabs || [];
        const snoozedTab = snoozedTabs.find(st => st.tabId === tabId && st.wakeTime === wakeTime);
        
        if (snoozedTab) {
            // FIX: Use lazy-sleep1.png as fallback instead of missing icon48.png
            const iconUrl = snoozedTab.favIconUrl && snoozedTab.favIconUrl.startsWith('http') 
                ? 'lazy-sleep1.png' // Remote URLs often fail in SW notifications, use local asset
                : 'lazy-sleep1.png';
            
            // Create notification
            chrome.notifications.create({
                type: 'basic',
                iconUrl: iconUrl,
                title: 'SynapseSave',
                message: `"${snoozedTab.title}" is ready to reopen!`,
                buttons: [
                    { title: 'Open Now' },
                    { title: 'Snooze Again' }
                ],
                priority: 2
            }, (notificationId) => {
                // Store notification data
                chrome.storage.local.set({
                    [`notification_${notificationId}`]: {
                        tabId: snoozedTab.tabId,
                        url: snoozedTab.url,
                        title: snoozedTab.title,
                        wakeTime: wakeTime
                    }
                });
            });
            
            // Optionally auto-open tab
            // await chrome.tabs.create({ url: snoozedTab.url, active: false });
        }
    }
});

// Handle notification button clicks
chrome.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
    try {
        const key = `notification_${notificationId}`;
        const result = await chrome.storage.local.get([key]);
        const notificationData = result[key];
        
        if (notificationData) {
            if (buttonIndex === 0) {
                // Open Now
                try {
                    // Get the full snoozed tab data to restore group
                    const snoozedResult = await chrome.storage.local.get(['snoozedTabs']);
                    const snoozedTabs = snoozedResult.snoozedTabs || [];
                    const snoozedTab = snoozedTabs.find(st => 
                        st.tabId === notificationData.tabId && st.wakeTime === notificationData.wakeTime
                    );
                    
                    const newTab = await chrome.tabs.create({
                        url: notificationData.url,
                        active: true
                    });
                    
                    // Restore to original group if it had one
                    if (snoozedTab && (snoozedTab.groupId || snoozedTab.groupInfo)) {
                        await restoreGroup(snoozedTab, newTab.id);
                    }
                    
                    // Remove from snoozed
                    const updated = snoozedTabs.filter(st => 
                        !(st.tabId === notificationData.tabId && st.wakeTime === notificationData.wakeTime)
                    );
                    await chrome.storage.local.set({ snoozedTabs: updated });
                } catch (e) {
                    console.log("Error opening tab:", e);
                }
                
                // Clear alarm
                chrome.alarms.clear(`snooze_${notificationData.tabId}_${notificationData.wakeTime}`);
            } else if (buttonIndex === 1) {
                // Snooze Again (1 hour)
                const newWakeTime = Date.now() + (60 * 60 * 1000);
                const snoozedResult = await chrome.storage.local.get(['snoozedTabs']);
                const snoozedTabs = snoozedResult.snoozedTabs || [];
                const snoozedTab = snoozedTabs.find(st => 
                    st.tabId === notificationData.tabId && st.wakeTime === notificationData.wakeTime
                );
                
                if (snoozedTab) {
                    snoozedTab.wakeTime = newWakeTime;
                    await chrome.storage.local.set({ snoozedTabs });
                    
                    // Update alarm
                    chrome.alarms.clear(`snooze_${notificationData.tabId}_${notificationData.wakeTime}`);
                    chrome.alarms.create(`snooze_${notificationData.tabId}_${newWakeTime}`, {
                        when: newWakeTime
                    });
                }
            }
            
            // Clean up
            chrome.storage.local.remove([key]);
            chrome.notifications.clear(notificationId);
        }
    } catch (e) {
        console.log("Error handling notification button click:", e);
    }
});

// Clean up old snoozed tabs periodically
chrome.alarms.create('cleanup', { periodInMinutes: 60 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'cleanup') {
        const result = await chrome.storage.local.get(['snoozedTabs']);
        const snoozedTabs = result.snoozedTabs || [];
        const now = Date.now();
        
        // Remove tabs that should have woken up more than 7 days ago
        const updated = snoozedTabs.filter(st => {
            const daysSinceWake = (now - st.wakeTime) / (1000 * 60 * 60 * 24);
            return daysSinceWake < 7;
        });
        
        if (updated.length !== snoozedTabs.length) {
            await chrome.storage.local.set({ snoozedTabs: updated });
        }
    }
});

