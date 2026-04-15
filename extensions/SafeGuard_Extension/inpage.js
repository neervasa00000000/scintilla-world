// inpage.js - Resolves race conditions during wallet initialization
(function () {
  if (typeof window.ethereum === 'undefined') return;
  const originalRequest = window.ethereum.request.bind(window.ethereum);

  window.ethereum.request = async (args) => {
    const { method, params } = args || {};
    
    const watchMethods = [
      'eth_requestAccounts',
      'eth_sendTransaction',
      'eth_signTransaction',
      'eth_sign',
      'personal_sign',
      'eth_signTypedData',
      'eth_signTypedData_v3',
      'eth_signTypedData_v4'
    ];

    if (watchMethods.includes(method)) {
      return new Promise(async (resolve, reject) => {
        const reqId = Math.random().toString(36).slice(2);
        
        // --- ASYNC CHAIN ID CHECK ---
        let chainId = window.ethereum.chainId;
        if (!chainId) {
          try {
            chainId = await originalRequest({ method: 'eth_chainId' });
          } catch (e) {
            chainId = '0x1'; 
          }
        }

        const listener = (event) => {
          if (event.data?.type === 'WEB3_RESPONSE' && event.data.reqId === reqId) {
            window.removeEventListener('message', listener);
            if (event.data.approved) originalRequest(args).then(resolve).catch(reject);
            else reject({ code: 4001, message: 'User rejected request via SAFE GUARD' });
          }
        };
        
        window.addEventListener('message', listener);

        window.postMessage({
          target: 'LOCAL_WEB3_GUARD',
          type: 'WEB3_REQUEST',
          payload: { method, params, chainId, origin: window.location.hostname },
          reqId
        }, '*');
      });
    }
    
    return await originalRequest(args);
  };
})();
