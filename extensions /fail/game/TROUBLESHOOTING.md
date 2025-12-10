# Troubleshooting PixelPet Extension

## Blank Screen Issues

If you see a blank white screen, try these steps:

### 1. Check Browser Console
- Right-click on the extension popup → "Inspect"
- Open the Console tab
- Look for any red error messages
- Common errors to check for:
  - `Failed to load module script`
  - `Cannot read property of undefined`
  - `Firebase config not found`

### 2. Verify Files Are Loaded
In the Console, check:
```javascript
// Should return a string (even if it's the placeholder config)
window.__firebase_config

// Should return 'pixel-panda-v2'
window.__app_id

// Should return the root element
document.getElementById('root')
```

### 3. Reload Extension
1. Go to `chrome://extensions/`
2. Find "PixelPet - Virtual Pet Game"
3. Click the reload icon (circular arrow)
4. Try opening the popup again

### 4. Check Network Tab
- In DevTools, go to Network tab
- Reload the popup
- Verify these files load successfully:
  - `popup.html`
  - `assets/config.js`
  - `assets/popup-*.js` (the main bundle)
  - `assets/popup-*.css` (the styles)

### 5. Common Issues

**Issue: "Failed to load module script"**
- Make sure you're loading from the `dist` folder
- Check that all files in `dist/assets/` are present

**Issue: "Firebase config not found"**
- This is OK! The app will run in offline mode
- To enable Firebase, edit `src/config.js` and rebuild

**Issue: Blank screen with no errors**
- Check if React is mounting:
  ```javascript
  // In console, check if root has children
  document.getElementById('root').children.length
  ```
- If 0, React isn't mounting - check for silent errors

### 6. Rebuild from Scratch
If nothing works:
```bash
cd "extensions /game"
rm -rf dist node_modules
npm install
npm run build
```
Then reload the extension.

## Still Having Issues?

Check that:
- ✅ You're loading the `dist` folder (not the root `game` folder)
- ✅ All icon files (icon16.png, icon48.png, icon128.png) are in `dist/`
- ✅ The manifest.json is in `dist/`
- ✅ The `dist/assets/` folder contains the built files


