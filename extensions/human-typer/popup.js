const $ = (id) => document.getElementById(id);

const SPEED_NAMES = [
  'Glacial',
  'Very slow',
  'Slow',
  'Normal',
  'Medium',
  'Fast',
  'Very fast',
];

let saveTimer = null;
let dirty = false;

$('speed').addEventListener('input', () => {
  $('speedLabel').textContent = SPEED_NAMES[$('speed').value - 1];
  scheduleSave();
});

$('mistakes').addEventListener('input', () => {
  $('mistakeLabel').textContent = `${$('mistakes').value}%`;
  scheduleSave();
});

$('clickToTarget').addEventListener('change', scheduleSave);

function syncExactUi() {
  const on = $('exactMode').checked;
  $('mistakes').disabled = on;
  $('mistakeLabel').textContent = on ? 'off (exact)' : `${$('mistakes').value}%`;
}

$('exactMode').addEventListener('change', () => {
  syncExactUi();
  scheduleSave();
});

function looksLikeCode(text) {
  return (
    /^\s*(private|public|protected|class|void|int|function|import|package)\b/m.test(text) ||
    (text.includes('{') && text.includes('}') && text.includes('\n'))
  );
}

function setSaveHint(text, unsaved = false) {
  const el = $('saveHint');
  el.textContent = text ? ` — ${text}` : '';
  el.className = 'save-hint' + (unsaved ? ' unsaved' : '');
}

function setStatus(msg, kind = '') {
  $('status').textContent = msg;
  $('status').className = 'status ' + kind;
}

async function loadSaved() {
  const data = await chrome.storage.local.get([
    'humanTyperText',
    'humanTyperSpeed',
    'humanTyperMistakes',
    'humanTyperClickToTarget',
    'humanTyperExactMode',
  ]);
  if (data.humanTyperText != null) $('text').value = data.humanTyperText;
  if (data.humanTyperSpeed) $('speed').value = data.humanTyperSpeed;
  if (data.humanTyperMistakes != null) $('mistakes').value = data.humanTyperMistakes;
  if (data.humanTyperClickToTarget != null) {
    $('clickToTarget').checked = data.humanTyperClickToTarget;
  }
  if (data.humanTyperExactMode != null) {
    $('exactMode').checked = data.humanTyperExactMode;
  } else if (data.humanTyperText && looksLikeCode(data.humanTyperText)) {
    $('exactMode').checked = true;
  }
  $('speedLabel').textContent = SPEED_NAMES[$('speed').value - 1];
  syncExactUi();
  dirty = false;
  setSaveHint($('text').value.trim() ? 'draft loaded' : '');
}

async function saveSettings() {
  const text = $('text').value;
  await chrome.storage.local.set({
    humanTyperText: text,
    humanTyperSpeed: Number($('speed').value),
    humanTyperMistakes: Number($('mistakes').value),
    humanTyperClickToTarget: $('clickToTarget').checked,
    humanTyperExactMode: $('exactMode').checked,
    humanTyperSavedAt: Date.now(),
  });
  dirty = false;
  const n = text.length;
  const lines = text.split('\n').length;
  setSaveHint(
    n ? `${n.toLocaleString()} chars, ${lines} line${lines === 1 ? '' : 's'} saved` : 'saved'
  );
  return true;
}

function scheduleSave() {
  dirty = true;
  setSaveHint('saving…', true);
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      await saveSettings();
    } catch {
      setSaveHint('save failed', true);
    }
  }, 350);
}

$('text').addEventListener('input', () => {
  if (looksLikeCode($('text').value)) $('exactMode').checked = true;
  syncExactUi();
  scheduleSave();
});
$('text').addEventListener('paste', () => {
  setTimeout(() => {
    if (looksLikeCode($('text').value)) $('exactMode').checked = true;
    syncExactUi();
    scheduleSave();
  }, 50);
});

$('text').addEventListener('blur', () => {
  if (dirty) saveSettings().catch(() => {});
});

$('saveDraft').addEventListener('click', async () => {
  clearTimeout(saveTimer);
  try {
    await saveSettings();
    setStatus('Draft saved. It will stay here when you reopen the extension.', 'ok');
  } catch {
    setStatus('Could not save — try again.', 'err');
  }
});

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function sendToAllFrames(tabId, message) {
  let frames = [{ frameId: 0 }];
  try {
    const listed = await chrome.webNavigation.getAllFrames({ tabId });
    if (listed?.length) frames = listed;
  } catch {
    /* fallback */
  }
  await Promise.all(
    frames.map((f) =>
      chrome.tabs.sendMessage(tabId, message, { frameId: f.frameId }).catch(() => null)
    )
  );
}

function probeFrameForEditor() {
  return Boolean(
    document.querySelector(
      [
        '.monaco-editor',
        '.ace_editor',
        '.cm-editor',
        'textarea.inputarea',
        '.view-lines',
        '.monaco-scrollable-element',
        '[class*="monaco-editor"]',
        '.mtk1',
        '[class*="CodeEditor"]',
      ].join(', ')
    )
  );
}

/** Ed Workspaces puts the editor in an iframe — only message frames that contain it. */
async function sendStartToEditorFrames(tabId, message) {
  let frames = [{ frameId: 0 }];
  try {
    const listed = await chrome.webNavigation.getAllFrames({ tabId });
    if (listed?.length) frames = listed;
  } catch {
    /* fallback */
  }

  const checks = await Promise.all(
    frames.map(async (f) => {
      try {
        const injected = await chrome.scripting.executeScript({
          target: { tabId, frameIds: [f.frameId] },
          func: probeFrameForEditor,
        });
        const hasEditor = Boolean(injected?.[0]?.result);
        return { frameId: f.frameId, hasEditor };
      } catch {
        return { frameId: f.frameId, hasEditor: false };
      }
    })
  );

  const editorFrames = checks.filter((c) => c.hasEditor);
  const targets = editorFrames.length ? editorFrames : checks.filter((c) => c.frameId === 0);

  await Promise.all(
    targets.map((f) =>
      chrome.tabs.sendMessage(tabId, message, { frameId: f.frameId }).catch(() => null)
    )
  );

  return editorFrames.length;
}

$('start').addEventListener('click', async () => {
  clearTimeout(saveTimer);
  await saveSettings();

  const text = $('text').value;
  if (!text.trim()) {
    setStatus('Enter some text first.', 'err');
    return;
  }

  const tab = await getActiveTab();
  if (!tab?.id) {
    setStatus('No active tab.', 'err');
    return;
  }

  if (tab.url?.startsWith('chrome://') || tab.url?.startsWith('chrome-extension://')) {
    setStatus('Open a normal website tab first (not chrome:// pages).', 'err');
    return;
  }

  $('start').disabled = true;

  const clickToTarget = $('clickToTarget').checked;
  const isDocs = tab.url?.includes('docs.google.com');
  setStatus(
    clickToTarget
      ? isDocs
        ? 'Click inside the document…'
        : 'Click the text box on the page…'
      : 'Make sure your cursor is in a text box…',
    'ok'
  );

  try {
    chrome.runtime.sendMessage({ type: 'HUMAN_TYPER_PREPARE', tabId: tab.id }).catch(() => {});

    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        files: ['content.js'],
      });
    } catch {
      /* already injected */
    }

    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        files: ['pageBridge.js'],
        world: 'MAIN',
      });
    } catch {
      /* bridge may already be present */
    }

    await new Promise((r) => setTimeout(r, 250));

    const isEdStem = tab.url?.includes('edstem.org');
    const exactMode = $('exactMode').checked;

    const startMsg = {
      type: 'HUMAN_TYPER_START',
      text,
      speed: Number($('speed').value),
      mistakeRate: Number($('mistakes').value) / 100,
      clickToTarget,
      exactMode,
      autoEdStem: isEdStem && exactMode,
    };

    setStatus(
      isEdStem && exactMode
        ? 'Starting… (put cursor in code first)'
        : 'Starting…',
      'ok'
    );

    const editorFrameCount = await sendStartToEditorFrames(tab.id, startMsg);

    if (editorFrameCount === 0) {
      await sendToAllFrames(tab.id, startMsg);
      setStatus('No editor frame found — trying whole page…', 'ok');
    }

    window.__humanTyperStartTimeout = setTimeout(() => {
      if (!$('start').disabled) return;
      const t = $('status').textContent || '';
      if (!t.includes('Typing') && !t.includes('Done') && !t.includes('Stopped') && !t.includes('bridge')) {
        setStatus(
          'No response from EdStem. Reload extension (v1.7.1), refresh page, open .java, try again.',
          'err'
        );
        $('start').disabled = false;
      }
    }, 10000);
  } catch {
    setStatus('Refresh the page, then try again.', 'err');
    $('start').disabled = false;
  }
});

$('stop').addEventListener('click', async () => {
  const tab = await getActiveTab();
  if (tab?.id) {
    await sendToAllFrames(tab.id, { type: 'HUMAN_TYPER_STOP' });
  }
  setStatus('Stopped.', '');
  $('start').disabled = false;
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'HUMAN_TYPER_STATUS') {
    clearTimeout(window.__humanTyperStartTimeout);
    setStatus(msg.message, msg.kind || '');
  }
  if (msg.type === 'HUMAN_TYPER_DONE') {
    clearTimeout(window.__humanTyperStartTimeout);
    setStatus(msg.message || 'Finished.', msg.kind || 'ok');
    $('start').disabled = false;
  }
});

syncExactUi();
loadSaved();
