// Block The Buy - Universal Content Script
// Blocks ALL purchases, subscriptions, and checkouts with 24-hour countdown

const HOURLY_WAGE = 30; // Average Australian wage
const BLOCK_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// Universal button selectors - catches everything
const UNIVERSAL_BUTTON_SELECTORS = [
  // Buy buttons
  'button[class*="buy"]',
  'button[class*="purchase"]',
  'button[class*="checkout"]',
  'button[class*="add-to-cart"]',
  'button[class*="addtocart"]',
  'button[id*="buy"]',
  'button[id*="purchase"]',
  'button[id*="checkout"]',
  'button[id*="add-to-cart"]',
  'a[class*="buy"]',
  'a[class*="purchase"]',
  'a[class*="checkout"]',
  'a[id*="buy"]',
  'a[id*="purchase"]',
  'input[type="submit"][value*="Buy"]',
  'input[type="submit"][value*="Purchase"]',
  'input[type="submit"][value*="Checkout"]',
  'input[type="submit"][value*="Add to Cart"]',
  'input[type="button"][value*="Buy"]',
  'input[type="button"][value*="Purchase"]',
  
  // Subscription buttons
  'button[class*="subscribe"]',
  'button[class*="subscription"]',
  'button[id*="subscribe"]',
  'a[class*="subscribe"]',
  'a[id*="subscribe"]',
  'input[value*="Subscribe"]',
  
  // Checkout buttons
  'button[class*="checkout"]',
  'button[id*="checkout"]',
  'a[class*="checkout"]',
  'a[id*="checkout"]',
  'button[class*="proceed"]',
  'button[class*="complete"]',
  'button[class*="place-order"]',
  
  // Payment buttons
  'button[class*="pay"]',
  'button[class*="payment"]',
  'button[id*="pay"]',
  'button[aria-label*="Buy"]',
  'button[aria-label*="Purchase"]',
  'button[aria-label*="Checkout"]',
  'button[aria-label*="Subscribe"]',
  
  // Amazon specific
  '#buy-now-button',
  '#add-to-cart-button',
  'input[name="submit.buy-now"]',
  'input[name="submit.add-to-cart"]',
  
  // eBay specific
  '#binBtn_btn',
  '.ux-call-to-action',
  '[data-testid="ux-call-to-action"]',
  
  // Shein specific
  '[class*="add-to-bag"]',
  '[class*="addToBag"]',
  '[class*="checkout"]',
  '[class*="buy-now"]',
  'button[data-testid*="add"]',
  'button[data-testid*="buy"]',
  
  // Generic patterns
  '[role="button"][aria-label*="buy"]',
  '[role="button"][aria-label*="purchase"]',
  '[role="button"][aria-label*="checkout"]',
  '[data-action*="buy"]',
  '[data-action*="purchase"]',
  '[data-action*="checkout"]',
  
  // Text-based detection (fallback)
  'button:contains("Buy")',
  'button:contains("Purchase")',
  'button:contains("Checkout")',
  'button:contains("Subscribe")',
  'button:contains("Add to Cart")',
  'a:contains("Buy")',
  'a:contains("Purchase")',
  'a:contains("Checkout")',
  'a:contains("Subscribe")'
];

let blockedPurchases = 0;
let moneySaved = 0;
let activeCountdowns = new Map(); // Store countdown timers

// Load stats from storage
chrome.storage.local.get(['blockedCount', 'savedAmount', 'countdowns'], (result) => {
  blockedPurchases = result.blockedCount || 0;
  moneySaved = result.savedAmount || 0;
  if (result.countdowns) {
    activeCountdowns = new Map(Object.entries(result.countdowns));
    restoreCountdowns();
  }
});

// Function to check if button text matches purchase keywords
function isPurchaseButton(element) {
  if (!element) return false;
  
  const text = (element.textContent || element.innerText || '').toLowerCase();
  const ariaLabel = (element.getAttribute('aria-label') || '').toLowerCase();
  const className = (element.className || '').toLowerCase();
  const id = (element.id || '').toLowerCase();
  const value = (element.value || '').toLowerCase();
  
  const purchaseKeywords = [
    'buy', 'purchase', 'checkout', 'subscribe', 'subscription',
    'add to cart', 'addtocart', 'add-to-cart', 'proceed to checkout',
    'place order', 'complete purchase', 'pay now', 'order now',
    'get started', 'start trial', 'upgrade', 'checkout now'
  ];
  
  const combinedText = `${text} ${ariaLabel} ${className} ${id} ${value}`;
  
  return purchaseKeywords.some(keyword => combinedText.includes(keyword));
}

// Function to extract price from page
function extractPrice(button) {
  // Try multiple strategies to find price
  const strategies = [
    // Strategy 1: Look in parent containers
    () => {
      let element = button;
      for (let i = 0; i < 5; i++) {
        element = element.parentElement;
        if (!element) break;
        const priceRegex = /\$([0-9,]+\.?[0-9]*)/g;
        const matches = [...(element.innerText || '').matchAll(priceRegex)];
        if (matches.length > 0) {
          const price = parseFloat(matches[matches.length - 1][1].replace(/,/g, ''));
          if (price > 0 && price < 1000000) return price;
        }
      }
      return null;
    },
    
    // Strategy 2: Look for price elements
    () => {
      const priceSelectors = [
        '[class*="price"]',
        '[id*="price"]',
        '[data-price]',
        '.price',
        '#price'
      ];
      
      for (const selector of priceSelectors) {
        try {
          const elements = document.querySelectorAll(selector);
          for (const el of elements) {
            const priceRegex = /\$([0-9,]+\.?[0-9]*)/;
            const match = (el.textContent || '').match(priceRegex);
            if (match) {
              const price = parseFloat(match[1].replace(/,/g, ''));
              if (price > 0 && price < 1000000) return price;
            }
          }
        } catch (e) {}
      }
      return null;
    },
    
    // Strategy 3: Search entire page
    () => {
      const priceRegex = /\$([0-9,]+\.?[0-9]*)/g;
      const matches = [...document.body.innerText.matchAll(priceRegex)];
      if (matches.length > 0) {
        const prices = matches.map(m => parseFloat(m[1].replace(/,/g, ''))).filter(p => p > 0 && p < 1000000);
        if (prices.length > 0) {
          return prices[prices.length - 1]; // Get the last (usually the main) price
        }
      }
      return null;
    }
  ];
  
  for (const strategy of strategies) {
    const price = strategy();
    if (price) return price;
  }
  
  return 99; // Default fallback price
}

// Format time remaining
function formatTimeRemaining(ms) {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((ms % (1000 * 60)) / 1000);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
}

// Create countdown timer
function createCountdown(buttonId, endTime) {
  const now = Date.now();
  const remaining = endTime - now;
  
  if (remaining <= 0) {
    activeCountdowns.delete(buttonId);
    chrome.storage.local.set({ countdowns: Object.fromEntries(activeCountdowns) });
    return null;
  }
  
  return formatTimeRemaining(remaining);
}

// Restore active countdowns
function restoreCountdowns() {
  activeCountdowns.forEach((endTime, buttonId) => {
    const button = document.querySelector(`[data-btb-id="${buttonId}"]`);
    if (button) {
      updateCountdownDisplay(button, endTime);
    }
  });
}

// Update countdown display on button
function updateCountdownDisplay(button, endTime) {
  const countdown = createCountdown(button.dataset.btbId, endTime);
  if (!countdown) {
    button.classList.remove('btb-countdown-active');
    button.dataset.btbCountdown = '';
    return;
  }
  
  button.classList.add('btb-countdown-active');
  button.dataset.btbCountdown = countdown;
  
  // Update every second
  setTimeout(() => {
    if (button.dataset.btbId) {
      updateCountdownDisplay(button, endTime);
    }
  }, 1000);
}

// Create intervention popup with countdown
function createInterventionPopup(button, price, buttonId) {
  const workHours = (price / HOURLY_WAGE).toFixed(1);
  const groceryWeeks = (price / 285).toFixed(1);
  const endTime = Date.now() + BLOCK_DURATION;
  
  // Store countdown
  activeCountdowns.set(buttonId, endTime);
  chrome.storage.local.set({ countdowns: Object.fromEntries(activeCountdowns) });
  
  const popup = document.createElement('div');
  popup.className = 'btb-intervention-popup';
  popup.setAttribute('data-btb-popup-id', buttonId);
  
  const updatePopupCountdown = () => {
    const countdown = createCountdown(buttonId, endTime);
    const countdownEl = popup.querySelector('.btb-countdown-timer');
    if (countdownEl) {
      if (countdown) {
        countdownEl.textContent = countdown;
        countdownEl.style.display = 'block';
        setTimeout(updatePopupCountdown, 1000);
      } else {
        countdownEl.textContent = '⏰ 24 hours complete! You can now purchase.';
        countdownEl.style.color = '#00ff88';
      }
    }
  };
  
  popup.innerHTML = `
    <div class="btb-popup-content">
      <div class="btb-popup-header">
        <span class="btb-icon">🛑</span>
        <h3>24-Hour Purchase Delay</h3>
      </div>
      
      <div class="btb-countdown-section">
        <div class="btb-countdown-timer" id="btb-countdown-${buttonId}">24:00:00</div>
        <div class="btb-countdown-label">Time remaining before you can purchase</div>
      </div>
      
      <div class="btb-stats">
        <div class="btb-stat">
          <span class="btb-stat-label">💼 Work hours needed</span>
          <span class="btb-stat-value">${workHours} hours</span>
        </div>
        <div class="btb-stat">
          <span class="btb-stat-label">🛒 Grocery equivalent</span>
          <span class="btb-stat-value">${groceryWeeks} weeks</span>
        </div>
        <div class="btb-stat">
          <span class="btb-stat-label">💰 Price</span>
          <span class="btb-stat-value">$${price.toFixed(2)}</span>
        </div>
      </div>
      
      <div class="btb-question">
        <p><strong>Do you REALLY need this right now?</strong></p>
        <p style="margin-top: 8px; font-size: 0.9em;">This extension has saved you from <strong>${blockedPurchases}</strong> impulse purchases (<strong>$${moneySaved.toFixed(0)}</strong> total).</p>
      </div>
      
      <div class="btb-actions">
        <button class="btb-btn btb-btn-wait">Wait 24 Hours ⏰</button>
        <button class="btb-btn btb-btn-cancel">Cancel Purchase ✅</button>
      </div>
      
      <div class="btb-footer">
        💡 Studies show 24-hour delays reduce regretted purchases by 70%
      </div>
    </div>
  `;
  
  document.body.appendChild(popup);
  
  // Position popup
  const buttonRect = button.getBoundingClientRect();
  const popupRect = popup.getBoundingClientRect();
  
  let left = buttonRect.left + window.scrollX + (buttonRect.width / 2) - (popupRect.width / 2);
  let top = buttonRect.bottom + window.scrollY + 15;
  
  if (left < 10) left = 10;
  if (left + popupRect.width > window.innerWidth - 10) {
    left = window.innerWidth - popupRect.width - 10;
  }
  if (top + popupRect.height > window.innerHeight + window.scrollY) {
    top = buttonRect.top + window.scrollY - popupRect.height - 15;
  }
  
  popup.style.top = `${top}px`;
  popup.style.left = `${left}px`;
  
  // Start countdown
  updatePopupCountdown();
  updateCountdownDisplay(button, endTime);
  
  // Event listeners
  popup.querySelector('.btb-btn-cancel').addEventListener('click', () => {
    popup.remove();
    blockedPurchases++;
    moneySaved += price;
    activeCountdowns.delete(buttonId);
    chrome.storage.local.set({
      blockedCount: blockedPurchases,
      savedAmount: moneySaved,
      countdowns: Object.fromEntries(activeCountdowns)
    });
    updateStatsDisplay();
    button.classList.remove('btb-countdown-active');
    button.dataset.btbCountdown = '';
  });
  
  popup.querySelector('.btb-btn-wait').addEventListener('click', () => {
    popup.remove();
    blockedPurchases++;
    moneySaved += price;
    chrome.storage.local.set({
      blockedCount: blockedPurchases,
      savedAmount: moneySaved,
      countdowns: Object.fromEntries(activeCountdowns)
    });
    updateStatsDisplay();
  });
  
  // Close on outside click
  setTimeout(() => {
    document.addEventListener('click', function closePopup(e) {
      if (!popup.contains(e.target) && !button.contains(e.target)) {
        popup.remove();
        document.removeEventListener('click', closePopup);
      }
    });
  }, 100);
  
  return popup;
}

// Update stats display in popup
function updateStatsDisplay() {
  chrome.runtime.sendMessage({
    action: 'updateStats',
    blockedCount: blockedPurchases,
    savedAmount: moneySaved
  });
}

// Generate unique ID for button
function getButtonId(button) {
  if (!button.dataset.btbId) {
    button.dataset.btbId = `btb-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  return button.dataset.btbId;
}

// Check if button should be unblocked (24 hours passed)
function shouldUnblock(buttonId) {
  const endTime = activeCountdowns.get(buttonId);
  if (!endTime) return true;
  return Date.now() >= endTime;
}

// Block a buy button
function blockButton(button) {
  const buttonId = getButtonId(button);
  
  // Check if countdown is still active
  if (!shouldUnblock(buttonId)) {
    button.classList.add('btb-blocked', 'btb-countdown-active');
    const endTime = activeCountdowns.get(buttonId);
    updateCountdownDisplay(button, endTime);
    return;
  }
  
  if (button.classList.contains('btb-blocked')) return;
  
  button.classList.add('btb-blocked');
  const originalOnClick = button.onclick;
  const originalHref = button.href;
  
  button.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    
    // Check if 24 hours passed
    if (shouldUnblock(buttonId)) {
      activeCountdowns.delete(buttonId);
      chrome.storage.local.set({ countdowns: Object.fromEntries(activeCountdowns) });
      button.classList.remove('btb-blocked', 'btb-countdown-active');
      button.dataset.btbCountdown = '';
      return true; // Allow purchase
    }
    
    const price = extractPrice(button);
    createInterventionPopup(button, price, buttonId);
    return false;
  };
  
  // Prevent default actions
  button.addEventListener('click', (e) => {
    if (button.classList.contains('btb-blocked') && !shouldUnblock(buttonId)) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    }
  }, true);
  
  if (button.tagName === 'A') {
    const originalHrefValue = button.href;
    button.href = 'javascript:void(0)';
    button.dataset.btbOriginalHref = originalHrefValue;
  }
  
  button.dataset.btbOriginalOnclick = originalOnClick;
}

// Scan page for buy buttons (universal detection)
function scanAndBlockButtons() {
  // Use all selectors
  UNIVERSAL_BUTTON_SELECTORS.forEach(selector => {
    try {
      const buttons = document.querySelectorAll(selector);
      buttons.forEach(button => {
        if (isPurchaseButton(button) || selector.includes('buy') || selector.includes('purchase') || selector.includes('checkout') || selector.includes('subscribe')) {
          blockButton(button);
        }
      });
    } catch (e) {
      // Invalid selector, skip
    }
  });
  
  // Also scan all buttons and links for purchase keywords
  const allButtons = document.querySelectorAll('button, a, input[type="submit"], input[type="button"]');
  allButtons.forEach(button => {
    if (isPurchaseButton(button) && !button.classList.contains('btb-blocked')) {
      blockButton(button);
    }
  });
}

// Initialize extension
console.log('🛑 Block The Buy: Universal extension active on this page');
scanAndBlockButtons();

// Watch for dynamically added buttons
const observer = new MutationObserver((mutations) => {
  scanAndBlockButtons();
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

// Scan every 2 seconds as fallback
setInterval(scanAndBlockButtons, 2000);

// Also scan on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', scanAndBlockButtons);
} else {
  scanAndBlockButtons();
}
