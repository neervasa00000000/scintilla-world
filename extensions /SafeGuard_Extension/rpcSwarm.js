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
      const timeoutMs = requiresTrace ? 8000 : 2500; 
      const timeoutId = setTimeout(() => { controller.abort(); reject(new Error('Timeout')); }, timeoutMs);

      fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
        signal: controller.signal
      })
      .then(async res => {
        clearTimeout(timeoutId);
        if (!res.ok) return reject(new Error(`HTTP ${res.status}`)); // Handled rejection
        return res.json();
      })
      .then(json => {
        if (json && json.result !== undefined) resolve(json.result);
        else reject(new Error(json?.error?.message || 'Invalid RPC Response'));
      })
      .catch((err) => {
        clearTimeout(timeoutId);
        reject(err); // Ensure all errors are caught
      });
    });
  });

  // 3. HANDLE RESULTS
  try {
    // Use Promise.any to return the first successful result
    return await Promise.any(requestPromises);
  } catch (e) {
    // Only log if the entire swarm fails to find a working node
    console.debug(`[SAFE GUARD] Swarm exhausted for ${method} on ${chainId}`);
    return null;
  }
}
