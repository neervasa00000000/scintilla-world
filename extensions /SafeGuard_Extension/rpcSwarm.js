// rpcSwarm.js - Smart RPC Swarm: Multi-Chain Edition
import { getChainConfig } from './chains.js';

// --- Configuration: High-quality Free RPCs (Removed Ankr/Auth-wall nodes) ---
const FREE_RPCS = {
  // Ethereum Mainnet
  '0x1': [
    "https://rpc.flashbots.net",           // Best for privacy/tracing
    "https://eth.llamarpc.com",            // High throughput
    "https://nodes.mewapi.io/rpc/eth",     // Reliable
    "https://ethereum.publicnode.com",     // Good backup
    "https://1rpc.io/eth"                  // Privacy focused
  ],
  // Base (Coinbase L2)
  '0x2105': [
    "https://mainnet.base.org",
    "https://base.llamarpc.com",
    "https://base.publicnode.com"
  ],
  // Arbitrum One
  '0xa4b1': [
    "https://arb1.arbitrum.io/rpc",
    "https://arbitrum.llamarpc.com",
    "https://arbitrum-one.publicnode.com"
  ],
  // Polygon
  '0x89': [
    "https://polygon-rpc.com",
    "https://polygon.llamarpc.com",
    "https://polygon.publicnode.com"
  ]
};

// --- Tracing RPCs: STRICT list (Only nodes that support debug_traceCall) ---
// Note: Standard nodes (Infura/Cloudflare/PublicNode) usually BLOCK tracing.
const TRACE_RPCS = {
  '0x1': [
    "https://rpc.flashbots.net",       // #1 Choice for tracing
    "https://eth.llamarpc.com",        // Often supports it
    "https://nodes.mewapi.io/rpc/eth"
  ],
  '0x2105': [
    "https://mainnet.base.org" 
  ],
  '0xa4b1': [
    "https://arb1.arbitrum.io/rpc"
  ],
  '0x89': [
    "https://polygon-rpc.com"
  ]
};

// Polyfill for Promise.any() (FIXED ERROR HANDLING)
function promiseAny(promises) {
  return new Promise((resolve, reject) => {
    if (!Array.isArray(promises) || promises.length === 0) {
      return reject(new AggregateError([], 'No promises provided'));
    }
    
    let rejectedCount = 0;
    const errors = [];
    
    promises.forEach((promise, index) => {
      Promise.resolve(promise)
        .then(resolve)
        .catch(error => {
          errors[index] = error;
          rejectedCount++;
          if (rejectedCount === promises.length) {
            // CRITICAL FIX: Use AggregateError (standard format) for clean catch-all
            reject(new AggregateError(errors, 'All promises rejected'));
          }
        });
    });
  });
}

// Use native Promise.any for speed (polyfill available as fallback)
const raceToSuccess = Promise.any || promiseAny;

// --- Core Function ---
export async function swarmRequest(method, params, requiresTrace = false, chainId = '0x1') {
  const config = getChainConfig(chainId);
  
  // 1. SELECT NODES
  // If tracing is required, strictly use the TRACE list to avoid "Method not supported" errors
  let nodes = requiresTrace 
    ? (TRACE_RPCS[chainId] || [])
    : (FREE_RPCS[chainId] || []);
  
  // Always append the default config RPC as a last resort backup
  if (!nodes.includes(config.rpc)) {
    nodes.push(config.rpc);
  }
  
  // Slice to 5 max to prevent browser network congestion
  nodes = nodes.slice(0, 5); 

  // 2. RACE REQUESTS
  const requestPromises = nodes.map(rpcUrl => {
    return new Promise((resolve, reject) => {
      const controller = new AbortController();
      // Shorter timeout for trace (fail fast) so we can switch to a working node
      const timeoutMs = requiresTrace ? 8000 : 2500; 
      
      const timeoutId = setTimeout(() => {
        controller.abort();
        reject(new Error(`Timeout`));
      }, timeoutMs);

      fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
        signal: controller.signal
      })
      .then(async res => {
        clearTimeout(timeoutId);
        if (!res.ok) {
          // Reject immediately on 403/400/500 so Promise.any moves to the next node
          throw new Error(`HTTP ${res.status}`);
        }
        return res.json();
      })
      .then(json => {
        if (json.error) {
          // Vital: Reject on specific RPC errors so we try the next node
          throw new Error(json.error.message || 'RPC Error');
        }
        resolve(json.result);
      })
      .catch(error => {
        clearTimeout(timeoutId);
        // We reject here to let Promise.any catch it. 
        // Note: Browser console may still show "POST ... 403" red text; this is unavoidable but harmless.
        reject(error);
      });
    });
  });

  // 3. HANDLE RESULTS
  try {
    const result = await raceToSuccess(requestPromises);
    return result;
  } catch (errors) {
    // If we are here, EVERY SINGLE node failed.
    console.warn(`[Swarm Failed] Method: ${method}, Chain: ${chainId}. All nodes rejected.`);
    return null;
  }
}
