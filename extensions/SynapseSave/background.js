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

// Snooze bundle function - handles snoozing a group of tabs as a named bundle
async function snoozeBundle(request) {
    try {
        const { bundleName, tabs, groupInfo, timeOption, wakeTime } = request;
        
        if (!tabs || tabs.length === 0) {
            return { success: false, message: 'No tabs to snooze' };
        }
        
        // Validate that tabs still exist before proceeding
        const validTabs = [];
        for (const tab of tabs) {
            try {
                await chrome.tabs.get(tab.id);
                validTabs.push(tab);
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
            groupInfo: groupInfo
        }));
        
        // Create bundle object
        const bundle = {
            bundleId: bundleId,
            name: bundleName,
            tabs: tabData,
            groupInfo: groupInfo,
            wakeTime: wakeTime,
            snoozedAt: Date.now(),
            timeOption: timeOption
        };
        
        bundles.push(bundle);
        
        // Create alarms for each tab in the bundle
        const alarmPromises = tabData.map(tab => 
            chrome.alarms.create(`snooze_${tab.tabId}_${wakeTime}`, { when: wakeTime }).catch(err => {
                console.log(`Error creating alarm for tab ${tab.tabId}:`, err);
            })
        );
        
        // Close all tabs in the bundle (handle errors gracefully)
        const tabIds = validTabs.map(t => t.id);
        const closePromise = chrome.tabs.remove(tabIds).catch(err => {
            console.log('Error closing tabs:', err);
            // Continue even if some tabs fail to close
        });
        
        // Wait for all operations
        await Promise.all([...alarmPromises, closePromise]);
        
        // Save bundle
        await chrome.storage.local.set({ snoozedBundles: bundles });
        
        return { success: true, bundleId: bundleId, count: validTabs.length };
    } catch (error) {
        console.error('Error in snoozeBundle:', error);
        return { success: false, message: error.message || 'Unknown error occurred' };
    }
}

// Restore bundle function - reopens all tabs in a bundle and restores group
async function restoreBundle(bundleId) {
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
        
        // Create all tabs
        const tabPromises = bundle.tabs.map(async (tabData) => {
            try {
                const newTab = await chrome.tabs.create({
                    url: tabData.url,
                    active: false
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
            } catch (e) {
                console.log('Error activating tab:', e);
            }
        }
        
        // Remove bundle from storage after successful restore
        // This ensures the bundle is removed even if the popup callback fails
        try {
            const updatedBundles = bundles.filter(b => b.bundleId !== bundleId);
            await chrome.storage.local.set({ snoozedBundles: updatedBundles });
            
            // Clear alarms for the bundle
            bundle.tabs.forEach(tab => {
                chrome.alarms.clear(`snooze_${tab.tabId}_${bundle.wakeTime}`);
            });
        } catch (e) {
            console.error('Error removing bundle from storage:', e);
            // Continue even if removal fails - popup will handle it
        }
        
        return { success: true, count: createdTabs.length };
    } catch (error) {
        console.error('Error in restoreBundle:', error);
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
                tabId: tab.id,
                url: tab.url,
                title: tab.title,
                favIconUrl: tab.favIconUrl,
                wakeTime: wakeTime,
                snoozedAt: Date.now(),
                timeOption: timeOption,
                groupId: groupInfo ? groupInfo.id : null,
                groupInfo: groupInfo
            };
        });

        const tabDataArray = await Promise.all(tabDataPromises);
        
        // Add all tabs to snoozedTabs array at once
        snoozedTabs.push(...tabDataArray);
        
        // Save storage once before creating alarms
        await chrome.storage.local.set({ snoozedTabs });

        // Create alarms and close tabs in parallel
        const operationPromises = filteredTabs.map(async (tab) => {
            const promises = [];
            
            // Create alarm
            promises.push(
                chrome.alarms.create(`snooze_${tab.id}_${wakeTime}`, { when: wakeTime }).catch(err => {
                    console.error(`Error creating alarm for tab ${tab.id}:`, err);
                })
            );
            
            // Close tab
            promises.push(
                chrome.tabs.remove(tab.id).catch(err => {
                    console.error(`Error removing tab ${tab.id}:`, err);
                })
            );
            
            return Promise.all(promises);
        });

        // Wait for all operations
        await Promise.all(operationPromises);

        return { success: true, count: filteredTabs.length };
    } catch (error) {
        console.error('Error in batchSnooze:', error);
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
            // This is a bundle wake-up - only notify once per bundle
            // Check if we've already notified for this bundle
            const notificationKey = `bundle_notified_${bundle.bundleId}`;
            const notified = await chrome.storage.local.get([notificationKey]);
            
            if (!notified[notificationKey]) {
                // Mark as notified
                await chrome.storage.local.set({ [notificationKey]: true });
                
                // Create bundle notification
                chrome.notifications.create({
                    type: 'basic',
                    iconUrl: 'lazy-sleep1.png',
                    title: 'SynapseSave',
                    message: `Bundle "${bundle.name}" (${bundle.tabs.length} tabs) is ready to reopen!`,
                    buttons: [
                        { title: 'Open Bundle' },
                        { title: 'Snooze Again' }
                    ],
                    priority: 2
                }, (notificationId) => {
                    // Store notification data
                    chrome.storage.local.set({
                        [`notification_${notificationId}`]: {
                            bundleId: bundle.bundleId,
                            type: 'bundle',
                            wakeTime: wakeTime
                        }
                    });
                });
            }
        } else {
            // Regular tab wake-up
            const result = await chrome.storage.local.get(['snoozedTabs']);
            const snoozedTabs = result.snoozedTabs || [];
            const snoozedTab = snoozedTabs.find(st => st.tabId === tabId && st.wakeTime === wakeTime);
            
            if (snoozedTab) {
                // Use local asset for notifications (remote URLs often fail in SW)
                const iconUrl = 'lazy-sleep1.png';
                
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
                            wakeTime: wakeTime,
                            type: 'tab'
                        }
                    });
                });
            }
        }
    }
});

// Handle notification button clicks
chrome.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
    try {
        const key = `notification_${notificationId}`;
        const result = await chrome.storage.local.get([key]);
        const notificationData = result[key];
        
        if (!notificationData) return;
        
        if (notificationData.type === 'bundle') {
            // Handle bundle notification
            if (buttonIndex === 0) {
                // Open Bundle
                await restoreBundle(notificationData.bundleId);
                
                // Remove bundle from storage
                const bundleResult = await chrome.storage.local.get(['snoozedBundles']);
                const bundles = bundleResult.snoozedBundles || [];
                const bundle = bundles.find(b => b.bundleId === notificationData.bundleId);
                
                if (bundle) {
                    // Clear all alarms for bundle tabs
                    bundle.tabs.forEach(tab => {
                        chrome.alarms.clear(`snooze_${tab.tabId}_${notificationData.wakeTime}`);
                    });
                    
                    const updated = bundles.filter(b => b.bundleId !== notificationData.bundleId);
                    await chrome.storage.local.set({ snoozedBundles: updated });
                    
                    // Clear notification flag
                    await chrome.storage.local.remove([`bundle_notified_${notificationData.bundleId}`]);
                }
            } else if (buttonIndex === 1) {
                // Snooze Again (1 hour)
                const newWakeTime = Date.now() + (60 * 60 * 1000);
                const bundleResult = await chrome.storage.local.get(['snoozedBundles']);
                const bundles = bundleResult.snoozedBundles || [];
                const bundle = bundles.find(b => b.bundleId === notificationData.bundleId);
                
                if (bundle) {
                    bundle.wakeTime = newWakeTime;
                    
                    // Update alarms for all tabs
                    for (const tab of bundle.tabs) {
                        try {
                            chrome.alarms.clear(`snooze_${tab.tabId}_${notificationData.wakeTime}`);
                            chrome.alarms.create(`snooze_${tab.tabId}_${newWakeTime}`, {
                                when: newWakeTime
                            });
                        } catch (alarmError) {
                            console.error(`Error updating alarm for tab ${tab.tabId}:`, alarmError);
                        }
                    }
                    
                    await chrome.storage.local.set({ snoozedBundles: bundles });
                    await chrome.storage.local.remove([`bundle_notified_${notificationData.bundleId}`]);
                }
            }
        } else {
            // Handle regular tab notification
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
        }
        
        // Clean up
        chrome.storage.local.remove([key]);
        chrome.notifications.clear(notificationId);
    } catch (e) {
        console.log("Error handling notification button click:", e);
    }
});

// Clean up old snoozed tabs and bundles periodically
chrome.alarms.create('cleanup', { periodInMinutes: 60 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'cleanup') {
        const result = await chrome.storage.local.get(['snoozedTabs', 'snoozedBundles']);
        const snoozedTabs = result.snoozedTabs || [];
        const bundles = result.snoozedBundles || [];
        const now = Date.now();
        
        // Remove tabs that should have woken up more than 50 days ago
        const updatedTabs = snoozedTabs.filter(st => {
            const daysSinceWake = (now - st.wakeTime) / (1000 * 60 * 60 * 24);
            return daysSinceWake < 50;
        });
        
        // Remove bundles that should have woken up more than 50 days ago
        const updatedBundles = bundles.filter(bundle => {
            const daysSinceWake = (now - bundle.wakeTime) / (1000 * 60 * 60 * 24);
            return daysSinceWake < 50;
        });
        
        // Clear alarms for removed bundles
        const removedBundles = bundles.filter(bundle => {
            const daysSinceWake = (now - bundle.wakeTime) / (1000 * 60 * 60 * 24);
            return daysSinceWake >= 50;
        });
        
        for (const bundle of removedBundles) {
            for (const tab of bundle.tabs) {
                chrome.alarms.clear(`snooze_${tab.tabId}_${bundle.wakeTime}`);
            }
        }
        
        if (updatedTabs.length !== snoozedTabs.length || updatedBundles.length !== bundles.length) {
            await chrome.storage.local.set({ 
                snoozedTabs: updatedTabs,
                snoozedBundles: updatedBundles
            });
        }
    }
});

