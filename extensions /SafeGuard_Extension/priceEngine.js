import { swarmRequest } from './rpcSwarm.js';
import { getChainConfig } from './chains.js';

// Cache prices to save requests (Address -> {price, timestamp})
const PRICE_CACHE = new Map();
const ETH_PRICE_CACHE = { price: 0, timestamp: 0 }; // New dedicated cache

export async function getTokenPrice(tokenAddress, symbol, decimals, chainId = '0x1') {
  const config = getChainConfig(chainId);
  // 1. Check Cache (1 minute valid)
  const cached = PRICE_CACHE.get(tokenAddress.toLowerCase());
  if (cached && (Date.now() - cached.timestamp < 60000)) return cached.price;

  let price = 0;

  // 2. LAYER 1: DexScreener (Best for Meme Coins/Shitcoins)
  // They rate limit per IP. Since every user is their own IP, this scales infinitely.
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`);
    const json = await res.json();
    if (json.pairs && json.pairs.length > 0) {
      price = parseFloat(json.pairs[0].priceUsd);
      if (price > 0) {
        saveCache(tokenAddress, price);
        return price;
      }
    }
  } catch (e) { /* Layer 1 Failed */ }

  // 3. LAYER 2: Binance / CoinGecko (Best for Major Tokens)
  // Quick check for ETH price to use in calculations
  const ethPrice = await getEthPrice();
  
  if (symbol === 'ETH' || symbol === 'WETH') return ethPrice;
  if (symbol === 'USDT' || symbol === 'USDC' || symbol === 'DAI') return 1.0;

  try {
    // ENHANCEMENT: Coingecko API is often rate-limited, removed to rely on local Swarm/DexScreener/Binance
    // const res = await fetch(`https://api.coingecko.com/api/v3/simple/token_price/ethereum?contract_addresses=${tokenAddress}&vs_currencies=usd`);
    // const json = await res.json();
    // const geckoPrice = json[tokenAddress.toLowerCase()]?.usd;
    // if (geckoPrice) {
    //   saveCache(tokenAddress, geckoPrice);
    //   return geckoPrice;
    // }
  } catch (e) { /* Layer 2 Failed */ }

  // 4. LAYER 3: ON-CHAIN QUOTER (The "Nuclear Option")
  // If APIs fail, we ask the Blockchain directly.
  // We check how much WETH we get for 1 Token, then multiply by ETH price.
  try {
    const wethOut = await getUniswapQuote(tokenAddress, config.weth, decimals, 18, config.quoter);
    if (wethOut > 0) {
      price = wethOut * ethPrice;
      saveCache(tokenAddress, price);
      return price;
    }
  } catch (e) { /* Layer 3 Failed */ }

  return 0; // Could not find price
}

// --- HELPER: GET ETH PRICE (FIXED FOR CACHING) ---
async function getEthPrice() {
  // Check Cache (Valid for 60 seconds)
  if (ETH_PRICE_CACHE.price > 0 && (Date.now() - ETH_PRICE_CACHE.timestamp < 60000)) {
    return ETH_PRICE_CACHE.price;
  }
  
  try {
    const res = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT');
    const json = await res.json();
    const price = parseFloat(json.price);
    
    // Update Cache
    if (price > 0) {
      ETH_PRICE_CACHE.price = price;
      ETH_PRICE_CACHE.timestamp = Date.now();
      return price;
    }
    
    // Fallback if API returns garbage
    return 3000;
    
  } catch (e) {
    // Fallback hardcoded if network fails (3000 is still the last resort)
    return ETH_PRICE_CACHE.price > 0 ? ETH_PRICE_CACHE.price : 3000; 
  }
}

// --- HELPER: UNISWAP QUOTER ---
async function getUniswapQuote(tokenIn, tokenOut, decimalsIn, decimalsOut, quoterAddress) {
  // ABI: quoteExactInputSingle(tokenIn, tokenOut, fee, amountIn, sqrtPriceLimitX96)
  // Sig: 0xf7729d43
  
  // Use 1 full token for quote
  const amountScale = BigInt(10) ** BigInt(decimalsIn);
  const hexAmount = amountScale.toString(16).padStart(64, '0');

  // Try 0.3% Fee (Most common) -> 3000 -> 0x0bb8
  // Try 1% Fee (Meme coins) -> 10000 -> 0x2710
  const fees = ['000bb8', '002710']; 

  for (let fee of fees) {
    const payload = '0xf7729d43' + // method
      tokenIn.replace('0x', '').padStart(64, '0').toLowerCase() +
      tokenOut.replace('0x', '').padStart(64, '0').toLowerCase() +
      fee.padStart(64, '0') + 
      hexAmount + 
      '0'.repeat(64); // sqrtPriceLimitX96 (0 = no limit)

    const res = await swarmRequest('eth_call', [{
      to: quoterAddress,
      data: payload
    }, 'latest']);

    if (res && res !== '0x') {
      // Decode Output (uint256 amountOut) - BigInt-safe conversion
      const val = BigInt(res);
      const decimalsOutNum = Number(decimalsOut);
      
      // BigInt-safe conversion: format as string then parse to float
      // This avoids Number.MAX_SAFE_INTEGER limits and precision loss
      let valStr = val.toString().padStart(decimalsOutNum + 1, '0');
      const index = valStr.length - decimalsOutNum;
      const formatted = valStr.slice(0, index) + '.' + valStr.slice(index);
      return parseFloat(formatted);
    }
  }
  return 0;
}

function saveCache(addr, price) {
  PRICE_CACHE.set(addr.toLowerCase(), { price, timestamp: Date.now() });
}

// ENHANCEMENT: Export this helper so honeypot.js can use it for price impact/slippage check
export function formatBigIntTokenValue(value, decimals) {
  if (decimals === 0) return Number(value);
  const decimalsNum = Number(decimals);
  
  let valueStr = value.toString();
  
  // Pad value string if it's shorter than the number of decimals
  if (valueStr.length <= decimalsNum) {
    valueStr = valueStr.padStart(decimalsNum + 1, '0');
  }
  
  // Insert decimal point
  const index = valueStr.length - decimalsNum;
  const result = valueStr.slice(0, index) + '.' + valueStr.slice(index);
  
  // FIX: Handle scientific notation / precision issues by using a proper BigInt to Float conversion
  // We use this string formatting approach which is safe for display
  return parseFloat(result);
}

