// popup.js - FINAL VERSION
document.addEventListener('DOMContentLoaded', async () => {
  // --- Chain Name Mapping ---
  const CHAIN_NAMES = {
    '0x1': 'Ethereum',
    '0x2105': 'Base',
    '0xa4b1': 'Arbitrum',
    '0x89': 'Polygon'
  };

  // Helper function to decode hex string to text
  function hexToString(hex) {
    try {
      const cleanHex = hex.replace(/^0x/, '');
      let str = '';
      for (let i = 0; i < cleanHex.length; i += 2) {
        const code = parseInt(cleanHex.substr(i, 2), 16);
        if (code > 0) {
          str += String.fromCharCode(code);
        }
      }
      return str.trim();
    } catch (e) {
      return null;
    }
  }

  // Helper function to format warnings with markdown-style bold and emoji support
  function formatWarning(text) {
    if (!text) return text;
    // Convert **text** to <strong>text</strong> for visual emphasis
    return text.replace(/\*\*(.*?)\*\*/g, '<strong style="color: #fbbf24; font-weight: 700;">$1</strong>');
  }

  const data = await chrome.storage.local.get('currentRequest');
  const request = data.currentRequest;

  // Check if request is still valid (not older than 5 minutes)
  if (request && request.timestamp) {
    const age = Date.now() - request.timestamp;
    if (age > 300000) { // 5 minutes
      // Request is too old, clear it
      chrome.storage.local.remove('currentRequest');
      request = null;
    }
  }

  if (!request) {
    // Show status page when no active request
    const riskBox = document.getElementById('riskBox');
    const riskTitle = document.getElementById('riskTitle');
    const warningsEl = document.getElementById('warnings');
    const detailsEl = document.getElementById('details');
    const buttons = document.querySelector('.buttons');
    const networkChainEl = document.getElementById('network-chain');
    
    riskBox.className = 'risk-box safe';
    riskTitle.textContent = 'ACTIVE';
    warningsEl.innerHTML = '<ul><li>SAFE GUARD is monitoring your wallet transactions.</li><li>No active request at this time.</li></ul>';
    detailsEl.innerHTML = '<div class="detail-row"><span class="detail-label">Status</span><span style="color: rgba(255, 255, 255, 0.9); font-weight: 600;">Ready</span></div><div class="detail-row"><span class="detail-label">Protection</span><span style="color: #22c55e; font-weight: 600;">Enabled</span></div>';
    if (networkChainEl) networkChainEl.textContent = '[Ready]';
    buttons.style.display = 'none';
    return;
  }

  const { method, params, risk, warnings, reqId, tabId, title, simulation, chainId } = request;

  // Update UI
  const riskBox = document.getElementById('riskBox');
  const riskTitle = document.getElementById('riskTitle');
  const warningsEl = document.getElementById('warnings');
  const detailsEl = document.getElementById('details');
  const buttons = document.querySelector('.buttons');
  const networkChainEl = document.getElementById('network-chain');
  const simulationSummaryEl = document.getElementById('simulation-summary');
  
  // Ensure buttons are visible for valid requests
  if (buttons) {
    buttons.style.display = 'flex';
  }
  
  // Display network chain in header
  if (networkChainEl) {
    networkChainEl.textContent = `[${CHAIN_NAMES[chainId] || 'Unknown Network'}]`;
  }
  
  // Check if request is still pending (not too old)
  const isExpired = request.timestamp && (Date.now() - request.timestamp > 300000);

  // Set risk styling with proper color mapping
  const riskLevel = risk ? risk.toLowerCase() : 'low';
  // Map risk levels to CSS classes
  let riskClass = 'safe'; // Default to safe (green)
  if (riskLevel === 'critical' || riskLevel === 'high') {
    riskClass = riskLevel === 'critical' ? 'critical' : 'high'; // Red
  } else if (riskLevel === 'medium') {
    riskClass = 'medium'; // Orange
  } else {
    riskClass = 'safe'; // Green (for safe, low, or unknown)
  }
  
  riskBox.className = `risk-box ${riskClass}`;
  riskTitle.textContent = title || risk || 'UNKNOWN';

  // Show transaction summary (what's happening)
  let transactionSummary = '';
  if (method === 'eth_sendTransaction') {
    transactionSummary = 'Sending Transaction';
    if (params && params[0] && params[0].to) {
      transactionSummary += ` to ${params[0].to.slice(0, 6)}...${params[0].to.slice(-4)}`;
    }
  } else if (method === 'eth_requestAccounts') {
    transactionSummary = 'Wallet Connection Request';
  } else if (method === 'personal_sign' || method === 'eth_sign') {
    transactionSummary = 'Signature Request';
  } else if (method === 'eth_signTypedData_v4') {
    transactionSummary = 'Typed Data Signature';
  } else {
    transactionSummary = method || 'Unknown Request';
  }

  // Show warnings with transaction summary
  let warningsHtml = '';
  if (transactionSummary) {
    warningsHtml += `<div style="color: #00f0ff; font-size: 11px; margin-bottom: 10px; font-weight: 700; letter-spacing: 0.3px; display: flex; align-items: center; gap: 6px;">
      <span style="font-size: 11px; text-transform: uppercase;">Summary:</span> ${transactionSummary}
    </div>`;
  }
  if (warnings && warnings.length > 0) {
    warningsHtml += '<ul>' + warnings.map(w => `<li>${formatWarning(w)}</li>`).join('') + '</ul>';
  } else {
    warningsHtml += '<div style="color: rgba(255, 255, 255, 0.5); font-size: 11px;">No warnings detected</div>';
  }
  warningsEl.innerHTML = warningsHtml;

  // Show details with decoded transaction data
  detailsEl.innerHTML = ''; // Clear old content

  // --- ALWAYS SHOW DESTINATION ADDRESS (Accurate Extraction) ---
  let destinationAddress = null;
  let spenderAddress = null; // For approvals, this is the actual spender
  let transactionValue = null;
  
  // Extract addresses based on transaction type
  if (method === 'eth_sendTransaction' && params && params[0]) {
    // For transactions, the "to" field is the contract/wallet being interacted with
    if (params[0].to) {
      destinationAddress = params[0].to.toLowerCase(); // Normalize to lowercase
    }
    
    // For approvals, extract the spender address from decoded data
    if (simulation && (simulation.name === 'approve' || simulation.name === 'setApprovalForAll')) {
      if (simulation.params && simulation.params.length > 0) {
        // First param is usually the spender address
        const spenderParam = simulation.params.find(p => p.type === 'address');
        if (spenderParam) {
          spenderAddress = spenderParam.value.toLowerCase();
        }
      }
    }
    
    // For transfers, extract recipient address from decoded data or trace logs
    if (simulation && (simulation.name === 'transfer' || simulation.name === 'transferFrom' || simulation.name === 'safeTransferFrom' || simulation.name === 'Asset Changes')) {
      if (simulation.params && simulation.params.length > 0) {
        // First check if recipient is stored in params (from trace logs)
        const transferParam = simulation.params.find(p => p.recipient);
        if (transferParam && transferParam.recipient) {
          spenderAddress = transferParam.recipient.toLowerCase();
        } else {
          // Fallback: extract from decoded function params
          // For transfer: first param is recipient
          // For transferFrom: second param is recipient
          const recipientParam = simulation.name === 'transfer' 
            ? simulation.params[0] 
            : simulation.params[1];
          if (recipientParam && recipientParam.type === 'address') {
            spenderAddress = recipientParam.value.toLowerCase(); // Reuse variable for recipient
          }
        }
      }
    }
    
    // Extract transaction value
    if (params[0].value) {
      const valueHex = params[0].value;
      const valueWei = valueHex.startsWith('0x') ? BigInt(valueHex) : BigInt('0x' + valueHex);
      transactionValue = Number(valueWei) / 1e18;
    }
  }

  // --- DISPLAY: ADDRESSES & VALUE (Compact) ---
  // Show destination address prominently (Contract address) - for transactions only
  if (destinationAddress) {
    const contractRow = document.createElement('div');
    contractRow.className = 'detail-row';
    contractRow.style.marginBottom = '6px';
    contractRow.style.padding = '6px';
    contractRow.style.background = 'rgba(0, 240, 255, 0.05)';
    contractRow.style.borderRadius = '6px';
    contractRow.style.border = '1px solid rgba(0, 240, 255, 0.15)';
    contractRow.innerHTML = `<span class="detail-label">Contract/Destination</span> 
      <span class="address-compact" style="color: #00f0ff;">${destinationAddress}</span>`;
    detailsEl.appendChild(contractRow);
  }
  
  // ALWAYS show Contract/Target Address for any transaction
  if (destinationAddress && method === 'eth_sendTransaction') {
    const contractRow = document.createElement('div');
    contractRow.className = 'detail-row';
    contractRow.style.marginBottom = '12px';
    contractRow.style.padding = '12px';
    contractRow.style.borderRadius = '8px';
    contractRow.style.background = 'rgba(0, 240, 255, 0.05)';
    contractRow.style.border = '1px solid rgba(0, 240, 255, 0.15)';
    
    contractRow.innerHTML = `<span class="detail-label">📍 Contract Address</span> 
      <span class="address-compact" style="color: #00f0ff; font-weight: 600; font-family: 'SF Mono', 'Monaco', 'Courier New', monospace;">${destinationAddress}</span>`;
    detailsEl.appendChild(contractRow);
  }
  
  // Show Spender/Recipient Address (The Critical Security Check)
  if (spenderAddress && spenderAddress !== destinationAddress) {
    const spenderRow = document.createElement('div');
    spenderRow.className = 'detail-row';
    spenderRow.style.marginBottom = '12px';
    spenderRow.style.padding = '12px';
    spenderRow.style.borderRadius = '8px';
    spenderRow.style.borderTop = '1px solid rgba(255, 255, 255, 0.05)';
    
    // Define label and color based on security risk
    let spenderLabel = 'Target Address';
    let spenderColor = '#00f0ff';
    let bgColor = 'rgba(0, 240, 255, 0.05)';
    let borderColor = 'rgba(0, 240, 255, 0.15)';
    
    if (simulation && (simulation.name === 'approve' || simulation.name === 'setApprovalForAll')) {
      spenderLabel = '⚠️ SPENDER (Can Take Your Tokens)';
      spenderColor = '#ff6b6b';
      bgColor = 'rgba(239, 68, 68, 0.15)';
      borderColor = 'rgba(239, 68, 68, 0.3)';
      spenderRow.style.border = `2px solid ${borderColor}`;
    } else if (simulation && (simulation.name === 'transfer' || simulation.name === 'transferFrom' || simulation.name === 'safeTransferFrom')) {
      spenderLabel = '📤 Recipient (Receiving Your Assets)';
      spenderColor = '#fbbf24';
      bgColor = 'rgba(245, 158, 11, 0.08)';
      borderColor = 'rgba(245, 158, 11, 0.2)';
    } else if (simulation && simulation.name === 'Asset Changes') {
      // For complex transactions, show the final recipient
      spenderLabel = '📤 Final Recipient';
      spenderColor = '#fbbf24';
      bgColor = 'rgba(245, 158, 11, 0.08)';
      borderColor = 'rgba(245, 158, 11, 0.2)';
    }
    
    spenderRow.style.background = bgColor;
    spenderRow.style.border = `1px solid ${borderColor}`;
    
    spenderRow.innerHTML = `<span class="detail-label">${spenderLabel}</span> 
      <span class="address-compact" style="color: ${spenderColor}; font-weight: 600;">${spenderAddress}</span>`;
    detailsEl.appendChild(spenderRow);
  }
  
  // Show transaction value if available
  if (transactionValue && transactionValue > 0) {
    const valueRow = document.createElement('div');
    valueRow.className = 'detail-row';
    valueRow.style.marginBottom = '6px';
    valueRow.style.padding = '6px';
    valueRow.style.background = 'rgba(245, 158, 11, 0.08)';
    valueRow.style.borderRadius = '6px';
    valueRow.style.border = '1px solid rgba(245, 158, 11, 0.2)';
    valueRow.innerHTML = `<span class="detail-label">Value</span> 
      <span style="color: #fcd34d; font-size: 11px; font-weight: 600;">${transactionValue.toFixed(6)} ETH</span>`;
    detailsEl.appendChild(valueRow);
  }

  // --- DISPLAY: SIGNATURE REQUEST DETAILS ---
  // For signature requests, show origin and message details
  if (method === 'personal_sign' || method === 'eth_sign' || method.startsWith('eth_signTypedData')) {
    // Show origin/domain (from payload or request)
    const origin = request.origin || (params && params.origin) || 'Unknown';
    if (origin && origin !== 'Unknown' && !detailsEl.querySelector('.origin-row')) {
      const originRow = document.createElement('div');
      originRow.className = 'detail-row origin-row';
      originRow.style.marginBottom = '12px';
      originRow.style.padding = '12px';
      originRow.style.background = 'rgba(0, 240, 255, 0.05)';
      originRow.style.borderRadius = '8px';
      originRow.style.border = '1px solid rgba(0, 240, 255, 0.15)';
      originRow.innerHTML = `<span class="detail-label">🌐 Requesting Site</span> 
        <span style="color: #00f0ff; font-family: 'SF Mono', 'Monaco', 'Courier New', monospace; font-size: 11px; font-weight: 600; display: block; margin-top: 6px; word-break: break-all;">${origin}</span>`;
      detailsEl.appendChild(originRow);
    }

    // Show decoded message for personal_sign
    if (method === 'personal_sign' && params && params[0]) {
      try {
        const messageHex = params[0].startsWith('0x') ? params[0] : params[1];
        if (messageHex) {
          // Decode hex to string
          const messageStr = hexToString(messageHex);
          if (messageStr && messageStr.length > 0) {
            const messageRow = document.createElement('div');
            messageRow.className = 'detail-row';
            messageRow.style.marginBottom = '12px';
            messageRow.style.padding = '14px';
            messageRow.style.backgroundColor = 'rgba(0, 240, 255, 0.08)';
            messageRow.style.borderLeft = '3px solid #00f0ff';
            messageRow.style.borderRadius = '10px';
            messageRow.style.border = '1px solid rgba(0, 240, 255, 0.15)';
            messageRow.style.whiteSpace = 'pre-wrap';
            messageRow.innerHTML = `<div style="color: rgba(255, 255, 255, 0.6); font-size: 10px; margin-bottom: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px;">Message to Sign</div>
              <div style="color: rgba(255, 255, 255, 0.95); font-family: 'SF Mono', 'Monaco', 'Courier New', monospace; font-size: 12px; word-break: break-word; white-space: pre-wrap; line-height: 1.7; max-height: 150px; overflow-y: auto; padding: 8px; background: rgba(0, 0, 0, 0.2); border-radius: 6px;">${messageStr.replace(/\n/g, '<br>')}</div>`;
            detailsEl.appendChild(messageRow);
          }
        }
      } catch (e) {
        // If decoding fails, show raw hex
        const messageRow = document.createElement('div');
        messageRow.className = 'detail-row';
        messageRow.style.marginBottom = '12px';
        messageRow.style.padding = '12px';
        messageRow.style.background = 'rgba(245, 158, 11, 0.08)';
        messageRow.style.borderRadius = '10px';
        messageRow.style.border = '1px solid rgba(245, 158, 11, 0.2)';
        messageRow.innerHTML = `<span class="detail-label">Message (Hex - Could not decode)</span> 
          <span style="color: rgba(255, 255, 255, 0.7); font-family: 'SF Mono', 'Monaco', 'Courier New', monospace; font-size: 11px; word-break: break-all; display: block; margin-top: 6px; padding: 8px; background: rgba(0, 0, 0, 0.2); border-radius: 6px;">${params[0].slice(0, 80)}...</span>`;
        detailsEl.appendChild(messageRow);
      }
    }

    // Show typed data details for eth_signTypedData_v4
    if (method === 'eth_signTypedData_v4' && params && params[1]) {
      try {
        const typedData = JSON.parse(params[1]);
        if (typedData.domain) {
          const domainRow = document.createElement('div');
          domainRow.className = 'detail-row';
          domainRow.style.marginBottom = '10px';
          domainRow.style.padding = '10px';
          domainRow.style.background = 'rgba(0, 240, 255, 0.05)';
          domainRow.style.borderRadius = '8px';
          domainRow.innerHTML = `<span class="detail-label">Domain</span> 
            <span style="color: #00f0ff; font-family: 'SF Mono', 'Monaco', 'Courier New', monospace; font-size: 12px; font-weight: 600; display: block; margin-top: 4px;">${typedData.domain.name || 'Unknown'}</span>`;
          detailsEl.appendChild(domainRow);
        }
        if (typedData.message) {
          const messageKeys = Object.keys(typedData.message);
          if (messageKeys.length > 0) {
            const messageRow = document.createElement('div');
            messageRow.className = 'detail-row';
            messageRow.style.marginBottom = '12px';
            messageRow.style.padding = '14px';
            messageRow.style.backgroundColor = 'rgba(0, 240, 255, 0.08)';
            messageRow.style.borderLeft = '3px solid #00f0ff';
            messageRow.style.borderRadius = '10px';
            messageRow.style.border = '1px solid rgba(0, 240, 255, 0.15)';
            messageRow.innerHTML = `<div style="color: rgba(255, 255, 255, 0.6); font-size: 10px; margin-bottom: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px;">Typed Data Fields</div>
              <div style="color: rgba(255, 255, 255, 0.95); font-family: 'SF Mono', 'Monaco', 'Courier New', monospace; font-size: 11px; word-break: break-word; line-height: 1.8; max-height: 200px; overflow-y: auto; padding: 8px; background: rgba(0, 0, 0, 0.2); border-radius: 6px;">${messageKeys.map(k => {
              const value = String(typedData.message[k]);
              const displayValue = value.length > 50 ? value.slice(0, 50) + '...' : value;
              return `<div style="margin: 6px 0; padding: 4px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.05);"><strong style="color: #00f0ff; font-size: 11px;">${k}:</strong> <span style="color: rgba(255, 255, 255, 0.9);">${displayValue}</span></div>`;
            }).join('')}</div>`;
            detailsEl.appendChild(messageRow);
          }
        }
      } catch (e) {
        // If parsing fails, show raw data preview
        const dataRow = document.createElement('div');
        dataRow.className = 'detail-row';
        dataRow.style.marginBottom = '12px';
        dataRow.style.padding = '12px';
        dataRow.style.background = 'rgba(245, 158, 11, 0.08)';
        dataRow.style.borderRadius = '10px';
        dataRow.style.border = '1px solid rgba(245, 158, 11, 0.2)';
        dataRow.innerHTML = `<span class="detail-label">Typed Data (Could not parse)</span> 
          <span style="color: rgba(255, 255, 255, 0.7); font-family: 'SF Mono', 'Monaco', 'Courier New', monospace; font-size: 11px; word-break: break-all; display: block; margin-top: 6px; padding: 8px; background: rgba(0, 0, 0, 0.2); border-radius: 6px; max-height: 100px; overflow-y: auto;">${params[1].slice(0, 200)}...</span>`;
        detailsEl.appendChild(dataRow);
      }
    }
  }

  // Always show request origin if available
  if (request.origin && !detailsEl.querySelector('.origin-row')) {
    const originRow = document.createElement('div');
    originRow.className = 'detail-row origin-row';
    originRow.style.marginBottom = '12px';
    originRow.style.padding = '12px';
    originRow.style.background = 'rgba(0, 240, 255, 0.05)';
    originRow.style.borderRadius = '8px';
    originRow.style.border = '1px solid rgba(0, 240, 255, 0.15)';
    originRow.innerHTML = `<span class="detail-label">🌐 Requesting Site</span> 
      <span style="color: #00f0ff; font-family: 'SF Mono', 'Monaco', 'Courier New', monospace; font-size: 11px; font-weight: 600; display: block; margin-top: 6px; word-break: break-all;">${request.origin}</span>`;
    detailsEl.appendChild(originRow);
  }

  // Show request type if no other details were added
  if (detailsEl.children.length === 0 || (detailsEl.children.length === 1 && detailsEl.querySelector('.origin-row'))) {
    const methodRow = document.createElement('div');
    methodRow.className = 'detail-row';
    methodRow.style.marginBottom = '10px';
    methodRow.style.padding = '10px';
    methodRow.style.background = 'rgba(0, 240, 255, 0.05)';
    methodRow.style.borderRadius = '8px';
    methodRow.innerHTML = `<span class="detail-label">Request Type</span> 
      <span style="color: #00f0ff; font-family: 'SF Mono', 'Monaco', 'Courier New', monospace; font-size: 12px; font-weight: 600; display: block; margin-top: 4px;">${method}</span>`;
    detailsEl.appendChild(methodRow);
  }
  
  // Show gas limit if available and high
  if (method === 'eth_sendTransaction' && params && params[0] && params[0].gas) {
    const gasLimit = parseInt(params[0].gas, 16);
    if (gasLimit > 0) {
      const gasRow = document.createElement('div');
      gasRow.className = 'detail-row';
      gasRow.style.marginBottom = '10px';
      gasRow.style.padding = '10px';
      gasRow.style.background = gasLimit > 500000 ? 'rgba(245, 158, 11, 0.08)' : 'rgba(0, 240, 255, 0.05)';
      gasRow.style.borderRadius = '8px';
      gasRow.style.border = gasLimit > 500000 ? '1px solid rgba(245, 158, 11, 0.2)' : '1px solid rgba(0, 240, 255, 0.1)';
      gasRow.innerHTML = `<span class="detail-label">Gas Limit</span> 
        <span style="color: ${gasLimit > 500000 ? '#fbbf24' : '#00f0ff'}; font-family: 'SF Mono', 'Monaco', 'Courier New', monospace; font-size: 11px; font-weight: 600; display: block; margin-top: 4px;">${gasLimit.toLocaleString()}</span>`;
      detailsEl.appendChild(gasRow);
    }
  }
  
  // Show transaction data size if available
  if (method === 'eth_sendTransaction' && params && params[0] && params[0].data && params[0].data !== '0x') {
    const dataSize = (params[0].data.length - 2) / 2; // Convert hex to bytes
    const dataSizeRow = document.createElement('div');
    dataSizeRow.className = 'detail-row';
    dataSizeRow.style.marginBottom = '10px';
    dataSizeRow.style.padding = '10px';
    dataSizeRow.style.background = 'rgba(0, 240, 255, 0.05)';
    dataSizeRow.style.borderRadius = '8px';
    dataSizeRow.innerHTML = `<span class="detail-label">Transaction Data</span> 
      <span style="color: #00f0ff; font-family: 'SF Mono', 'Monaco', 'Courier New', monospace; font-size: 11px; font-weight: 600; display: block; margin-top: 4px;">${dataSize} bytes</span>`;
    detailsEl.appendChild(dataSizeRow);
  }
  
  // Show security database info for blocklist warnings
  if (title && title.includes('🛑 BLOCKED')) {
    const securityInfoRow = document.createElement('div');
    securityInfoRow.className = 'detail-row';
    securityInfoRow.style.marginTop = '12px';
    securityInfoRow.style.padding = '12px';
    securityInfoRow.style.background = 'rgba(220, 38, 38, 0.1)';
    securityInfoRow.style.borderRadius = '8px';
    securityInfoRow.style.border = '1px solid rgba(220, 38, 38, 0.3)';
    securityInfoRow.innerHTML = `<span class="detail-label" style="color: #fca5a5;">🛡️ Security Information</span> 
      <div style="color: #fecaca; font-size: 11px; margin-top: 8px; line-height: 1.6;">
        <div style="margin-bottom: 6px;">• <strong>Source:</strong> Community Security Databases</div>
        <div style="margin-bottom: 6px;">• <strong>Status:</strong> Known Malicious Contract</div>
        <div style="margin-bottom: 6px;">• <strong>Threat Type:</strong> Scam/Rug/Drainer</div>
        <div style="margin-bottom: 0;">• <strong>Recommendation:</strong> Block Transaction</div>
      </div>`;
    detailsEl.appendChild(securityInfoRow);
    
    // Add risk disclosure
    const riskDisclosureRow = document.createElement('div');
    riskDisclosureRow.className = 'detail-row';
    riskDisclosureRow.style.marginTop = '10px';
    riskDisclosureRow.style.padding = '12px';
    riskDisclosureRow.style.background = 'rgba(245, 158, 11, 0.08)';
    riskDisclosureRow.style.borderRadius = '8px';
    riskDisclosureRow.style.border = '1px solid rgba(245, 158, 11, 0.3)';
    riskDisclosureRow.innerHTML = `<span class="detail-label" style="color: #fbbf24;">⚠️ If You Continue</span> 
      <div style="color: #fde68a; font-size: 10px; margin-top: 8px; line-height: 1.6;">
        Proceeding with this transaction may result in:
        <ul style="margin: 8px 0 0 16px; padding: 0;">
          <li style="margin: 4px 0;">Complete loss of funds sent</li>
          <li style="margin: 4px 0;">Unauthorized token approvals</li>
          <li style="margin: 4px 0;">NFT/asset drainage from wallet</li>
          <li style="margin: 4px 0;">No possibility of recovery</li>
        </ul>
      </div>`;
    detailsEl.appendChild(riskDisclosureRow);
  }

  // --- SIMULATION RESULTS (Cleaned up display) ---
  if (simulationSummaryEl) {
    simulationSummaryEl.innerHTML = ''; // Clear old content

    if (simulation && simulation.name) {
      simulationSummaryEl.style.display = 'block'; // Show only when there's content
      
      // --- TRANSACTION SUMMARY: What You Lose vs What You Gain ---
      if (simulation.params && simulation.params.length > 0) {
        const losses = simulation.params.filter(p => p.type === 'LOSS');
        const gains = simulation.params.filter(p => p.type === 'INCOMING' || p.type === 'NFT MINT');
        
        if (losses.length > 0 || gains.length > 0) {
          const summarySection = document.createElement('div');
          summarySection.style.marginBottom = '16px';
          summarySection.style.padding = '14px';
          summarySection.style.background = 'rgba(0, 240, 255, 0.05)';
          summarySection.style.borderRadius = '10px';
          summarySection.style.border = '2px solid rgba(0, 240, 255, 0.2)';
          
          const summaryTitle = document.createElement('div');
          summaryTitle.style.color = '#00f0ff';
          summaryTitle.style.fontSize = '10px';
          summaryTitle.style.fontWeight = '700';
          summaryTitle.style.textTransform = 'uppercase';
          summaryTitle.style.letterSpacing = '1px';
          summaryTitle.style.marginBottom = '12px';
          summaryTitle.textContent = '💱 TRANSACTION SUMMARY';
          summarySection.appendChild(summaryTitle);
          
          // Create two-column layout
          const summaryGrid = document.createElement('div');
          summaryGrid.style.display = 'grid';
          summaryGrid.style.gridTemplateColumns = '1fr 1fr';
          summaryGrid.style.gap = '12px';
          
          // LEFT COLUMN: What You Lose
          const lossColumn = document.createElement('div');
          lossColumn.style.padding = '10px';
          lossColumn.style.background = losses.length > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 255, 255, 0.03)';
          lossColumn.style.borderRadius = '8px';
          lossColumn.style.border = losses.length > 0 ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)';
          
          const lossHeader = document.createElement('div');
          lossHeader.style.color = losses.length > 0 ? '#ff6b6b' : 'rgba(255, 255, 255, 0.5)';
          lossHeader.style.fontSize = '9px';
          lossHeader.style.fontWeight = '700';
          lossHeader.style.marginBottom = '8px';
          lossHeader.style.textTransform = 'uppercase';
          lossHeader.style.letterSpacing = '0.5px';
          lossHeader.textContent = '📤 YOU SEND';
          lossColumn.appendChild(lossHeader);
          
          if (losses.length > 0) {
            losses.forEach(loss => {
              const lossItem = document.createElement('div');
              lossItem.style.color = '#fca5a5';
              lossItem.style.fontSize = '10px';
              lossItem.style.marginBottom = '6px';
              lossItem.style.fontWeight = '600';
              lossItem.style.lineHeight = '1.4';
              lossItem.style.wordBreak = 'break-word';
              lossItem.textContent = loss.value.replace('(Estimated Value:', '').replace(')', '');
              lossColumn.appendChild(lossItem);
              
              // Add NFT image if exists
              if (loss.image) {
                const miniImg = document.createElement('img');
                miniImg.src = loss.image;
                miniImg.style.width = '60px';
                miniImg.style.height = '60px';
                miniImg.style.borderRadius = '6px';
                miniImg.style.marginTop = '6px';
                miniImg.style.border = '1px solid rgba(255, 255, 255, 0.2)';
                miniImg.style.objectFit = 'cover';
                miniImg.onerror = () => { miniImg.style.display = 'none'; };
                lossColumn.appendChild(miniImg);
              }
            });
          } else {
            const noLoss = document.createElement('div');
            noLoss.style.color = 'rgba(255, 255, 255, 0.4)';
            noLoss.style.fontSize = '9px';
            noLoss.style.fontStyle = 'italic';
            noLoss.textContent = 'Nothing';
            lossColumn.appendChild(noLoss);
          }
          
          summaryGrid.appendChild(lossColumn);
          
          // RIGHT COLUMN: What You Gain
          const gainColumn = document.createElement('div');
          gainColumn.style.padding = '10px';
          gainColumn.style.background = gains.length > 0 ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255, 255, 255, 0.03)';
          gainColumn.style.borderRadius = '8px';
          gainColumn.style.border = gains.length > 0 ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)';
          
          const gainHeader = document.createElement('div');
          gainHeader.style.color = gains.length > 0 ? '#86efac' : 'rgba(255, 255, 255, 0.5)';
          gainHeader.style.fontSize = '9px';
          gainHeader.style.fontWeight = '700';
          gainHeader.style.marginBottom = '8px';
          gainHeader.style.textTransform = 'uppercase';
          gainHeader.style.letterSpacing = '0.5px';
          gainHeader.textContent = '📥 YOU RECEIVE';
          gainColumn.appendChild(gainHeader);
          
          if (gains.length > 0) {
            gains.forEach(gain => {
              const gainItem = document.createElement('div');
              gainItem.style.color = '#86efac';
              gainItem.style.fontSize = '10px';
              gainItem.style.marginBottom = '6px';
              gainItem.style.fontWeight = '600';
              gainItem.style.lineHeight = '1.4';
              gainItem.style.wordBreak = 'break-word';
              gainItem.textContent = gain.value.replace('(Estimated Value:', '').replace(')', '');
              gainColumn.appendChild(gainItem);
              
              // Add NFT image if exists
              if (gain.image) {
                const miniImg = document.createElement('img');
                miniImg.src = gain.image;
                miniImg.style.width = '60px';
                miniImg.style.height = '60px';
                miniImg.style.borderRadius = '6px';
                miniImg.style.marginTop = '6px';
                miniImg.style.border = '1px solid rgba(255, 255, 255, 0.2)';
                miniImg.style.objectFit = 'cover';
                miniImg.onerror = () => { miniImg.style.display = 'none'; };
                gainColumn.appendChild(miniImg);
              }
            });
          } else {
            const noGain = document.createElement('div');
            noGain.style.color = 'rgba(255, 255, 255, 0.4)';
            noGain.style.fontSize = '9px';
            noGain.style.fontStyle = 'italic';
            noGain.textContent = 'Nothing';
            gainColumn.appendChild(noGain);
          }
          
          summaryGrid.appendChild(gainColumn);
          summarySection.appendChild(summaryGrid);
          simulationSummaryEl.appendChild(summarySection);
        }
      }
      
      // Add a header for decoded action section
      const sectionHeader = document.createElement('div');
      sectionHeader.style.color = 'rgba(255, 255, 255, 0.5)';
      sectionHeader.style.fontSize = '9px';
      sectionHeader.style.fontWeight = '700';
      sectionHeader.style.textTransform = 'uppercase';
      sectionHeader.style.letterSpacing = '1px';
      sectionHeader.style.marginBottom = '8px';
      sectionHeader.textContent = 'DECODED TRANSACTION';
      simulationSummaryEl.appendChild(sectionHeader);
      
      const actionTitle = document.createElement('div');
      actionTitle.style.color = '#00f0ff';
      actionTitle.style.fontWeight = '700';
      actionTitle.style.marginBottom = '8px';
      actionTitle.style.fontSize = '11px';
      actionTitle.style.textTransform = 'uppercase';
      actionTitle.style.letterSpacing = '0.4px';
      actionTitle.innerHTML = `Action: <span style="color: rgba(255, 255, 255, 0.9); text-transform: none;">${simulation.name}</span>`;
      simulationSummaryEl.appendChild(actionTitle);

      // Show decoded parameters / Loss Events
      if (simulation.params && simulation.params.length > 0) {
        simulation.params.forEach(p => {
          const row = document.createElement('div');
          row.className = 'detail-row';
          row.style.marginBottom = '12px';
          row.style.padding = '12px';
          row.style.background = p.type === '🔴 LOSS' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255, 255, 255, 0.03)';
          row.style.borderRadius = '10px';
          row.style.border = p.type === '🔴 LOSS' ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(255, 255, 255, 0.05)';
          
          // Use a table/grid approach for better visual alignment of key data
          const pType = p.type === 'LOSS' ? `<span style="color: #ff6b6b; font-weight: 700; font-size: 10px;">LOSS</span>` : 
                       p.type === 'SELF-TRANSFER' ? `<span style="color: #22c55e; font-weight: 700; font-size: 10px;">SELF-TRANSFER</span>` :
                       `<span style="color: rgba(255, 255, 255, 0.6); font-weight: 600; font-size: 9px; text-transform: uppercase; letter-spacing: 0.4px;">${p.type.replace(/[^\x20-\x7E]/g, '')}</span>`;
          
          row.innerHTML = `<div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: ${p.image ? '6px' : '0'};">
              <span style="flex-shrink: 0; min-width: 80px;">${pType}</span>
              <span style="color: ${p.type === 'LOSS' ? '#ff6b6b' : p.type === 'SELF-TRANSFER' ? '#86efac' : 'rgba(255, 255, 255, 0.9)'}; text-align: right; font-weight: ${p.type === 'LOSS' ? '700' : '600'}; font-size: 10px; word-break: break-word; flex: 1;">${p.value}</span>
            </div>`;

          // IMAGE (If exists - for NFTs) - Positioned below the text
          if (p.image) {
            const imgContainer = document.createElement('div');
            imgContainer.style.marginTop = '6px';
            imgContainer.style.textAlign = 'center';
            
            const img = document.createElement('img');
            img.src = p.image;
            img.style.width = '100%';
            img.style.maxWidth = '120px'; 
            img.style.height = 'auto';
            img.style.display = 'block';
            img.style.margin = '0 auto';
            img.style.borderRadius = '8px';
            img.style.border = '2px solid rgba(255, 255, 255, 0.15)';
            img.style.objectFit = 'cover';
            img.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.3)';
            
            img.onerror = () => { 
              console.warn('[SAFE GUARD] Failed to load NFT image:', p.image);
              imgContainer.innerHTML = '<div style="color: rgba(255,255,255,0.4); font-size: 9px; padding: 8px;">🖼️ Image unavailable</div>'; 
            };
            
            img.onload = () => {
              console.debug('[SAFE GUARD] NFT image loaded successfully');
            };
            
            imgContainer.appendChild(img);
            row.appendChild(imgContainer);
          }
          
          simulationSummaryEl.appendChild(row);
        });
      }
      
      // Show method ID 
      if (simulation.methodId) {
        const methodRow = document.createElement('div');
        methodRow.className = 'detail-row';
        methodRow.style.fontSize = '9px';
        methodRow.style.color = '#666';
        methodRow.style.marginTop = '8px';
        methodRow.innerHTML = `<span class="detail-label">Method ID:</span> ${simulation.methodId}`;
        simulationSummaryEl.appendChild(methodRow);
      }
    } else {
      // Hide the simulation summary if no data
      simulationSummaryEl.style.display = 'none';
    }
  }

  // Hide buttons if request is expired
  if (isExpired) {
    if (buttons) buttons.style.display = 'none';
      detailsEl.innerHTML += '<div class="detail-row" style="color: #f59e0b; margin-top: 10px; padding: 12px; background: rgba(245, 158, 11, 0.1); border-radius: 8px; border: 1px solid rgba(245, 158, 11, 0.2); font-weight: 600;">This request has expired. Please try again.</div>';
    // Clear expired request
    chrome.storage.local.remove('currentRequest');
    return;
  }

  // Update button labels based on risk level for clarity
  const btnReject = document.getElementById('btnReject');
  const btnApprove = document.getElementById('btnApprove');
  
  // Setup button handlers function (defined before use)
  function setupButtons(rejectBtn, approveBtn, reqId, tabId) {
    if (approveBtn) {
      approveBtn.onclick = async () => {
        try {
          await chrome.runtime.sendMessage({
            type: 'USER_DECISION',
            reqId,
            approved: true,
            tabId
          });
          window.close();
        } catch (e) {
          // Only log unexpected errors (connection issues are common during extension reload)
          if (e.message && !e.message.includes('Could not establish connection') && !e.message.includes('Extension context invalidated')) {
            console.debug('[SAFE GUARD] Approval send error:', e.message);
          }
          // Always try to close the window
          try {
            window.close();
          } catch (closeErr) {
            // Window might already be closed
          }
        }
      };
    }
    
    if (rejectBtn) {
      rejectBtn.onclick = async () => {
        try {
          await chrome.runtime.sendMessage({
            type: 'USER_DECISION',
            reqId,
            approved: false,
            tabId
          });
          window.close();
        } catch (e) {
          // Only log unexpected errors (connection issues are common during extension reload)
          if (e.message && !e.message.includes('Could not establish connection') && !e.message.includes('Extension context invalidated')) {
            console.debug('[SAFE GUARD] Rejection send error:', e.message);
          }
          // Always try to close the window
          try {
            window.close();
          } catch (closeErr) {
            // Window might already be closed
          }
        }
      };
    }
  }
  
  // Ensure buttons exist before proceeding
  if (!btnReject || !btnApprove) {
    console.error('[SAFE GUARD] Buttons not found in DOM. Retrying...');
    // Retry after a short delay in case DOM isn't ready
    setTimeout(() => {
      const retryReject = document.getElementById('btnReject');
      const retryApprove = document.getElementById('btnApprove');
      const retryButtons = document.querySelector('.buttons');
      if (retryReject && retryApprove) {
        if (retryButtons) retryButtons.style.display = 'flex';
        setupButtons(retryReject, retryApprove, reqId, tabId);
        // Also update button text
        retryReject.textContent = 'Block';
        retryApprove.textContent = 'Continue';
      }
    }, 100);
    return;
  }
  
  // Ensure buttons are visible
  if (buttons) {
    buttons.style.display = 'flex';
  }

  // Get recipient address for button display
  const recipient = spenderAddress;
  const shortRecipient = recipient ? `${recipient.slice(0, 6)}...${recipient.slice(-4)}` : 'UNKNOWN';

  // Custom logic for button text based on derived risk title
  // SIMPLE, CONSISTENT BUTTON TEXT FOR ALL CASES
  if (title && title.includes('🛑 BLOCKED')) {
    // CRITICAL: Blocklist match - Make block button SUPER prominent
    btnReject.textContent = 'Block';
    btnReject.className = 'btn-critical-block';
    btnApprove.textContent = 'Continue';
    btnApprove.className = 'btn-approve';
  } else if (title === 'TRANSACTION WILL FAIL' || risk === 'CRITICAL') {
    // Guaranteed failure or major drainer attack
    btnReject.textContent = 'Block';
    btnApprove.textContent = 'Continue';
  } else if (title === 'SELF-TRANSFER CONFIRMATION') {
    // Self-transfer is SAFE
    btnReject.textContent = 'Block';
    btnApprove.textContent = 'Continue';
    riskBox.className = 'risk-box safe';
  } else if (title === 'EXTERNAL TRANSFER CONFIRMATION') {
    // External transfer is MEDIUM RISK
    btnReject.textContent = 'Block';
    btnApprove.textContent = 'Continue';
    riskBox.className = 'risk-box medium';
  } else if (title === 'SECURITY BLIND SPOT') {
    // Simulation failed, proceed with caution
    btnReject.textContent = 'Block';
    btnApprove.textContent = 'Continue';
  } else {
    // Default safe action
    btnReject.textContent = 'Block';
    btnApprove.textContent = 'Continue';
  }

  // Setup button handlers
  setupButtons(btnReject, btnApprove, reqId, tabId);
});

