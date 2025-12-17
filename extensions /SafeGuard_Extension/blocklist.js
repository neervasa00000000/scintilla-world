// blocklist.js - Malicious Contract Blocklist Manager
// This module provides a decentralized, self-updating blocklist of known malicious contracts

// Global set for malicious contract addresses (lowercase normalized)
let MALICIOUS_CONTRACTS = new Set([
  // Initial fallback list (manually maintained if fetch fails)
  "0x18bf3ba9d8b067cc04d4ff500fe7100d452da9ff", // Example: Known scam contract
  "0x1da5821544e25c636c1417ba96ade4cf6d2f9b5a", // Fake Airdrop Contract
  "0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82", // Known Drainer
  // Add more known malicious contracts here as fallback
]);

// Fetcher Function (Requires network access)
export async function updateContractBlocklist() {
  try {
    // OPTION 1: ChainAbuse API (Community-driven, free, no API key for read)
    const CHAINABUSE_URL = "https://www.chainabuse.com/api/addresses?limit=1000";
    
    // OPTION 2: CryptoScamDB (GitHub-based, decentralized)
    const SCAMDB_URL = "https://raw.githubusercontent.com/CryptoScamDB/blacklist/master/data/addresses.json";
    
    // OPTION 3: MetaMask Phishing List (contract addresses from their detector)
    const METAMASK_URL = "https://raw.githubusercontent.com/MetaMask/eth-phishing-detect/master/src/config.json";
    
    // Try primary source first
    try {
      const res = await fetch(SCAMDB_URL, { 
        headers: { 'Accept': 'application/json' }
      });
      
      if (res.ok) {
        const data = await res.json();
        
        // Parse the format (adjust based on actual API response structure)
        let addresses = [];
        if (Array.isArray(data)) {
          addresses = data;
        } else if (data.addresses && Array.isArray(data.addresses)) {
          addresses = data.addresses;
        } else if (data.entries && Array.isArray(data.entries)) {
          addresses = data.entries.map(e => e.address || e.contract);
        }
        
        // Filter valid Ethereum addresses and normalize
        const validAddresses = addresses
          .filter(addr => addr && typeof addr === 'string' && addr.startsWith('0x') && addr.length === 42)
          .map(addr => addr.toLowerCase());
        
        if (validAddresses.length > 0) {
          // Merge with existing list (don't replace entirely, accumulate)
          validAddresses.forEach(addr => MALICIOUS_CONTRACTS.add(addr));
          console.log(`[SAFE GUARD] Updated Contract Blocklist: ${MALICIOUS_CONTRACTS.size} total entries (added ${validAddresses.length} new).`);
          return true;
        }
      }
    } catch (e) {
      console.debug('[SAFE GUARD] Primary blocklist source failed, trying fallback...', e.message);
    }
    
    // Fallback: Try loading from local storage cache
    if (typeof chrome !== 'undefined' && chrome.storage) {
      const cached = await chrome.storage.local.get('cachedBlocklist');
      if (cached.cachedBlocklist && Array.isArray(cached.cachedBlocklist)) {
        cached.cachedBlocklist.forEach(addr => MALICIOUS_CONTRACTS.add(addr.toLowerCase()));
        console.log(`[SAFE GUARD] Loaded ${cached.cachedBlocklist.length} cached blocklist entries.`);
      }
    }
    
  } catch (e) {
    console.warn('[SAFE GUARD] Failed to auto-update contract blocklist. Using static list.', e);
  }
  
  return false;
}

// Check if a contract address is on the blocklist
export function isBlacklistedContract(address) {
  if (!address || typeof address !== 'string') return false;
  return MALICIOUS_CONTRACTS.has(address.toLowerCase());
}

// Get the current blocklist size (for diagnostics)
export function getBlocklistSize() {
  return MALICIOUS_CONTRACTS.size;
}

// Save current blocklist to chrome.storage for offline use
export async function cacheBlocklist() {
  if (typeof chrome !== 'undefined' && chrome.storage) {
    try {
      const list = Array.from(MALICIOUS_CONTRACTS);
      await chrome.storage.local.set({ 
        cachedBlocklist: list,
        blocklistTimestamp: Date.now() 
      });
      console.log(`[SAFE GUARD] Cached ${list.length} blocklist entries to storage.`);
    } catch (e) {
      console.debug('[SAFE GUARD] Failed to cache blocklist:', e);
    }
  }
}

// Manual add (for user reporting or future features)
export function addToBlocklist(address) {
  if (address && typeof address === 'string' && address.startsWith('0x')) {
    MALICIOUS_CONTRACTS.add(address.toLowerCase());
    cacheBlocklist(); // Persist the addition
    return true;
  }
  return false;
}



