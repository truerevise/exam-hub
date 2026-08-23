// Bulk Import mobile paste fix.
// Do not rely on the browser's native paste path for large clipboard payloads.
// Android Chrome/WebView can truncate or partially insert large pastes. This file
// provides a capture-phase paste handler plus a Clipboard API fallback button.

function installBulkInputFix() {
  const el = document.getElementById('source');
  if (!el || el.dataset.largePasteFix === '2') return;
  el.dataset.largePasteFix = '2';

  el.removeAttribute('maxlength');
  el.maxLength = -1;
  el.setAttribute('wrap', 'off');
  el.setAttribute('autocomplete', 'off');
  el.setAttribute('spellcheck', 'false');

  let counter = document.getElementById('sourceCharCount');
  if (!counter) {
    counter = document.createElement('div');
    counter.id = 'sourceCharCount';
    counter.className = 'help';
    counter.style.textAlign = 'right';
    counter.style.marginTop = '4px';
    el.insertAdjacentElement('afterend', counter);
  }

  const updateCount = () => {
    const chars = el.value.length;
    const lines = el.value ? el.value.split(/\n/).length : 0;
    const questions = (el.value.match(/^\s*(?:Q(?:uestion)?\s*)\d{1,4}\s*[.):-]/gim) || []).length;
    counter.textContent = `${chars.toLocaleString()} characters • ${lines.toLocaleString()} lines • ${questions.toLocaleString()} questions detected • No character limit`;
  };

  const insertText = text => {
    if (typeof text !== 'string' || !text.length) return false;
    const start = Number.isInteger(el.selectionStart) ? el.selectionStart : el.value.length;
    const end = Number.isInteger(el.selectionEnd) ? el.selectionEnd : start;
    const before = el.value.slice(0, start);
    const after = el.value.slice(end);
    el.value = before + text + after;
    const cursor = start + text.length;
    try { el.setSelectionRange(cursor, cursor); } catch (_) {}
    el.dispatchEvent(new Event('input', { bubbles: true }));
    updateCount();
    return true;
  };

  // Capture before other page handlers. This prevents another listener from
  // replacing/truncating the value after a large paste.
  document.addEventListener('paste', event => {
    if (event.target !== el) return;
    const text = event.clipboardData?.getData('text/plain');
    if (typeof text !== 'string' || !text.length) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    insertText(text);
  }, true);

  // Add a reliable Android-friendly button that reads the complete clipboard
  // through navigator.clipboard instead of the keyboard paste path.
  let pasteBtn = document.getElementById('pasteFullClipboard');
  if (!pasteBtn) {
    pasteBtn = document.createElement('button');
    pasteBtn.id = 'pasteFullClipboard';
    pasteBtn.type = 'button';
    pasteBtn.className = 'btn secondary';
    pasteBtn.style.marginTop = '8px';
    pasteBtn.textContent = '📋 Paste Full Clipboard';
    el.insertAdjacentElement('afterend', pasteBtn);
  }

  pasteBtn.addEventListener('click', async () => {
    try {
      if (!navigator.clipboard?.readText) throw new Error('Clipboard API unavailable');
      const text = await navigator.clipboard.readText();
      if (!text) throw new Error('Clipboard is empty');
      insertText(text);
      el.focus();
      pasteBtn.textContent = `✓ Pasted ${text.length.toLocaleString()} characters`;
      setTimeout(() => { pasteBtn.textContent = '📋 Paste Full Clipboard'; }, 2500);
    } catch (e) {
      pasteBtn.textContent = '⚠️ Tap here and allow clipboard access';
      setTimeout(() => { pasteBtn.textContent = '📋 Paste Full Clipboard'; }, 3000);
    }
  });

  el.addEventListener('input', updateCount);
  updateCount();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', installBulkInputFix, { once: true });
} else {
  installBulkInputFix();
}
