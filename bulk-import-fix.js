import { auth, db } from './firebase-config.js';
import { collection, doc, writeBatch, serverTimestamp, setDoc } from 'https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js';

// Bulk Import hardening: supports Q1–Q1000, any complete contiguous paper length,
// preserves individually-uploaded images, and always adds SET Economics.
const MAX_QUESTIONS = 1000;
const REQUIRED_TAG = 'set-economics';
const $ = id => document.getElementById(id);
const esc = v => String(v ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
const normalize = text => String(text || '').replace(/\r\n?/g,'\n').replace(/[\u00a0\u2007\u202f]/g,' ').replace(/[“”]/g,'\"').replace(/[‘’]/g,"'");

function parseOptions(block, prefix='') {
  const out={A:'',B:'',C:'',D:''};
  const re = prefix==='te'
    ? /(?:^|\n)\s*\(([ABCD])(?:-Telugu)?\)\s*/gi
    : /(?:^|\n)\s*\(([ABCD])\)\s*/gi;
  const os=[...block.matchAll(re)];
  for(let i=0;i<os.length;i++){
    const key=os[i][1].toUpperCase();
    const from=os[i].index+os[i][0].length;
    const to=i+1<os.length?os[i+1].index:block.length;
    if(!out[key]) out[key]=block.slice(from,to).trim();
  }
  return out;
}

function parseQuestions(text){
  const normalized=normalize(text);
  const re=/^\s*(?:Q(?:uestion)?\s*)0*(\d{1,4})\s*[.):-]\s*/gim;
  const starts=[...normalized.matchAll(re)];
  const out=[];
  for(let i=0;i<starts.length;i++){
    const start=starts[i].index;
    const end=i+1<starts.length?starts[i+1].index:normalized.length;
    const num=Number(starts[i][1]);
    let block=normalized.slice(start,end).trim().replace(/^\s*(?:Q(?:uestion)?\s*)0*\d{1,4}\s*[.):-]\s*/i,'').trim();

    const tagMatch=block.match(/(?:^|\n)\s*Tags?\s*:\s*([^\n]*)/i);
    const questionTags=tagMatch?tagMatch[1].split(',').map(x=>x.trim().toLowerCase()).filter(Boolean):[];
    if(tagMatch) block=(block.slice(0,tagMatch.index)+block.slice(tagMatch.index+tagMatch[0].length)).trim();

    const explanationMatch=block.match(/(?:^|\n)\s*Explanation\s*:\s*([\s\S]*)$/i);
    const explanation=explanationMatch?explanationMatch[1].trim():'';
    if(explanationMatch) block=block.slice(0,explanationMatch.index).trim();

    const answerMatch=block.match(/(?:^|\n)\s*Answer\s*:\s*\(?\s*(A|B|C|D|ALL|MULTIPLE|DELETED)\s*\)?/i);
    const correctAnswer=answerMatch?answerMatch[1].toUpperCase():'';
    if(answerMatch) block=block.slice(0,answerMatch.index).trim();

    let teQuestion='';
    const teQ=block.match(/(?:^|\n)\s*Telugu Question\s*:\s*([\s\S]*?)(?=\n\s*(?:Explanation|Telugu Explanation|Tags?)\s*:|$)/i);
    if(teQ) teQuestion=teQ[1].trim();
    const teExplanationMatch=block.match(/(?:^|\n)\s*Telugu Explanation\s*:\s*([\s\S]*)$/i);
    const explanationTe=teExplanationMatch?teExplanationMatch[1].trim():'';
    if(teExplanationMatch) block=block.slice(0,teExplanationMatch.index).trim();

    const englishMatch=block.match(/(?:^|\n)\s*English Question\s*:\s*([\s\S]*?)(?=\n\s*Telugu Question\s*:|$)/i);
    const question=englishMatch?englishMatch[1].trim():block.replace(/(?:^|\n)\s*Telugu Question\s*:[\s\S]*$/i,'').trim();
    const options=parseOptions(block);
    const teOptions=parseOptions(teQuestion,'te');
    if(teQuestion){const idx=teQuestion.search(/\n\s*\([ABCD]-Telugu\)\s*/i);if(idx>=0)teQuestion=teQuestion.slice(0,idx).trim();}

    const imageUrls=(window.__bulkImportImages&&window.__bulkImportImages[String(num)])||{};
    const tags=[...new Set([...questionTags,REQUIRED_TAG])];
    const errors=[];
    if(!question) errors.push('missing question');
    for(const k of ['A','B','C','D']) if(!options[k]) errors.push('missing '+k);
    if(!correctAnswer) errors.push('missing answer');
    out.push({num,question,options,questionTe,optionsTe:teOptions,correctAnswer,explanation,explanationTe,tags,errors,hasTelugu:!!(teQuestion||Object.values(teOptions).some(Boolean)||explanationTe),imageUrls});
  }
  return out;
}

function sequenceIssues(items){
  const nums=items.map(q=>q.num);
  const duplicates=[...new Set(nums.filter((n,i)=>nums.indexOf(n)!==i))];
  const outOfRange=nums.filter(n=>n<1||n>MAX_QUESTIONS);
  const missing=[];
  if(nums.length){
    const max=Math.max(...nums);
    if(Math.min(...nums)!==1) missing.push(1);
    for(let n=1;n<=max;n++) if(!nums.includes(n)) missing.push(n);
  }
  return {duplicates,missing,outOfRange};
}

function isSequenceValid(items){
  if(!items.length) return false;
  const s=sequenceIssues(items);
  return !s.duplicates.length && !s.missing.length && !s.outOfRange.length;
}

function renderPreview(parsed){
  const seq=sequenceIssues(parsed);
  const valid=parsed.filter(q=>!q.errors.length).length;
  const max=parsed.length?Math.max(...parsed.map(q=>q.num)):0;
  const ok=isSequenceValid(parsed);
  $('summary').innerHTML=`<span class="pill">Detected: ${parsed.length}</span><span class="pill">Valid: ${valid}</span><span class="pill">Telugu: ${parsed.filter(q=>q.hasTelugu).length}</span><span class="pill">Errors: ${parsed.length-valid}</span><span class="pill">Sequence: ${ok?`1–${max} ✓`:'Needs review'}</span>`;
  $('rows').innerHTML=parsed.length?parsed.map(q=>`<div class="row"><div>Q${q.num}</div><div><b>${esc(q.question)}</b>${q.imageUrls?.question?`<div class="small-options"><img src="${q.imageUrls.question}" alt="Q${q.num} image" style="max-width:180px;max-height:100px;object-fit:contain;border-radius:7px;margin-top:6px"></div>`:''}${q.hasTelugu?`<div class="small-options" style="color:#7dd3fc"><b>తెలుగు available</b></div>`:''}<div class="small-options">${['A','B','C','D'].map(k=>`<div><b>(${k})</b> ${esc(q.options[k])}${q.imageUrls?.[k]?`<img src="${q.imageUrls[k]}" alt="Option ${k}" style="display:block;max-width:120px;max-height:70px;object-fit:contain;border-radius:6px;margin-top:4px">`:''}</div>`).join('')}<div class="small-options"><b>Tags:</b> ${esc(q.tags.join(', '))}</div></div></div><div>${esc(q.correctAnswer||'—')}</div><div class="${q.errors.length?'bad':'ok'}">${q.errors.length?esc(q.errors.join(', ')):'Ready'}</div></div>`).join(''):'<div class="row"><div>—</div><div>No questions detected.</div><div>—</div><div class="bad">Invalid</div></div>';
  $('previewCard').style.display='block';
  const warnings=[];
  if(seq.duplicates.length) warnings.push(`duplicate numbers: ${seq.duplicates.join(', ')}`);
  if(seq.missing.length) warnings.push(`missing numbers: ${seq.missing.slice(0,30).join(', ')}${seq.missing.length>30?'…':''}`);
  if(seq.outOfRange.length) warnings.push(`out-of-range numbers: ${seq.outOfRange.join(', ')}`);
  $('sequenceWarning').textContent=warnings.length?warnings.join(' | '):`✓ Questions are in the correct Q1–Q${max} sequence.`;
}

async function importQuestions(parsed){
  const valid=parsed.filter(q=>!q.errors.length);
  const seq=sequenceIssues(parsed);
  if(valid.length!==parsed.length||!isSequenceValid(parsed)){
    $('status').className='status error';$('status').textContent='Fix validation/sequence errors before importing.';return;
  }
  const exam=$('exam').value.trim(),subject=$('subject').value.trim();
  const previousExam=$('previousExam').value.trim();
  const globalTags=$('tags').value.split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
  const tags=[...new Set([...globalTags,REQUIRED_TAG])];
  const marks=Number($('marks').value)||0,negativeMarks=Number($('negative').value)||0;
  if(!exam||!subject){$('status').className='status error';$('status').textContent='Exam and Subject are required.';return;}
  if(!confirm(`Import all ${valid.length} questions into ${exam} → ${subject}?`)) return;
  const btn=$('importBtn');btn.disabled=true;btn.textContent='Importing…';
  try{
    for(let i=0;i<valid.length;i+=400){
      const batch=writeBatch(db);
      if(i===0){
        batch.set(doc(db,'exams','exam-'+String(exam).trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,100)),{name:exam,title:exam,subject,updatedAt:serverTimestamp(),createdBy:auth.currentUser?.email||''},{merge:true});
      }
      for(const q of valid.slice(i,i+400)){
        const ref=doc(collection(db,'questions'));
        batch.set(ref,{exam,subject,previousExam,tags:q.tags.length?q.tags:tags,marks,negativeMarks,questionNumber:q.num,question:q.question,questionTe:q.questionTe||'',questionImageUrl:q.imageUrls?.question||'',options:q.options,optionsTe:q.optionsTe,optionImageUrls:{A:q.imageUrls?.A||'',B:q.imageUrls?.B||'',C:q.imageUrls?.C||'',D:q.imageUrls?.D||''},correctAnswer:q.correctAnswer,answerType:['A','B','C','D'].includes(q.correctAnswer)?'single':q.correctAnswer==='ALL'?'all':q.correctAnswer==='MULTIPLE'?'multiple':'deleted_or_all_awarded',explanation:q.explanation,explanationTe:q.explanationTe||'',hasTelugu:q.hasTelugu===true,availableLanguages:q.hasTelugu?['en','te']:['en'],answerSource:'bulk-import',createdAt:serverTimestamp()});
      }
      await batch.commit();
    }
    const slug=String(subject).trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,100);
    await setDoc(doc(db,'subjects','subject-'+slug),{name:subject,updatedAt:serverTimestamp(),createdBy:auth.currentUser?.email||''},{merge:true});
    $('status').className='status';$('status').textContent=`✓ Successfully imported all ${valid.length} questions into ${exam} → ${subject}.`;
    btn.textContent='Imported';
  }catch(e){console.error(e);$('status').className='status error';$('status').textContent='Import failed. Check Firestore permissions and try again.';btn.disabled=false;btn.textContent='Import Questions';}
}

function initFix(){
  const preview=$('preview');const importBtn=$('importBtn');if(!preview||!importBtn)return;
  let parsed=[];
  preview.onclick=()=>{
    parsed=parseQuestions($('source').value);
    window.__bulkFixedParsed=parsed;
    renderPreview(parsed);
    const invalid=parsed.filter(q=>q.errors.length).length;
    const ok=isSequenceValid(parsed);
    $('status').className='status'+(invalid||!ok?' error':'');
    $('status').textContent=!parsed.length?'No questions found.':ok&&!invalid?`✓ Found ${parsed.length} questions (Q1–Q${Math.max(...parsed.map(q=>q.num))}). They are ready to import.`:`Found ${parsed.length} questions. ${invalid} need correction; check the Q-number sequence.`;
  };
  importBtn.onclick=()=>importQuestions(window.__bulkFixedParsed||parseQuestions($('source').value));
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',initFix,{once:true}); else initFix();
