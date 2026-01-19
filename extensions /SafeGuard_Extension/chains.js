// chains.js
export const CHAINS = {
  // Ethereum Mainnet
  '0x1': {
    name: 'Ethereum',
    rpc: 'https://eth.llamarpc.com', // Primary RPC
    quoter: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
    weth: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    stable: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
    nativeSymbol: 'ETH'
  },
  // Base (Coinbase L2)
  '0x2105': {
    name: 'Base',
    rpc: 'https://mainnet.base.org',
    quoter: '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a',
    weth: '0x4200000000000000000000000000000000000006', // WETH on Base
    stable: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC on Base
    nativeSymbol: 'ETH'
  },
  // Arbitrum One
  '0xa4b1': {
    name: 'Arbitrum',
    rpc: 'https://arb1.arbitrum.io/rpc',
    quoter: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6',
    weth: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    stable: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', // USDC
    nativeSymbol: 'ETH'
  },
  // Polygon
  '0x89': {
    name: 'Polygon',
    rpc: 'https://polygon-rpc.com',
    quoter: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e', // Check specific deployment
    weth: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', // WMATIC
    stable: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // USDC
    nativeSymbol: 'MATIC'
  }
};

export function getChainConfig(chainIdHex) {
  return CHAINS[chainIdHex] || CHAINS['0x1']; // Default to Mainnet
}











