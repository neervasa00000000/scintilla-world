const KEYS = {
  enabled: "flotyEnabled",
  relayAuto: "flotyRelayAutoClipboard",
  targetTabId: "flotyTargetTabId",
  targetTabTitle: "flotyTargetTabTitle",
};

const el = (id) => document.getElementById(id);

function setStatus(msg, isErr) {
  const s = el("status");
  s.textContent = msg || "";
  s.classList.toggle("err", !!isErr);
}

async function renderRelayTargetLabel() {
  const lab = el("relayTargetLabel");
  if (!lab) return;
  const d = await chrome.storage.sync.get([KEYS.targetTabId, KEYS.targetTabTitle]);
  const tabId = d[KEYS.targetTabId];
  if (tabId === undefined || tabId === null || tabId === "") {
    lab.textContent = "Not set — choose your chat tab with the button above.";
    return;
  }
  lab.textContent = `Set to: ${d[KEYS.targetTabTitle] || "Tab " + tabId}`;
}

async function load() {
  const data = await chrome.storage.sync.get([KEYS.enabled, KEYS.relayAuto]);
  el("enabled").checked = data[KEYS.enabled] !== false;
  el("relayAuto").checked = data[KEYS.relayAuto] === true;
  await renderRelayTargetLabel();
}

el("save").addEventListener("click", async () => {
  setStatus("");
  await chrome.storage.sync.set({
    [KEYS.enabled]: el("enabled").checked,
    [KEYS.relayAuto]: el("relayAuto").checked,
  });
  setStatus("Saved.");
});

el("setAiTab").addEventListener("click", async () => {
  setStatus("");
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    setStatus("No active tab.", true);
    return;
  }
  await chrome.storage.sync.set({
    [KEYS.targetTabId]: tab.id,
    [KEYS.targetTabTitle]: tab.title || "AI tab",
  });
  await renderRelayTargetLabel();
  setStatus("AI tab saved. Use other tabs to send questions here.");
});

el("clearAiTab").addEventListener("click", async () => {
  await chrome.storage.sync.remove([KEYS.targetTabId, KEYS.targetTabTitle]);
  await renderRelayTargetLabel();
  setStatus("AI tab cleared.");
});

load().catch(() => {});
