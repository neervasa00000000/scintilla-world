// Loader script to work around Chrome extension MIME type issues
// This loads the main module dynamically

(async () => {
  try {
    // Wait for config to be available
    if (typeof window.__firebase_config === 'undefined') {
      await new Promise(resolve => {
        const checkConfig = setInterval(() => {
          if (typeof window.__firebase_config !== 'undefined') {
            clearInterval(checkConfig);
            resolve();
          }
        }, 10);
        // Timeout after 1 second
        setTimeout(() => {
          clearInterval(checkConfig);
          resolve();
        }, 1000);
      });
    }
    
    // Dynamically import the main module
    const module = await import('./main.tsx');
    console.log('Module loaded successfully');
  } catch (error) {
    console.error('Failed to load module:', error);
    // Fallback: try to load as regular script
    const script = document.createElement('script');
    script.src = './assets/popup-CjK7OH6Z.js';
    document.head.appendChild(script);
  }
})();


