# SafeGuard Extension - Quick Installation Guide

## 🚀 Quick Start (5 Minutes)

### Step 1: Extract Files
If you downloaded the ZIP file, extract it to a folder on your computer.

### Step 2: Open Chrome/Brave Extensions
1. Open your browser
2. Navigate to `chrome://extensions/`
3. Or use Menu → More Tools → Extensions

### Step 3: Enable Developer Mode
- Look for the **Developer mode** toggle in the top-right corner
- Turn it **ON** (it should turn blue/green)

### Step 4: Load the Extension
1. Click the **"Load unpacked"** button
2. Navigate to and select the `SafeGuard_Extension` folder
3. Click **"Select Folder"** or **"Open"**

### Step 5: Verify Installation
- You should see SafeGuard appear in your extensions list
- Look for the SafeGuard icon in your browser toolbar
- The extension is now **ACTIVE** and protecting you!

---

## ✅ Testing the Extension

### Test 1: Check if it's Running
1. Open any website with Web3 functionality (like Uniswap or OpenSea)
2. Try to connect your wallet
3. SafeGuard should intercept the request and show you a popup

### Test 2: View Extension Status
1. Click the SafeGuard icon in your browser toolbar
2. If no transaction is pending, you'll see "ACTIVE" status
3. This means SafeGuard is monitoring your transactions

---

## 🔧 Troubleshooting

### Extension Not Loading?
- **Make sure Developer Mode is enabled** (toggle in top-right)
- **Check that you selected the correct folder** (the one containing manifest.json)
- **Try refreshing the extensions page** (F5 or Ctrl+R)

### Popup Not Showing?
- **Disable popup blockers** for your browser
- **Check if the popup opened behind other windows**
- **Refresh the webpage** you're trying to transact on

### Extension Shows Errors?
- **Check the console** (right-click extension → Inspect → Console tab)
- **Make sure all files are present** in the folder
- **Try removing and re-adding** the extension

---

## 📱 Browser Compatibility

### ✅ Fully Supported
- Google Chrome (v88+)
- Brave Browser (v1.20+)
- Microsoft Edge (v88+)
- Any Chromium-based browser

### ❌ Not Supported
- Firefox (uses different extension format)
- Safari (uses different extension format)
- Mobile browsers (not yet supported)

---

## 🔒 Permissions Explained

SafeGuard requests these permissions:

- **`scripting`** - To inject the Web3 interceptor into web pages
- **`tabs`** - To detect which tab initiated a transaction
- **`storage`** - To cache blocklists and transaction data
- **`windows`** - To create the transaction confirmation popup
- **`declarativeNetRequest`** - To block phishing domains
- **`<all_urls>`** - To protect you on any website with Web3

**Why these permissions are needed:**
SafeGuard must intercept Web3 requests before they reach your wallet. This requires access to web pages and the ability to show you transaction details in a popup window.

**Your privacy:**
SafeGuard does NOT:
- Track your browsing
- Send your data anywhere
- Access your private keys
- Collect personal information

---

## 🔄 Updating the Extension

### When a New Version is Released:
1. Download the new version
2. Go to `chrome://extensions/`
3. Click **"Remove"** on the old SafeGuard extension
4. Follow the installation steps above with the new version

### Keeping Blocklists Updated:
- Blocklists update automatically while the extension is running
- No manual action needed!

---

## 🆘 Still Need Help?

### Check the Console Logs
1. Go to `chrome://extensions/`
2. Find SafeGuard
3. Click **"Inspect views: service worker"**
4. Look for error messages in the Console tab

### Common Error Messages

**"Extension context invalidated"**
- Solution: Reload the extension from `chrome://extensions/`

**"Could not establish connection"**
- Solution: Refresh the webpage you're on

**"Receiving end does not exist"**
- Solution: The transaction may have timed out, try again

---

## 💡 Pro Tips

1. **Pin the Extension** - Click the puzzle icon in your toolbar → Pin SafeGuard for easy access
2. **Check Status Regularly** - Click the icon to see if SafeGuard is active
3. **Read Warnings Carefully** - SafeGuard shows detailed information about each transaction
4. **When in Doubt, Block** - It's better to be safe than sorry!

---

## ✨ You're All Set!

SafeGuard is now protecting your Web3 transactions. 

**Remember:** Always verify transactions manually, even with SafeGuard active. No security tool is 100% foolproof.

Stay safe! 🛡️

