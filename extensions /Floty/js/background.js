function relayForwardError(replyTabId, text) {
  chrome.tabs.sendMessage(replyTabId, {
    type: "FLOTY_SHOW_RELAY_ANSWER",
    answer: text,
    isError: true,
  }).catch(() => {});
}

function relayDeliverToSender(replyTabId, answer, isError) {
  chrome.tabs
    .sendMessage(replyTabId, {
      type: "FLOTY_SHOW_RELAY_ANSWER",
      answer,
      isError: !!isError,
    })
    .catch(() => {});
}

let flotyPollState = null;

function flotyStopReplyPoll() {
  if (flotyPollState?.intervalId != null) {
    clearInterval(flotyPollState.intervalId);
  }
  flotyPollState = null;
}

function flotyStartReplyPoll(aiTabId, replyTabId, beforeJoined, beforeLast) {
  flotyStopReplyPoll();
  const deadline = Date.now() + 110000;
  let stable = "";
  let stableTicks = 0;

  const tick = () => {
    if (!flotyPollState) return;
    if (Date.now() >= deadline) {
      flotyStopReplyPoll();
      chrome.tabs.sendMessage(
        aiTabId,
        { type: "FLOTY_GET_ASSISTANT_SNAPSHOT" },
        (resp) => {
          if (chrome.runtime.lastError) {
            relayDeliverToSender(
              replyTabId,
              "Lost connection to the AI tab while waiting for a reply.",
              true
            );
            return;
          }
          const final = resp?.parts || [];
          const last = final[final.length - 1] || "";
          if (last && last !== beforeLast && last.length > 5) {
            relayDeliverToSender(replyTabId, last, false);
          } else {
            relayDeliverToSender(
              replyTabId,
              "No new reply detected. Some chat sites only update the page while that tab is visible (e.g. dock it beside your work). Floty never switches tabs for you.",
              true
            );
          }
        }
      );
      return;
    }

    chrome.tabs.sendMessage(aiTabId, { type: "FLOTY_GET_ASSISTANT_SNAPSHOT" }, (resp) => {
      if (!flotyPollState) return;
      if (chrome.runtime.lastError) {
        flotyStopReplyPoll();
        relayDeliverToSender(
          replyTabId,
          "Lost connection to the AI tab while waiting for a reply.",
          true
        );
        return;
      }
      const now = resp?.parts || [];
      const joined = now.join("\n---FLOTY---\n");
      const last = now[now.length - 1] || "";

      if (joined !== beforeJoined && last.length > 8) {
        if (last === stable) stableTicks += 1;
        else {
          stable = last;
          stableTicks = 0;
        }
        if (stableTicks >= 2) {
          flotyStopReplyPoll();
          relayDeliverToSender(replyTabId, last, false);
        }
      }
    });
  };

  const intervalId = setInterval(tick, 2000);
  flotyPollState = { intervalId, aiTabId, replyTabId };
  tick();
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "FLOTY_POLL_REPLY") {
    const aiTabId = sender.tab?.id;
    if (aiTabId == null) {
      sendResponse({ ok: false });
      return;
    }
    flotyStartReplyPoll(
      aiTabId,
      msg.replyTabId,
      msg.beforeJoined,
      msg.beforeLast || ""
    );
    sendResponse({ ok: true });
    return true;
  }

  if (msg?.type === "FLOTY_RELAY_TO_AI_TAB") {
    (async () => {
      const replyTabId = sender.tab?.id;
      if (replyTabId == null) {
        sendResponse({ ok: false });
        return;
      }
      let flotyTargetTabId;
      try {
        ({ flotyTargetTabId } = await chrome.storage.sync.get(["flotyTargetTabId"]));
      } catch {
        relayForwardError(replyTabId, "Could not read Floty settings. Try again.");
        sendResponse({ ok: false });
        return;
      }
      if (
        flotyTargetTabId === undefined ||
        flotyTargetTabId === null ||
        flotyTargetTabId === ""
      ) {
        relayForwardError(
          replyTabId,
          "Open the Floty extension popup and click “Use this tab as AI tab” on your chat page (e.g. ChatGPT or Gemini)."
        );
        sendResponse({ ok: false });
        return;
      }
      const targetId = Number(flotyTargetTabId);
      if (!Number.isFinite(targetId) || targetId < 1) {
        relayForwardError(
          replyTabId,
          "Your saved AI tab looks invalid. Open the Floty popup and set the AI tab again."
        );
        sendResponse({ ok: false });
        return;
      }

      chrome.tabs.sendMessage(
        targetId,
        {
          type: "FLOTY_REMOTE_ASK",
          text: msg.text,
          replyTabId,
        },
        () => {
          if (chrome.runtime.lastError) {
            relayForwardError(
              replyTabId,
              "Could not reach the AI tab. Open and refresh that tab once, then try again."
            );
            sendResponse({ ok: false });
            return;
          }
          sendResponse({ ok: true });
        }
      );
    })();
    return true;
  }

  if (msg?.type === "FLOTY_REMOTE_REPLY") {
    relayDeliverToSender(msg.replyTabId, msg.answer, msg.isError);
  }
});
