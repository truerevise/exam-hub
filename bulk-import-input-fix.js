// Bulk Import textarea input fix.
// Android/mobile browsers can behave unexpectedly with very large pastes. Keep the
// source textarea unrestricted and handle paste explicitly so the complete clipboard
// text is inserted instead of being silently truncated.
const source = document.getElementById('source');

function installBulkInputFix() {
  const el = document.getElementById('source');
  if (!el || el.dataset.largePasteFix === '1') return;
  el.dataset.largePasteFix = '1';

  // Never impose a character limit from this page.
  el.removeAttribute('maxlength');
  el.maxLength = -1;

  // Add a lightweight character counter so the user can see that the full text
  // is present. It does not impose any limit.
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
    counter.textContent = `${chars.toLocaleString()} characters • ${lines.toLocaleString()} lines • No character limit`;
  };

  el.addEventListener('input', updateCount);

  el.addEventListener('paste', event => {
    const text = event.clipboardData?.getData('text/plain');
    if (typeof text !== 'string' || !text.length) return;

    // Let the browser handle normal small pastes. For larger pastes, explicitly
    // insert the complete clipboard text at the current selection.
    if (text.length < 8000) return;

    event.preventDefault();
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    el.value = el.value.slice(0, start) + text + el.value.slice(end);
    const cursor = start + text.length;
    el.setSelectionRange(cursor, cursor);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    updateCount();
  });

  updateCount();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', installBulkInputFix, { once: true });
} else {
  installBulkInputFix();
}
