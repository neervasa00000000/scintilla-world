// contentScript.js
(function inject() {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('inpage.js');
  script.onload = function () { this.remove(); };
  (document.head || document.documentElement).appendChild(script);

  // 1. From Page -> Extension (Request)
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (event.data?.target === 'LOCAL_WEB3_GUARD' && event.data?.type === 'WEB3_REQUEST') {
      // Send message with error handling (chrome.runtime.sendMessage uses callback, not Promise)
      chrome.runtime.sendMessage(event.data, (response) => {
        // Check for errors
        if (chrome.runtime.lastError) {
          const error = chrome.runtime.lastError;
          // Only log non-expected errors
          if (error.message && error.message.includes('Extension context invalidated')) {
            console.warn('[SAFE GUARD] Extension context invalidated. Please reload the extension.');
          } else if (error.message && !error.message.includes('Could not establish connection')) {
            // Only log unexpected errors (not connection issues which are common)
            console.debug('[SAFE GUARD] Message send failed:', error.message);
          }
          // Silently fail - extension might be reloading
        }
      });
    }
  });

  // 2. From Extension -> Page (Answer)
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'WEB3_RESPONSE') {
      window.postMessage(msg, '*');
    }
  });
})();
