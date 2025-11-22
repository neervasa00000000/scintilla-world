# Tab Amnesty - Publishing Guide

## ✅ What You Already Have

Your extension is **already functional**! You have:
- ✅ `manifest.json` - Extension configuration
- ✅ `popup.html` - Main UI
- ✅ `popup.js` - UI logic
- ✅ `background.js` - Service worker
- ✅ `styles.css` - Styling

## 📦 Step 1: Create Extension Icons

You need icons for the Chrome Web Store. Create these sizes:

**Required sizes:**
- `icon16.png` - 16x16 pixels
- `icon48.png` - 48x48 pixels  
- `icon128.png` - 128x128 pixels

**How to create icons:**
1. Use any image editor (Photoshop, Figma, Canva, etc.)
2. Design a simple icon (⏰ clock icon works great!)
3. Export at all 3 sizes
4. Save them in the `big-one` folder

**Quick online tools:**
- https://www.favicon-generator.org/
- https://realfavicongenerator.net/
- https://www.canva.com/

## 📝 Step 2: Update manifest.json

Add icon references to your manifest:

```json
{
  "manifest_version": 3,
  "name": "Tab Amnesty - Snooze Your Tabs",
  "version": "1.0.0",
  "description": "Snooze tabs to specific times. Free your RAM. Save your sanity.",
  "icons": {
    "16": "icon16.png",
    "48": "icon48.png",
    "128": "icon128.png"
  },
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icon16.png",
      "48": "icon48.png",
      "128": "icon128.png"
    }
  },
  // ... rest of your manifest
}
```

## 🧪 Step 3: Test Locally

1. Go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select your `big-one` folder
5. Test all features thoroughly

## 📦 Step 4: Package Extension

**Option A: Zip for Distribution**
```bash
cd /Users/neervasa/Desktop/Website
zip -r tab-amnesty.zip big-one/ -x "*.git*" "*.DS_Store" "*.md"
```

**Option B: Chrome Web Store Package**
1. Go to `chrome://extensions/`
2. Click "Pack extension"
3. Select your `big-one` folder
4. This creates a `.crx` file (for distribution)

## 🚀 Step 5: Publish to Chrome Web Store (Optional)

### Requirements:
- **$5 one-time fee** to register as Chrome developer
- Google account
- Extension must be working perfectly

### Steps:

1. **Register as Developer:**
   - Go to https://chrome.google.com/webstore/devconsole
   - Pay $5 registration fee
   - Accept terms

2. **Prepare Store Assets:**
   - **Screenshots:** Take 1-5 screenshots of your extension
     - Minimum: 1280x800 or 640x400
   - **Promotional Images:** (Optional but recommended)
     - Small tile: 440x280
     - Large tile: 920x680
   - **Description:** Write compelling description (132+ characters)
   - **Category:** Choose "Productivity"

3. **Upload Extension:**
   - Click "New Item"
   - Upload your `.zip` file
   - Fill in all required fields:
     - Name: "Tab Amnesty"
     - Summary: "Snooze tabs to free RAM and save your sanity"
     - Description: (Write detailed description)
     - Category: Productivity
     - Language: English
     - Privacy practices: Select appropriate options

4. **Submit for Review:**
   - Review takes 1-3 days
   - Chrome team will test your extension
   - You'll get email when approved/rejected

## 📋 Store Listing Checklist

- [ ] Extension works perfectly
- [ ] Icons created (16, 48, 128)
- [ ] Screenshots taken
- [ ] Description written
- [ ] Privacy policy (if collecting data)
- [ ] Terms of service (optional)
- [ ] Support email/website
- [ ] Category selected
- [ ] Pricing set (Free)

## 🎯 Quick Launch (Share with Friends)

**Without Chrome Web Store:**

1. Zip your extension:
   ```bash
   zip -r tab-amnesty.zip big-one/
   ```

2. Share the zip file
3. Recipients:
   - Extract zip
   - Go to `chrome://extensions/`
   - Enable Developer mode
   - Click "Load unpacked"
   - Select extracted folder

## 💡 Pro Tips

1. **Version Numbers:** Use semantic versioning (1.0.0, 1.0.1, etc.)
2. **Update Process:** When you update, increment version in manifest.json
3. **Privacy:** If you collect ANY data, you need a privacy policy
4. **Permissions:** Only request permissions you actually use
5. **Testing:** Test on multiple Chrome versions before publishing

## 🔧 Current Status

Your extension is **ready to use locally**! To make it distributable:

1. ✅ Code is complete
2. ⚠️ Need icons (16, 48, 128)
3. ⚠️ Need to update manifest.json with icon paths
4. ✅ Ready to test
5. ⚠️ Need screenshots for Chrome Web Store

## 📞 Need Help?

- Chrome Extension Docs: https://developer.chrome.com/docs/extensions/
- Chrome Web Store Policies: https://developer.chrome.com/docs/webstore/policies/
- Stack Overflow: Tag `google-chrome-extension`

---

**You're almost there!** Just add icons and you can publish! 🚀

