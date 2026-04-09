/**
 * Runs on the "AI tab": pastes forwarded text into the page chat box, submits,
 * then scrapes the latest assistant reply and reports back via the background worker.
 */
function flotyRelaySleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function flotyFindChatInput() {
  const ql = document.querySelector("rich-textarea .ql-editor");
  if (ql && ql.isContentEditable) {
    const r = ql.getBoundingClientRect();
    if (r.height > 8 && r.width > 48 && !ql.closest("[hidden]")) {
      return { el: ql, kind: "quill" };
    }
  }
  const areas = [...document.querySelectorAll("textarea")].filter((el) => {
    if (el.disabled) return false;
    const r = el.getBoundingClientRect();
    return r.width > 48 && r.height > 16 && el.offsetParent !== null;
  });
  areas.sort((a, b) => b.getBoundingClientRect().height - a.getBoundingClientRect().height);
  if (areas[0]) return { el: areas[0], kind: "textarea" };
  const ce =
    document.querySelector('div[contenteditable="true"][role="textbox"]') ||
    document.querySelector('div[contenteditable="true"]');
  if (ce && ce.getBoundingClientRect().height > 16) return { el: ce, kind: "contenteditable" };
  return null;
}

function flotySetInputText(input, text) {
  if (input.kind === "textarea") {
    const el = input.el;
    el.focus();
    el.value = text;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return;
  }
  const el = input.el;
  el.focus();
  if (input.kind === "quill" || el.classList?.contains("ql-editor")) {
    el.innerHTML = "";
    const p = document.createElement("p");
    p.textContent = text;
    el.appendChild(p);
    el.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        inputType: "insertFromPaste",
        data: text,
      })
    );
    return;
  }
  el.textContent = text;
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

function flotyFindSubmit() {
  const tryList = [
    ...document.querySelectorAll('button[data-testid="send-button"]'),
    ...document.querySelectorAll('button[aria-label="Run"]'),
    ...document.querySelectorAll('button[aria-label*="Run" i]'),
    ...document.querySelectorAll('button[mattooltip*="Run" i]'),
    ...document.querySelectorAll('button[aria-label*="Send" i]'),
    ...document.querySelectorAll('button[title*="Send" i]'),
    ...document.querySelectorAll("button.send-button"),
    ...document.querySelectorAll('button[type="submit"]'),
  ];
  for (const b of tryList) {
    if (b.offsetParent !== null && !b.disabled) return b;
  }
  const fab = document.querySelector(
    "button.mdc-fab, button.mat-mdc-fab-bottom-sheet, button.fab-primary"
  );
  if (fab && fab.offsetParent !== null && !fab.disabled) return fab;
  return null;
}

function flotyAssistantSnapshot() {
  const chatgpt = document.querySelectorAll('[data-message-author-role="assistant"]');
  if (chatgpt.length) {
    return [...chatgpt].map((n) => (n.innerText || "").trim()).filter(Boolean);
  }
  const gemini = document.querySelectorAll(
    ".model-response-text, message-content .markdown, [data-test-id='model-response'] .markdown, [class*='model-response'] .markdown"
  );
  if (gemini.length) {
    return [...gemini].map((n) => (n.innerText || "").trim()).filter(Boolean);
  }
  const alt = document.querySelectorAll(".markdown, [class*='Message'] [class*='assistant']");
  if (alt.length) {
    return [...alt].map((n) => (n.innerText || "").trim()).filter(Boolean);
  }
  return [];
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "FLOTY_GET_ASSISTANT_SNAPSHOT") {
    sendResponse({ parts: flotyAssistantSnapshot() });
    return;
  }

  if (msg?.type !== "FLOTY_REMOTE_ASK") return;

  (async () => {
    const { text, replyTabId } = msg;
    const reply = (t, err) =>
      chrome.runtime.sendMessage({
        type: "FLOTY_REMOTE_REPLY",
        replyTabId,
        answer: t,
        isError: !!err,
      });

    let ackSent = false;
    try {
      const input = flotyFindChatInput();
      if (!input) {
        await reply(
          "Floty could not find a chat box on this page. Open a supported chat (e.g. ChatGPT or Gemini) in this tab.",
          true
        );
        sendResponse({ ok: false });
        ackSent = true;
        return;
      }

      sendResponse({ ok: true });
      ackSent = true;

      const before = flotyAssistantSnapshot();
      const beforeJoined = before.join("\n---FLOTY---\n");

      flotySetInputText(input, text);
      await flotyRelaySleep(500);

      let submitted = false;
      for (let attempt = 0; attempt < 6; attempt++) {
        const btn = flotyFindSubmit();
        if (btn && !btn.disabled) {
          btn.click();
          submitted = true;
          break;
        }
        await flotyRelaySleep(350);
      }
      if (!submitted) {
        input.el.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "Enter",
            code: "Enter",
            keyCode: 13,
            which: 13,
            bubbles: true,
          })
        );
      }

      chrome.runtime.sendMessage({
        type: "FLOTY_POLL_REPLY",
        replyTabId,
        beforeJoined,
        beforeLast: before[before.length - 1] || "",
      });
    } catch (e) {
      await reply(e?.message || String(e), true);
      if (!ackSent) sendResponse({ ok: false });
    }
  })();
  return true;
});
