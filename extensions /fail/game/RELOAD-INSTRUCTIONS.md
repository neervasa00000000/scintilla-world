# How to Fix the MIME Type Error

The error you're seeing is caused by Chrome caching an old version of the extension. Follow these steps **exactly**:

## Step 1: Remove the Extension Completely

1. Open Chrome and go to `chrome://extensions/`
2. Find "PixelPet - Virtual Pet Game"
3. Click the **"Remove"** button (NOT just reload)
4. Confirm removal

## Step 2: Clear Chrome Cache (Important!)

1. Press `Cmd+Shift+Delete` (Mac) or `Ctrl+Shift+Delete` (Windows/Linux)
2. Select "Cached images and files"
3. Time range: "All time"
4. Click "Clear data"

## Step 3: Close All Chrome Windows

Close ALL Chrome windows completely and reopen Chrome.

## Step 4: Re-add the Extension

1. Go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Navigate to: `~/Desktop/scintilla-world/extensions /game/dist`
5. Select the `dist` folder

## Step 5: Test

1. Click the PixelPet extension icon
2. The popup should open without errors

## If It Still Doesn't Work

The build is correct (IIFE format, no modules). If you still see the error after following all steps above, try:

1. **Hard refresh the extension page**: In `chrome://extensions/`, click the reload button while holding `Shift`
2. **Check the Network tab**: Right-click the popup → Inspect → Network tab → Look for the `popup-*.js` file and check its Content-Type header
3. **Try a different Chrome profile**: Create a new Chrome profile and test there

The current build is correct - this is purely a Chrome caching issue.

