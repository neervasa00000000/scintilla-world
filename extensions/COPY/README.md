# COPY Extension

Data Extractor & Automation Chrome Extension

## Folder Structure

```
COPY/
├── assets/          # Images and icons
│   └── cow.png      # Extension icon
├── css/             # Stylesheets
│   └── popup.css    # Main popup styles
├── js/              # JavaScript files
│   ├── common.js         # Shared state and utilities
│   ├── popup-main.js     # Main coordinator
│   ├── extract.js        # Extract tool logic
│   ├── automation.js     # Automation tool logic
│   ├── adblocker.js      # Ad Blocker tool logic
│   ├── calendar.js       # Calendar tool logic
│   ├── notes.js          # Notes/Todo tool logic
│   ├── background.js      # Background service worker
│   ├── content.js        # Content script
│   └── youtube-adblock.js # YouTube ad blocking
├── fontawesome/     # Font Awesome icons
├── popup.html       # Main popup UI
├── manifest.json    # Extension manifest
└── rules.json       # Ad blocking rules
```

## Tools

1. **Extract** - Extract emails, phones, and names from text or web pages
2. **Automation** - Automated email campaigns
3. **Ad Blocker** - Block ads and trackers
4. **Calendar** - Create calendar events from natural language
5. **Notes** - Notes and todos with deadlines

## File Organization

- All JavaScript files are in `js/` folder
- All CSS files are in `css/` folder
- All assets (images) are in `assets/` folder
- Main HTML and config files remain in root

