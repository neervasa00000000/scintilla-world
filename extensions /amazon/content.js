// content.js

function findAllASINs() {
  const found = new Set();
  const url = window.location.href;

  const urlPatterns = [
    /\/(?:dp|gp\/product|aw\/d|product-reviews|vdp)\/([A-Z0-9]{10})/,
    /asin=([A-Z0-9]{10})/i
  ];
  for (let pattern of urlPatterns) {
    const m = url.match(pattern);
    if (m && m[1] && m[1].length === 10) found.add(m[1]);
  }

  const asinInput =
    document.getElementById('ASIN') ||
    document.querySelector('input[name="ASIN"]');
  if (asinInput && asinInput.value && asinInput.value.length === 10) {
    found.add(asinInput.value);
  }

  document.querySelectorAll('[data-asin]').forEach(el => {
    const v = el.getAttribute('data-asin');
    if (v && v.length === 10) found.add(v);
  });

  document.querySelectorAll('a[href*="/dp/"]').forEach(a => {
    const m = a.href.match(/\/dp\/([A-Z0-9]{10})/);
    if (m && m[1] && m[1].length === 10) found.add(m[1]);
  });

  return Array.from(found);
}

function recordASIN(asin) {
  if (!asin || asin.length !== 10) return;

  chrome.storage.local.get({ recordedASINs: [] }, (result) => {
    let list = result.recordedASINs;
    if (!list.some(item => item.asin === asin)) {
      list.push({
        asin: asin,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        url: "https://www.amazon.com/dp/" + asin
      });
      if (list.length > 200) list = list.slice(list.length - 200);
      chrome.storage.local.set({ recordedASINs: list });
    }
  });
}

chrome.storage.local.get({ autoScan: true }, (res) => {
  if (res.autoScan) {
    const asins = findAllASINs();
    asins.forEach(recordASIN);
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getASINS") {
    const asins = findAllASINs();
    const domain = window.location.origin;
    sendResponse({ asins, domain });
    return true;
  }
});

// Optional: click-to-record still works
document.body.addEventListener('click', (e) => {
  chrome.storage.local.get({ clickRecord: true }, (res) => {
    if (!res.clickRecord) return;
    const link = e.target.closest('a');
    const card = e.target.closest('[data-asin]');
    let asin = null;

    if (link && link.href) {
      const m = link.href.match(
        /\/(?:dp|gp\/product|aw\/d|product-reviews|vdp)\/([A-Z0-9]{10})/
      );
      if (m && m[1] && m[1].length === 10) asin = m[1];
    }
    if (!asin && card) {
      const v = card.getAttribute('data-asin');
      if (v && v.length === 10) asin = v;
    }

    if (asin) {
      recordASIN(asin);
      navigator.clipboard?.writeText(asin).catch(() => {});
    }
  });
}, true);