# ⏰ Tab Amnesty - Chrome Extension

## Snooze Your Tabs. Free Your RAM. Save Your Sanity.

Tab Amnesty is a Chrome extension that lets you snooze tabs to specific times, helping you manage your browser tabs more effectively.

## Features

- ⏰ **Time-Based Snoozing** - Snooze tabs until tonight, tomorrow, weekend, or next week
- 🔁 **Automatic Wake-Up** - Tabs automatically reopen at the scheduled time
- 📊 **Stats Tracking** - See how many tabs you've snoozed and RAM saved
- 🧹 **Quick Actions** - Clear all tabs until tomorrow or weekend with one click
- 💾 **Persistent Storage** - Snoozed tabs survive browser restarts
- 🔔 **Notifications** - Get notified when snoozed tabs are ready

## Installation

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top-right)
3. Click "Load unpacked"
4. Select the `big-one` folder
5. Done! Click the extension icon to start snoozing tabs

## How to Use

1. **Snooze a Single Tab:**
   - Click the extension icon
   - Click "Snooze" on any tab
   - Choose when to wake it up

2. **Clear All Tabs:**
   - Click "Clear All Until Tomorrow" or "Snooze Until Weekend"
   - All tabs will be snoozed at once

3. **Manage Snoozed Tabs:**
   - View all snoozed tabs in the "Snoozed Tabs" section
   - Click "Open Now" to reopen early
   - Click "Delete" to cancel snooze

## Files Structure

- `manifest.json` - Extension configuration
- `popup.html` - Main UI
- `popup.js` - Popup logic and tab management
- `background.js` - Background service worker for alarms and notifications
- `styles.css` - Styling

## Notes

- This is a test version
- Icons are optional (extension works without them)
- All data is stored locally in Chrome storage
- No external servers or data collection

## Future Enhancements

- Custom date/time picker
- Recurring snoozes (every Monday, etc.)
- Named sessions (save tab groups)
- Tab graveyard (see never-opened snoozed tabs)
- Sync across devices

