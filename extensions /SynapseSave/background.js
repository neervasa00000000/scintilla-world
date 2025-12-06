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
async function batchSnooze(timeOption) {
    const tabs = await chrome.tabs.query({ currentWindow: true });
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
        batchSnooze(request.timeOption).then(result => {
            sendResponse(result);
        }).catch(error => {
            sendResponse({ success: false, message: error.message });
        });
        return true; // Indicates we will send a response asynchronously
    }
});

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
            // Create notification
            chrome.notifications.create({
                type: 'basic',
                iconUrl: snoozedTab.favIconUrl || 'icon48.png',
                title: 'SynapseSave',
                message: `"${snoozedTab.title}" is ready to reopen!`,
                buttons: [
                    { title: 'Open Now' },
                    { title: 'Snooze Again' }
                ]
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

