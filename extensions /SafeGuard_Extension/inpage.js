// inpage.js
(function () {
  if (typeof window.ethereum === 'undefined') return;

  const originalRequest = window.ethereum.request.bind(window.ethereum);

  window.ethereum.request = async (args) => {
    const { method, params } = args || {};

    // 1. WATCH LIST: Added 'eth_requestAccounts' (Sign Up) back in
    const watchMethods = [
      'eth_requestAccounts',      // <--- DETECTS "SIGN UP" / CONNECT
      'eth_sendTransaction',
      'eth_signTransaction',
      'eth_sign',
      'personal_sign',
      'eth_signTypedData',
      'eth_signTypedData_v3',
      'eth_signTypedData_v4'
    ];

    if (watchMethods.includes(method)) {
      // 2. BLOCKING LOGIC: Return a Promise that waits for the user
      return new Promise((resolve, reject) => {
        const reqId = Math.random().toString(36).slice(2);
        let resolved = false;
        
        // Timeout after 5 minutes (user might have closed popup)
        const timeout = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            window.removeEventListener('message', listener);
            console.warn('[SAFE GUARD] Timeout waiting for user decision, rejecting');
            reject({ code: 4001, message: 'Request timeout - no response from user' });
          }
        }, 300000); // 5 minutes
        
        // Listen for the answer from the popup
        const listener = (event) => {
          if (event.data && event.data.type === 'WEB3_RESPONSE' && event.data.reqId === reqId) {
            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              window.removeEventListener('message', listener);
              
              if (event.data.approved) {
                // User approved -> Let the real wallet open
                originalRequest(args).then(resolve).catch(reject);
              } else {
                // User rejected -> Throw error to block the site
                reject({ code: 4001, message: 'User rejected request via SAFE GUARD' });
              }
            }
          }
        };
        
        window.addEventListener('message', listener);

        // --- CRITICAL CHAIN ID RETRIEVAL FIX ---
        // Get chainId synchronously if possible, or default instantly.
        let chainId = window.ethereum.chainId || '0x1'; 
        
        // This is the core fix: relies on the instant property access and removes the slow async call.

        // Send request to extension to open the popup
        window.postMessage(
          {
            target: 'LOCAL_WEB3_GUARD',
            type: 'WEB3_REQUEST',
            payload: { method, params, chainId, origin: window.location.hostname },
            reqId: reqId
          },
          '*'
        );
      });
    }

    // Non-dangerous methods go through instantly
    return await originalRequest(args);
  };
})();
