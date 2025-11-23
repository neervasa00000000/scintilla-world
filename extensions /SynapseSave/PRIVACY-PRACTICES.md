# Privacy Practices - Chrome Web Store

## Single Purpose Description

**SynapseSave is a tab management extension that allows users to snooze browser tabs for later, automatically closing them to free up memory. When the scheduled time arrives, snoozed tabs are automatically reopened, optionally restored to their original browser tab groups.**

---

## Permission Justifications

### 1. **alarms** Permission

**Justification:**
SynapseSave uses the alarms API to schedule when snoozed tabs should wake up and reopen. When a user snoozes a tab, the extension creates an alarm set to trigger at the specified time (e.g., 24 hours later or 7 days later). This is essential for the core functionality of automatically reopening tabs at the scheduled time. Without this permission, users would have to manually reopen tabs, defeating the purpose of the snoozing feature.

---

### 2. **favicon** Permission

**Justification:**
SynapseSave displays favicons (website icons) next to tab titles in the extension popup to help users visually identify and distinguish between different tabs. This improves user experience by making it easier to recognize tabs at a glance. The favicon permission allows the extension to access favicons through Chrome's favicon API, ensuring proper display of website icons in the tab list interface.

---

### 3. **notifications** Permission

**Justification:**
SynapseSave sends browser notifications when snoozed tabs are ready to reopen. This alerts users that their previously snoozed tabs are now available, allowing them to choose whether to open them immediately or snooze them again. Notifications are essential for the user experience, as users may not remember which tabs they snoozed or when they scheduled them to wake up. All notifications are generated locally and do not involve external servers.

---

### 4. **remote code use** Permission

**Justification:**
SynapseSave does not use remote code execution. All code runs locally within the browser extension. If Chrome Web Store is flagging this, it may be a false positive. The extension only uses standard Chrome extension APIs (tabs, storage, alarms, notifications) and does not execute any code from external sources or remote servers.

---

### 5. **storage** Permission

**Justification:**
SynapseSave uses Chrome's local storage API to save information about snoozed tabs, including tab URLs, titles, wake times, and group associations. This data is stored locally on the user's device and is necessary to remember which tabs were snoozed and when they should be reopened. The extension does not transmit this data to any external servers - all storage operations are local to the user's browser.

---

### 6. **tabGroups** Permission

**Justification:**
SynapseSave uses the tabGroups API to preserve and restore browser tab groups. When a user snoozes a tab that belongs to a tab group, the extension stores the group ID. When the tab is reopened, it is automatically restored to its original group, maintaining the user's organized workspace. This permission is essential for the tab group restoration feature, which helps users maintain their tab organization.

---

### 7. **tabs** Permission

**Justification:**
SynapseSave requires the tabs permission to access information about open browser tabs (titles, URLs, IDs), close tabs when they are snoozed, and create new tabs when snoozed tabs are reopened. This is the core functionality of the extension - managing browser tabs by snoozing and reopening them. The extension only accesses tabs that the user explicitly chooses to snooze and does not access tabs without user interaction.

---

## Data Usage Certification

**I certify that SynapseSave's data usage complies with Chrome Web Store Developer Programme Policies:**

✅ **No Data Collection**: SynapseSave does not collect, transmit, or store any user data on external servers.

✅ **Local Storage Only**: All data (snoozed tab information) is stored locally on the user's device using Chrome's local storage API.

✅ **No User Tracking**: The extension does not track user behavior, browsing history, or any personal information.

✅ **No Third-Party Services**: SynapseSave does not communicate with any external servers or third-party services.

✅ **User Control**: Users have full control over their snoozed tabs and can delete them at any time through the extension interface.

✅ **Privacy-First Design**: All functionality operates entirely within the user's browser without external data transmission.

---

## Summary

SynapseSave is a privacy-focused extension that operates entirely locally. All permissions are used solely for the core functionality of snoozing and managing browser tabs. No user data is collected, transmitted, or stored externally. The extension respects user privacy and provides full control over tab management features.


