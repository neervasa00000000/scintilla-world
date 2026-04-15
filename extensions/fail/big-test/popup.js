// Popup script for Block The Buy extension - Professional Version

// Format numbers with commas
function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Format currency
function formatCurrency(amount) {
  return '$' + formatNumber(Math.round(amount));
}

// Load stats from storage and display
chrome.storage.local.get(['blockedCount', 'savedAmount'], (result) => {
  const blockedCount = result.blockedCount || 0;
  const savedAmount = result.savedAmount || 0;
  const hoursSaved = Math.round(savedAmount / 30);

  document.getElementById('blocked-count').textContent = formatNumber(blockedCount);
  document.getElementById('money-saved').textContent = formatCurrency(savedAmount);
  document.getElementById('hours-saved').textContent = formatNumber(hoursSaved);
});

// Reset button functionality
const resetBtn = document.getElementById('reset-btn');
resetBtn.addEventListener('click', () => {
  if (confirm('⚠️ Reset all statistics?\n\nThis will permanently delete:\n• Blocked purchase count\n• Money saved total\n• Work hours saved\n\nThis action cannot be undone.')) {
    chrome.storage.local.set({
      blockedCount: 0,
      savedAmount: 0
    }, () => {
      // Update display immediately with animation
      const cards = document.querySelectorAll('.stat-card');
      cards.forEach((card, index) => {
        setTimeout(() => {
          card.style.transform = 'scale(0.95)';
          setTimeout(() => {
            card.style.transform = '';
          }, 150);
        }, index * 50);
      });

      document.getElementById('blocked-count').textContent = '0';
      document.getElementById('money-saved').textContent = '$0';
      document.getElementById('hours-saved').textContent = '0';
      
      // Show confirmation feedback
      const originalText = resetBtn.textContent;
      resetBtn.textContent = '✓ Reset Complete';
      resetBtn.style.background = 'linear-gradient(135deg, rgba(0, 255, 136, 0.2) 0%, rgba(0, 204, 102, 0.2) 100%)';
      resetBtn.style.borderColor = 'rgba(0, 255, 136, 0.4)';
      resetBtn.style.color = '#00ff88';
      
      setTimeout(() => {
        resetBtn.textContent = originalText;
        resetBtn.style.background = '';
        resetBtn.style.borderColor = '';
        resetBtn.style.color = '';
      }, 2000);
    });
  }
});

// Listen for stats updates from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'updateStats') {
    const blockedCount = request.blockedCount || 0;
    const savedAmount = request.savedAmount || 0;
    const hoursSaved = Math.round(savedAmount / 30);

    // Animate stat updates
    const updateStat = (elementId, newValue) => {
      const element = document.getElementById(elementId);
      element.style.transform = 'scale(1.1)';
      element.style.color = '#00ff88';
      setTimeout(() => {
        element.textContent = elementId === 'money-saved' ? formatCurrency(newValue) : formatNumber(newValue);
        element.style.transform = '';
        setTimeout(() => {
          element.style.color = '';
        }, 300);
      }, 150);
    };

    updateStat('blocked-count', blockedCount);
    updateStat('money-saved', savedAmount);
    updateStat('hours-saved', hoursSaved);
  }
});

// Add smooth entrance animation
window.addEventListener('DOMContentLoaded', () => {
  const cards = document.querySelectorAll('.stat-card');
  cards.forEach((card, index) => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(10px)';
    setTimeout(() => {
      card.style.transition = 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
      card.style.opacity = '1';
      card.style.transform = 'translateY(0)';
    }, index * 100);
  });
});
