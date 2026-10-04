// inpage.js — intercept wallet RPC; supports late provider injection + guard timeout
(function () {
  const GUARD_TIMEOUT_MS = 5 * 60 * 1000;
  const WATCH_METHODS = new Set([
    'eth_requestAccounts',
    'eth_sendTransaction',
    'eth_signTransaction',
    'eth_sign',
    'personal_sign',
    'eth_signTypedData',
    'eth_signTypedData_v3',
    'eth_signTypedData_v4',
  ]);

  function installEthereumHook(provider) {
    if (!provider || typeof provider.request !== 'function') return false;
    if (provider.__safeGuardHooked) return true;

    const originalRequest = provider.request.bind(provider);

    provider.request = async function safeGuardRequest(args) {
      const { method, params } = args || {};

      if (!WATCH_METHODS.has(method)) {
        return originalRequest(args);
      }

      return new Promise((resolve, reject) => {
        const reqId = Math.random().toString(36).slice(2);

        const finish = (approved) => {
          clearTimeout(timeoutId);
          window.removeEventListener('message', listener);
          if (approved) {
            originalRequest(args).then(resolve).catch(reject);
          } else {
            reject({ code: 4001, message: 'User rejected request via SAFE GUARD' });
          }
        };

        const listener = (event) => {
          if (event.source !== window) return;
          if (event.data?.type === 'WEB3_RESPONSE' && event.data.reqId === reqId) {
            finish(Boolean(event.data.approved));
          }
        };

        const timeoutId = setTimeout(() => {
          window.removeEventListener('message', listener);
          reject({ code: 4001, message: 'SafeGuard review timed out' });
        }, GUARD_TIMEOUT_MS);

        window.addEventListener('message', listener);

        (async () => {
          let chainId = provider.chainId;
          if (!chainId) {
            try {
              chainId = await originalRequest({ method: 'eth_chainId' });
            } catch {
              chainId = '0x1';
            }
          }

          window.postMessage(
            {
              target: 'LOCAL_WEB3_GUARD',
              type: 'WEB3_REQUEST',
              payload: { method, params, chainId, origin: window.location.hostname },
              reqId,
            },
            '*'
          );
        })().catch(() => {
          finish(false);
        });
      });
    };

    provider.__safeGuardHooked = true;
    return true;
  }

  function tryInstall() {
    if (window.ethereum && installEthereumHook(window.ethereum)) return true;
    return false;
  }

  if (!tryInstall()) {
    const poll = setInterval(() => {
      if (tryInstall()) clearInterval(poll);
    }, 200);
    setTimeout(() => clearInterval(poll), 30000);
    window.addEventListener('ethereum#initialized', () => tryInstall(), { once: true });
  }
})();
