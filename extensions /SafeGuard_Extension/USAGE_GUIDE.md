# SafeGuard Extension - Complete Usage Guide

## 📖 Table of Contents
1. [Getting Started](#getting-started)
2. [Understanding the Interface](#understanding-the-interface)
3. [Transaction Types](#transaction-types)
4. [Risk Levels Explained](#risk-levels-explained)
5. [Common Scenarios](#common-scenarios)
6. [Advanced Features](#advanced-features)
7. [Best Practices](#best-practices)

---

## 🚀 Getting Started

### First Time Setup
After installing SafeGuard, it will automatically start monitoring your Web3 transactions. No configuration needed!

### How It Works
1. You initiate a transaction on any Web3 site (Uniswap, OpenSea, etc.)
2. SafeGuard intercepts the transaction **before** it reaches your wallet
3. A popup window appears showing detailed analysis
4. You decide: **Block** (reject) or **Continue** (approve)

---

## 🎨 Understanding the Interface

### Popup Window Components

#### 1. Header Section
```
SAFE GUARD [Network Name]
Transaction Analysis
```
- Shows which blockchain network you're on (Ethereum, Base, Arbitrum, Polygon)
- Always visible at the top

#### 2. Risk Status Box
- **Color-coded** based on threat level:
  - 🟢 Green = SAFE
  - 🟡 Yellow = MEDIUM RISK
  - 🟠 Orange = HIGH RISK
  - 🔴 Red = CRITICAL DANGER

#### 3. Transaction Summary
Shows what's happening in plain English:
- "Sending Transaction to 0x1234..."
- "Wallet Connection Request"
- "Signature Request"
- "Token Approval"

#### 4. Warnings Section
Lists all detected risks:
- Unlimited token approvals
- High gas limits
- Suspicious contract patterns
- Known malicious addresses

#### 5. Transaction Direction Box
Visual display of what you're sending/receiving:

**📤 LEAVING YOUR WALLET**
- Shows assets being sent
- Displays amounts and USD values
- Lists recipient addresses

**📥 COMING TO YOUR WALLET**
- Shows assets being received
- Displays amounts and USD values
- Shows NFT images if applicable

#### 6. Details Section
Technical information:
- Contract addresses
- Spender addresses (for approvals)
- Transaction value (ETH/native token)
- Gas limit
- Transaction data size

#### 7. Action Buttons
- **Block** (Red) - Reject the transaction
- **Continue** (Blue) - Approve and proceed

---

## 📝 Transaction Types

### 1. Token Transfers
**What it is:** Sending tokens from your wallet to another address

**What SafeGuard Shows:**
- Token name and amount
- Recipient address
- USD value estimate
- Whether it's a self-transfer or external transfer

**Example:**
```
📤 LEAVING YOUR WALLET
• 100 USDC ($100.00)

📍 Recipient: 0x1234...5678
```

### 2. NFT Transfers
**What it is:** Sending an NFT to another wallet

**What SafeGuard Shows:**
- NFT collection name
- Token ID
- NFT image preview
- Recipient address
- Estimated value (if available)

**Example:**
```
📤 LEAVING YOUR WALLET
• Bored Ape #1234 (~$50,000)
[NFT Image Preview]

📍 Recipient: 0xabcd...ef12
```

### 3. Token Approvals
**What it is:** Giving a contract permission to spend your tokens

**What SafeGuard Shows:**
- Token being approved
- Spender address (who can take your tokens)
- Approval amount
- ⚠️ Warning if unlimited approval

**Example:**
```
⚠️ TOKEN APPROVAL REQUEST

You are granting spending allowance for USDC

Spender: 0x1234...5678

CRITICAL: Unlimited allowance granted.
The spender can take ALL your tokens.
```

### 4. NFT Approvals (setApprovalForAll)
**What it is:** Giving a contract permission to transfer ALL your NFTs

**What SafeGuard Shows:**
- Collection being approved
- Operator address
- ⚠️ Critical warning about full access

**Example:**
```
🔴 CRITICAL: NFT/ASSET FULL ACCESS GRANT

You are granting FULL, UNLIMITED ACCESS to ALL
your NFTs/Assets (ERC-721/1155) to:

Spender: 0x1234...5678
```

### 5. Swaps/Trades
**What it is:** Exchanging one token for another (on DEXs like Uniswap)

**What SafeGuard Shows:**
- Tokens being exchanged
- Amounts and USD values
- Price impact percentage
- Slippage warnings

**Example:**
```
🔄 SWAP / TRADE

📤 LEAVING YOUR WALLET
• 1.0 ETH ($3,000)

📥 COMING TO YOUR WALLET
• 3,000 USDC ($3,000)

Price Impact: 0.5%
```

### 6. Signature Requests
**What it is:** Signing a message (doesn't spend tokens, but can be dangerous)

**What SafeGuard Shows:**
- Requesting website
- Message content (decoded)
- Type of signature (personal_sign, typed data, etc.)

**Example:**
```
📝 SIGNATURE REQUEST

🌐 Requesting Site: app.uniswap.org

Message to Sign:
"Welcome to Uniswap!
Click to sign in and accept the Terms of Service."
```

### 7. Wallet Connection
**What it is:** A website wants to see your wallet address

**What SafeGuard Shows:**
- Requesting website
- What they can see (just your address, not your funds)

**Example:**
```
🟢 WALLET CONNECT

Site wants to view your address.

🌐 Requesting Site: opensea.io

This is generally safe - they can only see
your public address, not access your funds.
```

---

## ⚠️ Risk Levels Explained

### 🟢 SAFE / LOW RISK
**What it means:**
- No obvious red flags detected
- Transaction appears legitimate
- Standard operation

**Should I proceed?**
- Usually safe, but still verify manually
- Check the recipient address
- Make sure the amounts are correct

**Examples:**
- Connecting wallet to known sites
- Self-transfers between your wallets
- Receiving tokens/NFTs

---

### 🟡 MEDIUM RISK
**What it means:**
- Some warnings present
- Requires careful review
- Not necessarily malicious, but be cautious

**Should I proceed?**
- Review all details carefully
- Verify the recipient/contract address
- Make sure you trust the website
- Check if amounts are correct

**Examples:**
- Sending tokens to external addresses
- Approving known contracts (like Uniswap)
- Signing messages on trusted sites

---

### 🟠 HIGH RISK
**What it means:**
- Significant risk factors detected
- Unusual patterns or suspicious behavior
- Proceed with extreme caution

**Should I proceed?**
- Only if you're 100% sure about what you're doing
- Double-check everything
- Research the contract/address first
- Consider waiting and investigating further

**Examples:**
- High gas limits (potential forced execution)
- Extreme price slippage (>20%)
- Newly registered domains
- Unusual contract patterns

---

### 🔴 CRITICAL DANGER
**What it means:**
- Known malicious contract detected
- Guaranteed transaction failure
- Drainer or scam pattern identified
- Blocklisted address

**Should I proceed?**
- **NO! Block the transaction immediately**
- This is a confirmed threat
- Proceeding will likely result in loss of funds

**Examples:**
- Blocklisted contracts (known scams)
- Unlimited NFT approvals to unknown addresses
- Permit signatures (offline drainers)
- Transactions that will definitely fail

---

## 🎯 Common Scenarios

### Scenario 1: Buying an NFT on OpenSea
**What you'll see:**
```
🔄 SWAP / TRADE

📤 LEAVING YOUR WALLET
• 0.5 ETH ($1,500)

📥 COMING TO YOUR WALLET
• Bored Ape #1234
[NFT Image]

📍 Contract: 0x... (OpenSea Seaport)

Risk: MEDIUM
```

**What to do:**
1. ✅ Verify the NFT image matches what you want to buy
2. ✅ Check the price is correct (0.5 ETH)
3. ✅ Make sure the contract is OpenSea's official contract
4. ✅ If everything looks good, click **Continue**

---

### Scenario 2: Swapping on Uniswap
**What you'll see:**
```
🔄 SWAP / TRADE

📤 LEAVING YOUR WALLET
• 1.0 ETH ($3,000)

📥 COMING TO YOUR WALLET
• 2,950 USDC ($2,950)

Price Impact: 1.7%

Risk: MEDIUM
```

**What to do:**
1. ✅ Verify you're swapping the correct tokens
2. ✅ Check the amounts match what you expected
3. ⚠️ Note the price impact (1.7% is reasonable)
4. ✅ If you're happy with the trade, click **Continue**

---

### Scenario 3: Approving Uniswap to Spend USDC
**What you'll see:**
```
⚠️ TOKEN APPROVAL REQUEST

You are granting spending allowance for USDC

Spender: 0x68b3...c7bd (Uniswap Router)

CRITICAL: Unlimited allowance granted.
The spender can take ALL your tokens.

Risk: CRITICAL
```

**What to do:**
1. ⚠️ This is normal for DEX usage, BUT...
2. ✅ Verify the spender is actually Uniswap (check address)
3. ⚠️ Consider approving only the amount you need
4. ✅ If you trust Uniswap, click **Continue**
5. 💡 Pro tip: Use revoke.cash later to remove unused approvals

---

### Scenario 4: Suspicious Airdrop Claim
**What you'll see:**
```
🔴 BLOCKED: MALICIOUS CONTRACT

CRITICAL DANGER: This contract (0x1da5...9b5a)
is on a known blocklist for scams, rugs, or drainers.

DO NOT PROCEED. Your funds are at CRITICAL RISK.

This transaction has been automatically flagged
by community security databases.

Risk: CRITICAL
```

**What to do:**
1. ❌ **DO NOT PROCEED**
2. ❌ Click **Block** immediately
3. ❌ This is a confirmed scam
4. ✅ Report the website to your browser/wallet provider

---

### Scenario 5: Signing a Message
**What you'll see:**
```
📝 SIGNATURE REQUEST

🌐 Requesting Site: app.uniswap.org

Message to Sign:
"Welcome to Uniswap!
Click to sign in and accept the Terms of Service.
https://uniswap.org/terms"

Risk: MEDIUM
```

**What to do:**
1. ✅ Verify the website is legitimate (check URL)
2. ✅ Read the message carefully
3. ⚠️ Make sure it's not asking for token permissions
4. ✅ If it's just a login message, click **Continue**

---

## 🔧 Advanced Features

### Transaction Simulation
SafeGuard simulates your transaction before you approve it, showing:
- Exact asset movements
- Gas consumption
- Contract interactions
- Potential failures

**When simulation fails:**
```
⚠️ SECURITY BLIND SPOT

Warning: simulation failed. The network is too
congested or busy to verify the transaction outcome.

Proceeding is possible, but RISKY.
Transaction outcome is unknown.
```

**What to do:**
- Wait a few minutes and try again
- Check if the network is congested
- Proceed only if you trust the website completely

---

### NFT Image Preview
For NFT transfers, SafeGuard fetches and displays the actual NFT image:
- Helps verify you're buying/selling the right NFT
- Shows metadata (name, collection, token ID)
- Displays estimated value when available

**If image fails to load:**
- The NFT contract might not support metadata
- IPFS gateway might be slow
- Image URL might be invalid
- Transaction is still analyzed, just without the visual

---

### Price Impact Detection
For token swaps, SafeGuard calculates price impact:
- **0-5%** - Normal slippage
- **5-20%** - High slippage (warning)
- **20%+** - Extreme slippage (possible honeypot)

**Example:**
```
HIGH SLIPPAGE: You lose 15.2% of value in this trade.
Possible honeypot or high tax token.
```

---

### Multi-Chain Support
SafeGuard works on multiple blockchains:
- Ethereum Mainnet
- Base (Coinbase L2)
- Arbitrum One
- Polygon

**Network is shown in the header:**
```
SAFE GUARD [Ethereum]
SAFE GUARD [Base]
SAFE GUARD [Arbitrum]
SAFE GUARD [Polygon]
```

---

### Phishing Domain Protection
SafeGuard automatically blocks known phishing websites:
- Checks against MetaMask's phishing list
- Detects typosquatting (fake domains similar to real ones)
- Warns about newly registered domains
- Blocks high-entropy domains (random-looking URLs)

**If a site is blocked:**
```
🛑 PHISHING DETECTED

SAFE GUARD has blocked this website because
it is on a known list of crypto scams.

Visiting this site may result in loss of funds.

[GO BACK TO SAFETY]
```

---

## 💡 Best Practices

### Before Every Transaction

1. **Verify the Website URL**
   - Check for typos (opensea.io vs opensee.io)
   - Look for HTTPS
   - Verify it's the official domain

2. **Read All Warnings**
   - Don't rush through the popup
   - Understand what each warning means
   - When in doubt, research first

3. **Check Addresses**
   - Verify recipient addresses
   - Compare with official sources
   - Use ENS names when possible

4. **Verify Amounts**
   - Make sure token amounts are correct
   - Check USD values make sense
   - Look for decimal place errors

5. **Research Unknown Contracts**
   - Search the contract address on Etherscan
   - Check if it's verified
   - Read the contract's comments/warnings

### Token Approvals

1. **Avoid Unlimited Approvals**
   - Approve only what you need
   - Revoke unused approvals regularly
   - Use revoke.cash to manage approvals

2. **Trust the Spender**
   - Only approve well-known contracts
   - Verify the spender address
   - Research new protocols before approving

3. **Regular Cleanup**
   - Review your approvals monthly
   - Revoke old/unused approvals
   - Keep your wallet clean

### NFT Transactions

1. **Verify the NFT**
   - Check the image matches
   - Verify token ID is correct
   - Confirm collection name

2. **Check Floor Prices**
   - Compare with OpenSea/Blur
   - Make sure price is reasonable
   - Watch for fake collections

3. **Beware of Airdrops**
   - Unsolicited NFTs are often scams
   - Don't interact with random airdrops
   - Research before claiming

### General Security

1. **Use Hardware Wallets**
   - Ledger or Trezor for large amounts
   - Adds extra confirmation layer
   - Protects against malware

2. **Keep Software Updated**
   - Update your browser regularly
   - Keep wallet extensions updated
   - Update SafeGuard when new versions release

3. **Separate Wallets**
   - Use different wallets for different purposes
   - Keep large holdings in cold storage
   - Use a "burner" wallet for risky interactions

4. **Stay Informed**
   - Follow Web3 security accounts
   - Join security-focused communities
   - Learn about new scam patterns

5. **Trust Your Instincts**
   - If something feels wrong, it probably is
   - Don't let FOMO override caution
   - It's better to miss an opportunity than lose funds

---

## 🆘 When Things Go Wrong

### Transaction Stuck/Pending
- SafeGuard doesn't cause stuck transactions
- Check your wallet for pending transactions
- You may need to speed up or cancel in your wallet

### False Positive (Legitimate Transaction Blocked)
- Research the contract thoroughly
- Verify with official sources
- If confirmed safe, you can proceed with caution
- Report false positives to help improve SafeGuard

### Missed a Scam
- SafeGuard can't catch everything
- Report the contract address
- Share with the community
- Learn from the experience

### Lost Funds Despite SafeGuard
- SafeGuard is a tool, not a guarantee
- Document what happened
- Report to relevant authorities
- Share to warn others

---

## 📚 Additional Resources

### Learning Resources
- [Ethereum.org Security Guide](https://ethereum.org/en/security/)
- [MetaMask Security Best Practices](https://metamask.io/security/)
- [Revoke.cash](https://revoke.cash/) - Manage token approvals

### Security Tools
- **Etherscan** - Verify contracts and transactions
- **Revoke.cash** - Revoke token approvals
- **Wallet Guard** - Additional browser protection
- **Fire** - Scam database

### Community
- Follow Web3 security researchers on Twitter
- Join Discord communities focused on security
- Stay updated on latest scam patterns

---

## ✨ Remember

SafeGuard is a powerful tool, but **you** are the final line of defense:
- Always verify transactions manually
- Never rush important decisions
- When in doubt, research first
- It's okay to say no to a transaction

**Stay safe and enjoy Web3! 🛡️**

