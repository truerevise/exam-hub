// Bulk Import mobile/large-series input fix v7.
// Clipboard and .txt loaders APPEND to the existing textarea content.
// They never erase questions already loaded in #source.

(function installBulkInputFix(){
  const el = document.getElementById('source');
  if (!el || el.dataset.largePasteFix === '7') return;
  el.dataset.largePasteFix = '7';

  el.removeAttribute('maxlength');
  try { el.maxLength = -1; } catch (_) {}
  el.style.maxHeight = 'none';
  el.style.overflowY = 'auto';
  el.setAttribute('wrap','off');
  el.setAttribute('autocomplete','off');
  el.setAttribute('spellcheck','false');

  const questionCount = text =>
    (String(text || '').match(/^\s*(?:Q(?:uestion)?\s*)\d{1,4}\s*[.):-]/gim) || []).length;

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
    const value = el.value || '';
    counter.textContent = `${value.length.toLocaleString()} characters • ${value.split(/\n/).length.toLocaleString()} lines • ${questionCount(value).toLocaleString()} questions detected • No character limit`;
  };

  // Replace is kept only as an internal helper for the Clear/empty use case.
  const putFullText = text => {
    if (typeof text !== 'string') return false;
    el.value = text;
    try { el.focus({preventScroll:true}); el.setSelectionRange(text.length,text.length); } catch (_) {}
    el.dispatchEvent(new Event('input',{bubbles:true}));
    el.dispatchEvent(new Event('change',{bubbles:true}));
    updateCount();
    return true;
  };

  // Append new imported text without ever deleting the existing series.
  const appendFullText = text => {
    if (typeof text !== 'string' || !text.length) return false;
    const existing = el.value || '';
    if (!existing.length) return putFullText(text);

    // Keep every existing character. Add a clean separator so Q-number blocks
    // remain independent and the parser can continue the existing sequence.
    const separator = /\n\s*$/.test(existing) ? '\n' : '\n\n';
    const combined = existing + separator + text;
    return putFullText(combined);
  };

  // Capture native paste before any other page handler and append it to the
  // existing bulk series instead of replacing the current textarea contents.
  document.addEventListener('paste', event => {
    if (event.target !== el) return;
    const text = event.clipboardData && event.clipboardData.getData('text/plain');
    if (typeof text !== 'string' || !text.length) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    appendFullText(text);
  }, true);

  const addButton = (id,label,afterId) => {
    let btn=document.getElementById(id);
    if(btn) return btn;
    btn=document.createElement('button');
    btn.id=id; btn.type='button'; btn.className='btn secondary'; btn.style.marginTop='8px'; btn.textContent=label;
    document.getElementById(afterId).insertAdjacentElement('afterend',btn);
    return btn;
  };

  const pasteBtn=addButton('pasteFullClipboard','📋 Load FULL Clipboard','sourceCharCount');
  const previewBtn=addButton('previewClipboard','📋 Load Clipboard + Preview','pasteFullClipboard');
  let fileInput=document.getElementById('bulkTextFile');
  if(!fileInput){
    fileInput=document.createElement('input'); fileInput.id='bulkTextFile'; fileInput.type='file'; fileInput.accept='.txt,.text,text/plain'; fileInput.style.display='none'; document.body.appendChild(fileInput);
  }
  const fileBtn=addButton('loadBulkTextFile','📄 Load Full Series from .txt','previewClipboard');

  const readClipboard=async()=>{
    if(!navigator.clipboard || !navigator.clipboard.readText) throw new Error('Clipboard API unavailable');
    const text=await navigator.clipboard.readText();
    if(!text) throw new Error('Clipboard is empty');
    return text;
  };

  pasteBtn.onclick=async()=>{
    try{
      const text=await readClipboard();
      appendFullText(text);
      pasteBtn.textContent=`✓ Added ${text.length.toLocaleString()} characters / ${questionCount(text)} questions`;
    }catch(e){
      console.error(e);
      pasteBtn.textContent='⚠️ Clipboard access failed — use .txt fallback';
    }
    setTimeout(()=>pasteBtn.textContent='📋 Load FULL Clipboard',3500);
  };

  previewBtn.onclick=async()=>{
    try{
      const text=await readClipboard();
      appendFullText(text);
      document.getElementById('preview')?.click();
      previewBtn.textContent=`✓ Added ${questionCount(text)} questions + previewed full series`;
    }catch(e){
      console.error(e);
      previewBtn.textContent='⚠️ Clipboard access failed — use .txt fallback';
    }
    setTimeout(()=>previewBtn.textContent='📋 Load Clipboard + Preview',4000);
  };

  fileBtn.onclick=()=>fileInput.click();
  fileInput.onchange=async()=>{
    const file=fileInput.files && fileInput.files[0]; if(!file) return;
    try{
      const text=await file.text();
      if(!text) throw new Error('File is empty');
      appendFullText(text);
      fileBtn.textContent=`✓ Added ${text.length.toLocaleString()} characters / ${questionCount(text)} questions`;
      document.getElementById('preview')?.click();
    }catch(e){
      console.error(e);
      fileBtn.textContent='⚠️ Could not read file';
    }
    setTimeout(()=>fileBtn.textContent='📄 Load Full Series from .txt',4000);
  };

  el.addEventListener('input',updateCount);
  updateCount();
})();
