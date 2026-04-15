// Firebase Configuration
// This file is loaded before the main app to set up Firebase config
// 
// 📖 SETUP INSTRUCTIONS:
// 1. Go to https://console.firebase.google.com/
// 2. Create a new project (or use existing)
// 3. Enable Authentication → Google sign-in
// 4. Create Firestore Database (start in test mode)
// 5. Get your config from Project Settings → Your apps → Web app
// 6. Replace the values below with your actual Firebase config
// 7. See FIREBASE-SETUP.md for detailed instructions
//
// ⚠️ IMPORTANT: Replace ALL placeholder values below!

(function() {
  'use strict';
  
  // Replace these with your Firebase project credentials
  // Get them from: Firebase Console → Project Settings → Your apps → Web app
  const firebaseConfig = {
    apiKey: "YOUR_API_KEY",                    // ← Replace this
    authDomain: "YOUR_AUTH_DOMAIN",            // ← Replace this
    projectId: "YOUR_PROJECT_ID",              // ← Replace this
    storageBucket: "YOUR_STORAGE_BUCKET",       // ← Replace this
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID", // ← Replace this
    appId: "YOUR_APP_ID"                       // ← Replace this
  };
  
  // Check if config is still using placeholders
  const isConfigured = firebaseConfig.apiKey !== "YOUR_API_KEY" && 
                       firebaseConfig.apiKey.length > 10;
  
  if (!isConfigured) {
    console.warn('⚠️ Firebase not configured! App will run in offline mode.');
    console.warn('📖 See FIREBASE-SETUP.md for setup instructions');
  } else {
    console.log('✅ Firebase config loaded');
  }
  
  window.__firebase_config = JSON.stringify(firebaseConfig);
  window.__app_id = 'pixel-panda-v2';
  window.__initial_auth_token = null;
})();

