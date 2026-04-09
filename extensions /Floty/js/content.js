(() => {
  const HOST_ID = "floty-extension-root";
  const Z = 2147483646;

  let host = null;
  let shadow = null;
  let bubbleEl = null;
  let panelEl = null;
  let selectionChip = null;
  let dragState = null;
  let ignoreNextBubbleClick = false;

  const css = `
    :host { all: initial; }
    * { box-sizing: border-box; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
    .floty-bubble {
      position: fixed;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: linear-gradient(145deg, #6366f1, #4f46e5);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: grab;
      box-shadow: 0 4px 20px rgba(79, 70, 229, 0.45);
      z-index: ${Z};
      font-size: 18px;
      font-weight: 700;
      user-select: none;
      border: 2px solid rgba(255,255,255,0.35);
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    }
    .floty-bubble:active { cursor: grabbing; }
    .floty-bubble:hover { transform: scale(1.06); }
    .floty-bubble.open { box-shadow: 0 6px 24px rgba(79, 70, 229, 0.55); }
    .floty-panel {
      position: fixed;
      width: min(360px, calc(100vw - 32px));
      max-height: min(520px, calc(100vh - 100px));
      background: #0f0f12;
      color: #e4e4e7;
      border-radius: 14px;
      box-shadow: 0 12px 40px rgba(0,0,0,0.55);
      border: 1px solid rgba(255,255,255,0.08);
      z-index: ${Z};
      display: none;
      flex-direction: column;
      overflow: hidden;
    }
    .floty-panel.visible { display: flex; }
    .floty-panel-header {
      padding: 10px 12px;
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.02em;
      color: #e4e4e7;
      border-bottom: 1px solid rgba(255,255,255,0.06);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .floty-close {
      background: transparent;
      border: none;
      color: #71717a;
      cursor: pointer;
      font-size: 18px;
      line-height: 1;
      padding: 2px 6px;
      border-radius: 6px;
    }
    .floty-close:hover { color: #e4e4e7; background: rgba(255,255,255,0.06); }
    .floty-body { padding: 10px 12px 12px; overflow: auto; flex: 1; display: flex; flex-direction: column; gap: 8px; }
    .floty-label { font-size: 11px; color: #71717a; text-transform: uppercase; letter-spacing: 0.04em; }
    .floty-hint { font-size: 11px; color: #a1a1aa; line-height: 1.35; margin: 0; }
    .floty-input {
      width: 100%;
      min-height: 100px;
      max-height: 200px;
      resize: vertical;
      border-radius: 8px;
      border: 1px solid rgba(255,255,255,0.12);
      background: rgba(255,255,255,0.05);
      color: #fafafa;
      padding: 10px;
      font-size: 13px;
      line-height: 1.4;
    }
    .floty-input::placeholder { color: #71717a; }
    .floty-actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .floty-btn {
      flex: 1;
      min-width: 100px;
      padding: 8px 12px;
      border-radius: 8px;
      border: none;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
    }
    .floty-btn-primary {
      background: linear-gradient(145deg, #6366f1, #4f46e5);
      color: #fff;
    }
    .floty-btn-ghost {
      background: rgba(255,255,255,0.08);
      color: #e4e4e7;
    }
    .floty-answer {
      font-size: 13px;
      line-height: 1.45;
      color: #e4e4e7;
      background: rgba(99, 102, 241, 0.08);
      border: 1px solid rgba(99, 102, 241, 0.2);
      border-radius: 8px;
      padding: 10px;
      min-height: 48px;
      max-height: 180px;
      overflow: auto;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .floty-err { font-size: 12px; color: #f87171; min-height: 0; }
    .floty-chip {
      position: fixed;
      z-index: ${Z};
      padding: 6px 10px;
      font-size: 12px;
      font-weight: 600;
      background: #4f46e5;
      color: #fff;
      border-radius: 999px;
      cursor: pointer;
      box-shadow: 0 4px 16px rgba(0,0,0,0.35);
      border: 1px solid rgba(255,255,255,0.2);
      user-select: none;
    }
    .floty-chip:hover { background: #6366f1; }
  `;

  function isInsideFloty(node) {
    let n = node;
    while (n) {
      if (n === host) return true;
      n = n.parentNode;
    }
    return false;
  }

  function getSelectionText() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return "";
    const t = sel.toString().trim();
    if (!t) return "";
    if (isInsideFloty(sel.anchorNode)) return "";
    if (isInsideFloty(sel.focusNode)) return "";
    return t.slice(0, 12000);
  }

  function placePanelNearBubble() {
    if (!bubbleEl || !panelEl) return;
    const r = bubbleEl.getBoundingClientRect();
    const pw = panelEl.offsetWidth || 320;
    const ph = panelEl.offsetHeight || 200;
    let left = r.left - pw + r.width;
    let top = r.top - ph - 12;
    if (left < 12) left = 12;
    if (left + pw > innerWidth - 12) left = innerWidth - pw - 12;
    if (top < 12) top = r.bottom + 12;
    if (top + ph > innerHeight - 12) top = innerHeight - ph - 12;
    panelEl.style.left = `${left}px`;
    panelEl.style.top = `${top}px`;
  }

  async function updateTargetHint() {
    if (!panelEl) return;
    const hint = panelEl.querySelector(".floty-hint");
    if (!hint) return;
    try {
      const d = await chrome.storage.sync.get(["flotyTargetTabId", "flotyTargetTabTitle"]);
      if (!hint.isConnected) return;
      const tabId = d.flotyTargetTabId;
      if (tabId === undefined || tabId === null || tabId === "") {
        hint.textContent =
          "No AI tab yet — open the Floty popup (puzzle icon) and click “Use this tab as AI tab” on your chat page.";
        hint.style.color = "#fbbf24";
      } else {
        hint.textContent = `Sending to: ${d.flotyTargetTabTitle || "Tab " + tabId}`;
        hint.style.color = "#a1a1aa";
      }
    } catch {
      if (hint.isConnected) {
        hint.textContent = "Could not read Floty settings.";
        hint.style.color = "#f87171";
      }
    }
  }

  function setPanelOpen(open) {
    if (!panelEl || !bubbleEl) return;
    panelEl.classList.toggle("visible", open);
    bubbleEl.classList.toggle("open", open);
    if (open) {
      const fresh = getSelectionText();
      const ta = panelEl.querySelector(".floty-input");
      if (fresh && ta) ta.value = fresh.slice(0, 12000);
      placePanelNearBubble();
      const errEl = panelEl.querySelector(".floty-err");
      errEl.textContent = "";
      errEl.style.color = "#f87171";
      updateTargetHint();
      if (ta) ta.focus();
    }
  }

  function hideChip() {
    if (selectionChip) {
      selectionChip.remove();
      selectionChip = null;
    }
  }

  function showSelectionChip() {
    const text = getSelectionText();
    if (!text) {
      hideChip();
      return;
    }
    hideChip();
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    const rects = range.getClientRects();
    const rect = rects.length ? rects[rects.length - 1] : range.getBoundingClientRect();
    selectionChip = document.createElement("div");
    selectionChip.className = "floty-chip";
    selectionChip.textContent = "Floty";
    const chipW = 72;
    let left = rect.right + 8;
    let top = rect.top;
    if (left + chipW > innerWidth - 8) left = rect.left - chipW - 8;
    if (top < 8) top = 8;
    selectionChip.style.left = `${left}px`;
    selectionChip.style.top = `${top}px`;
    selectionChip.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      hideChip();
      setPanelOpen(true);
    });
    shadow.appendChild(selectionChip);
    window.setTimeout(() => {
      if (selectionChip && getSelectionText() !== text) hideChip();
    }, 4000);
  }

  async function pasteClipboardIntoInput() {
    const ta = panelEl.querySelector(".floty-input");
    const errEl = panelEl.querySelector(".floty-err");
    errEl.textContent = "";
    try {
      const t = await navigator.clipboard.readText();
      if (ta) {
        ta.value = (t || "").trim().slice(0, 12000);
        ta.focus();
      }
    } catch {
      errEl.textContent = "Paste with Ctrl/Cmd+V in the box if clipboard read fails.";
    }
  }

  function sendToAiTab(text) {
    const t = (text || "").trim().slice(0, 12000);
    const errEl = panelEl.querySelector(".floty-err");
    errEl.textContent = "";
    errEl.style.color = "#a1a1aa";
    if (!t) {
      errEl.style.color = "#f87171";
      errEl.textContent = "Add text — select on the page, paste, or type.";
      return;
    }
    errEl.textContent = "Sent to your AI tab. Waiting for a reply…";
    chrome.runtime.sendMessage({ type: "FLOTY_RELAY_TO_AI_TAB", text: t }, () => {
      if (chrome.runtime.lastError) {
        errEl.style.color = "#f87171";
        errEl.textContent =
          chrome.runtime.lastError.message || "Could not reach the background worker.";
      }
    });
  }

  async function relayFromClipboard() {
    try {
      const t = await navigator.clipboard.readText();
      sendToAiTab(t);
    } catch {
      const errEl = panelEl.querySelector(".floty-err");
      errEl.style.color = "#f87171";
      errEl.textContent = "Could not read clipboard.";
    }
  }

  function copyAnswer() {
    const ansEl = panelEl.querySelector(".floty-answer");
    const t = ansEl?.textContent?.trim();
    if (!t) return;
    navigator.clipboard.writeText(t).catch(() => {});
  }

  function mountUI() {
    if (host) return;
    host = document.createElement("div");
    host.id = HOST_ID;
    host.setAttribute("data-floty", "");
    document.documentElement.appendChild(host);
    shadow = host.attachShadow({ mode: "closed" });
    const style = document.createElement("style");
    style.textContent = css;
    shadow.appendChild(style);

    bubbleEl = document.createElement("div");
    bubbleEl.className = "floty-bubble";
    bubbleEl.setAttribute("title", "Floty — send text to your AI chat tab");
    bubbleEl.textContent = "✦";

    panelEl = document.createElement("div");
    panelEl.className = "floty-panel";
    panelEl.innerHTML = `
      <div class="floty-panel-header">
        <span>Floty</span>
        <button type="button" class="floty-close" aria-label="Close">×</button>
      </div>
      <div class="floty-body">
        <p class="floty-hint"></p>
        <div class="floty-label">Message for your AI tab</div>
        <textarea class="floty-input" placeholder="Select text on the page, paste, or type…" spellcheck="false"></textarea>
        <div class="floty-actions">
          <button type="button" class="floty-btn floty-btn-primary floty-send">Send to AI tab</button>
          <button type="button" class="floty-btn floty-btn-ghost floty-paste">Paste</button>
          <button type="button" class="floty-btn floty-btn-ghost floty-copy">Copy reply</button>
        </div>
        <div class="floty-err"></div>
        <div class="floty-label">Last reply</div>
        <div class="floty-answer"></div>
      </div>
    `;

    shadow.appendChild(panelEl);
    shadow.appendChild(bubbleEl);

    const pos = sessionStorage.getItem("flotyBubblePos");
    if (pos) {
      try {
        const { left, top } = JSON.parse(pos);
        bubbleEl.style.left = `${left}px`;
        bubbleEl.style.top = `${top}px`;
        bubbleEl.style.right = "auto";
        bubbleEl.style.bottom = "auto";
      } catch (_) {}
    } else {
      bubbleEl.style.right = "20px";
      bubbleEl.style.bottom = "24px";
      bubbleEl.style.left = "auto";
      bubbleEl.style.top = "auto";
    }

    bubbleEl.addEventListener("click", (e) => {
      if (ignoreNextBubbleClick) {
        ignoreNextBubbleClick = false;
        return;
      }
      e.stopPropagation();
      const open = !panelEl.classList.contains("visible");
      setPanelOpen(open);
    });

    panelEl.querySelector(".floty-close").addEventListener("click", () => setPanelOpen(false));
    panelEl.querySelector(".floty-send").addEventListener("click", () => {
      const ta = panelEl.querySelector(".floty-input");
      sendToAiTab(ta?.value || "");
    });
    panelEl.querySelector(".floty-paste").addEventListener("click", () => pasteClipboardIntoInput());
    panelEl.querySelector(".floty-copy").addEventListener("click", () => copyAnswer());
    panelEl.querySelector(".floty-input").addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      if (!(e.metaKey || e.ctrlKey)) return;
      e.preventDefault();
      sendToAiTab(panelEl.querySelector(".floty-input")?.value || "");
    });

    bubbleEl.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      const rect = bubbleEl.getBoundingClientRect();
      dragState = {
        startX: e.clientX,
        startY: e.clientY,
        origLeft: rect.left,
        origTop: rect.top,
        moved: false,
      };
      bubbleEl.setPointerCapture(e.pointerId);
    });

    bubbleEl.addEventListener("pointermove", (e) => {
      if (!dragState) return;
      const dx = e.clientX - dragState.startX;
      const dy = e.clientY - dragState.startY;
      if (Math.abs(dx) + Math.abs(dy) > 4) dragState.moved = true;
      let left = dragState.origLeft + dx;
      let top = dragState.origTop + dy;
      const w = bubbleEl.offsetWidth;
      const h = bubbleEl.offsetHeight;
      left = Math.max(8, Math.min(left, innerWidth - w - 8));
      top = Math.max(8, Math.min(top, innerHeight - h - 8));
      bubbleEl.style.left = `${left}px`;
      bubbleEl.style.top = `${top}px`;
      bubbleEl.style.right = "auto";
      bubbleEl.style.bottom = "auto";
      if (panelEl.classList.contains("visible")) placePanelNearBubble();
    });

    bubbleEl.addEventListener("pointerup", () => {
      if (dragState?.moved) {
        ignoreNextBubbleClick = true;
        const r = bubbleEl.getBoundingClientRect();
        sessionStorage.setItem("flotyBubblePos", JSON.stringify({ left: r.left, top: r.top }));
      }
      dragState = null;
    });

    document.addEventListener(
      "mouseup",
      () => {
        window.setTimeout(() => {
          if (!host) return;
          const t = getSelectionText();
          if (t) showSelectionChip();
        }, 10);
      },
      true
    );

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        hideChip();
        setPanelOpen(false);
      }
    });

    updateTargetHint();
  }

  function unmountUI() {
    hideChip();
    if (host) {
      host.remove();
      host = null;
      shadow = null;
      bubbleEl = null;
      panelEl = null;
    }
  }

  function applyEnabled(enabled) {
    if (enabled) mountUI();
    else unmountUI();
  }

  function isBubbleOn(value) {
    return value !== false;
  }

  function syncFromStorage() {
    chrome.storage.sync
      .get(["flotyEnabled"])
      .then((data) => {
        applyEnabled(isBubbleOn(data.flotyEnabled));
      })
      .catch(() => {});
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    if ("flotyEnabled" in changes) {
      applyEnabled(isBubbleOn(changes.flotyEnabled.newValue));
    }
    if ("flotyTargetTabId" in changes || "flotyTargetTabTitle" in changes) {
      updateTargetHint();
    }
  });

  syncFromStorage();
})();

window.addEventListener("floty-panel-answer", (ev) => {
  if (!ev.detail) return;
  const { answer, isError } = ev.detail;
  const host = document.getElementById("floty-extension-root");
  const root = host?.shadowRoot;
  if (!root) return;
  const ans = root.querySelector(".floty-answer");
  const errEl = root.querySelector(".floty-err");
  if (errEl) {
    errEl.textContent = "";
    errEl.style.color = "#f87171";
  }
  if (ans) {
    ans.textContent = answer || "";
    ans.style.color = isError ? "#fca5a5" : "#e4e4e7";
  }
});

function flotyShowRelayAnswer(answer, isError) {
  navigator.clipboard.writeText(answer).catch(() => {});
  window.dispatchEvent(
    new CustomEvent("floty-panel-answer", {
      detail: { answer, isError },
    })
  );
  let b = document.getElementById("floty-relay-banner");
  if (!b) {
    b = document.createElement("div");
    b.id = "floty-relay-banner";
    b.style.cssText =
      "position:fixed;z-index:2147483645;max-width:min(440px,94vw);max-height:42vh;overflow:auto;padding:14px 16px;right:16px;top:16px;background:#0f172a;color:#f1f5f9;border-radius:12px;font:13px/1.45 system-ui,sans-serif;box-shadow:0 20px 50px rgba(0,0,0,.5);";
    document.documentElement.appendChild(b);
  }
  b.style.border = isError ? "2px solid #dc2626" : "2px solid #6366f1";
  b.textContent = (isError ? "Floty: " : "Copied: ") + answer;
  window.clearTimeout(window.__flotyBannerT);
  window.__flotyBannerT = window.setTimeout(() => {
    b?.remove();
  }, 22000);
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "FLOTY_SHOW_RELAY_ANSWER") {
    flotyShowRelayAnswer(msg.answer, msg.isError);
  }
});

(function flotyClipboardRelayWatch() {
  if (window !== window.top) return;
  let primed = false;
  let lastClip = "";
  window.setInterval(async () => {
    if (document.visibilityState !== "visible") return;
    let s;
    try {
      s = await chrome.storage.sync.get(["flotyRelayAutoClipboard", "flotyTargetTabId"]);
    } catch {
      return;
    }
    const targetId = s.flotyTargetTabId;
    if (!s.flotyRelayAutoClipboard || targetId === undefined || targetId === null || targetId === "") {
      return;
    }
    let t;
    try {
      t = (await navigator.clipboard.readText()).trim();
    } catch {
      return;
    }
    if (t.length < 2) return;
    if (!primed) {
      primed = true;
      lastClip = t;
      return;
    }
    if (t === lastClip) return;
    lastClip = t;
    chrome.runtime.sendMessage({ type: "FLOTY_RELAY_TO_AI_TAB", text: t.slice(0, 12000) });
  }, 4000);
})();
