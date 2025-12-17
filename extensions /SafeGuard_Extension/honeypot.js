// honeypot.js - Visuals, Prices, & Simulation
import { decodeTransaction } from './decoder.js';
import { swarmRequest } from './rpcSwarm.js';
// ENHANCEMENT: Import formatBigIntTokenValue for consistent use
import { getTokenPrice, formatBigIntTokenValue } from './priceEngine.js';
import { getChainConfig } from './chains.js';
// CRITICAL: Import malicious contract blocklist checker
import { isBlacklistedContract } from './blocklist.js';

const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const PROXY_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
// ENHANCEMENT: Add common Swap Event Topic (for Price Impact Check)
const SWAP_TOPIC = "0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822";
const MAX_UINT256 = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

export async function checkHoneypotAndActor({ method, params, origin, chainId }) {
  let risk = 'LOW';
  let title = 'TRANSACTION';
  let warnings = [];
  let simulation = null;
  
  // Detect chainId from multiple sources
  let detectedChainId = chainId || '0x1'; // Default to Ethereum Mainnet
  if (method === 'eth_sendTransaction' && params[0]?.chainId) {
    const txChainId = params[0].chainId;
    detectedChainId = typeof txChainId === 'string' ? txChainId : '0x' + txChainId.toString(16);
  }
  // Normalize chainId format (ensure it starts with 0x)
  if (detectedChainId && !detectedChainId.startsWith('0x')) {
    detectedChainId = '0x' + detectedChainId;
  }

  // --- 0. INSTANT CONTRACT BLOCKLIST CHECK (The PU Killer) ---
  // This runs FIRST, before any other checks, for maximum protection speed
  if (method === 'eth_sendTransaction' && params[0]?.to) {
    const destination = params[0].to.toLowerCase();
    if (isBlacklistedContract(destination)) {
      risk = 'CRITICAL';
      title = '🛑 BLOCKED: MALICIOUS CONTRACT';
      warnings.push(`🛑 CRITICAL DANGER: This contract (${destination.slice(0, 10)}...${destination.slice(-6)}) is on a known blocklist for scams, rugs, or drainers.`);
      warnings.push(`⚠️ DO NOT PROCEED. Your funds are at CRITICAL RISK.`);
      warnings.push(`🔒 This transaction has been automatically flagged by community security databases.`);
      return { risk, title, warnings, simulation: null }; // Exit instantly - don't waste time analyzing
    }
  }

  // Also check if interacting with a contract via approval or other methods
  if (method === 'eth_sendTransaction' && params[0]?.data) {
    const tx = params[0];
    // For approve/setApprovalForAll, the 'to' field is the token, but the spender is in the data
    const decoded = decodeTransaction(tx.data);
    if ((decoded.name === 'approve' || decoded.name === 'setApprovalForAll') && decoded.params[0]) {
      const spender = decoded.params[0].value;
      if (spender && isBlacklistedContract(spender)) {
        risk = 'CRITICAL';
        title = '🛑 BLOCKED: MALICIOUS SPENDER';
        warnings.push(`🛑 CRITICAL DANGER: You are trying to approve a known malicious address (${spender.slice(0, 10)}...${spender.slice(-6)}).`);
        warnings.push(`⚠️ This address is flagged in community security databases as a drainer or scam contract.`);
        warnings.push(`🔒 DO NOT PROCEED. Reject this transaction immediately.`);
        return { risk, title, warnings, simulation: null };
      }
    }
  }

  // --- 1. TRANSACTION HEURISTICS (Quick Checks) ---
  if (method === 'eth_sendTransaction' && params[0]) {
    const tx = params[0];

    // ENHANCEMENT: Check for excessively high gas limit (Potential Drainer/Forced Execution)
    if (tx.gas) {
      const gasLimit = parseInt(tx.gas, 16);
      if (gasLimit > 1000000) { // Over 1 Million Gas
        risk = risk === 'CRITICAL' ? 'CRITICAL' : 'HIGH';
        warnings.push(`Extreme Gas Limit (${gasLimit}): This is usually not required for simple transactions. Potential forced execution or malicious contract interaction.`);
      }
    }

    // Check for high ETH/Native value transfer
    if (tx.value && tx.value !== '0x0') {
        const valueWei = BigInt(tx.value);
        if (valueWei > BigInt('1000000000000000000')) { // Greater than 1 ETH (or native token)
            warnings.push(`High Value Native Transfer: Sending ${formatBigIntTokenValue(valueWei, 18)} ${getChainConfig(detectedChainId).nativeSymbol}. Verify recipient.`);
        }
    }
  }

  // --- 1. DECODE THE INTENT (Local) ---
  if (method === 'eth_sendTransaction' && params[0]?.data) {
    const decoded = decodeTransaction(params[0].data);
    simulation = decoded;

    const tx = params[0];
    const userAddr = tx.from ? tx.from.toLowerCase() : null;
    const contractAddr = tx.to;

    // 1A. APPROVALS (DRAINER PATTERN)
    if (decoded.name === 'approve') {
      const spender = decoded.params[0]?.value;
      const amount = decoded.params[1]?.value;

      risk = 'CRITICAL';
      title = 'TOKEN APPROVAL REQUEST';
      warnings.push(`You are granting spending allowance for a token.`);
      
      if (spender) {
        warnings.push(`Spender: **${spender.slice(0, 6)}...${spender.slice(-4)}**`);
      }
      
      // ENHANCEMENT: Check for Unlimited Approval (The classic drainer move)
      if (amount === MAX_UINT256) {
        risk = 'CRITICAL';
        warnings.push(`CRITICAL: Unlimited allowance granted. The spender can take ALL your tokens.`);
      } else {
        // Show the value in Hex to user
        warnings.push(`Amount (Hex): ${amount}`);
      }
    }
    
    // 1B. ERC-721/1155 Full Approval (DRAINER PATTERN)
    if (decoded.name === 'setApprovalForAll') {
      const operator = decoded.params[0]?.value;
      const approved = decoded.params[1]?.value; // Boolean value is now correctly formatted

      if (approved === true) {
        risk = 'CRITICAL';
        title = 'NFT/ASSET FULL ACCESS GRANT';
        warnings.push(`CRITICAL: You are granting **FULL, UNLIMITED ACCESS** to ALL your NFTs/Assets (ERC-721/1155) to the following address:`);
        if (operator) {
            warnings.push(`Spender: **${operator.slice(0, 6)}...${operator.slice(-4)}**`);
        }
      }
    }

    // 1C. DIRECT NFT / TOKEN TRANSFERS (Without Trace)
    if (
      contractAddr &&
      decoded.params &&
      decoded.params.length > 0 &&
      (decoded.name === 'safeTransferFrom' || decoded.name === 'transferFrom')
    ) {
      try {
        const fromParam = decoded.params[0];
        const toParam = decoded.params[1];
        const tokenIdParam = decoded.params[2];

        const from = fromParam && typeof fromParam.value === 'string' ? fromParam.value.toLowerCase() : null;
        const to = toParam && typeof toParam.value === 'string' ? toParam.value.toLowerCase() : null;
        const tokenId = tokenIdParam ? tokenIdParam.value : null;

        if (from && to && tokenId != null) {
          // Get token details & visuals
          const { symbol, decimals } = await getTokenDetails(contractAddr, detectedChainId);
          const usdPrice = await getTokenPrice(contractAddr, symbol, decimals, detectedChainId);
          const imageUrl = await getNftImage(contractAddr, tokenId, detectedChainId);

          // Basic value formatting (for NFTs we mainly care about symbol)
          const displayValue = `NFT: ${symbol}`;
          const valueStr = usdPrice > 0 ? `(~$${usdPrice.toFixed(2)})` : '';

          // Classify relative to the user wallet
          const zeroAddress = '0x0000000000000000000000000000000000000000';
          let eventType = '🟢 INCOMING';

          if (userAddr) {
            if (from === userAddr && to !== userAddr) {
              // Outgoing NFT transfer
              risk = risk === 'CRITICAL' ? 'CRITICAL' : 'MEDIUM';
              title = 'EXTERNAL TRANSFER CONFIRMATION';
              warnings.push(`🟡 You are sending an NFT to **${to.slice(0, 6)}...${to.slice(-4)}**. Verify this address carefully.`);
              eventType = '🔴 LOSS';
            } else if (to === userAddr && from !== userAddr) {
              // Incoming NFT (airdrop / transfer)
              if (risk === 'LOW') risk = 'SAFE';
              if (title === 'TRANSACTION') title = 'INCOMING ASSET';
              eventType = (from === zeroAddress) ? '🟢 NFT MINT' : '🟢 INCOMING';
            }
          }

          // Normalize simulation to "Asset Changes" style so popup rendering is consistent
          simulation = simulation || { name: 'Asset Changes', params: [] };
          simulation.name = 'Asset Changes';

          simulation.params.push({
            type: eventType,
            value: `${displayValue} ${valueStr}`,
            image: imageUrl,
            recipient: to || contractAddr
          });
        }
      } catch (e) {
        // If this lightweight NFT decoding fails, we simply fall back to trace-based logic later.
      }
    }
  }

  // --- 2. PROXY PEEKER (Deep Scam Detection) ---
  if (method === 'eth_sendTransaction' && params[0]?.to) {
    const to = params[0].to;
    const implSlot = await swarmRequest('eth_getStorageAt', [to, PROXY_SLOT, 'latest'], false, detectedChainId);
    if (implSlot && implSlot !== '0x' && parseInt(implSlot, 16) > 0) {
      warnings.push(`Interaction via hidden proxy contract.`);
    }

    const code = await swarmRequest('eth_getCode', [to, 'latest'], false, detectedChainId);
    if (code && code !== '0x') {
      if (code.includes('ff')) warnings.push('Contract contains SELFDESTRUCT.');
      if (code.includes('f4')) warnings.push('Contract contains DELEGATECALL.');
    }
  }

  // --- 3. TRACE SCRAPER (Asset Logic) ---
  if (method === 'eth_sendTransaction') {
    const tx = params[0];
    const trace = await swarmRequest('debug_traceCall', [tx, 'latest', { tracer: 'callTracer' }], true, detectedChainId);
    
    // Asset Changes: Aggregate array for simulation
    const assetChanges = [];

    if (trace && !trace.error) {
      const logs = extractLogs(trace);
      const transfers = logs.filter(l => l.topics && l.topics[0] === TRANSFER_TOPIC);
      const swaps = logs.filter(l => l.topics && l.topics[0] === SWAP_TOPIC); // ENHANCEMENT: Filter Swap Events
      
      // --- Process Transfers (Token/NFT Movements) ---
      if (transfers.length > 0) {
        // We defer simulation creation until we successfully parse a valuable change
        await Promise.all(transfers.map(async (t) => {
          const from = '0x' + t.topics[1].slice(26).toLowerCase();
          const to = '0x' + t.topics[2].slice(26).toLowerCase();
          const user = tx.from ? tx.from.toLowerCase() : '';
          const zeroAddress = '0x0000000000000000000000000000000000000000';

          if (from !== user && to !== user) return;

          const tokenAddress = t.address;
          const tokenId = t.topics[3] ? BigInt(t.topics[3]).toString() : null;

          const { symbol, decimals } = await getTokenDetails(tokenAddress, detectedChainId);
          const usdPrice = await getTokenPrice(tokenAddress, symbol, decimals, detectedChainId);
          let imageUrl = null;
          if (tokenId) imageUrl = await getNftImage(tokenAddress, tokenId, detectedChainId);

          let displayValue = "";
          let totalValue = 0;

          if (tokenId) {
            displayValue = `NFT: ${symbol}`;
          } else if (t.data && t.data !== '0x') {
            const val = BigInt(t.data);
            const floatVal = formatBigIntTokenValue(val, decimals); // Use enhanced helper
            totalValue = floatVal * usdPrice;
            const formattedAmount = floatVal.toLocaleString('en-US', {minimumFractionDigits: 4, maximumFractionDigits: 10});
            displayValue = `${formattedAmount} ${symbol}`;
          }
          
          // OUTGOING: asset leaving the user (LOSS)
          if (from === user && from !== to) { // Not self-transfer
            risk = risk === 'CRITICAL' ? 'CRITICAL' : 'MEDIUM';
            title = 'EXTERNAL TRANSFER CONFIRMATION';
            warnings.push(`🔴 LOSS: **${displayValue}** sent to **${to.slice(0, 6)}...${to.slice(-4)}** ${totalValue > 0 ? `(~$${totalValue.toFixed(2)})` : ''}`);
            
            assetChanges.push({ 
                type: 'LOSS',
                value: `${displayValue} (Estimated Value: $${totalValue.toFixed(2)})`,
                image: imageUrl,
                recipient: to
            });
          }

          // INCOMING: asset arriving in the user's wallet
          if (to === user && from !== user) {
            if (risk === 'LOW') risk = 'SAFE';
            if (title === 'TRANSACTION') title = 'INCOMING ASSET';
            const typeLabel = (from === zeroAddress) ? 'NFT MINT' : 'INCOMING';

            assetChanges.push({
              type: typeLabel,
              value: `${displayValue} (Estimated Value: $${totalValue.toFixed(2)})`,
              image: imageUrl,
              recipient: to
            });
          }
        }));
      }

      // --- ENHANCEMENT: Slippage/Price Impact Check (Honeypot/Rug Pattern) ---
      if (swaps.length > 0) {
        // Check for suspicious swap patterns that indicate honeypot tokens
        const totalLossValue = assetChanges
          .filter(c => c.type === 'LOSS')
          .reduce((sum, c) => {
            const match = c.value.match(/\$(\d+\.?\d*)/);
            return sum + (match ? parseFloat(match[1]) : 0);
          }, 0);
        
        const totalGainValue = assetChanges
          .filter(c => c.type === 'INCOMING')
          .reduce((sum, c) => {
            const match = c.value.match(/\$(\d+\.?\d*)/);
            return sum + (match ? parseFloat(match[1]) : 0);
          }, 0);
        
        // Simple check: If LOSS > 0 and GAIN = 0, it's a drain or a burn
        if (totalLossValue > 0 && totalGainValue === 0) {
          risk = risk === 'CRITICAL' ? 'CRITICAL' : 'HIGH';
          warnings.push('CRITICAL: Transaction simulates a token loss with no corresponding token gain. **Likely a scam or token burn.**');
        } else if (totalLossValue > 0 && totalGainValue > 0) {
          // Price Impact / Slippage Check
          const priceImpact = (1 - (totalGainValue / totalLossValue)) * 100;
          
          if (priceImpact > 20) { // Over 20% loss due to slippage/fees
            risk = risk === 'CRITICAL' ? 'CRITICAL' : 'HIGH';
            warnings.push(`HIGH SLIPPAGE: You lose **${priceImpact.toFixed(1)}%** of value in this trade. Possible honeypot or high tax token.`);
          } else if (priceImpact > 5) { // 5-20% loss is suspicious
            warnings.push(`Warning: High slippage (${priceImpact.toFixed(1)}%). Check token taxes/fees.`);
          }
        }
      }

      // Finalize simulation data if changes were found
      if (assetChanges.length > 0) {
        simulation = simulation || { name: 'Asset Changes', params: [] };
        simulation.name = 'Asset Changes';
        simulation.params = assetChanges;
      }
    } else {
        // --- Detailed Fallback/Failure Check (Simplified UX) ---
        try {
          // Run a simpler eth_call (no trace) to see if TX reverts
          const dryRun = await swarmRequest('eth_call', [tx, 'latest'], false, detectedChainId);
          
          // NOTE: Many nodes return '0x' for successful calls with no return data.
          // We ONLY treat it as a failure if dryRun is null/undefined.
          if (!dryRun) {
            // TX reverted on the simpler call (Clear Danger)
            risk = 'CRITICAL';
            title = 'TRANSACTION WILL FAIL'; // Clear, decisive title
            warnings.push('Danger: this transaction is guaranteed to revert and fail on the blockchain.');
            warnings.push('Reverting transactions waste gas and often indicate a broken or malicious contract.');
          } else {
            // TX succeeded, but no trace data was returned (Uncertain Danger)
            if (title === 'TRANSACTION') title = 'SECURITY BLIND SPOT'; // Clear, decisive title
            warnings.push(`Warning: simulation failed. The network is too congested or busy to verify the transaction outcome.`);
            warnings.push(`Proceeding is possible, but **risky**. Transaction outcome is unknown.`);
          }
        } catch (e) {
            // If even the basic eth_call fails
            risk = risk === 'CRITICAL' ? 'CRITICAL' : 'HIGH';
            title = 'NETWORK FAILURE';
            warnings.push('Critical network error: could not verify transaction due to connection issues.');
        }
    }
  }

  // --- 4. DRAINER SIGNATURES ---
  if (method === 'eth_signTypedData_v4') {
    try {
      const data = JSON.parse(params[1]);
      if (data.domain && data.domain.name && data.domain.name.toLowerCase().includes('permit')) {
        risk = 'CRITICAL';
        title = 'OFFLINE PERMIT';
        warnings.push('Permit-style signature: this can allow the dApp to drain tokens later without another approval.');
      }
    } catch (e) { /* Ignore parse errors */ }
  }
  
  if (method === 'eth_requestAccounts') {
    risk = 'SAFE';
    title = 'WALLET CONNECT'; 
    warnings.push('Site wants to view your address.');
    return { risk, title, warnings, simulation };
  }

  // --- 5. Analyze Signatures ---
  if (
    method === 'eth_sign' ||
    method === 'personal_sign' ||
    method.startsWith('eth_signTypedData')
  ) {
    if (risk === 'LOW') {
      risk = 'MEDIUM';
      title = 'SIGNATURE REQUEST';
    }
    warnings.push('You are signing data; verify the site and content carefully.');
  }

  if (warnings.length === 0 && risk === 'LOW') {
    warnings.push('No obvious local red flags detected. Still verify manually.');
  }

  return { risk, title, warnings, simulation };
}

// --- VISUAL ENGINE (NFT IMAGES) ---
async function getNftImage(contract, tokenId, chainId = '0x1') {
  try {
    // 1. Call tokenURI(tokenId) - Function Sig: 0xc87b56dd
    const hexId = BigInt(tokenId).toString(16).padStart(64, '0');
    const data = '0xc87b56dd' + hexId;
    const uriHex = await swarmRequest('eth_call', [{ to: contract, data }, 'latest'], false, chainId);
    
    if (!uriHex || uriHex === '0x') return null;
    
    // 2. Decode String
    let uri = hexToAscii(uriHex).replace(/[^\x20-\x7E]/g, '').trim();
    // Fix common IPFS formats
    if (uri.startsWith('ipfs://')) uri = uri.replace('ipfs://', 'https://ipfs.io/ipfs/');
    
    // 3. Fetch Metadata JSON
    const res = await fetch(uri);
    const json = await res.json();
    
    // 4. Extract Image
    let img = json.image || json.image_url;
    if (img && img.startsWith('ipfs://')) img = img.replace('ipfs://', 'https://ipfs.io/ipfs/');
    
    // 5. PRIVACY FIX: Use proxy to prevent IP leak
    if (img) {
      // Use images.weserv.nl as privacy proxy (doesn't log IPs)
      img = `https://images.weserv.nl/?url=${encodeURIComponent(img)}`;
    }
    
    return img;
  } catch (e) {
    return null;
  }
}


// --- HELPER ---
async function getTokenDetails(contractAddress, chainId = '0x1') {
  try {
    const [symbolHex, decimalsHex] = await Promise.all([
      swarmRequest('eth_call', [{ to: contractAddress, data: '0x95d89b41' }, 'latest'], false, chainId),
      swarmRequest('eth_call', [{ to: contractAddress, data: '0x313ce567' }, 'latest'], false, chainId)
    ]);
    let symbol = symbolHex && symbolHex.length > 2 ? hexToAscii(symbolHex).replace(/[^\x20-\x7E]/g, '').trim() : 'TOKEN';
    let decimals = decimalsHex && decimalsHex.length > 2 ? parseInt(decimalsHex, 16) : 18;
    return { symbol, decimals };
  } catch (e) { return { symbol: 'TOKEN', decimals: 18 }; }
}

function hexToAscii(hex) {
  let str = '';
  const cleanHex = hex.replace(/^0x/, '');
  for (let i = 0; i < cleanHex.length; i += 2) {
    const code = parseInt(cleanHex.substr(i, 2), 16);
    if (code > 32 && code < 126) str += String.fromCharCode(code);
  }
  return str;
}

function extractLogs(traceNode) {
  if (!traceNode) return [];
  let logs = traceNode.logs || [];
  if (traceNode.calls) traceNode.calls.forEach(call => logs = logs.concat(extractLogs(call)));
  return logs;
}

// NOTE: formatBigIntTokenValue is now in priceEngine.js and imported.
