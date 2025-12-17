// decoder.js - Decodes transaction data locally

// Common signatures (The "DNA" of transactions)
const SIGNATURES = {
  // ERC-20 Token Methods
  '0xa9059cbb': { name: 'transfer', params: ['address', 'uint256'] },
  '0x23b872dd': { name: 'transferFrom', params: ['address', 'address', 'uint256'] },
  '0x095ea7b3': { name: 'approve', params: ['address', 'uint256'] },
  
  // ERC-721 NFT Methods
  '0x42842e0e': { name: 'safeTransferFrom', params: ['address', 'address', 'uint256'] },
  '0xb88d4fde': { name: 'safeTransferFrom', params: ['address', 'address', 'uint256', 'bytes'] }, // With data
  '0xa22cb465': { name: 'setApprovalForAll', params: ['address', 'bool'] },
  
  // OpenSea / Marketplace Methods
  '0xfb0f3ee1': { name: 'atomicMatch_', params: ['address[]', 'uint256[]', 'uint256[]', 'uint256', 'bytes', 'bytes', 'bytes', 'bytes', 'bytes', 'uint8[]', 'bytes32[]', 'bytes32[]'] }, // OpenSea Wyvern
  '0xab834bab': { name: 'atomicMatch_', params: ['address[]', 'uint256[]', 'uint256[]', 'uint256', 'bytes', 'bytes', 'bytes', 'bytes', 'bytes', 'uint8[]', 'bytes32[]', 'bytes32[]'] }, // OpenSea v1
  '0x0d98fc9e': { name: 'fulfillBasicOrder', params: ['tuple'] }, // Seaport basic
  '0xe7acab24': { name: 'fulfillOrder', params: ['tuple', 'bytes32'] }, // Seaport standard
  '0x00000000': { name: 'fulfillAvailableOrders', params: ['tuple[]', 'tuple[]', 'tuple[]', 'address', 'uint256'] }, // Seaport advanced
  
  // DEX Swap Methods  
  '0x7c025200': { name: 'swap', params: ['uint256', 'uint256', 'address', 'bytes'] }, // Uniswap
  '0x38ed1739': { name: 'swapExactTokensForTokens', params: ['uint256', 'uint256', 'address[]', 'address', 'uint256'] }, // Uniswap V2
  '0x8803dbee': { name: 'swapTokensForExactTokens', params: ['uint256', 'uint256', 'address[]', 'address', 'uint256'] },
  '0x18cbafe5': { name: 'swapExactTokensForETH', params: ['uint256', 'uint256', 'address[]', 'address', 'uint256'] },
  '0x7ff36ab5': { name: 'swapExactETHForTokens', params: ['uint256', 'address[]', 'address', 'uint256'] },
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



