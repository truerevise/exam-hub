// Bulk Import mobile/large-series input fix v4.
// IMPORTANT: never set textarea.maxLength=0. For a textarea, 0 means zero characters.
// This version removes the limit completely and uses direct clipboard/file loading.

function installBulkInputFix() {
  const el = document.getElementById('source');
  if (!el || el.dataset.largePasteFix === '4') return;
  el.dataset.largePasteFix = '4';

  // Remove every possible character limit. Do NOT set maxLength=0.
  el.removeAttribute('maxlength');
  el.removeAttribute('maxLength');
  try { el.maxLength = 2147483647; } catch (_) {}
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

  const questionCount = text =>
    (String(text || '').match(/^\s*(?:Q(?:uestion)?\s*)\d{1,4}\s*[.):-]/gim) || []).length;

  const updateCount = () => {
    const value = el.value || '';
    counter.textContent = `${value.length.toLocaleString()} characters • ${value.split(/\n/).length.toLocaleString()} lines • ${questionCount(value).toLocaleString()} questions detected • No character limit`;
  };

  const putFullText = text => {
    if (typeof text !== 'string' || !text.length) return false;
    // Direct assignment bypasses Android's textarea paste/input limit.
    el.value = text;
    try { el.setSelectionRange(text.length, text.length); } catch (_) {}
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    updateCount();
    return true;
  };

  // Capture paste before other handlers and insert the complete clipboardData text.
  document.addEventListener('paste', event => {
    if (event.target !== el) return;
    const text = event.clipboardData?.getData('text/plain');
    if (typeof text !== 'string' || !text.length) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    putFullText(text);
  }, true);

  let pasteBtn = document.getElementById('pasteFullClipboard');
  if (!pasteBtn) {
    pasteBtn = document.createElement('button');
    pasteBtn.id = 'pasteFullClipboard';
    pasteBtn.type = 'button';
    pasteBtn.className = 'btn secondary';
    pasteBtn.style.marginTop = '8px';
    pasteBtn.textContent = '📋 Load FULL Clipboard';
    el.insertAdjacentElement('afterend', pasteBtn);
  }

  let previewClipboardBtn = document.getElementById('previewClipboard');
  if (!previewClipboardBtn) {
    previewClipboardBtn = document.createElement('button');
    previewClipboardBtn.id = 'previewClipboard';
    previewClipboardBtn.type = 'button';
    previewClipboardBtn.className = 'btn';
    previewClipboardBtn.style.marginTop = '8px';
    previewClipboardBtn.textContent = '📋 Load Clipboard + Preview';
    pasteBtn.insertAdjacentElement('afterend', previewClipboardBtn);
  }

  // A file path is the most reliable fallback for very large series on Android.
  let fileInput = document.getElementById('bulkTextFile');
  if (!fileInput) {
    fileInput = document.createElement('input');
    fileInput.id = 'bulkTextFile';
    fileInput.type = 'file';
    fileInput.accept = '.txt,.text,text/plain';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);
  }
  let fileBtn = document.getElementById('loadBulkTextFile');
  if (!fileBtn) {
    fileBtn = document.createElement('button');
    fileBtn.id = 'loadBulkTextFile';
    fileBtn.type = 'button';
    fileBtn.className = 'btn secondary';
    fileBtn.style.marginTop = '8px';
    fileBtn.textContent = '📄 Load Full Series from .txt';
    previewClipboardBtn.insertAdjacentElement('afterend', fileBtn);
  }

  async function readClipboard() {
    if (!navigator.clipboard?.readText) throw new Error('Clipboard API unavailable');
    const text = await navigator.clipboard.readText();
    if (!text) throw new Error('Clipboard is empty');
    putFullText(text);
    el.focus();
    return text;
  }

  pasteBtn.onclick = async () => {
    try {
      const text = await readClipboard();
      pasteBtn.textContent = `✓ Loaded ${text.length.toLocaleString()} characters / ${questionCount(text)} questions`;
    } catch (e) {
      console.error(e);
      pasteBtn.textContent = '⚠️ Allow clipboard access, then tap again';
    }
    setTimeout(() => { pasteBtn.textContent = '📋 Load FULL Clipboard'; }, 3500);
  };

  previewClipboardBtn.onclick = async () => {
    try {
      const text = await readClipboard();
      const preview = document.getElementById('preview');
      if (preview) preview.click();
      previewClipboardBtn.textContent = `✓ ${questionCount(text)} questions loaded + previewed`;
    } catch (e) {
      console.error(e);
      previewClipboardBtn.textContent = '⚠️ Clipboard access failed — use .txt fallback';
    }
    setTimeout(() => { previewClipboardBtn.textContent = '📋 Load Clipboard + Preview'; }, 4000);
  };

  fileBtn.onclick = () => fileInput.click();
  fileInput.onchange = async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      if (!text) throw new Error('File is empty');
      putFullText(text);
      fileBtn.textContent = `✓ Loaded ${text.length.toLocaleString()} characters / ${questionCount(text)} questions`;
      const preview = document.getElementById('preview');
      if (preview) preview.click();
    } catch (e) {
      console.error(e);
      fileBtn.textContent = '⚠️ Could not read file';
    }
    setTimeout(() => { fileBtn.textContent = '📄 Load Full Series from .txt'; }, 4000);
  };

  el.addEventListener('input', updateCount);
  updateCount();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', installBulkInputFix, { once: true });
} else {
  installBulkInputFix();
}
