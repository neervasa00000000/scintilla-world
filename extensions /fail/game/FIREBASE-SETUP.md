# Firebase Setup Guide - Get Online Mode Working

This guide will help you configure Firebase so your PixelPet extension can go online and enable Google sign-in.

## Quick Setup (5 minutes)

### Step 1: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Add project"** or **"Create a project"**
3. Enter a project name (e.g., "PixelPet")
4. Click **Continue**
5. Disable Google Analytics (optional) and click **Create project**
6. Wait for project creation, then click **Continue**

### Step 2: Enable Authentication

1. In your Firebase project, click **Authentication** in the left menu
2. Click **Get started**
3. Click **Sign-in method** tab
4. Enable **Google**:
   - Click on **Google**
   - Toggle **Enable**
   - Enter a project support email
   - Click **Save**
5. Enable **Anonymous** (optional, for guest mode):
   - Click on **Anonymous**
   - Toggle **Enable**
   - Click **Save**

### Step 3: Create Firestore Database

1. Click **Firestore Database** in the left menu
2. Click **Create database**
3. Select **Start in test mode** (for development)
4. Choose a location (closest to you)
5. Click **Enable**

### Step 4: Get Your Firebase Config

1. Click the **gear icon** ⚙️ next to "Project Overview"
2. Click **Project settings**
3. Scroll down to **"Your apps"** section
4. Click the **Web icon** `</>`
5. Register your app:
   - Enter app nickname: "PixelPet Extension"
   - Click **Register app**
6. **Copy the config object** - it looks like this:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

### Step 5: Update Your Extension Config

Open `extensions/game/src/config.js` and replace the placeholder values:

```javascript
window.__firebase_config = JSON.stringify({
  apiKey: "AIzaSy...",  // ← Paste your apiKey here
  authDomain: "your-project.firebaseapp.com",  // ← Paste your authDomain here
  projectId: "your-project-id",  // ← Paste your projectId here
  storageBucket: "your-project.appspot.com",  // ← Paste your storageBucket here
  messagingSenderId: "123456789",  // ← Paste your messagingSenderId here
  appId: "1:123456789:web:abc123"  // ← Paste your appId here
});
```

### Step 6: Set Firestore Rules (Important!)

1. Go to **Firestore Database** → **Rules** tab
2. Replace the rules with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /artifacts/{appId}/public/players/{playerId} {
      // Allow read if player exists
      allow read: if true;
      // Allow write if user is authenticated and writing their own data
      allow write: if request.auth != null && request.auth.uid == playerId;
    }
  }
}
```

3. Click **Publish**

### Step 7: Rebuild and Reload Extension

1. If you're using a build process, rebuild:
   ```bash
   npm run build
   ```

2. Reload the extension:
   - Go to `chrome://extensions/`
   - Find "PixelPet - Virtual Pet Game"
   - Click the **reload icon** 🔄

3. Open the extension popup - it should now show **online mode**!

## Troubleshooting

### Still showing "Offline Mode"?

1. **Check browser console** (F12 → Console tab) for errors
2. **Verify config.js** - Make sure all values are replaced (no "YOUR_API_KEY" left)
3. **Check file path** - Make sure `popup.html` loads `config.js` correctly
4. **Clear cache** - Try hard refresh (Ctrl+Shift+R or Cmd+Shift+R)

### Google Sign-in not working?

1. **Check Authentication** - Make sure Google is enabled in Firebase Console
2. **Check OAuth consent screen** - May need to configure in Google Cloud Console
3. **Check browser console** - Look for authentication errors

### Firestore errors?

1. **Check database exists** - Make sure Firestore is created
2. **Check rules** - Make sure rules allow read/write
3. **Check collection path** - Should be `artifacts/pixel-panda-v2/public/players`

## Security Notes

- The config values are safe to include in your extension (they're public)
- Firestore rules protect your data
- Consider using production rules for better security later

## Need Help?

- Check Firebase Console for error messages
- Check browser console (F12) for JavaScript errors
- Verify all config values are correct (no typos)

Once configured, your extension will:
- ✅ Show "Online Mode" instead of "Offline Mode"
- ✅ Allow Google sign-in
- ✅ Enable multiplayer features
- ✅ Sync panda data in real-time


