// background.js
import { checkHoneypotAndActor } from './honeypot.js';
import { updateContractBlocklist, cacheBlocklist, getBlocklistSize } from './blocklist.js';

let currentPopupWindow = null;
let pendingRequests = new Map(); // Store reqId -> tabId mapping

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'WEB3_REQUEST') {
    handleWeb3Request(message, sender);
    return true; // Async
  }
  
  // Handle decision from the Popup UI
  if (message.type === 'USER_DECISION') {
    const { reqId, approved, tabId } = message;
    
    console.log('[SAFE GUARD] User decision:', approved, 'for reqId:', reqId, 'tabId:', tabId);
    
    // Get the stored tabId if not provided
    const targetTabId = tabId || pendingRequests.get(reqId);
    
    // Close the popup window first
    if (currentPopupWindow) {
      chrome.windows.remove(currentPopupWindow).catch(() => {});
      currentPopupWindow = null;
    }
    
        // Send decision back to the content script (to unlock the page)
        if (targetTabId) {
          chrome.tabs.sendMessage(targetTabId, {
            type: 'WEB3_RESPONSE',
            reqId,
            approved
          }).catch((err) => {
            // Only log if it's not a common error (tab closed, extension reloaded)
            if (err.message && !err.message.includes('Could not establish connection') && !err.message.includes('Receiving end does not exist')) {
              console.debug('[SAFE GUARD] Response send failed:', err.message);
            }
          });
        } else {
          console.debug('[SAFE GUARD] No tabId found for reqId:', reqId);
        }
    
    // Clean up - Clear the currentRequest from storage
    chrome.storage.local.remove('currentRequest').catch(() => {});
    pendingRequests.delete(reqId);
    
    return true; // Keep channel open for async response
  }
});

async function handleWeb3Request(message, sender) {
  const { payload, reqId } = message;
      const tabId = sender.tab?.id;
      
      if (!tabId) {
        console.debug('[SAFE GUARD] No tabId in sender - request may be from non-tab context');
        return;
      }
  
  // Store the mapping
  pendingRequests.set(reqId, tabId);
  
  console.log('[SAFE GUARD] Intercepted request:', payload.method, 'reqId:', reqId, 'tabId:', tabId);
  
  // 1. Run Analysis
  const analysis = await checkHoneypotAndActor(payload);
  
  // 2. Save data for the popup to read (with timestamp)
  await chrome.storage.local.set({
    currentRequest: { ...payload, ...analysis, reqId, tabId, timestamp: Date.now() }
  });

  // 3. Open the Popup Window (Forces user attention) - Centered on screen
  try {
    const popupWidth = 360;
    const popupHeight = 500; // Compact size, no scrolling
    
    // Don't calculate position - Chrome automatically centers popup windows
    // Removing manual calculation ensures reliable centering
    
    // Don't set left/top - Chrome automatically centers popup windows
    // This ensures it appears in the center of the screen
    const window = await chrome.windows.create({
      url: chrome.runtime.getURL('popup.html'),
      type: 'popup',
      width: popupWidth,
      height: popupHeight,
      focused: true
      // Intentionally NOT setting left/top - Chrome centers automatically
    });
        currentPopupWindow = window.id;
      } catch (e) {
        console.warn('[SAFE GUARD] Failed to open popup window:', e.message || 'Unknown error');
        // If popup fails, default to reject
        chrome.tabs.sendMessage(tabId, {
          type: 'WEB3_RESPONSE',
          reqId,
          approved: false
        }).catch(() => {
          // Tab might be closed, ignore
        });
      }
}

// --- TYPOSQUATTING PROTECTION ---
const SAFE_DOMAINS = [
  "opensea.io", "uniswap.org", "metamask.io", "blur.io", "revoke.cash", "app.aave.com"
];

// Calculate Levenshtein Distance
function getDistance(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) matrix[i][j] = matrix[i - 1][j - 1];
      else matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
    }
  }
  return matrix[b.length][a.length];
}

// --- PHISHING BLOCKER ---
const PHISHING_LIST_URL = "https://raw.githubusercontent.com/MetaMask/eth-phishing-detect/master/src/config.json";
let BLOCKLIST = new Set();
let DOMAIN_AGE_CACHE = new Map(); // Cache domain age checks

// 1. Fetch Domain Phishing List on Startup
async function updateBlocklist() {
  try {
    const res = await fetch(PHISHING_LIST_URL);
    const json = await res.json();
    // MetaMask list structure: { fuzzylist: [], whitelist: [], blacklist: [] }
    // We strictly use the blacklist for now
    if (json.blacklist) {
      BLOCKLIST = new Set(json.blacklist);
      console.log(`[SAFE GUARD] Updated Domain Blocklist: ${BLOCKLIST.size} domains`);
    }
      } catch (e) {
        console.debug('[SAFE GUARD] Domain blocklist update failed (will retry):', e.message || 'Network error');
      }
}
updateBlocklist();
// Update every 1 hour
setInterval(updateBlocklist, 3600000);

// --- MALICIOUS CONTRACT BLOCKER (The PU Killer) ---
// Initialize Contract Blocklist on Startup
async function initContractBlocklist() {
  console.log('[SAFE GUARD] Initializing malicious contract blocklist...');
  await updateContractBlocklist();
  await cacheBlocklist(); // Persist to storage for offline use
  console.log(`[SAFE GUARD] Contract blocklist ready: ${getBlocklistSize()} entries.`);
}
initContractBlocklist();
// Update every 3 hours (more frequent than domain list due to higher threat velocity)
setInterval(async () => {
  await updateContractBlocklist();
  await cacheBlocklist();
}, 10800000);

// 2. Check URLs on Navigation
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading' && tab.url) {
    try {
      const url = new URL(tab.url);
      const hostname = url.hostname.replace('www.', '').toLowerCase();
      
      // A. Check Typosquatting (Before phishing check)
      SAFE_DOMAINS.forEach(safe => {
        const dist = getDistance(hostname, safe);
        // If distance is 1 or 2 (very close), but NOT exact match -> It's a Fake!
        if (dist > 0 && dist <= 2 && hostname !== safe) {
          console.warn(`[SAFE GUARD] Typosquat Detected: ${hostname} mimics ${safe}`);
          chrome.tabs.update(tabId, { url: chrome.runtime.getURL(`blocked.html?safe=${safe}`) });
        }
      });
      
      // B. Check Phishing List (async)
      isPhishing(hostname).then(isPhish => {
        if (isPhish) {
          console.warn(`[SAFE GUARD] PHISHING DETECTED: ${hostname}`);
          chrome.tabs.update(tabId, { url: chrome.runtime.getURL("blocked.html") });
        }
      }).catch(() => {}); // Ignore errors
    } catch (e) {}
  }
});

async function isPhishing(domain) {
  // A. Check MetaMask Blocklist (Fastest check)
  if (BLOCKLIST.has(domain)) return true;
  
  // Check parts (e.g., if "bad.com" is blocked, block "login.bad.com")
  const parts = domain.split('.');
  for (let i = 0; i < parts.length - 1; i++) {
    const parent = parts.slice(i).join('.');
    if (BLOCKLIST.has(parent)) return true;
  }
  
  // B. HEURISTIC 1: High Entropy Detection (Random-looking domains)
  if (hasHighEntropy(domain)) {
    console.warn(`[SAFE GUARD] High entropy domain detected: ${domain}`);
    return true;
  }
  
  // C. HEURISTIC 2: Suspicious Keywords (Flag long, complex, deceptive domains)
  const suspiciousKeywords = ['verify', 'wallet', 'claim', 'airdrop', 'support', 'official', 'secure', 'update'];
  const domainLower = domain.toLowerCase();
  if (suspiciousKeywords.some(keyword => domainLower.includes(keyword)) && domain.length > 20) {
    console.warn(`[SAFE GUARD] Suspicious keyword in domain: ${domain}`);
    return true;
  }
  
  // D. HEURISTIC 3: Domain Age Check (The 0-Day Killer)
  // Check cache first (synchronous check)
  const cacheKey = `domainAge_${domain}`;
  const cached = await chrome.storage.local.get(cacheKey);
  if (cached[cacheKey] === true) {
    console.warn(`[SAFE GUARD] Newly registered domain (cached): ${domain}`);
    return true; // Block based on cached result
  }
  
  // If not in cache, check asynchronously and store result
  checkDomainAge(domain).then(isNew => {
    if (isNew) {
      // Store flag for future requests (persistent across sessions)
      chrome.storage.local.set({ [cacheKey]: true });
      console.warn(`[SAFE GUARD] Newly registered domain detected: ${domain}`);
    } else {
      // Cache negative result too (to avoid repeated checks)
      chrome.storage.local.set({ [cacheKey]: false });
    }
  }).catch(() => {}); // Ignore RDAP errors
  
  // If synchronous checks pass, allow it to load but keep the flag ready
  return false;
}

// Calculate Shannon Entropy (Higher = More Random)
function hasHighEntropy(domain) {
  // Remove TLD for calculation
  const domainName = domain.split('.').slice(0, -1).join('.');
  if (domainName.length < 8) return false; // Short domains are fine
  
  const freq = {};
  for (const char of domainName) {
    freq[char] = (freq[char] || 0) + 1;
  }
  
  let entropy = 0;
  const len = domainName.length;
  for (const count of Object.values(freq)) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }
  
  // Entropy > 4.5 suggests random generation (e.g., "x83-verify-wallet.com")
  // Normal domains like "opensea" have entropy ~3.5
  return entropy > 4.5;
}

// Check Domain Age via RDAP (Registration Data Access Protocol)
async function checkDomainAge(domain) {
  try {
    // Extract TLD
    const parts = domain.split('.');
    const tld = parts[parts.length - 1];
    
    // RDAP endpoint (works for .com, .org, .net, etc.)
    const rdapUrl = `https://rdap.org/domain/${domain}`;
    
    const res = await fetch(rdapUrl, {
      headers: { 'Accept': 'application/rdap+json' }
    });
    
    if (!res.ok) return false; // Can't determine age
    
    const data = await res.json();
    if (data.events) {
      // Find registration event
      const regEvent = data.events.find(e => e.eventAction === 'registration');
      if (regEvent && regEvent.eventDate) {
        const regDate = new Date(regEvent.eventDate);
        const daysOld = (Date.now() - regDate.getTime()) / (1000 * 60 * 60 * 24);
        
        // If registered in last 7 days, it's suspicious
        return daysOld < 7;
      }
    }
  } catch (e) {
    // RDAP failed - don't block, just log
    console.debug(`[SAFE GUARD] RDAP check failed for ${domain}:`, e);
  }
  return false;
}
