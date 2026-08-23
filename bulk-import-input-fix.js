// Bulk Import mobile/large-series input fix v3.
// Uses Clipboard API directly so Android keyboard paste truncation cannot affect the
// imported text. Also provides an immediate clipboard -> textarea -> preview path.

function installBulkInputFix() {
  const el = document.getElementById('source');
  if (!el || el.dataset.largePasteFix === '3') return;
  el.dataset.largePasteFix = '3';

  el.removeAttribute('maxlength');
  try { el.maxLength = 0; } catch (_) {}
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
    const chars = value.length;
    const lines = value ? value.split(/\n/).length : 0;
    const questions = questionCount(value);
    counter.textContent = `${chars.toLocaleString()} characters • ${lines.toLocaleString()} lines • ${questions.toLocaleString()} questions detected • No character limit`;
  };

  const putFullText = text => {
    if (typeof text !== 'string' || !text.length) return false;
    // Direct value assignment avoids Android's native textarea paste path entirely.
    el.value = text;
    try { el.setSelectionRange(text.length, text.length); } catch (_) {}
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    updateCount();
    return true;
  };

  // Intercept normal paste before page handlers. If the browser supplies the full
  // clipboard text, insert it directly. Otherwise the dedicated Clipboard button
  // below is the reliable path.
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

  async function readClipboard() {
    if (!navigator.clipboard?.readText) throw new Error('Clipboard API unavailable in this browser/context');
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
      setTimeout(() => { pasteBtn.textContent = '📋 Load FULL Clipboard'; }, 3500);
    } catch (e) {
      console.error(e);
      pasteBtn.textContent = '⚠️ Allow clipboard access, then tap again';
      setTimeout(() => { pasteBtn.textContent = '📋 Load FULL Clipboard'; }, 3500);
    }
  };

  previewClipboardBtn.onclick = async () => {
    try {
      const text = await readClipboard();
      const preview = document.getElementById('preview');
      if (preview) {
        preview.click();
        previewClipboardBtn.textContent = `✓ ${questionCount(text)} questions loaded + previewed`;
      } else {
        previewClipboardBtn.textContent = `✓ Loaded ${text.length.toLocaleString()} characters`;
      }
      setTimeout(() => { previewClipboardBtn.textContent = '📋 Load Clipboard + Preview'; }, 4000);
    } catch (e) {
      console.error(e);
      previewClipboardBtn.textContent = '⚠️ Clipboard access failed — allow permission';
      setTimeout(() => { previewClipboardBtn.textContent = '📋 Load Clipboard + Preview'; }, 4000);
    }
  };

  el.addEventListener('input', updateCount);
  updateCount();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', installBulkInputFix, { once: true });
} else {
  installBulkInputFix();
}
