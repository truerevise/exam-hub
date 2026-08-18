import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js';
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js';

const ADMIN='kiransingh.smile@gmail.com';
const $=id=>document.getElementById(id);
const draftRef=()=>doc(db,'bulkImportDrafts','admin-'+ADMIN.toLowerCase().replace(/[^a-z0-9]+/g,'-'));
let authed=false;
let hasDraft=false;

function status(text,error=false){
  const el=$('status');
  if(!el)return;
  el.className='status'+(error?' error':'');
  el.textContent=text;
}

function snapshotForm(){
  return {
    exam:$('exam')?.value||'',
    subject:$('subject')?.value||'',
    marks:$('marks')?.value||'2',
    negative:$('negative')?.value||'0',
    previousExam:$('previousExam')?.value||'',
    tags:$('tags')?.value||'',
    source:$('source')?.value||'',
    savedAt:serverTimestamp(),
    updatedBy:ADMIN
  };
}

function setValue(id,value){const el=$(id);if(el&&value!==undefined&&value!==null)el.value=String(value);}

async function saveDraft(){
  if(!authed)return;
  const source=$('source')?.value?.trim()||'';
  if(!source){status('Paste or enter the questions before saving the draft.',true);return;}
  const btn=$('draftButton');
  btn.disabled=true;btn.textContent='Saving…';
  try{
    await setDoc(draftRef(),snapshotForm());
    hasDraft=true;
    btn.textContent='Load Draft';
    status('✓ Draft saved. Your loaded questions are safely stored and can be loaded later.');
  }catch(e){
    console.error(e);
    status('Could not save draft. Check Firestore permissions.',true);
  }finally{btn.disabled=false;}
}

async function loadDraft(){
  if(!authed)return;
  const btn=$('draftButton');
  btn.disabled=true;btn.textContent='Loading…';
  try{
    const snap=await getDoc(draftRef());
    if(!snap.exists()){
      hasDraft=false;btn.textContent='Save Draft';status('No saved draft found.');return;
    }
    const d=snap.data();
    setValue('marks',d.marks);setValue('negative',d.negative);setValue('previousExam',d.previousExam);setValue('tags',d.tags);setValue('source',d.source);
    // Exam and subject may not yet be populated by the choices loader. Retry briefly until options exist.
    const applySelect=(id,value)=>{const el=$(id);if(!el||!value)return false;const exists=[...el.options].some(o=>o.value===value);if(exists){el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}));return true;}return false;};
    let appliedExam=applySelect('exam',d.exam),appliedSubject=applySelect('subject',d.subject);
    if(!appliedExam||!appliedSubject){
      let tries=0;
      const timer=setInterval(()=>{
        tries++;
        if(!appliedExam)appliedExam=applySelect('exam',d.exam);
        if(!appliedSubject)appliedSubject=applySelect('subject',d.subject);
        if((appliedExam&&appliedSubject)||tries>=30)clearInterval(timer);
      },200);
    }
    hasDraft=true;btn.textContent='Save Draft';status('✓ Draft loaded. Your questions are ready to preview/import.');
    try{window.parsed=[]; if(typeof window.renderPreview==='function')window.renderPreview();}catch(e){}
  }catch(e){
    console.error(e);status('Could not load draft. Check Firestore permissions.',true);btn.textContent='Load Draft';
  }finally{btn.disabled=false;}
}

async function removeDraft(){
  try{await deleteDoc(draftRef());hasDraft=false;const btn=$('draftButton');if(btn)btn.textContent='Save Draft';}catch(e){console.warn('Draft cleanup failed:',e);}
}

function installButton(){
  const actions=$('importBtn')?.parentElement;
  if(!actions||$('draftButton'))return;
  const btn=document.createElement('button');
  btn.id='draftButton';btn.type='button';btn.className='btn secondary';btn.textContent=hasDraft?'Load Draft':'Save Draft';
  btn.title='Save the current bulk-import questions as a draft. When a draft exists, this button loads it.';
  btn.style.cssText='padding:8px 11px;font-size:12px;min-height:36px';
  actions.appendChild(btn);
  btn.addEventListener('click',()=>hasDraft?loadDraft():saveDraft());
}

async function detectDraft(){
  if(!authed)return;
  try{hasDraft=(await getDoc(draftRef())).exists();}catch(e){console.warn('Draft check failed:',e);}
  installButton();
  const btn=$('draftButton');if(btn)btn.textContent=hasDraft?'Load Draft':'Save Draft';
}

function hookPublishCleanup(){
  const btn=$('importBtn');
  if(!btn||btn.dataset.draftHooked)return;
  btn.dataset.draftHooked='1';
  const original=btn.onclick;
  if(typeof original!=='function')return;
  btn.onclick=async function(...args){
    const result=await original.apply(this,args);
    // The existing importer writes the success message only after all batches commit.
    const text=$('status')?.textContent||'';
    if(text.includes('Successfully imported all')){
      await removeDraft();
      status(text+' Draft removed automatically because the questions were published.');
    }
    return result;
  };
}

onAuthStateChanged(auth,async u=>{
  authed=u?.email?.toLowerCase()===ADMIN.toLowerCase();
  if(!authed)return;
  installButton();
  hookPublishCleanup();
  await detectDraft();
});

window.addEventListener('load',()=>{
  installButton();
  hookPublishCleanup();
});