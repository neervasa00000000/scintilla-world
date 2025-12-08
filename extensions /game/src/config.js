// Firebase Configuration
// This file is loaded before the main app to set up Firebase config
// Update these values with your Firebase project credentials

(function() {
  'use strict';
  window.__firebase_config = JSON.stringify({
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
  });
  
  window.__app_id = 'pixel-panda-v2';
  window.__initial_auth_token = null;
  
  console.log('Firebase config loaded');
})();

