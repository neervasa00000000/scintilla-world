document.addEventListener('DOMContentLoaded', async () => {
  const scanBtn = document.getElementById('manual-scan');
  const historyList = document.getElementById('history-list');
  const clearBtn = document.getElementById('clear-history');
  const autoScanCheck = document.getElementById('auto-scan');
  const clickRecordCheck = document.getElementById('click-record');
  const searchInput = document.getElementById('search-history');
  const totalCountSpan = document.getElementById('total-count');
  const toast = document.getElementById('toast');

  let fullHistory = [];

  const showToast = (text) => {
    toast.textContent = text;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2000);
  };

  chrome.storage.local.get(['autoScan', 'clickRecord'], (prefs) => {
    autoScanCheck.checked = prefs.autoScan !== false;
    clickRecordCheck.checked = prefs.clickRecord !== false;
  });

  autoScanCheck.addEventListener('change', () => chrome.storage.local.set({ autoScan: autoScanCheck.checked }));
  clickRecordCheck.addEventListener('change', () => chrome.storage.local.set({ clickRecord: clickRecordCheck.checked }));

  const updateHistoryUI = (filter = '') => {
    chrome.storage.local.get({ recordedASINs: [] }, (result) => {
      fullHistory = result.recordedASINs;
      totalCountSpan.textContent = fullHistory.length;
      historyList.innerHTML = '';
      
      const filtered = fullHistory.filter(item => 
        item.asin.toLowerCase().includes(filter.toLowerCase())
      ).slice().reverse();

      if (!filtered.length) {
        historyList.innerHTML = `<div class="empty-text">${filter ? 'NO MATCHES' : 'NO DATA COLLECTED'}</div>`;
        return;
      }

      filtered.forEach(item => {
        const row = document.createElement('div');
        row.className = 'item';
        row.innerHTML = `
          <div class="item-meta">
            <span class="asin">${item.asin}</span>
            <span class="time">${item.time}</span>
          </div>
          <button class="copy-pill">COPY URL</button>
        `;
        row.querySelector('.copy-pill').addEventListener('click', () => {
          navigator.clipboard.writeText(item.url);
          showToast('URL COPIED');
        });
        historyList.appendChild(row);
      });
    });
  };

  const getActiveTabASINS = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url?.includes("amazon")) {
      showToast("INVALID DOMAIN");
      return;
    }

    scanBtn.disabled = true;
    scanBtn.innerHTML = `SCANNING...`;

    chrome.tabs.sendMessage(tab.id, { action: "getASINS" }, (response) => {
      scanBtn.disabled = false;
      scanBtn.innerHTML = `START PAGE SCAN`;

      if (chrome.runtime.lastError || !response?.asins?.length) {
        showToast("NO DATA FOUND");
        return;
      }

      chrome.storage.local.get({ recordedASINs: [] }, (result) => {
        let list = result.recordedASINs;
        let added = 0;
        response.asins.forEach(asin => {
          if (!list.some(item => item.asin === asin)) {
            list.push({
              asin: asin,
              time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
              url: `${response.domain}/dp/${asin}`
            });
            added++;
          }
        });
        chrome.storage.local.set({ recordedASINs: list }, () => {
          updateHistoryUI();
          showToast(`${added} ITEMS ADDED`);
        });
      });
    });
  };

  searchInput.addEventListener('input', (e) => updateHistoryUI(e.target.value));
  scanBtn.addEventListener('click', getActiveTabASINS);
  clearBtn.addEventListener('click', () => chrome.storage.local.set({ recordedASINs: [] }, updateHistoryUI));

  document.getElementById('copy-all').addEventListener('click', () => {
    if (!fullHistory.length) return;
    navigator.clipboard.writeText(fullHistory.map(i => i.asin).join('\n'));
    showToast('ALL COPIED');
  });

  document.getElementById('download-csv').addEventListener('click', () => {
    if (!fullHistory.length) return;
    const csv = ["ASIN,TIME,URL", ...fullHistory.map(i => `${i.asin},"${i.time}","${i.url}"`)].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `asins_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  });

  updateHistoryUI();
});