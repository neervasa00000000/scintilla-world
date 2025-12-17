// decoder.js - Decodes transaction data locally

// Common signatures (The "DNA" of transactions)
const SIGNATURES = {
  '0xa9059cbb': { name: 'transfer', params: ['address', 'uint256'] },
  '0x23b872dd': { name: 'transferFrom', params: ['address', 'address', 'uint256'] },
  '0x095ea7b3': { name: 'approve', params: ['address', 'uint256'] },
  '0x42842e0e': { name: 'safeTransferFrom', params: ['address', 'address', 'uint256'] },
  // ENHANCEMENT: Added setApprovalForAll (ERC-721/1155) - Critical for Drainers
  '0xa22cb465': { name: 'setApprovalForAll', params: ['address', 'bool'] },
  '0x7c025200': { name: 'swap', params: ['uint256', 'uint256', 'address', 'bytes'] }, // Uniswap
  '0xfb0f3ee1': { name: 'swapExactTokensForTokens', params: ['uint256', 'uint256', 'address[]', 'address', 'uint256'] }, // Common DEX V2 Swap
};

export function decodeTransaction(data) {
  if (!data || data === '0x') return { name: 'Transfer ETH', params: [] };

  const methodId = data.slice(0, 10); // First 4 bytes (0x + 8 chars)
  const definition = SIGNATURES[methodId];

  if (!definition) {
    return { name: 'Unknown Function', params: [], methodId };
  }

  // Basic Parameter Decoding (Slicing the hex string)
  const rawParams = data.slice(10);
  const decodedParams = [];

  for (let i = 0; i < definition.params.length; i++) {
    const chunk = rawParams.slice(i * 64, (i + 1) * 64);
    let value = '0x' + chunk;
    
    // Format addresses nicely
    if (definition.params[i] === 'address') {
      value = '0x' + chunk.slice(24);
    }
    // Format numbers
    if (definition.params[i] === 'uint256') {
      // Use BigInt for accurate unlimited approval detection later
      value = '0x' + chunk;
    }
    // Format booleans
    if (definition.params[i] === 'bool') {
      value = (parseInt(chunk, 16) === 1);
    }
    
    decodedParams.push({ type: definition.params[i], value });
  }

  return { name: definition.name, params: decodedParams, methodId };
}



