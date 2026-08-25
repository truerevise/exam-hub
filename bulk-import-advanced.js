import { db } from './firebase-config.js';
import { collection, getDocs } from 'https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js';

const $ = id => document.getElementById(id);
const source = $('source');
if (!source) throw new Error('Bulk import editor not found');

const style = document.createElement('style');
style.textContent = `
.adv-panel{margin:12px 0 0;padding:12px;border:1px solid #293b59;border-radius:14px;background:#0d1422}.adv-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.adv-title{font-size:12px;font-weight:900;color:#dbe7ff}.adv-sub{font-size:11px;color:#8190aa}.adv-btn{border:1px solid #344766;background:#172238;color:#dce6f8;border-radius:9px;padding:8px 10px;font-size:11px;font-weight:800;cursor:pointer}.adv-btn:hover{border-color:#4f7ff2}.adv-btn.danger{border-color:#653442;color:#ffb4bf;background:#25151b}.adv-select{border:1px solid #344766;background:#101a2b;color:#fff;border-radius:9px;padding:8px}.adv-meter{height:6px;background:#182238;border-radius:99px;overflow:hidden;margin-top:9px}.adv-meter span{display:block;height:100%;width:0;background:#3b6cff;transition:width .25s}.adv-dup{margin-top:8px;padding:9px;border:1px solid #653442;border-radius:9px;background:#25151b;color:#ffb4bf;font-size:11px}.adv-ok{margin-top:8px;padding:9px;border:1px solid #205b40;border-radius:9px;background:#0d2b1e;color:#8be5b0;font-size:11px}.adv-modal-backdrop{position:fixed;inset:0;background:#0009;z-index:100;display:flex;align-items:center;justify-content:center;padding:14px}.adv-modal{width:min(720px,100%);max-height:90vh;overflow:auto;background:#111a29;border:1px solid #344766;border-radius:16px;padding:16px;box-shadow:0 25px 70px #000b}.adv-modal textarea{width:100%;min-height:260px;resize:vertical;background:#0b111d;color:#fff;border:1px solid #344766;border-radius:10px;padding:11px;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:12px;line-height:1.5}.adv-modal-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:10px;flex-wrap:wrap}.adv-card-actions{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap}.adv-mini{padding:5px 8px;font-size:10px;border-radius:7px}.adv-summary-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:9px}.adv-summary-box{padding:9px;border:1px solid #29344a;border-radius:10px;background:#111a29}.adv-summary-box b{display:block;font-size:17px}.adv-summary-box span{font-size:9px;color:#7f8ca4}@media(max-width:650px){.adv-summary-grid{grid-template-columns:repeat(2,1fr)}}
`;
document.head.appendChild(style);

const previewCard = $('previewCard');
if (previewCard) {
  const panel = document.createElement('div');
  panel.className = 'adv-panel';
  panel.innerHTML = `<div class="adv-row"><div><div class="adv-title">🧠 Advanced Review Controls</div><div class="adv-sub">Review the parsed set before anything is written to Firestore.</div></div><span style="flex:1"></span><select id="advMode" class="adv-select"><option value="strict">Strict import</option><option value="safe">Safe review</option></select><button class="adv-btn" id="advRenumber" type="button">🔢 Auto-renumber</button><button class="adv-btn" id="advDuplicates" type="button">🔍 Check duplicates</button></div><div class="adv-summary-grid"><div class="adv-summary-box"><b id="advTotal">0</b><span>TOTAL</span></div><div class="adv-summary-box"><b id="advReady">0</b><span>READY</span></div><div class="adv-summary-box"><b id="advErrors">0</b><span>ERRORS</span></div><div class="adv-summary-box"><b id="advDupCount">0</b><span>DUPLICATES</span></div></div><div id="advMessage"></div><div class="adv-meter"><span id="advMeter"></span></div>`;
  previewCard.insertBefore(panel, previewCard.children[1] || null);
}

function setMessage(text, ok=false, error=false){
  const el=$('advMessage'); if(!el)return;
  el.className=error?'adv-dup':ok?'adv-ok':'';
  el.textContent=text;
}
function normalizeText(v){
  return String(v||'').toLowerCase().replace(/<[^>]*>/g,' ').replace(/[^\p{L}\p{N}]+/gu,' ').replace(/\s+/g,' ').trim();
}
function questionStarts(text){
  const re=/^\s*(?:Q(?:uestion)?\s*)0*(\d{1,4})\s*[.):-]\s*/gim;
  return [...String(text||'').matchAll(re)];
}
function blocks(){
  const text=source.value||''; const starts=questionStarts(text); const out=[];
  for(let i=0;i<starts.length;i++){
    const start=starts[i].index; const end=i+1<starts.length?starts[i+1].index:text.length;
    out.push({num:Number(starts[i][1]),start,end,text:text.slice(start,end)});
  }
  return out;
}
function setSourceBlocks(list){ source.value=list.map((x,i)=>{const n=i+1;return x.text.replace(/^\s*(?:Q(?:uestion)?\s*)0*\d{1,4}\s*[.):-]\s*/i,`Q${n}. `)}).join('\n\n'); source.dispatchEvent(new Event('input',{bubbles:true})); }

$('advRenumber')?.addEventListener('click',()=>{
  const b=blocks();
  if(!b.length){setMessage('No questions detected in the editor.',false,true);return;}
  if(!confirm(`Renumber ${b.length} detected questions sequentially from Q1 to Q${b.length}?`))return;
  setSourceBlocks(b); $('preview')?.click(); setMessage(`Renumbered ${b.length} questions to Q1–Q${b.length}.`,true);
});

function levenshtein(a,b){
  if(a===b)return 0; if(!a)return b.length;if(!b)return a.length;
  let prev=Array.from({length:b.length+1},(_,i)=>i);
  for(let i=1;i<=a.length;i++){const cur=[i];for(let j=1;j<=b.length;j++)cur[j]=Math.min(cur[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));prev=cur;}return prev[b.length];
}
function similarity(a,b){
  const x=normalizeText(a),y=normalizeText(b);if(!x||!y)return 0;
  const max=Math.max(x.length,y.length);return 1-levenshtein(x,y)/max;
}
async function duplicateCheck(){
  const rows=[...document.querySelectorAll('#rows .row')].filter(r=>!r.classList.contains('headrow'));
  if(rows.length<2){setMessage('Preview at least two questions first.',false,true);return;}
  const texts=rows.map(r=>({row:r,text:r.children[1]?.textContent||''}));
  const pairs=[];
  for(let i=0;i<texts.length;i++)for(let j=i+1;j<texts.length;j++){const score=similarity(texts[i].text,texts[j].text);if(score>=.88)pairs.push([i+1,j+1,score]);}
  $('advDupCount').textContent=pairs.length;
  if(!pairs.length){setMessage('✓ No likely duplicates found within this import set.',true);return;}
  setMessage(`⚠ ${pairs.length} likely duplicate pair${pairs.length===1?'':'s'} found: ${pairs.slice(0,8).map(p=>`Q${p[0]} ↔ Q${p[1]} (${Math.round(p[2]*100)}%)`).join(', ')}${pairs.length>8?' …':''}`,false,true);
}
$('advDuplicates')?.addEventListener('click',duplicateCheck);

function addRowActions(row,index){
  if(row.querySelector('.adv-card-actions')||row.classList.contains('headrow'))return;
  const action=document.createElement('div');action.className='adv-card-actions';
  const edit=document.createElement('button');edit.className='adv-btn adv-mini';edit.type='button';edit.textContent='✏ Edit';
  const del=document.createElement('button');del.className='adv-btn danger adv-mini';del.type='button';del.textContent='🗑 Delete';
  edit.onclick=()=>editQuestion(index); del.onclick=()=>deleteQuestion(index);
  action.append(edit,del);row.children[1]?.appendChild(action);
}
function editQuestion(index){
  const b=blocks(); if(!b[index])return;
  const backdrop=document.createElement('div');backdrop.className='adv-modal-backdrop';
  const modal=document.createElement('div');modal.className='adv-modal';
  modal.innerHTML=`<div class="adv-title">Edit Q${b[index].num}</div><div class="adv-sub" style="margin:6px 0 10px">Edit the complete question block. The question number is preserved unless you use Auto-renumber.</div><textarea></textarea><div class="adv-modal-actions"><button class="adv-btn" id="advCancel">Cancel</button><button class="adv-btn" id="advSave">Save changes</button></div>`;
  modal.querySelector('textarea').value=b[index].text;
  backdrop.appendChild(modal);document.body.appendChild(backdrop);
  modal.querySelector('#advCancel').onclick=()=>backdrop.remove();
  modal.querySelector('#advSave').onclick=()=>{const v=modal.querySelector('textarea').value.trim();if(!v){alert('Question block cannot be empty.');return}const all=blocks();all[index].text=v;source.value=all.map(x=>x.text).join('\n\n');source.dispatchEvent(new Event('input',{bubbles:true}));backdrop.remove();$('preview')?.click();setMessage(`Q${b[index].num} updated.`,true)};
}
function deleteQuestion(index){
  const b=blocks();if(!b[index])return;
  if(!confirm(`Delete Q${b[index].num} from this import?`))return;
  b.splice(index,1);source.value=b.map(x=>x.text).join('\n\n');source.dispatchEvent(new Event('input',{bubbles:true}));$('preview')?.click();setMessage('Question deleted from the editor. Use Auto-renumber if you want a contiguous sequence.',true);
}

const observer=new MutationObserver(()=>{
  const rows=[...document.querySelectorAll('#rows .row')].filter(r=>!r.classList.contains('headrow'));
  let ready=0,errors=0;
  rows.forEach((r,i)=>{addRowActions(r,i);const s=(r.children[3]?.textContent||'').toLowerCase();if(s.includes('ready'))ready++;else errors++;});
  if($('advTotal'))$('advTotal').textContent=rows.length;
  if($('advReady'))$('advReady').textContent=ready;
  if($('advErrors'))$('advErrors').textContent=errors;
  if($('advMeter'))$('advMeter').style.width=rows.length?`${Math.round(ready/rows.length*100)}%`:'0%';
});
if($('rows'))observer.observe($('rows'),{childList:true,subtree:true});

// Warn before leaving when the editor contains unsaved content. Recovery still protects the text.
let dirty=false;
source.addEventListener('input',()=>{dirty=true});
window.addEventListener('beforeunload',e=>{if(dirty&&!document.body.dataset.importCompleted){e.preventDefault();e.returnValue=''}});
$('importBtn')?.addEventListener('click',()=>{document.body.dataset.importCompleted='true';dirty=false});

// Strict is the safest default. Safe review does not bypass the existing validation; it simply communicates that the admin intends to review skipped items manually.
$('advMode')?.addEventListener('change',e=>{setMessage(e.target.value==='strict'?'Strict mode: every question must pass validation and sequence checks.':'Safe review: review the preview carefully; the existing importer still blocks invalid questions.',e.target.value==='strict')});
setMessage('Strict mode is recommended for production imports.',true);
