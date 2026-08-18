import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js';
import { collection, getDocs, writeBatch, doc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js';

const ADMIN='kiransingh.smile@gmail.com';
const $=id=>document.getElementById(id);
let parsed=[];
let authed=false;

onAuthStateChanged(auth,async u=>{
  if(u?.email?.toLowerCase()!==ADMIN.toLowerCase()){location.replace('admin.html');return;}
  authed=true;
  await loadChoices();
});

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function normalize(text){return String(text||'').replace(/\r\n?/g,'\n').replace(/[\u00a0\u2007\u202f]/g,' ').replace(/[“”]/g,'"').replace(/[‘’]/g,"'");}
function slug(v){return String(v).trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,100);}
function examDocId(name){return 'exam-'+slug(name);}
function subjectDocId(name){return 'subject-'+slug(name);}

async function loadChoices(){
  try{
    const examSnap=await getDocs(collection(db,'exams'));
    const exams=examSnap.docs.map(d=>({id:d.id,...d.data()})).filter(x=>x.name||x.title);
    const subjectSet=new Set();
    examSnap.docs.forEach(d=>{const s=d.data().subject;if(s)subjectSet.add(String(s).trim());});
    try{const subSnap=await getDocs(collection(db,'subjects'));subSnap.docs.forEach(d=>{const s=d.data().name||d.id;if(s)subjectSet.add(String(s).trim());});}catch(e){console.warn('subjects collection unavailable',e);}
    fillSelect('exam',exams.map(x=>x.name||x.title).filter(Boolean).sort((a,b)=>a.localeCompare(b)),'Telangana SET');
    fillSelect('subject',[...subjectSet].filter(Boolean).sort((a,b)=>a.localeCompare(b)),'Commerce Paper 2');
  }catch(e){setStatus('Could not load exam/subject choices: '+e.message,true);}
}
function fillSelect(id,items,preferred){const s=$(id);s.innerHTML='';if(!items.length)items=[preferred];[...new Set(items)].forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=v;s.appendChild(o);});if(preferred&&items.includes(preferred))s.value=preferred;}
function showNew(type){$(type==='exam'?'newExamBox':'newSubjectBox').style.display='block';$(type==='exam'?'newExam':'newSubject').focus();}
async function saveChoice(type){
  const input=$(type==='exam'?'newExam':'newSubject'),name=input.value.trim();
  if(!name){setStatus(`Enter a ${type} name first.`,true);return;}
  try{
    if(type==='exam') await setDoc(doc(db,'exams',examDocId(name)),{name,title:name,status:'draft',enabled:true,createdBy:ADMIN,updatedAt:serverTimestamp()},{merge:true});
    else await setDoc(doc(db,'subjects',subjectDocId(name)),{name,createdBy:ADMIN,updatedAt:serverTimestamp()},{merge:true});
    const select=$(type==='exam'?'exam':'subject');if(![...select.options].some(o=>o.value===name)){const o=document.createElement('option');o.value=name;o.textContent=name;select.appendChild(o);}select.value=name;input.value='';$(type==='exam'?'newExamBox':'newSubjectBox').style.display='none';setStatus(`✓ ${type[0].toUpperCase()+type.slice(1)} added successfully.`);if(type==='exam')$('previousExam').value=name;
  }catch(e){setStatus(`Could not save ${type}: ${e.message}`,true);}
}
$('addExam').onclick=()=>showNew('exam');
$('addSubject').onclick=()=>showNew('subject');
$('saveExam').onclick=()=>saveChoice('exam');
$('saveSubject').onclick=()=>saveChoice('subject');
$('toggleIndividual').onclick=()=>{const box=$('individualForm'),show=box.style.display!=='block';box.style.display=show?'block':'none';$('toggleIndividual').textContent=show?'Hide Individual Question Form':'Show Individual Question Form';};
function setStatus(text,error=false){$('status').className='status'+(error?' error':'');$('status').textContent=text;}
function setIndividualStatus(text,error=false){$('individualStatus').className='status'+(error?' error':'');$('individualStatus').textContent=text;}

async function nextQuestionNumber(exam,subject){
  const snap=await getDocs(collection(db,'questions'));
  let max=0;
  snap.docs.forEach(d=>{const q=d.data();if(String(q.exam||'').trim()===exam&&String(q.subject||'').trim()===subject){const n=Number(q.questionNumber);if(Number.isFinite(n)&&n>max)max=n;}});
  return max+1;
}
$('addIndividual').onclick=async()=>{
  if(!authed)return;
  const exam=$('exam').value.trim(),subject=$('subject').value.trim(),question=$('individualQuestion').value.trim(),A=$('individualA').value.trim(),B=$('individualB').value.trim(),C=$('individualC').value.trim(),D=$('individualD').value.trim(),correctAnswer=$('individualAnswer').value,explanation=$('individualExplanation').value.trim(),previousExam=$('previousExam').value.trim(),tags=$('tags').value.split(',').map(x=>x.trim().toLowerCase()).filter(Boolean),marks=Number($('marks').value)||0,negativeMarks=Number($('negative').value)||0;
  if(!exam||!subject){setIndividualStatus('Select an Exam and Subject first.',true);return;}
  if(!question||!A||!B||!C||!D||!correctAnswer){setIndividualStatus('Question, all four options and the correct answer are required.',true);return;}
  const btn=$('addIndividual');btn.disabled=true;btn.textContent='Adding…';
  try{
    const questionNumber=await nextQuestionNumber(exam,subject);
    const ref=doc(collection(db,'questions'));
    await setDoc(ref,{exam,subject,previousExam,tags,marks,negativeMarks,questionNumber,question,options:{A,B,C,D},correctAnswer,answerType:'single',explanation,answerSource:'individual-bulk-page',createdAt:serverTimestamp()});
    await setDoc(doc(db,'exams',examDocId(exam)),{name:exam,title:exam,subject,updatedAt:serverTimestamp(),createdBy:ADMIN},{merge:true});
    await setDoc(doc(db,'subjects',subjectDocId(subject)),{name:subject,updatedAt:serverTimestamp(),createdBy:ADMIN},{merge:true});
    setIndividualStatus(`✓ Question ${questionNumber} added to ${exam} → ${subject}.`);
    $('individualQuestion').value='';$('individualA').value='';$('individualB').value='';$('individualC').value='';$('individualD').value='';$('individualAnswer').value='';$('individualExplanation').value='';
  }catch(e){console.error(e);setIndividualStatus('Could not add question. Check Firestore permissions and try again.',true);}finally{btn.disabled=false;btn.textContent='Add Question to Series';}
};

function parseQuestions(text){
  const normalized=normalize(text),re=/^\s*(?:Q(?:uestion)?\s*)0*(\d{1,3})\s*[.):-]\s*/gim,starts=[...normalized.matchAll(re)],out=[];
  for(let i=0;i<starts.length;i++){
    const start=starts[i].index,end=i+1<starts.length?starts[i+1].index:normalized.length,num=Number(starts[i][1]);let block=normalized.slice(start,end).trim();
    block=block.replace(/^\s*(?:Q(?:uestion)?\s*)0*\d{1,3}\s*[.):-]\s*/i,'').trim();
    const em=block.match(/(?:^|\n)\s*Explanation\s*:\s*([\s\S]*)$/i),explanation=em?em[1].trim():'';if(em)block=block.slice(0,em.index).trim();
    const am=block.match(/(?:^|\n)\s*Answer\s*:\s*\(?\s*(A|B|C|D|ALL|MULTIPLE|DELETED)\s*\)?/i),correctAnswer=am?am[1].toUpperCase():'';if(am)block=block.slice(0,am.index).trim();
    const reOpt=/(?:^|\n)\s*\(([ABCD])\)\s*/gi,os=[...block.matchAll(reOpt)],options={A:'',B:'',C:'',D:''};let question=block;
    if(os.length>=4){question=block.slice(0,os[0].index).trim();for(let j=0;j<os.length;j++){const k=os[j][1].toUpperCase(),from=os[j].index+os[j][0].length,to=j+1<os.length?os[j+1].index:block.length;if(!options[k])options[k]=block.slice(from,to).trim();}}
    question=question.replace(/^[:\-\s]+/,'').trim();Object.keys(options).forEach(k=>options[k]=options[k].trim());
    const errors=[];if(!question)errors.push('missing question');for(const k of ['A','B','C','D'])if(!options[k])errors.push('missing '+k);if(!correctAnswer)errors.push('missing answer');
    out.push({num,question,options,correctAnswer,explanation,errors});
  }return out;
}
function sequenceIssues(items){const nums=items.map(q=>q.num),duplicates=[...new Set(nums.filter((n,i)=>nums.indexOf(n)!==i))],missing=[];for(let n=1;n<=100;n++)if(!nums.includes(n))missing.push(n);return{duplicates,missing,outOfRange:nums.filter(n=>n<1||n>100)};}
function renderPreview(){
  const seq=sequenceIssues(parsed),valid=parsed.filter(q=>!q.errors.length).length,ok=parsed.length===100&&!seq.duplicates.length&&!seq.missing.length&&!seq.outOfRange.length;
  $('summary').innerHTML=`<span class="pill">Detected: ${parsed.length}</span><span class="pill">Valid: ${valid}</span><span class="pill">Errors: ${parsed.length-valid}</span><span class="pill">Sequence: ${ok?'1–100 ✓':'Needs review'}</span>`;
  $('rows').innerHTML=parsed.length?parsed.map(q=>`<div class="row"><div>Q${q.num}</div><div><b>${esc(q.question)}</b><div class="small-options">${['A','B','C','D'].map(k=>`<div><b>(${k})</b> ${esc(q.options[k])}</div>`).join('')}</div></div><div>${esc(q.correctAnswer||'—')}</div><div class="${q.errors.length?'bad':'ok'}">${q.errors.length?esc(q.errors.join(', ')):'Ready'}</div></div>`).join(''):'<div class="row"><div>—</div><div>No questions detected.</div><div>—</div><div class="bad">Invalid</div></div>';
  $('previewCard').style.display='block';
  const w=[];if(seq.duplicates.length)w.push(`duplicate numbers: ${seq.duplicates.join(', ')}`);if(seq.missing.length)w.push(`missing numbers: ${seq.missing.slice(0,20).join(', ')}${seq.missing.length>20?'…':''}`);if(seq.outOfRange.length)w.push(`out-of-range numbers: ${seq.outOfRange.join(', ')}`);$('sequenceWarning').textContent=w.length?w.join(' | '):'✓ Questions are in the correct Q1–Q100 sequence.';
}
$('preview').onclick=()=>{parsed=parseQuestions($('source').value);renderPreview();const invalid=parsed.filter(q=>q.errors.length).length,seq=sequenceIssues(parsed),ok=parsed.length===100&&!seq.duplicates.length&&!seq.missing.length&&!seq.outOfRange.length;setStatus(!parsed.length?'No questions found.':ok&&!invalid?'✓ Found all 100 questions. They are ready to import.':`Found ${parsed.length} questions. ${invalid} need correction${ok?'.':'; check the Q-number sequence.'}`,invalid||!ok);};
$('clear').onclick=()=>{$('source').value='';parsed=[];$('previewCard').style.display='none';setStatus('');};

$('importBtn').onclick=async()=>{
  if(!authed)return;
  const valid=parsed.filter(q=>!q.errors.length),seq=sequenceIssues(parsed),ok=parsed.length===100&&!seq.duplicates.length&&!seq.missing.length&&!seq.outOfRange.length;
  if(valid.length!==parsed.length||!ok){setStatus('Fix validation/sequence errors before importing.',true);return;}
  const exam=$('exam').value.trim(),subject=$('subject').value.trim(),previousExam=$('previousExam').value.trim(),tags=$('tags').value.split(',').map(x=>x.trim().toLowerCase()).filter(Boolean),marks=Number($('marks').value)||0,negativeMarks=Number($('negative').value)||0;
  if(!exam||!subject){setStatus('Exam and Subject are required.',true);return;}
  if(!confirm(`Import all ${valid.length} questions into ${exam} → ${subject}?`))return;
  const btn=$('importBtn');btn.disabled=true;btn.textContent='Importing…';
  try{
    for(let i=0;i<valid.length;i+=400){
      const batch=writeBatch(db);
      if(i===0)batch.set(doc(db,'exams',examDocId(exam)),{name:exam,title:exam,subject,updatedAt:serverTimestamp(),createdBy:ADMIN},{merge:true});
      for(const q of valid.slice(i,i+400)){const ref=doc(collection(db,'questions'));batch.set(ref,{exam,subject,previousExam,tags,marks,negativeMarks,questionNumber:q.num,question:q.question,options:q.options,correctAnswer:q.correctAnswer,answerType:['A','B','C','D'].includes(q.correctAnswer)?'single':q.correctAnswer==='ALL'?'all':q.correctAnswer==='MULTIPLE'?'multiple':'deleted_or_all_awarded',explanation:q.explanation,answerSource:'bulk-import',createdAt:serverTimestamp()});}
      await batch.commit();
    }
    await setDoc(doc(db,'subjects',subjectDocId(subject)),{name:subject,updatedAt:serverTimestamp(),createdBy:ADMIN},{merge:true});
    setStatus(`✓ Successfully imported all ${valid.length} questions into ${exam} → ${subject}.`);btn.textContent='Imported';
  }catch(e){console.error(e);setStatus('Import failed. Check Firestore permissions and try again.',true);btn.disabled=false;btn.textContent='Import Questions';}
};
