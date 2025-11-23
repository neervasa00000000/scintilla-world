// SynapseSave - Background Service Worker

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
                    if (snoozedTab && snoozedTab.groupId !== null && snoozedTab.groupId !== undefined) {
                        try {
                            const group = await chrome.tabGroups.get(snoozedTab.groupId).catch(() => null);
                            if (group) {
                                await chrome.tabs.group({
                                    groupId: snoozedTab.groupId,
                                    tabIds: [newTab.id]
                                });
                            }
                        } catch (e) {
                            console.log("Could not restore tab to group:", e);
                        }
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

