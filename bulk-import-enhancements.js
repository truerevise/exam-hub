import { auth } from './firebase-config.js';

const $ = id => document.getElementById(id);
const source = $('source');
if (!source) throw new Error('Bulk import source editor not found');

const style = document.createElement('style');
style.textContent = `
.smart-bar{position:sticky;top:8px;z-index:20;margin:-2px 0 14px;padding:10px 12px;border:1px solid #2b3b59;border-radius:15px;background:rgba(11,17,29,.94);backdrop-filter:blur(14px);box-shadow:0 12px 30px #0005}.smart-bar-inner{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}.smart-brand{font-size:12px;font-weight:900;color:#dbe7ff;letter-spacing:.02em}.smart-state{font-size:11px;color:#8f9bb5}.smart-state strong{color:#7ee2a9}.smart-actions{display:flex;gap:7px;flex-wrap:wrap}.smart-btn{border:1px solid #31415f;background:#151f31;color:#d7e0f2;border-radius:9px;padding:8px 10px;font-size:11px;font-weight:800;cursor:pointer}.smart-btn:hover{border-color:#4d73db;background:#1a2740}.smart-btn.primary{background:#2563eb;border-color:#3b6cff;color:#fff}.smart-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin-bottom:12px}.smart-stat{padding:11px 12px;border:1px solid #29344a;border-radius:12px;background:linear-gradient(145deg,#141d2b,#0d1420)}.smart-stat .n{font-size:20px;font-weight:900}.smart-stat .l{font-size:10px;color:#7f8ca4;margin-top:2px}.smart-stat.good .n{color:#7ee2a9}.smart-stat.warn .n{color:#fbbf24}.smart-stat.bad .n{color:#ff9aa7}.smart-editor-head{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:7px}.smart-editor-tools{display:flex;gap:6px;flex-wrap:wrap}.smart-file{display:none}.smart-hint{margin-top:8px;padding:10px 12px;border-radius:10px;background:#0d1727;border:1px solid #263a5d;color:#9fb1d0;font-size:11px;line-height:1.55}.smart-hint b{color:#d4e1ff}.smart-filter{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:10px 0}.smart-filter input{flex:1;min-width:170px;padding:9px 10px;border:1px solid #34415b;border-radius:9px;background:#0d1422;color:#fff}.smart-filter select{padding:9px 10px;border:1px solid #34415b;border-radius:9px;background:#0d1422;color:#fff}.smart-error-jump{display:inline-flex;align-items:center;gap:5px;padding:6px 9px;border-radius:999px;background:#321820;border:1px solid #65303d;color:#ffb1bb;font-size:10px;font-weight:900;cursor:pointer}.smart-ok-jump{display:inline-flex;align-items:center;gap:5px;padding:6px 9px;border-radius:999px;background:#0d2b1e;border:1px solid #205b40;color:#8be5b0;font-size:10px;font-weight:900}.smart-progress{height:5px;background:#182238;border-radius:99px;overflow:hidden;margin-top:8px}.smart-progress span{display:block;height:100%;width:0;background:#3b6cff;transition:width .2s}.smart-toast{position:fixed;right:16px;bottom:18px;z-index:50;max-width:330px;padding:11px 13px;border:1px solid #344667;border-radius:12px;background:#121b2a;color:#e8eefb;box-shadow:0 15px 35px #0007;font-size:12px;font-weight:700}.smart-toast.error{border-color:#693441;color:#ffb4bf}.smart-toast.hidden{display:none}@media(max-width:650px){.smart-bar{top:4px}.smart-stats{grid-template-columns:repeat(2,1fr)}.smart-actions{width:100%}.smart-btn{flex:1}.smart-filter{align-items:stretch}.smart-filter input,.smart-filter select{width:100%}}
`;
document.head.appendChild(style);

const bar=document.createElement('div');
bar.className='smart-bar';
bar.innerHTML=`<div class="smart-bar-inner"><div><div class="smart-brand">⚡ Smart Import Workspace</div><div class="smart-state" id="smartState">Ready — paste or load your questions</div></div><div class="smart-actions"><button class="smart-btn" id="loadTxt" type="button">📄 Load .txt</button><button class="smart-btn" id="templateTxt" type="button">🧩 Template</button><button class="smart-btn" id="cleanText" type="button">✨ Clean Text</button><button class="smart-btn" id="restoreLocal" type="button">↩ Recover</button><input class="smart-file" id="smartFile" type="file" accept=".txt,text/plain"></div></div><div class="smart-progress"><span id="smartProgress"></span></div>`;
source.closest('.card')?.before(bar);

const stats=document.createElement('div');
stats.className='smart-stats';
stats.innerHTML=`<div class="smart-stat"><div class="n" id="smartTotal">0</div><div class="l">QUESTIONS DETECTED</div></div><div class="smart-stat good"><div class="n" id="smartReady">0</div><div class="l">READY TO IMPORT</div></div><div class="smart-stat bad"><div class="n" id="smartErrors">0</div><div class="l">NEEDING FIX</div></div><div class="smart-stat warn"><div class="n" id="smartMissing">0</div><div class="l">SEQUENCE ISSUES</div></div>`;
source.closest('.card')?.prepend(stats);

const editorHead=document.createElement('div');
editorHead.className='smart-editor-head';
editorHead.innerHTML=`<div style="font-size:12px;color:#9eb6ff;font-weight:900">QUESTION SOURCE EDITOR</div><div class="smart-editor-tools"><button class="smart-btn" id="focusEditor" type="button">⌨ Focus</button><button class="smart-btn" id="selectAllText" type="button">Select All</button></div>`;
source.parentElement?.prepend(editorHead);

const hint=document.createElement('div');
hint.className='smart-hint';
hint.innerHTML='<b>Smart format:</b> Q1. Question → (A) Option → (B) Option → (C) Option → (D) Option → Answer: B → Explanation:. Telugu is optional. You can paste Q1–Q1000 in any supported numbering style; Preview & Validate will catch missing options, answers, duplicates and gaps before anything is written to Firestore.';
source.parentElement?.appendChild(hint);

const filter=document.createElement('div');
filter.className='smart-filter';
filter.innerHTML=`<input id="smartSearch" placeholder="Search detected questions…"><select id="smartFilter"><option value="all">Show all</option><option value="errors">Errors only</option><option value="ready">Ready only</option></select><span id="smartIssuePill"></span>`;
$('previewCard')?.prepend(filter);

const toast=document.createElement('div');toast.className='smart-toast hidden';document.body.appendChild(toast);
function showToast(msg,error=false){toast.textContent=msg;toast.className='smart-toast'+(error?' error':'');clearTimeout(showToast.t);showToast.t=setTimeout(()=>toast.classList.add('hidden'),2800)}
function setState(text,good=false){const el=$('smartState');if(el){el.innerHTML=good?`<strong>${text}</strong>`:text}}
function getParsed(){return Array.isArray(window.parsed)?window.parsed:null}

// The main module keeps its parsed array private, so derive lightweight counts from the visible preview.
function refreshStats(){
  const rows=[...document.querySelectorAll('#rows .row')].filter(r=>!r.classList.contains('headrow'));
  const total=rows.length;
  let errors=0,missing=0,ready=0;
  rows.forEach(r=>{const status=(r.children[3]?.textContent||'').toLowerCase();if(status.includes('missing')||status.includes('invalid')||status.includes('duplicate')||status.includes('error'))errors++;else ready++;});
  const warning=($('sequenceWarning')?.textContent||'').toLowerCase();
  if(warning.includes('missing')||warning.includes('duplicate')||warning.includes('out-of-range')||warning.includes('needs'))missing=1;
  $('smartTotal').textContent=total;$('smartReady').textContent=ready;$('smartErrors').textContent=errors;$('smartMissing').textContent=missing;
  $('smartIssuePill').innerHTML=errors?`<span class="smart-error-jump" id="jumpError">⚠ ${errors} issue${errors===1?'':'s'}</span>`:`<span class="smart-ok-jump">✓ Clean</span>`;
  $('jumpError')?.addEventListener('click',()=>{const row=[...document.querySelectorAll('#rows .row')].find(r=>(r.children[3]?.textContent||'').toLowerCase().includes('missing'));row?.scrollIntoView({behavior:'smooth',block:'center'});});
}

function clean(){
  let v=source.value||'';
  v=v.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').replace(/[\u00a0\u2007\u202f]/g,' ');
  v=v.replace(/^[ \t]+/gm,'').replace(/[ \t]+$/gm,'');
  v=v.replace(/^\s*Q\s*0*(\d+)\s*[.)-]\s*/gim,(m,n)=>`Q${Number(n)}. `);
  v=v.replace(/^\s*Question\s+0*(\d+)\s*[.)-]\s*/gim,(m,n)=>`Q${Number(n)}. `);
  source.value=v;source.dispatchEvent(new Event('input',{bubbles:true}));saveLocal();showToast('Text cleaned without changing question content.');updateStateFromText();
}

$('cleanText').onclick=clean;
$('focusEditor').onclick=()=>source.focus();
$('selectAllText').onclick=()=>{source.focus();source.select();};
$('loadTxt').onclick=()=>$('smartFile').click();
$('smartFile').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;try{source.value=await f.text();source.dispatchEvent(new Event('input',{bubbles:true}));saveLocal();showToast(`Loaded ${f.name}`);updateStateFromText()}catch(err){showToast('Could not read that text file.',true)}e.target.value='';};
$('templateTxt').onclick=()=>{const template=`Q1. Enter your question here\n(A) Option A\n(B) Option B\n(C) Option C\n(D) Option D\nAnswer: A\nExplanation: Enter explanation here\nTags: education, telangana-set\n\nQ2. Enter next question here\n(A) Option A\n(B) Option B\n(C) Option C\n(D) Option D\nAnswer: B\nExplanation: Enter explanation here` ;source.value=template;source.dispatchEvent(new Event('input',{bubbles:true}));source.focus();saveLocal();showToast('Template inserted. Replace the sample text before importing.');};

function saveLocal(){try{localStorage.setItem('truerevise_bulk_import_recovery',source.value);localStorage.setItem('truerevise_bulk_import_recovery_time',String(Date.now()))}catch(e){}}
function recover(){try{const v=localStorage.getItem('truerevise_bulk_import_recovery');if(!v){showToast('No local recovery copy found.',true);return}if(source.value.trim()&&!confirm('Replace the current editor with the recovered copy?'))return;source.value=v;source.dispatchEvent(new Event('input',{bubbles:true}));showToast('Recovered the latest local copy.');updateStateFromText()}catch(e){showToast('Recovery is unavailable.',true)}}
$('restoreLocal').onclick=recover;
let saveTimer;
source.addEventListener('input',()=>{clearTimeout(saveTimer);saveTimer=setTimeout(()=>{saveLocal();updateStateFromText()},500);setState('Unsaved changes — local recovery is being updated…');});

function updateStateFromText(){const n=(source.value||'').trim();const count=(n.match(/^\s*(?:Q(?:uestion)?\s*)0*\d{1,4}\s*[.):-]\s*/gim)||[]).length;setState(count?`${count} question${count===1?'':'s'} detected in editor`:'Ready — paste or load your questions');}

$('smartSearch').addEventListener('input',e=>{const term=e.target.value.trim().toLowerCase();document.querySelectorAll('#rows .row').forEach(r=>{if(!term){r.style.display='grid';return}r.style.display=r.textContent.toLowerCase().includes(term)?'grid':'none';});});
$('smartFilter').addEventListener('change',e=>{const mode=e.target.value;document.querySelectorAll('#rows .row').forEach(r=>{const status=(r.children[3]?.textContent||'').toLowerCase();let show=true;if(mode==='errors')show=status.includes('missing')||status.includes('invalid')||status.includes('duplicate')||status.includes('error');if(mode==='ready')show=!status.includes('missing')&&!status.includes('invalid')&&!status.includes('duplicate')&&!status.includes('error');r.style.display=show?'grid':'none';});});

const observer=new MutationObserver(()=>refreshStats());
if($('rows'))observer.observe($('rows'),{childList:true,subtree:true});
if($('sequenceWarning'))observer.observe($('sequenceWarning'),{childList:true,subtree:true,characterData:true});

// Keyboard shortcuts: Ctrl/Cmd+Enter previews; Ctrl/Cmd+S saves a local recovery copy.
document.addEventListener('keydown',e=>{const mod=e.ctrlKey||e.metaKey;if(!mod)return;if(e.key==='Enter'){e.preventDefault();$('preview')?.click();}if(e.key.toLowerCase()==='s'){e.preventDefault();saveLocal();showToast('Local recovery copy saved.');}});

updateStateFromText();
`;
