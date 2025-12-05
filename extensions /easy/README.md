# ExtractFlow - Data Extraction Extension

A beautiful browser extension for extracting emails, phone numbers, and names from text using Soft UI (Neumorphic) design.

## Features

- ✨ Beautiful Soft UI/Neumorphic design
- 📧 Automatic email extraction
- 📞 Phone number detection (Australian format)
- 👤 Name extraction with context menu
- 💾 Data persistence (saves records)
- 📊 CSV export functionality
- 🎨 Smooth animations and interactions

## Installation

1. Open Chrome/Edge and navigate to `chrome://extensions/` (or `edge://extensions/`)
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `easy` folder
5. The extension icon will appear in your toolbar

## Usage

1. Click the ExtractFlow icon in your browser toolbar
2. Paste text containing emails, phone numbers, or names
3. The extension automatically detects and extracts:
   - Email addresses
   - Phone numbers
   - Names (select text and use context menu)
4. Fill in First/Last name fields
5. Click "Add to List" to save the record
6. Export all records as CSV

## Icons

To add icons, create three PNG files:
- `icon16.png` (16x16 pixels)
- `icon48.png` (48x48 pixels)
- `icon128.png` (128x128 pixels)

Or use the favicon from `/assets/logo/favicon.png` and resize it.

## Permissions

- `storage`: Saves your extracted records locally

## Notes

- Records are saved automatically
- Data persists between browser sessions
- Works offline
- No data is sent to external servers

