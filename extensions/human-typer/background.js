/**
 * Injects the page bridge into all frames before typing starts.
 */
function injectBridge(tabId) {
  if (!tabId) return;
  chrome.scripting
    .executeScript({
      target: { tabId, allFrames: true },
      files: ['pageBridge.js'],
      world: 'MAIN',
    })
    .catch(() => {});
}

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type !== 'HUMAN_TYPER_PREPARE') return;

  const tabId = msg.tabId || sender.tab?.id;
  if (tabId) {
    injectBridge(tabId);
    return;
  }

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    injectBridge(tabs[0]?.id);
  });
});
