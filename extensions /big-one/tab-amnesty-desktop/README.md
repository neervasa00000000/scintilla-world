# Tab Amnesty Desktop

Desktop version of Tab Amnesty - Snooze your tabs, free your RAM, save your sanity!

## 🚀 Quick Start

### Prerequisites
- Node.js (v16 or higher recommended)
- npm (comes with Node.js)

### Installation & Run

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Run the app:**
   ```bash
   npm start
   ```

3. **The desktop app will launch!**

## 📦 Building for Distribution

### Build for your platform:
```bash
npm run build
```

This will create distributable packages in the `dist/` folder.

## 🎨 Features

- ✅ Same beautiful UI as Chrome extension
- ✅ Same color theme (dark, seamless, no shadows)
- ✅ Snooze tabs to specific times
- ✅ Batch snooze (Clear All, Weekend)
- ✅ Desktop notifications when tabs wake up
- ✅ Persistent storage (localStorage)
- ✅ Stats tracking

## 📁 Project Structure

```
tab-amnesty-desktop/
├── main.js          # Electron main process
├── preload.js       # Preload script (security bridge)
├── index.html       # Main UI
├── styles.css       # Styling (same as extension)
├── app.js           # Application logic
├── package.json     # Dependencies & scripts
├── lazy-sleep.png   # App icon
└── README.md        # This file
```

## 🔧 How It Works

- **Storage:** Uses browser localStorage (persists between sessions)
- **Notifications:** Uses Web Notifications API
- **Tabs:** Simulated tab management (can be extended to integrate with actual browser tabs)

## 🎯 Adding Real Browser Integration

To integrate with actual browser tabs, you can:

1. Use Electron's `webContents` API to manage browser windows
2. Integrate with browser extensions via messaging
3. Use native browser APIs if available

## 📝 Notes

- This is a standalone desktop app
- Data is stored locally (no cloud sync)
- Works offline
- Same UI/UX as Chrome extension

## 🚀 Publishing

To create distributable apps:

1. Install electron-builder:
   ```bash
   npm install --save-dev electron-builder
   ```

2. Build:
   ```bash
   npm run build
   ```

3. Distribute the files in `dist/` folder

---

**Enjoy your tab-free desktop experience!** 🎉

