# How to Load the Extension in Chrome

## ⚠️ CRITICAL: Load the `dist` folder, NOT the root folder!

The error you're seeing happens when you load the **root project folder** instead of the **compiled `dist` folder**.

## Step-by-Step Instructions

### 1. Build the Extension
```bash
cd "extensions /game"
npm run build
```

This compiles your TypeScript/TSX files into JavaScript and creates the `dist` folder.

### 2. Load the Extension in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable **"Developer mode"** (toggle in top right)
3. Click **"Load unpacked"**
4. **IMPORTANT**: Navigate to and select the **`dist` folder**:
   ```
   ~/Desktop/scintilla-world/extensions /game/dist
   ```
   **DO NOT** select the root `game` folder!

### 3. Verify It's Loaded Correctly

- The extension should appear in your extensions list
- Click the extension icon to open the popup
- It should work without MIME type errors

## Why This Matters

- **Root folder** (`game/`) contains source files (`.tsx`, `.ts`) that browsers can't execute
- **Dist folder** (`game/dist/`) contains compiled JavaScript (`.js`) that browsers can execute
- Vite transforms your source code during build, so you must load the built version

## If You Still See Errors

1. **Remove the extension completely** from Chrome
2. **Clear Chrome cache**: `Cmd+Shift+Delete` → Clear cached files
3. **Rebuild**: `npm run build`
4. **Re-add**: Load the `dist` folder again

## File Structure

```
extensions /game/
├── src/              ← Source files (TypeScript/TSX)
│   ├── App.tsx
│   ├── main.tsx
│   └── config.js
├── dist/             ← COMPILED FILES (Load this in Chrome!)
│   ├── popup.html    ← References compiled .js files
│   ├── manifest.json
│   ├── assets/
│   │   ├── popup-*.js  ← Compiled JavaScript
│   │   └── config.js
│   └── icon*.png
└── package.json
```

