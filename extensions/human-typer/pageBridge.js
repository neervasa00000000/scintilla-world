/**
 * Page-context bridge (MAIN world). Talks to the content script via postMessage.
 */
(function () {
  if (window.__humanTyperBridge) return;
  window.__humanTyperBridge = true;

  const CS = 'human-typer-cs';
  const BR = 'human-typer-bridge';

  let activeEditor = null;
  let activeKind = null;
  let savedMonacoOptions = null;
  let exactSession = false;

  const MONACO_EXACT_OFF = {
    autoIndent: 'none',
    formatOnType: false,
    formatOnPaste: false,
    quickSuggestions: false,
    suggestOnTriggerCharacters: false,
    tabCompletion: 'off',
    wordBasedSuggestions: 'off',
    autoClosingBrackets: 'never',
    autoClosingQuotes: 'never',
    autoSurround: 'never',
    acceptSuggestionOnEnter: 'off',
    snippetSuggestions: 'none',
  };

  const MONACO_KEYS = Object.keys(MONACO_EXACT_OFF);

  function respond(requestId, payload) {
    window.postMessage({ source: BR, requestId, ...payload }, '*');
  }

  function getMonacoEditors() {
    const out = [];
    try {
      if (window.monaco?.editor?.getEditors) {
        out.push(...monaco.editor.getEditors());
      }
    } catch {
      /* ignore */
    }
    document.querySelectorAll('.monaco-editor').forEach((root) => {
      if (root._editor) out.push(root._editor);
      if (root.editor) out.push(root.editor);
      if (root.__editor) out.push(root.__editor);
    });
    const seen = new Set();
    return out.filter((ed) => {
      if (!ed || seen.has(ed)) return false;
      seen.add(ed);
      return true;
    });
  }

  function findMonacoTextarea() {
    return (
      document.querySelector('.monaco-editor textarea.inputarea') ||
      document.querySelector('textarea.inputarea') ||
      document.querySelector('.monaco-editor textarea')
    );
  }

  function editorsAtPoint(x, y) {
    const hits = [];
    for (const ed of getMonacoEditors()) {
      try {
        const node = ed.getDomNode?.();
        if (!node) continue;
        const r = node.getBoundingClientRect();
        if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
          hits.push({ kind: 'monaco', ed, area: r.width * r.height });
        }
      } catch {
        /* ignore */
      }
    }

    const ta = findMonacoTextarea();
    if (ta) {
      const r = ta.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
        hits.push({ kind: 'textarea', ed: ta, area: r.width * r.height });
      }
    }

    if (window.ace?.edit) {
      document.querySelectorAll('.ace_editor').forEach((root) => {
        const r = root.getBoundingClientRect();
        if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
          try {
            const ed = ace.edit(root);
            if (ed) hits.push({ kind: 'ace', ed, area: r.width * r.height });
          } catch {
            /* ignore */
          }
        }
      });
    }

    hits.sort((a, b) => a.area - b.area);
    return hits;
  }

  function focusPrimaryEditor() {
    const editors = getMonacoEditors();
    if (editors.length) {
      let best = editors[0];
      let bestArea = 0;
      for (const ed of editors) {
        const node = ed.getDomNode?.();
        if (!node) continue;
        const r = node.getBoundingClientRect();
        const area = r.width * r.height;
        if (area > bestArea) {
          bestArea = area;
          best = ed;
        }
      }
      activeEditor = best;
      activeKind = 'monaco';
      activeEditor.focus();
      const node = best.getDomNode?.();
      const r = node?.getBoundingClientRect?.();
      return {
        ok: true,
        kind: 'monaco',
        x: r ? (r.left + r.right) / 2 : 0,
        y: r ? (r.top + r.bottom) / 2 : 0,
      };
    }

    const ta = findMonacoTextarea();
    if (ta) {
      activeEditor = ta;
      activeKind = 'textarea';
      ta.focus();
      const r = ta.getBoundingClientRect();
      return { ok: true, kind: 'textarea', x: (r.left + r.right) / 2, y: (r.top + r.bottom) / 2 };
    }

    return { ok: false };
  }

  function pickEditorAt(x, y) {
    const hits = editorsAtPoint(x, y);
    if (!hits.length) {
      const stack = document.elementsFromPoint?.(x, y) || [document.elementFromPoint(x, y)];
      for (const el of stack) {
        const root =
          el?.closest?.('.monaco-editor') ||
          el?.closest?.('[class*="monaco-editor"]') ||
          el?.closest?.('.view-lines')?.closest?.('[class*="monaco"]');
        const ta = root?.querySelector?.('textarea') || findMonacoTextarea();
        if (ta) {
          activeEditor = ta;
          activeKind = 'textarea';
          ta.focus();
          return true;
        }
      }

      const editors = getMonacoEditors();
      if (editors.length) {
        activeEditor = editors[0];
        activeKind = 'monaco';
        activeEditor.focus();
        activeEditor.setPosition?.({ lineNumber: 1, column: 1 });
        return true;
      }

      const ta = findMonacoTextarea();
      if (ta) {
        activeEditor = ta;
        activeKind = 'textarea';
        ta.focus();
        return true;
      }
      return false;
    }
    activeEditor = hits[0].ed;
    activeKind = hits[0].kind;
    try {
      if (activeKind === 'monaco') activeEditor.focus();
      else activeEditor.focus?.();
    } catch {
      /* ignore */
    }
    return true;
  }

  function beginExactSession() {
    exactSession = true;
    if (activeKind !== 'monaco' || !activeEditor) return true;
    const ed = activeEditor;
    try {
      savedMonacoOptions =
        typeof ed.getRawOptions === 'function' ? { ...ed.getRawOptions() } : {};
    } catch {
      savedMonacoOptions = {};
    }
    ed.updateOptions(MONACO_EXACT_OFF);
    return true;
  }

  function endExactSession() {
    if (activeKind === 'monaco' && activeEditor && savedMonacoOptions) {
      const patch = {};
      for (const k of MONACO_KEYS) {
        if (k in savedMonacoOptions) patch[k] = savedMonacoOptions[k];
      }
      try {
        if (Object.keys(patch).length) activeEditor.updateOptions(patch);
      } catch {
        /* ignore */
      }
    }
    savedMonacoOptions = null;
    exactSession = false;
    return true;
  }

  function stripLinePrefixTextarea() {
    if (activeKind !== 'textarea' || !activeEditor) return true;
    const ta = activeEditor;
    const pos = ta.selectionStart ?? 0;
    const val = ta.value;
    const lineStart = val.lastIndexOf('\n', Math.max(0, pos - 1)) + 1;
    const lineEnd = val.indexOf('\n', pos);
    const end = lineEnd === -1 ? val.length : lineEnd;
    const line = val.slice(lineStart, end);
    const lead = (line.match(/^\s*/) || [''])[0].length;
    if (lead === 0) return true;
    ta.value = val.slice(0, lineStart) + line.slice(lead);
    const newPos = Math.max(lineStart, pos - lead);
    ta.selectionStart = ta.selectionEnd = newPos;
    ta.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }));
    return true;
  }

  function stripLinePrefixMonaco() {
    if (activeKind !== 'monaco' || !activeEditor) return true;
    const ed = activeEditor;
    const model = ed.getModel();
    const pos = ed.getPosition();
    if (!model || !pos) return true;
    const line = model.getLineContent(pos.lineNumber);
    const lead = (line.match(/^\s*/) || [''])[0].length;
    if (lead === 0) return true;
    ed.pushUndoStop();
    ed.executeEdits('humanTyper', [
      {
        range: new monaco.Range(pos.lineNumber, 1, pos.lineNumber, lead + 1),
        text: '',
        forceMoveMarkers: true,
      },
    ]);
    return true;
  }

  function insertExactText(text) {
    if (!activeEditor || !text) return false;

    if (activeKind === 'monaco') {
      const ed = activeEditor;
      ed.focus();
      const selections = ed.getSelections();
      ed.pushUndoStop();
      ed.executeEdits(
        'humanTyper',
        selections.map((sel) => ({ range: sel, text, forceMoveMarkers: true }))
      );
      return true;
    }

    if (activeKind === 'textarea') {
      return typeOnTextarea(activeEditor, text);
    }

    if (activeKind === 'ace') {
      activeEditor.focus();
      activeEditor.insert(text);
      return true;
    }

    return false;
  }

  function typeOnTextarea(ta, text) {
    ta.focus();
    const start = ta.selectionStart ?? ta.value.length;
    const end = ta.selectionEnd ?? start;
    const val = ta.value;
    const next = val.slice(0, start) + text + val.slice(end);
    ta.value = next;
    const pos = start + text.length;
    ta.selectionStart = ta.selectionEnd = pos;
    ta.dispatchEvent(
      new InputEvent('beforeinput', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: text,
      })
    );
    ta.dispatchEvent(
      new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text })
    );
    return true;
  }

  function deleteLeftExact() {
    if (!activeEditor) return false;

    if (activeKind === 'monaco') {
      const ed = activeEditor;
      const pos = ed.getPosition();
      const model = ed.getModel();
      if (!pos || !model) return false;
      let range;
      if (pos.column > 1) {
        range = new monaco.Range(pos.lineNumber, pos.column - 1, pos.lineNumber, pos.column);
      } else if (pos.lineNumber > 1) {
        const prevLine = pos.lineNumber - 1;
        range = new monaco.Range(prevLine, model.getLineMaxColumn(prevLine), pos.lineNumber, pos.column);
      } else return false;
      ed.pushUndoStop();
      ed.executeEdits('humanTyper', [{ range, text: '', forceMoveMarkers: true }]);
      return true;
    }

    if (activeKind === 'textarea') {
      const ta = activeEditor;
      ta.focus();
      const start = ta.selectionStart ?? 0;
      const end = ta.selectionEnd ?? start;
      if (start === 0 && end === 0) return false;
      const val = ta.value;
      if (start !== end) {
        ta.value = val.slice(0, start) + val.slice(end);
        ta.selectionStart = ta.selectionEnd = start;
      } else {
        ta.value = val.slice(0, start - 1) + val.slice(start);
        ta.selectionStart = ta.selectionEnd = start - 1;
      }
      ta.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }));
      return true;
    }

    if (activeKind === 'ace') {
      activeEditor.remove('left');
      return true;
    }

    return false;
  }

  function typeChar(ch, exact) {
    if (!activeEditor) return false;
    if (exact || exactSession) return insertExactText(ch);

    if (activeKind === 'monaco') {
      activeEditor.focus();
      activeEditor.trigger('keyboard', 'type', { text: ch });
      return true;
    }
    if (activeKind === 'textarea') return typeOnTextarea(activeEditor, ch);
    if (activeKind === 'ace') {
      activeEditor.insert(ch);
      return true;
    }
    return false;
  }

  function deleteLeft(exact) {
    if (!activeEditor) return false;
    if (exact || exactSession) return deleteLeftExact();
    if (activeKind === 'monaco') {
      activeEditor.trigger('keyboard', 'deleteLeft', {});
      return true;
    }
    if (activeKind === 'textarea') return deleteLeftExact();
    if (activeKind === 'ace') {
      activeEditor.remove('left');
      return true;
    }
    return false;
  }

  window.addEventListener('message', (ev) => {
    if (ev.source !== window) return;
    const data = ev.data;
    if (!data || data.source !== CS) return;

    const { requestId, cmd, x, y, char, text, exact } = data;

    try {
      if (cmd === 'ping') {
        respond(requestId, {
          ok: true,
          hasMonaco: getMonacoEditors().length > 0,
          hasTextarea: Boolean(findMonacoTextarea()),
          hasAce: Boolean(window.ace?.edit),
        });
        return;
      }
      if (cmd === 'focusAt') {
        respond(requestId, { ok: pickEditorAt(x, y), kind: activeKind });
        return;
      }
      if (cmd === 'focusPrimaryEditor') {
        respond(requestId, focusPrimaryEditor());
        return;
      }
      if (cmd === 'beginExact') {
        respond(requestId, { ok: beginExactSession(), kind: activeKind });
        return;
      }
      if (cmd === 'endExact') {
        respond(requestId, { ok: endExactSession() });
        return;
      }
      if (cmd === 'stripLinePrefix') {
        let ok = true;
        if (activeKind === 'monaco') ok = stripLinePrefixMonaco();
        else if (activeKind === 'textarea') ok = stripLinePrefixTextarea();
        respond(requestId, { ok: Boolean(ok) });
        return;
      }
      if (cmd === 'typeText') {
        respond(requestId, { ok: insertExactText(text) });
        return;
      }
      if (cmd === 'type') {
        respond(requestId, { ok: typeChar(char, exact) });
        return;
      }
      if (cmd === 'backspace') {
        respond(requestId, { ok: deleteLeft(exact) });
        return;
      }
      respond(requestId, { ok: false, error: 'unknown cmd' });
    } catch (err) {
      respond(requestId, { ok: false, error: String(err?.message || err) });
    }
  });
})();
