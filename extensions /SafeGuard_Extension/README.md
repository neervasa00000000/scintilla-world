# SafeGuard - Web3 Transaction Security Extension

**Version:** 0.0.1  
**Type:** Chrome/Brave Browser Extension  
**Purpose:** Real-time Web3 transaction analysis and protection against scams, drainers, and malicious contracts

---

## 🛡️ Features

### Core Security Features
- **Real-time Transaction Analysis** - Intercepts and analyzes all Web3 transactions before execution
- **Malicious Contract Blocklist** - Automatically blocks known scam contracts and drainers
- **Transaction Simulation** - Shows exactly what assets you'll send/receive before confirming
- **NFT Visual Preview** - Displays NFT images and metadata in transaction confirmations
- **Price Impact Detection** - Warns about high slippage and honeypot tokens
- **Phishing Domain Protection** - Blocks known phishing websites and typosquatting domains
- **Approval Monitoring** - Warns about unlimited token approvals and dangerous permissions

### Multi-Chain Support
- Ethereum Mainnet
- Base (Coinbase L2)
- Arbitrum One
- Polygon

### Advanced Detection
- **Honeypot Detection** - Identifies tokens that can't be sold
- **Proxy Contract Analysis** - Detects hidden implementation contracts
- **Gas Limit Warnings** - Flags suspicious gas limits
- **Domain Age Checking** - Warns about newly registered domains
- **High Entropy Detection** - Identifies randomly generated phishing domains

---

## 📦 Installation

### Method 1: Load Unpacked Extension (Developer Mode)

1. **Open Chrome/Brave Extensions Page**
   - Navigate to `chrome://extensions/`
   - Or click Menu → Extensions → Manage Extensions

2. **Enable Developer Mode**
   - Toggle the "Developer mode" switch in the top right corner

3. **Load the Extension**
   - Click "Load unpacked"
   - Select the `SafeGuard_Extension` folder
   - The extension should now appear in your extensions list

4. **Verify Installation**
   - Look for the SafeGuard icon in your browser toolbar
   - The extension is now active and monitoring Web3 transactions

### Method 2: Install from ZIP

1. Extract the `SafeGuard-v0.0.1.zip` file
2. Follow steps from Method 1 above

---

## 🚀 Usage

### Basic Operation

1. **Connect Your Wallet**
   - SafeGuard works automatically with MetaMask, Coinbase Wallet, and other Web3 wallets
   - No configuration needed - it starts protecting you immediately

2. **Transaction Interception**
   - When you attempt a transaction, SafeGuard will automatically analyze it
   - A popup window will appear showing:
     - Risk level (SAFE, MEDIUM, HIGH, CRITICAL)
     - What assets you're sending
     - What assets you're receiving
     - Contract addresses involved
     - Detailed warnings and recommendations

3. **Making Decisions**
   - **Block** - Reject the transaction (recommended for high-risk transactions)
   - **Continue** - Proceed with the transaction (only if you trust the source)

### Understanding Risk Levels

- 🟢 **SAFE** - Transaction appears legitimate, minimal risk detected
- 🟡 **MEDIUM** - Some warnings present, review carefully before proceeding
- 🟠 **HIGH** - Significant risk factors detected, proceed with extreme caution
- 🔴 **CRITICAL** - Known malicious contract or drainer detected, DO NOT PROCEED

### What SafeGuard Shows You

**For Token/NFT Transfers:**
- Asset name and amount
- Recipient address
- USD value estimate (when available)
- NFT preview images

**For Token Approvals:**
- Spender address (who can take your tokens)
- Approval amount (warns about unlimited approvals)
- Contract reputation check

**For Swaps:**
- Tokens being exchanged
- Price impact percentage
- Slippage warnings

---

## 🔧 Technical Details

### File Structure

```
SafeGuard_Extension/
├── manifest.json           # Extension configuration
├── background.js          # Service worker (main logic)
├── contentScript.js       # Page injection handler
├── inpage.js             # Web3 provider interceptor
├── popup.html            # Transaction UI
├── popup.js              # Transaction UI logic
├── blocked.html          # Phishing block page
├── honeypot.js           # Transaction analysis engine
├── blocklist.js          # Malicious contract database
├── decoder.js            # Transaction decoder
├── rpcSwarm.js           # Multi-RPC request handler
├── priceEngine.js        # Token price fetcher
├── chains.js             # Multi-chain configuration
├── 11.png                # Extension logo
└── icons/                # Extension icons
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

### Key Components

**Background Service Worker**
- Manages transaction interception
- Coordinates analysis and user prompts
- Handles phishing domain detection
- Updates malicious contract blocklist

**Transaction Analysis Engine (honeypot.js)**
- Decodes transaction data
- Simulates transaction execution
- Extracts asset movements
- Calculates price impact
- Checks contract blocklists

**RPC Swarm (rpcSwarm.js)**
- Races multiple RPC endpoints for speed
- Automatic failover for reliability
- Supports tracing and simulation
- Multi-chain compatible

**Price Engine (priceEngine.js)**
- Fetches real-time token prices
- Uses DexScreener, Binance, and on-chain quoters
- Caches prices for performance
- Calculates USD values

---

## 🔒 Privacy & Security

### What SafeGuard Does
- ✅ Analyzes transactions locally when possible
- ✅ Uses public RPC endpoints (no API keys required)
- ✅ Checks community-maintained blocklists
- ✅ Fetches token prices from public APIs

### What SafeGuard Does NOT Do
- ❌ Collect or store your private keys
- ❌ Track your browsing history
- ❌ Send your transaction data to third parties
- ❌ Require account creation or login

### Network Requests
SafeGuard makes requests to:
- Public Ethereum RPC nodes (for transaction simulation)
- DexScreener API (for token prices)
- Binance API (for ETH price)
- GitHub (for blocklist updates)
- MetaMask phishing list (for domain protection)

All requests are made directly from your browser - no intermediary servers.

---

## ⚠️ Important Notes

### Limitations
- **Not 100% Foolproof** - Always verify transactions manually
- **Network Dependent** - Requires internet connection for analysis
- **RPC Limitations** - Some features may fail if RPC nodes are down
- **Price Accuracy** - Token prices are estimates and may not be exact

### Best Practices
1. **Always verify recipient addresses** - Even if SafeGuard says it's safe
2. **Never approve unlimited token amounts** - Unless you fully trust the contract
3. **Be cautious with new tokens** - Low liquidity tokens may have inaccurate prices
4. **Keep the extension updated** - Blocklists and features improve over time
5. **Use hardware wallets** - For additional security layer

---

## 🐛 Troubleshooting

### Extension Not Working
1. Refresh the page after installing the extension
2. Make sure Developer Mode is enabled
3. Check for console errors (F12 → Console tab)
4. Try reloading the extension from `chrome://extensions/`

### Popup Not Appearing
1. Check if popup blockers are disabled
2. Verify the extension has proper permissions
3. Look for the SafeGuard window in your taskbar (it may open behind other windows)

### Transaction Analysis Failed
- This usually means RPC nodes are congested or down
- You can still proceed, but do so with extra caution
- Try again in a few moments

### False Positives
- If SafeGuard blocks a legitimate site, you can report it
- Some new contracts may trigger warnings even if legitimate
- Use your judgment and research the project before proceeding

---

## 🔄 Updates & Maintenance

### Automatic Updates
- Malicious contract blocklist updates every 3 hours
- Phishing domain list updates every 1 hour
- Extension code updates require manual reinstallation (for now)

### Manual Updates
1. Download the latest version
2. Remove the old extension from `chrome://extensions/`
3. Load the new version using "Load unpacked"

---

## 📝 Version History

### v0.0.1 (Initial Release)
- Core transaction interception and analysis
- Multi-chain support (Ethereum, Base, Arbitrum, Polygon)
- Malicious contract blocklist
- Phishing domain protection
- Transaction simulation and asset preview
- NFT image display
- Price impact detection
- Token approval warnings

---

## 🤝 Contributing

This is an open-source security tool. Contributions are welcome!

### Ways to Help
- Report bugs and false positives
- Suggest new features
- Submit malicious contract addresses
- Improve documentation
- Add support for more chains

---

## ⚖️ License

This extension is provided as-is for educational and security purposes.

**Disclaimer:** SafeGuard is a security tool designed to help protect users, but it cannot guarantee 100% protection. Users are responsible for their own transaction decisions. The developers are not liable for any losses incurred while using this extension.

---

## 📧 Support

For issues, questions, or suggestions:
- Open an issue on the project repository
- Review the troubleshooting section above
- Check console logs for detailed error messages

---

## 🙏 Acknowledgments

SafeGuard uses data from:
- MetaMask Phishing List
- CryptoScamDB
- DexScreener API
- Community-maintained blocklists

Special thanks to the Web3 security community for their ongoing efforts to protect users.

---

**Stay Safe! 🛡️**

