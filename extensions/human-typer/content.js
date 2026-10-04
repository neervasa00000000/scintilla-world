/**
 * Human Typer — any page including Google Docs (iframe + keyboard events).
 */
(function () {
  if (window.__humanTyperLoaded) return;
  window.__humanTyperLoaded = true;
  let stopRequested = false;
  let typing = false;
  let picking = false;
  let lockedTarget = null;
  let pickerCleanup = null;
  let pickClaimed = false;

  /** QWERTY layout — typos use physically nearby keys (real finger slips). */
  const QWERTY_ROWS = [
    '`1234567890-=',
    'qwertyuiop[]\\',
    "asdfghjkl;'",
    'zxcvbnm,./',
  ];

  function keyPosition(char) {
    const lower = char.toLowerCase();
    for (let row = 0; row < QWERTY_ROWS.length; row++) {
      const col = QWERTY_ROWS[row].indexOf(lower);
      if (col >= 0) return { row, col };
    }
    return null;
  }

  function applyCase(key, template) {
    if (/[A-Z]/.test(template) && /[a-z]/.test(key)) return key.toUpperCase();
    if (/[a-z]/.test(template) && /[A-Z]/.test(key)) return key.toLowerCase();
    return key;
  }

  /** Keys one step away on the keyboard (including diagonals). */
  function neighborKeys(char) {
    if (char === '\n' || char === '\t') return [];
    if (char === ' ') return [' ', 'c', 'v', 'b', 'n', 'm'];

    const pos = keyPosition(char);
    if (!pos) return [];

    const out = new Set();
    const deltas = [
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0],
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1],
    ];

    for (const [dr, dc] of deltas) {
      const r = pos.row + dr;
      const c = pos.col + dc;
      const row = QWERTY_ROWS[r];
      if (row && row[c]) out.add(applyCase(row[c], char));
    }
    return [...out];
  }

  function pickNeighborKey(char) {
    const pool = neighborKeys(char);
    if (pool.length) return pool[Math.floor(Math.random() * pool.length)];
    return char;
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const rand = (a, b) => a + Math.random() * (b - a);

  const isGoogleDocs = () =>
    /docs\.google\.com$/i.test(location.hostname) ||
    /docs\.google\.com$/i.test(location.host || '');

  const isEdStem = () => /edstem\.org/i.test(location.hostname || '');

  let bridgeInjected = false;

  function findCodeEditorFromNode(node) {
    if (!node || node.nodeType !== 1) return null;

    const monacoRoot =
      node.closest?.('.monaco-editor') || node.closest?.('[class*="monaco-editor"]');
    if (monacoRoot) {
      const ta = monacoRoot.querySelector('textarea.inputarea, textarea');
      return { mode: 'monaco-bridge', root: monacoRoot, el: ta || monacoRoot, pickX: 0, pickY: 0 };
    }

    const aceRoot = node.closest?.('.ace_editor');
    if (aceRoot) {
      const ta = aceRoot.querySelector('textarea.ace_text-input, textarea');
      return { mode: 'monaco-bridge', root: aceRoot, el: ta || aceRoot, pickX: 0, pickY: 0 };
    }

    const cmRoot = node.closest?.('.cm-editor, .CodeMirror');
    if (cmRoot) {
      const ta = cmRoot.querySelector('textarea, .cm-content');
      if (ta) {
        const mode =
          ta.tagName === 'TEXTAREA' ? 'input' : ta.isContentEditable ? 'contenteditable' : 'keyboard';
        return { mode, root: cmRoot, el: ta, pickX: 0, pickY: 0 };
      }
    }

    return null;
  }

  /** Resolve editor from click coordinates (Ed Workspaces / Monaco line area). */
  function findCodeEditorFromPoint(x, y) {
    const stack = document.elementsFromPoint?.(x, y) || [document.elementFromPoint(x, y)];
    for (const el of stack) {
      if (!el || el.nodeType !== 1) continue;
      const t = findCodeEditorFromNode(el);
      if (t) {
        t.pickX = x;
        t.pickY = y;
        return t;
      }
    }

    const ta =
      document.querySelector('textarea.inputarea') ||
      document.querySelector('.monaco-editor textarea');
    if (ta) {
      const r = ta.getBoundingClientRect();
      if (x >= r.left - 8 && x <= r.right + 8 && y >= r.top - 8 && y <= r.bottom + 8) {
        const root = ta.closest('.monaco-editor') || ta.parentElement;
        return { mode: 'monaco-bridge', root, el: ta, pickX: x, pickY: y };
      }
    }

    if (isEdStem()) {
      return { mode: 'monaco-bridge', root: null, el: document.body, pickX: x, pickY: y };
    }

    return null;
  }

  const BRIDGE_SOURCE_CS = 'human-typer-cs';
  const BRIDGE_SOURCE_BR = 'human-typer-bridge';

  function bridgeCommand(cmd, data = {}) {
    return new Promise((resolve) => {
      const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const timeout = setTimeout(() => {
        window.removeEventListener('message', onMsg);
        resolve({ ok: false, error: 'timeout' });
      }, 8000);
      const onMsg = (ev) => {
        if (ev.source !== window || ev.data?.source !== BRIDGE_SOURCE_BR) return;
        if (ev.data.requestId !== requestId) return;
        clearTimeout(timeout);
        window.removeEventListener('message', onMsg);
        resolve(ev.data);
      };
      window.addEventListener('message', onMsg);
      window.postMessage({ source: BRIDGE_SOURCE_CS, requestId, cmd, ...data }, '*');
    });
  }

  function injectBridgeScriptTag() {
    if (document.getElementById('human-typer-bridge')) return;
    const script = document.createElement('script');
    script.id = 'human-typer-bridge';
    script.src = chrome.runtime.getURL('pageBridge.js');
    (document.head || document.documentElement).appendChild(script);
  }

  async function ensurePageBridge() {
    injectBridgeScriptTag();
    for (let attempt = 0; attempt < 12; attempt++) {
      const r = await bridgeCommand('ping');
      if (r?.ok) {
        bridgeInjected = true;
        return true;
      }
      await sleep(150 + attempt * 100);
    }
    bridgeInjected = false;
    return false;
  }

  /** Only frames that contain an editor should show the picker (fixes EdStem iframes). */
  function frameHasEditor() {
    return Boolean(
      document.querySelector(
        [
          '.monaco-editor',
          '.ace_editor',
          '.cm-editor',
          'textarea.inputarea',
          '[class*="monaco-editor"]',
          '.view-lines',
          '.monaco-scrollable-element',
          '.mtk1',
          '[class*="CodeEditor"]',
        ].join(', ')
      )
    );
  }

  function shouldRunPickerHere() {
    if (frameHasEditor()) return true;
    if (window !== window.top) return false;
    if (document.querySelector('iframe')) return false;
    return true;
  }

  async function prepareCodeEditorTarget(target) {
    if (target.mode !== 'monaco-bridge') return target;
    const ok = await ensurePageBridge();
    if (!ok) {
      target.mode = 'bridge-unavailable';
      return target;
    }
    const focus = await bridgeCommand('focusAt', { x: target.pickX, y: target.pickY });
    if (!focus.ok) {
      const retry = await bridgeCommand('focusAt', {
        x: target.pickX || window.innerWidth / 2,
        y: target.pickY || window.innerHeight / 2,
      });
      if (!retry.ok) {
        target.mode = 'bridge-unavailable';
        return target;
      }
      target.editorKind = retry.kind;
      return target;
    }
    target.editorKind = focus.kind;
    return target;
  }

  function notifyPopup(message, kind) {
    chrome.runtime.sendMessage({ type: 'HUMAN_TYPER_STATUS', message, kind }).catch(() => {});
  }

  function donePopup(message, kind = 'ok') {
    chrome.runtime.sendMessage({ type: 'HUMAN_TYPER_DONE', message, kind }).catch(() => {});
  }

  function isTextInput(el) {
    const t = (el.type || 'text').toLowerCase();
    return ['text', 'search', 'email', 'url', 'tel', 'password', 'number', ''].includes(t);
  }

  function isTypable(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.disabled || el.readOnly) return false;
    if (el.isContentEditable && el.isContentEditable !== 'false') return true;
    if (el.tagName === 'TEXTAREA') return true;
    if (el.tagName === 'INPUT' && isTextInput(el)) return true;
    if (el.getAttribute?.('role') === 'textbox') return true;
    return false;
  }

  /** Google Docs hides the real editor in an iframe / contenteditable. */
  function findGoogleDocsEditor() {
    const selectors = [
      'iframe.docs-texteventtarget-iframe',
      'iframe[class*="texteventtarget"]',
    ];
    for (const sel of selectors) {
      const iframe = document.querySelector(sel);
      try {
        const doc = iframe?.contentDocument;
        const inner =
          doc?.querySelector('[contenteditable="true"]') ||
          doc?.querySelector('[contenteditable]');
        if (inner) return { el: inner, mode: 'keyboard', doc: true };
      } catch {
        /* cross-origin iframe */
      }
    }

    const editables = document.querySelectorAll('[contenteditable="true"]');
    for (const el of editables) {
      const label = (el.getAttribute('aria-label') || '').toLowerCase();
      if (label.includes('document') || label.includes('heading') || el.isContentEditable) {
        return { el, mode: 'keyboard', doc: true };
      }
    }

    const ta = document.querySelector(
      'textarea[aria-label*="ocument"], textarea[aria-label*="Heading"]'
    );
    if (ta) return { el: ta, mode: 'keyboard', doc: true };

    return null;
  }

  function targetFromElement(el) {
    if (!isTypable(el)) return null;
    if (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && isTextInput(el))) {
      return { el, mode: 'input' };
    }
    if (isGoogleDocs() || el.isContentEditable || el.getAttribute?.('role') === 'textbox') {
      return { el, mode: isGoogleDocs() ? 'keyboard' : 'contenteditable' };
    }
    return { el, mode: 'input' };
  }

  function findTypableFromNode(node) {
    let n = node;
    while (n && n !== document.documentElement) {
      const t = targetFromElement(n);
      if (t) return t;
      n = n.parentElement;
    }
    return null;
  }

  function findTypableFromEvent(e) {
    const path = e.composedPath?.() || [];
    for (const node of path) {
      const code = findCodeEditorFromNode(node);
      if (code) return code;
      const t = findTypableFromNode(node);
      if (t) return t;
    }
    const code = findCodeEditorFromNode(e.target);
    if (code) return code;
    const direct = findTypableFromNode(e.target);
    if (direct) return direct;
    if (isGoogleDocs()) return findGoogleDocsEditor();
    return null;
  }

  function getTypableElement() {
    if (lockedTarget) return lockedTarget;
    if (isGoogleDocs()) {
      const g = findGoogleDocsEditor();
      if (g) return g;
    }
    return findTypableFromNode(document.activeElement);
  }

  function setNativeValue(el, value) {
    const proto =
      el instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) setter.call(el, value);
    else el.value = value;
  }

  function fireInput(el, inputType, data) {
    el.dispatchEvent(
      new InputEvent('input', { bubbles: true, cancelable: true, inputType, data: data ?? null })
    );
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function dispatchKey(el, type, key, code, char, extra = {}) {
    const doc = el.ownerDocument || document;
    const keyCode =
      extra.keyCode ??
      (key === 'Enter' ? 13 : key === 'Tab' ? 9 : key === 'Backspace' ? 8 : 0);
    el.dispatchEvent(
      new KeyboardEvent(type, {
        key,
        code: code || key,
        keyCode,
        which: keyCode,
        bubbles: true,
        cancelable: true,
        composed: true,
        char: char ?? key,
        shiftKey: Boolean(extra.shiftKey),
        ...extra,
      })
    );
  }

  function normalizeTypingText(text) {
    return String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  }

  /** Run execCommand in the same document as the editor (required for Google Docs iframe). */
  function execOnEditor(el, command, value) {
    const doc = el.ownerDocument || document;
    try {
      return doc.execCommand(command, false, value ?? null);
    } catch {
      return false;
    }
  }

  /**
   * Insert a line break. Google Docs needs execCommand / Shift+Enter in its iframe document.
   */
  function insertNewline(el, { soft = true } = {}) {
    const doc = el.ownerDocument || document;
    el.focus();

    if (soft && execOnEditor(el, 'insertLineBreak')) return;
    if (!soft && execOnEditor(el, 'insertParagraph')) return;
    if (execOnEditor(el, 'insertLineBreak')) return;
    if (execOnEditor(el, 'insertParagraph')) return;

    const target = doc.activeElement && doc.activeElement !== doc.body ? doc.activeElement : el;
    const shiftKey = soft;
    const keyCode = 13;

    try {
      const legacy = doc.createEvent('Event');
      legacy.initEvent('keypress', true, true);
      legacy.key = 'Enter';
      legacy.code = 'Enter';
      legacy.keyCode = keyCode;
      legacy.which = keyCode;
      legacy.shiftKey = shiftKey;
      target.dispatchEvent(legacy);
    } catch {
      /* ignore */
    }

    dispatchKey(target, 'keydown', 'Enter', 'Enter', 'Enter', { keyCode, shiftKey });
    target.dispatchEvent(
      new InputEvent('beforeinput', {
        bubbles: true,
        cancelable: true,
        inputType: soft ? 'insertLineBreak' : 'insertParagraph',
        data: soft ? '\n' : null,
      })
    );
    target.dispatchEvent(
      new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        inputType: soft ? 'insertLineBreak' : 'insertParagraph',
      })
    );
    dispatchKey(target, 'keyup', 'Enter', 'Enter', 'Enter', { keyCode, shiftKey });
  }

  async function focusTarget(target) {
    if (target.mode === 'monaco-bridge') {
      await bridgeCommand('focusAt', { x: target.pickX, y: target.pickY });
      target.root?.click?.();
      target.el?.focus?.();
      await sleep(120);
      return;
    }
    const el = target.el;
    el.focus?.();
    el.click?.();
    if (target.doc && window !== window.top) {
      window.focus();
    }
    await sleep(80);
  }

  function insertCharInput(el, char) {
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    const val = el.value;
    setNativeValue(el, val.slice(0, start) + char + val.slice(end));
    const pos = start + char.length;
    el.selectionStart = el.selectionEnd = pos;
    fireInput(el, 'insertText', char);
  }

  function backspaceInput(el) {
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? start;
    if (start === 0 && end === 0) return false;
    const val = el.value;
    if (start !== end) {
      setNativeValue(el, val.slice(0, start) + val.slice(end));
      el.selectionStart = el.selectionEnd = start;
    } else {
      setNativeValue(el, val.slice(0, start - 1) + val.slice(start));
      el.selectionStart = el.selectionEnd = start - 1;
    }
    fireInput(el, 'deleteContentBackward', null);
    return true;
  }

  function insertCharKeyboard(el, char) {
    el.focus();

    if (char === '\n') {
      insertNewline(el, { soft: isGoogleDocs() });
      return;
    }

    if (char === '\t') {
      if (execOnEditor(el, 'insertText', '\t')) return;
      dispatchKey(el, 'keydown', 'Tab', 'Tab');
      el.dispatchEvent(
        new InputEvent('beforeinput', {
          bubbles: true,
          cancelable: true,
          inputType: 'insertText',
          data: '\t',
        })
      );
      dispatchKey(el, 'keyup', 'Tab', 'Tab');
      return;
    }

    if (execOnEditor(el, 'insertText', char)) return;

    const code =
      char.length === 1 && /[a-z]/i.test(char)
        ? `Key${char.toUpperCase()}`
        : char === ' '
          ? 'Space'
          : char;

    dispatchKey(el, 'keydown', char, code, char);
    el.dispatchEvent(
      new InputEvent('beforeinput', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: char,
      })
    );
    el.dispatchEvent(
      new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: char })
    );
    dispatchKey(el, 'keyup', char, code, char);
  }

  function backspaceKeyboard(el) {
    el.focus();
    if (execOnEditor(el, 'delete')) return true;
    dispatchKey(el, 'keydown', 'Backspace', 'Backspace');
    el.dispatchEvent(
      new InputEvent('beforeinput', {
        bubbles: true,
        cancelable: true,
        inputType: 'deleteContentBackward',
      })
    );
    dispatchKey(el, 'keyup', 'Backspace', 'Backspace');
    return true;
  }

  function insertCharContentEditable(el, char) {
    el.focus();
    if (char === '\n') {
      insertNewline(el, { soft: true });
      return;
    }
    if (char === '\t') {
      if (execOnEditor(el, 'insertText', '\t')) return;
      insertCharKeyboard(el, char);
      return;
    }
    if (execOnEditor(el, 'insertText', char)) return;
    insertCharKeyboard(el, char);
  }

  function backspaceContentEditable(el) {
    el.focus();
    if (execOnEditor(el, 'delete')) return true;
    return backspaceKeyboard(el);
  }

  function clampSpeed(speed) {
    const n = Number(speed) || 2;
    return Math.min(7, Math.max(1, n));
  }

  function delayForChar(char, speed, exactMode) {
    if (exactMode) return delayExact(char, speed);
    const s = clampSpeed(speed);
    /** ms per char before punctuation pauses — 1 ≈ 15 WPM, 4 ≈ 35 WPM, 7 ≈ 90 WPM */
    const base = [580, 450, 340, 240, 170, 115, 70][s - 1];
    let ms = base * rand(0.72, 1.58);
    if (char === ' ') ms += rand(140, 520);
    if ('.!?'.includes(char)) ms += rand(500, 1600);
    if (',;:'.includes(char)) ms += rand(220, 650);
    if (char === '\n') ms += rand(700, 2000);
    if (char === '\t') ms += rand(120, 320);
    return ms;
  }

  /** Steady timing — every character typed exactly (spaces, tabs, newlines). */
  function delayExact(char, speed) {
    const s = clampSpeed(speed);
    const base = [360, 280, 210, 155, 115, 82, 55][s - 1];
    if (char === '\n') return base * rand(2.0, 2.8);
    if (char === '\t') return base * rand(1.2, 1.7);
    if (char === ' ') return base * rand(0.95, 1.35);
    return base * rand(0.85, 1.4);
  }

  async function bridgeType(target, char, exactMode) {
    let res = await bridgeCommand('type', { char, exact: exactMode });
    if (!res.ok) {
      await sleep(80);
      res = await bridgeCommand('type', { char, exact: exactMode });
    }
    return res;
  }

  async function bridgeTypeText(text, exactMode) {
    let res = await bridgeCommand('typeText', { text, exact: exactMode });
    if (!res.ok) {
      await sleep(80);
      res = await bridgeCommand('typeText', { text, exact: exactMode });
    }
    return res;
  }

  async function typeChar(target, char, exactMode) {
    if (target.mode === 'monaco-bridge') {
      const res = await bridgeType(target, char, exactMode);
      if (!res.ok) throw new Error(res.error || 'type failed');
      if (exactMode && char === '\n') {
        await sleep(160);
        await bridgeCommand('stripLinePrefix');
        await sleep(40);
      }
    } else if (target.mode === 'input') insertCharInput(target.el, char);
    else if (target.mode === 'keyboard') insertCharKeyboard(target.el, char);
    else insertCharContentEditable(target.el, char);
    if (char === '\n' && exactMode) await sleep(isGoogleDocs() ? 120 : 50);
  }

  async function backspace(target, exactMode = false) {
    if (target.mode === 'monaco-bridge') {
      await bridgeCommand('backspace', { exact: exactMode });
      return true;
    }
    if (target.mode === 'input') return backspaceInput(target.el);
    if (target.mode === 'keyboard') return backspaceKeyboard(target.el);
    return backspaceContentEditable(target.el);
  }

  /** Human backspace: quick bursts, then a short pause before continuing. */
  async function backspaceBurst(target, count, exactMode = false) {
    const rush = count > 1 && Math.random() < 0.7;
    for (let n = 0; n < count; n++) {
      if (stopRequested) break;
      await backspace(target, exactMode);
      if (n < count - 1) {
        await sleep(rush ? rand(40, 95) : rand(85, 180));
      }
    }
    if (count > 0) await sleep(rand(180, 450));
  }

  function isWordStart(text, i) {
    if (!/[a-zA-Z]/.test(text[i])) return false;
    return i === 0 || !/[a-zA-Z]/.test(text[i - 1]);
  }

  function getWordAt(text, i) {
    if (!/[a-zA-Z]/.test(text[i])) return null;
    let end = i;
    while (end < text.length && /[a-zA-Z]/.test(text[end])) end++;
    const word = text.slice(i, end);
    if (word.length < 2 || word.length > 18 || /\d/.test(word)) return null;
    return word;
  }

  function neighborMangleWord(word, intensity = 0.45) {
    let out = '';
    for (const c of word) {
      out += Math.random() < intensity ? pickNeighborKey(c) : c;
    }
    return out;
  }

  /** Build a plausible wrong version (e.g. "the" → "tre"), never identical to the real word. */
  function mangleWord(word) {
    const tries = [];

    tries.push(() => {
      const j = 1 + Math.floor(Math.random() * (word.length - 1));
      return word.slice(0, j) + pickNeighborKey(word[j]) + word.slice(j + 1);
    });

    tries.push(() => {
      const k = Math.max(1, word.length - (word.length >= 4 ? 2 : 1));
      let suffix = '';
      for (const c of word.slice(k)) suffix += pickNeighborKey(c);
      return word.slice(0, k) + suffix;
    });

    if (word.length >= 3) {
      tries.push(() => {
        const j = Math.floor(Math.random() * (word.length - 1));
        return word.slice(0, j) + word[j + 1] + word[j] + word.slice(j + 2);
      });
      tries.push(() => {
        const j = 1 + Math.floor(Math.random() * (word.length - 2));
        return word.slice(0, j) + word.slice(j + 1);
      });
    }

    if (word.length >= 2) {
      tries.push(() => neighborMangleWord(word, 0.55));
      tries.push(() => word + pickNeighborKey(word[word.length - 1]));
      tries.push(() => {
        const mid = Math.min(1, word.length - 2);
        return word.slice(0, mid) + pickNeighborKey(word[mid + 1] || word[mid]) + word.slice(mid + 2);
      });
    }

    for (let n = 0; n < 12; n++) {
      const fn = tries[Math.floor(Math.random() * tries.length)];
      const candidate = fn();
      if (candidate && candidate !== word && /[a-zA-Z]/.test(candidate)) return candidate;
    }
    const fallback = neighborMangleWord(word, 0.7);
    return fallback !== word ? fallback : word.slice(0, -1) + pickNeighborKey(word.slice(-1));
  }

  /**
   * Type a wrong word, pause, backspace all of it, then retype the correct word (e.g. "tre" → fix → "the").
   * Returns how many characters of the source text were typed correctly.
   */
  async function playWordTypoAndFix(target, text, i, mistakeRate, speed) {
    if (!isWordStart(text, i)) return 0;
    const word = getWordAt(text, i);
    if (!word) return 0;
    if (Math.random() >= mistakeRate * 0.65) return 0;

    const wrong = mangleWord(word);
    if (!wrong || wrong === word) return 0;

    for (const ch of wrong) {
      if (stopRequested) return 0;
      await typeChar(target, ch, false);
      await sleep(rand(150, 380));
    }

    await sleep(rand(700, 2000));

    await backspaceBurst(target, wrong.length);

    await sleep(rand(380, 950));

    for (const ch of word) {
      if (stopRequested) return 0;
      await typeChar(target, ch, false);
      await sleep(delayForChar(ch, speed, false));
    }

    return word.length;
  }

  /**
   * Type wrong key(s) on nearby QWERTY positions, pause, backspace them out, then caller types correct char.
   */
  async function playTypoAndFix(target, correctChar, mistakeRate, nextChar) {
    if (!/[a-zA-Z]/.test(correctChar)) return false;
    if (Math.random() >= mistakeRate) return false;

    const strokes = [];
    const roll = Math.random();

    if (roll < 0.5) {
      strokes.push(pickNeighborKey(correctChar));
    } else if (roll < 0.8) {
      strokes.push(pickNeighborKey(correctChar));
      strokes.push(pickNeighborKey(correctChar));
      if (Math.random() < 0.35) strokes.push(pickNeighborKey(correctChar));
    } else if (roll < 0.92) {
      strokes.push(pickNeighborKey(correctChar));
      const nearNext =
        nextChar && nextChar.trim() && nextChar !== '\n' ? pickNeighborKey(nextChar) : null;
      if (nearNext) strokes.push(nearNext);
    } else {
      strokes.push(
        correctChar === correctChar.toLowerCase()
          ? correctChar.toUpperCase()
          : correctChar.toLowerCase()
      );
    }

    for (const ch of strokes) {
      if (stopRequested) break;
      await typeChar(target, ch);
      await sleep(rand(130, 340));
    }

    await sleep(rand(420, 1100));

    await backspaceBurst(target, strokes.length);

    if (Math.random() < 0.3) await sleep(rand(200, 600));

    return true;
  }

  /** Swap two letters (teh → the). */
  async function playTransposeTypo(target, a, b, mistakeRate) {
    if (!/[a-zA-Z]/.test(a) || !/[a-zA-Z]/.test(b)) return false;
    if (Math.random() >= mistakeRate * 0.35) return false;

    await typeChar(target, b);
    await sleep(rand(160, 340));
    await typeChar(target, a);
    await sleep(rand(350, 850));
    await backspaceBurst(target, 2);
    await sleep(rand(260, 580));
    return true;
  }

  function highlightEl(el, on) {
    if (!el || el === document.body) return;
    try {
      if (on) {
        el.dataset.humanTyperHover = '1';
        el.style.outline = '2px solid #6c9eff';
        el.style.outlineOffset = '2px';
      } else if (el.dataset.humanTyperHover) {
        delete el.dataset.humanTyperHover;
        el.style.outline = '';
        el.style.outlineOffset = '';
      }
    } catch {
      /* read-only style on some nodes */
    }
  }

  let lastHoverEl = null;

  function cancelPicker() {
    picking = false;
    pickClaimed = false;
    if (pickerCleanup) {
      pickerCleanup();
      pickerCleanup = null;
    }
    if (lastHoverEl) {
      highlightEl(lastHoverEl, false);
      lastHoverEl = null;
    }
  }

  function startPicker(onPicked) {
    cancelPicker();
    picking = true;
    stopRequested = false;
    pickClaimed = false;

    const bannerText = isGoogleDocs()
      ? 'Click anywhere in the document · Esc to cancel'
      : document.querySelector('.monaco-editor, .ace_editor')
        ? 'Click in the code editor · Esc to cancel'
        : 'Click the text box where you want to type · Esc to cancel';

    const overlay = document.createElement('div');
    overlay.id = 'human-typer-overlay';
    overlay.setAttribute(
      'style',
      [
        'position:fixed',
        'inset:0',
        'z-index:2147483646',
        'cursor:crosshair',
        'background:rgba(10,10,20,0.25)',
        'display:flex',
        'align-items:flex-start',
        'justify-content:center',
        'padding-top:16px',
        'pointer-events:none',
      ].join(';')
    );
    const banner = document.createElement('div');
    banner.setAttribute(
      'style',
      [
        'pointer-events:none',
        'background:#1a1a24',
        'color:#e8e8ec',
        'padding:12px 20px',
        'border-radius:10px',
        'font:600 14px system-ui,sans-serif',
        'box-shadow:0 8px 32px rgba(0,0,0,.4)',
        'border:1px solid #6c9eff',
      ].join(';')
    );
    banner.textContent = bannerText;
    overlay.appendChild(banner);

    const onMove = (e) => {
      if (!picking || pickClaimed) return;
      let t = findTypableFromEvent(e);
      if (!t) t = findCodeEditorFromPoint(e.clientX, e.clientY);
      if (!t && isGoogleDocs()) t = findGoogleDocsEditor();
      const el = t?.root || t?.el || null;
      if (lastHoverEl && lastHoverEl !== el) highlightEl(lastHoverEl, false);
      lastHoverEl = el;
      if (el) highlightEl(el, true);
    };

    const onPointerDown = async (e) => {
      if (!picking || pickClaimed) return;
      if (e.button !== 0) return;

      let t = findTypableFromEvent(e);
      if (!t) t = findCodeEditorFromPoint(e.clientX, e.clientY);
      if (!t && isGoogleDocs()) t = findGoogleDocsEditor();

      if (!t) {
        notifyPopup('Click inside the dark code area (not the file list).', 'err');
        return;
      }

      t.pickX = e.clientX;
      t.pickY = e.clientY;

      pickClaimed = true;
      const useBridge = t.mode === 'monaco-bridge';

      cancelPicker();
      chrome.runtime.sendMessage({ type: 'HUMAN_TYPER_CANCEL_PICK' }).catch(() => {});

      if (!useBridge) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      }

      notifyPopup('Connecting to editor…', 'ok');

      if (useBridge) await sleep(150);

      notifyPopup('Typing…', 'ok');
      onPicked(t);
    };

    const onKey = (e) => {
      if (e.key === 'Escape') {
        stopRequested = true;
        cancelPicker();
        notifyPopup('Cancelled.', '');
        donePopup('Cancelled.', '');
      }
    };

    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('mousedown', onPointerDown, true);
    document.addEventListener('keydown', onKey, true);
    if (document.body) document.body.appendChild(overlay);
    else document.documentElement.appendChild(overlay);

    pickerCleanup = () => {
      document.removeEventListener('mousemove', onMove, true);
      document.removeEventListener('mousedown', onPointerDown, true);
      document.removeEventListener('keydown', onKey, true);
      overlay.remove();
      if (lastHoverEl) highlightEl(lastHoverEl, false);
    };

    notifyPopup(
      isEdStem()
        ? 'Click in the code panel below this banner…'
        : isGoogleDocs()
          ? 'Click in the Google Doc…'
          : 'Click the text box on the page…',
      'ok'
    );
  }

  /** EdStem / Monaco: type line-by-line, strip auto-indent after each newline. */
  async function humanTypeExactMonaco(text, speed, target) {
    const lines = text.split('\n');
    for (let li = 0; li < lines.length && !stopRequested; li++) {
      notifyPopup(`Typing line ${li + 1} of ${lines.length}…`, 'ok');
      const line = lines[li];
      const indent = line.match(/^ +/);
      if (indent) {
        const res = await bridgeTypeText(indent[0], true);
        if (!res.ok) throw new Error(`indent failed line ${li + 1}`);
        await sleep(delayExact(' ', speed) * Math.min(indent[0].length, 12) * 0.35);
      }
      const body = indent ? line.slice(indent[0].length) : line;
      for (let ci = 0; ci < body.length && !stopRequested; ci++) {
        const ch = body[ci];
        const res = await bridgeType(target, ch, true);
        if (!res.ok) throw new Error(`char failed line ${li + 1} col ${ci + 1}`);
        if (Math.random() < 0.02) await sleep(rand(400, 1200));
        else await sleep(delayExact(ch, speed));
      }
      if (li < lines.length - 1 && !stopRequested) {
        const res = await bridgeType(target, '\n', true);
        if (!res.ok) throw new Error(`newline failed after line ${li + 1}`);
        await sleep(delayExact('\n', speed));
        await sleep(160);
        await bridgeCommand('stripLinePrefix');
        await sleep(40);
      }
    }
  }

  async function humanType(text, speed, mistakeRate, target, exactMode) {
    if (!target) return { ok: false, error: 'No text field targeted.' };

    target = await prepareCodeEditorTarget(target);
    if (target.mode === 'bridge-unavailable') {
      return {
        ok: false,
        error:
          'Could not connect to the code editor. Refresh EdStem, reload the extension (v1.6), click inside the code, then Start again.',
      };
    }

    lockedTarget = target;
    await focusTarget(target);
    typing = true;
    stopRequested = false;

    const useExactBridge = target.mode === 'monaco-bridge' && exactMode;
    if (useExactBridge) await bridgeCommand('beginExact');

    const typos = exactMode ? 0 : mistakeRate;
    notifyPopup(
      exactMode ? 'Exact mode — typing every character…' : 'Typing… Press Esc to stop.',
      'ok'
    );

    let i = 0;
    let typed = 0;
    try {
    if (useExactBridge) {
      await humanTypeExactMonaco(text, speed, target);
      typed = text.length;
    } else while (i < text.length && !stopRequested) {
      const correct = text[i];
      const next = i + 1 < text.length ? text[i + 1] : '';

      if (!exactMode) {
        if (isWordStart(text, i)) {
          const wordDone = await playWordTypoAndFix(target, text, i, typos, speed);
          if (wordDone > 0) {
            i += wordDone;
            if (!stopRequested && Math.random() < 0.04) await sleep(rand(400, 1200));
            continue;
          }
        }

        if (
          next &&
          /[a-zA-Z]/.test(correct) &&
          /[a-zA-Z]/.test(next) &&
          (await playTransposeTypo(target, correct, next, typos))
        ) {
          await typeChar(target, correct, false);
          await sleep(rand(140, 300));
          await typeChar(target, next, false);
          i += 2;
          await sleep(delayForChar(next, speed, false));
          continue;
        }
        await playTypoAndFix(target, correct, typos, next);
      }

      if (stopRequested) break;
      await typeChar(target, correct, exactMode);
      i++;

      if (!exactMode && Math.random() < 0.09) await sleep(rand(800, 2800));
      else if (exactMode && Math.random() < 0.03) await sleep(rand(400, 1200));
      else await sleep(delayForChar(correct, speed, exactMode));
      typed = i + 1;
    }
    } catch (err) {
      typing = false;
      lockedTarget = null;
      if (useExactBridge) await bridgeCommand('endExact').catch(() => {});
      return {
        ok: false,
        message: err?.message || 'Typing failed in code editor.',
      };
    } finally {
      if (useExactBridge) await bridgeCommand('endExact').catch(() => {});
    }

    typing = false;
    lockedTarget = null;
    if (stopRequested) return { ok: true, message: 'Stopped.' };
    if (typed < text.length) {
      return { ok: false, message: `Stopped early at character ${typed} of ${text.length}.` };
    }
    return { ok: true, message: 'Done typing.' };
  }

  async function tryAutoStartEdStem(msg, doType) {
    if (!msg.autoEdStem) return false;

    notifyPopup('Connecting to code editor…', 'ok');

    if (!(await ensurePageBridge())) {
      notifyPopup('Bridge failed — refresh page & extension (v1.7.1).', 'err');
      donePopup('Bridge not ready.', 'err');
      return false;
    }

    const focus = await bridgeCommand('focusPrimaryEditor');
    if (!focus.ok) {
      notifyPopup('Editor not found — click the code panel once, then Start.', 'err');
      return false;
    }

    const root =
      document.querySelector('.monaco-editor') ||
      document.querySelector('[class*="monaco-editor"]');
    const ta = document.querySelector('textarea.inputarea, .monaco-editor textarea');

    notifyPopup('Typing at cursor…', 'ok');
    await doType({
      mode: 'monaco-bridge',
      root: root || document.body,
      el: ta || root || document.body,
      pickX: focus.x || 0,
      pickY: focus.y || 0,
    });
    return true;
  }

  async function runJob(msg) {
    notifyPopup('Human Typer active on this page…', 'ok');
    const text = normalizeTypingText(msg.text || '');
    await sleep(200);
    const doType = async (target) => {
      try {
        const result = await humanType(
          text,
          msg.speed || 2,
          msg.mistakeRate ?? 0.12,
          target,
          Boolean(msg.exactMode)
        );
        donePopup(result.message || '', result.ok ? 'ok' : 'err');
      } catch (err) {
        donePopup(err?.message || 'Typing failed.', 'err');
      }
    };

    if (await tryAutoStartEdStem(msg, doType)) return;

    if (msg.autoEdStem) {
      notifyPopup('Auto-start failed — click inside the code editor…', 'ok');
    }

    if (msg.clickToTarget !== false) {
      startPicker((target) => doType(target));
      return;
    }

    let target = getTypableElement();
    if (!target && isGoogleDocs()) target = findGoogleDocsEditor();
    if (!target) {
      donePopup('Click inside a text field first.', 'err');
      return;
    }
    await doType(target);
  }

  document.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Escape' && (typing || picking)) {
        stopRequested = true;
        if (picking) cancelPicker();
        notifyPopup('Stopping…', '');
      }
    },
    true
  );

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'HUMAN_TYPER_CANCEL_PICK') {
      if (!pickClaimed) cancelPicker();
      return;
    }

    if (msg.type === 'HUMAN_TYPER_STOP') {
      stopRequested = true;
      cancelPicker();
      return;
    }

    if (msg.type === 'HUMAN_TYPER_START') {
      if (typing || picking) return;
      if (!shouldRunPickerHere() && !msg.autoEdStem) return;
      stopRequested = false;
      runJob(msg);
    }
  });
})();
