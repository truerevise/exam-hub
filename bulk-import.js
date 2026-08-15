import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js';
import { collection, writeBatch, doc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js';

const ADMIN = 'kiransingh.smile@gmail.com';
const $ = (id) => document.getElementById(id);
let parsed = [];
let authed = false;

onAuthStateChanged(auth, (u) => {
  if (u?.email?.toLowerCase() === ADMIN.toLowerCase()) authed = true;
  else location.replace('admin.html');
});

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function normalize(text){return String(text||'').replace(/\r\n?/g,'\n').replace(/[\u00a0\u2007\u202f]/g,' ').replace(/[“”]/g,'"').replace(/[‘’]/g,"'");}
function examDocId(name){return 'exam-'+name.trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,100);}

function parseQuestions(text){
  const normalized=normalize(text),startRe=/^\s*(?:Q(?:uestion)?\s*)0*(\d{1,3})\s*[.):-]\s*/gim,starts=[...normalized.matchAll(startRe)],out=[];
  for(let i=0;i<starts.length;i++){
    const start=starts[i].index,end=i+1<starts.length?starts[i+1].index:normalized.length,num=Number(starts[i][1]);let block=normalized.slice(start,end).trim();
    block=block.replace(/^\s*(?:Q(?:uestion)?\s*)0*\d{1,3}\s*[.):-]\s*/i,'').trim();
    const explanationMatch=block.match(/(?:^|\n)\s*Explanation\s*:\s*([\s\S]*)$/i),explanation=explanationMatch?explanationMatch[1].trim():'';if(explanationMatch)block=block.slice(0,explanationMatch.index).trim();
    const answerMatch=block.match(/(?:^|\n)\s*Answer\s*:\s*\(?\s*(A|B|C|D|ALL|MULTIPLE|DELETED)\s*\)?/i),correctAnswer=answerMatch?answerMatch[1].toUpperCase():'';if(answerMatch)block=block.slice(0,answerMatch.index).trim();
    const optionRe=/(?:^|\n)\s*\(([ABCD])\)\s*/gi,optionStarts=[...block.matchAll(optionRe)],options={A:'',B:'',C:'',D:''};let question=block;
    if(optionStarts.length>=4){question=block.slice(0,optionStarts[0].index).trim();for(let j=0;j<optionStarts.length;j++){const letter=optionStarts[j][1].toUpperCase(),from=optionStarts[j].index+optionStarts[j][0].length,to=j+1<optionStarts.length?optionStarts[j+1].index:block.length;if(!options[letter])options[letter]=block.slice(from,to).trim();}}
    else{const compactRe=/\(([ABCD])\)\s*/gi,compactStarts=[...block.matchAll(compactRe)];if(compactStarts.length>=4){question=block.slice(0,compactStarts[0].index).trim();for(let j=0;j<compactStarts.length;j++){const letter=compactStarts[j][1].toUpperCase(),from=compactStarts[j].index+compactStarts[j][0].length,to=j+1<compactStarts.length?compactStarts[j+1].index:block.length;if(!options[letter])options[letter]=block.slice(from,to).trim();}}}
    question=question.replace(/^[:\-\s]+/,'').trim();Object.keys(options).forEach(k=>options[k]=options[k].replace(/\s+$/,'').trim());
    const errors=[];if(!question)errors.push('missing question');for(const letter of ['A','B','C','D'])if(!options[letter])errors.push('missing '+letter);if(!correctAnswer)errors.push('missing answer');
    if(correctAnswer&&!['A','B','C','D','ALL','MULTIPLE','DELETED'].includes(correctAnswer))errors.push('invalid answer');out.push({num,question,options,correctAnswer,explanation,errors});
  }return out;
}
function sequenceIssues(items){const nums=items.map(q=>q.num),duplicates=nums.filter((n,i)=>nums.indexOf(n)!==i).filter((n,i,a)=>a.indexOf(n)===i),missing=[];for(let n=1;n<=100;n++)if(!nums.includes(n))missing.push(n);return{duplicates,missing,outOfRange:nums.filter(n=>n<1||n>100)};}
function renderPreview(){const seq=sequenceIssues(parsed),valid=parsed.filter(q=>!q.errors.length).length,sequenceOk=parsed.length===100&&!seq.duplicates.length&&!seq.missing.length&&!seq.outOfRange.length;$('summary').innerHTML=`<span class="pill">Detected: ${parsed.length}</span><span class="pill">Valid: ${valid}</span><span class="pill">Errors: ${parsed.length-valid}</span><span class="pill">Sequence: ${sequenceOk?'1–100 ✓':'Needs review'}</span>`;$('rows').innerHTML=parsed.length?parsed.map(q=>`<div class="row"><div>Q${q.num}</div><div><b>${esc(q.question)}</b><div class="small-options">${['A','B','C','D'].map(k=>`<div><b>(${k})</b> ${esc(q.options[k])}</div>`).join('')}</div></div><div>${esc(q.correctAnswer||'—')}</div><div class="${q.errors.length?'bad':'ok'}">${q.errors.length?esc(q.errors.join(', ')):'Ready'}</div></div>`).join(''):'<div class="row"><div>—</div><div>No questions detected.</div><div>—</div><div class="bad">Invalid</div></div>';$('previewCard').style.display='block';const warnings=[];if(seq.duplicates.length)warnings.push(`duplicate numbers: ${seq.duplicates.join(', ')}`);if(seq.missing.length)warnings.push(`missing numbers: ${seq.missing.slice(0,20).join(', ')}${seq.missing.length>20?'…':''}`);if(seq.outOfRange.length)warnings.push(`out-of-range numbers: ${seq.outOfRange.join(', ')}`);$('sequenceWarning').textContent=warnings.length?warnings.join(' | '):'✓ Questions are in the correct Q1–Q100 sequence.';}

$('preview').onclick=()=>{parsed=parseQuestions($('source').value);renderPreview();const invalid=parsed.filter(q=>q.errors.length).length,seq=sequenceIssues(parsed),sequenceOk=parsed.length===100&&!seq.duplicates.length&&!seq.missing.length&&!seq.outOfRange.length;$('status').className='status '+(invalid||!sequenceOk?'error':'');$('status').textContent=!parsed.length?'No questions found.':sequenceOk&&!invalid?'✓ Found all 100 questions. They are ready to import.':`Found ${parsed.length} questions. ${invalid} need correction${sequenceOk?'.':'; check the Q-number sequence.'}`;};
$('clear').onclick=()=>{$('source').value='';parsed=[];$('previewCard').style.display='none';$('status').textContent='';};
$('load2018').onclick=async()=>{try{$('status').className='status';$('status').textContent='Loading all 100 questions…';const r=await fetch('data/ts-set-commerce-2018.txt?bulk=100',{cache:'no-store'});if(!r.ok)throw new Error('Could not load paper');$('source').value=await r.text();$('status').textContent='✓ All 100 questions loaded. Tap Preview & Validate.';}catch(e){$('status').className='status error';$('status').textContent='Could not load the prepared paper. Paste the text manually.';}};

$('importBtn').onclick=async()=>{
  if(!authed)return;const valid=parsed.filter(q=>!q.errors.length),seq=sequenceIssues(parsed),sequenceOk=parsed.length===100&&!seq.duplicates.length&&!seq.missing.length&&!seq.outOfRange.length;
  if(!valid.length)return $('status').textContent='Nothing valid to import.';if(valid.length!==parsed.length||!sequenceOk){$('status').className='status error';$('status').textContent='Fix validation/sequence errors before importing.';return;}
  const exam=$('exam').value.trim(),subject=$('subject').value.trim(),previousExam=$('previousExam').value.trim(),tags=$('tags').value.split(',').map(x=>x.trim().toLowerCase()).filter(Boolean),marks=Number($('marks').value)||0,negativeMarks=Number($('negative').value)||0;
  if(!exam||!subject){$('status').className='status error';$('status').textContent='Exam and Subject are required.';return;}if(!confirm(`Import all ${valid.length} questions into the Question Bank?`))return;
  const btn=$('importBtn');btn.disabled=true;btn.textContent='Importing…';
  try{
    for(let i=0;i<valid.length;i+=400){const batch=writeBatch(db);if(i===0){batch.set(doc(db,'exams',examDocId(exam)),{name:exam,updatedAt:serverTimestamp(),createdBy:ADMIN},{merge:true});}for(const q of valid.slice(i,i+400)){const ref=doc(collection(db,'questions'));batch.set(ref,{exam,subject,previousExam,tags,marks,negativeMarks,questionNumber:q.num,question:q.question,options:q.options,correctAnswer:q.correctAnswer,answerType:['A','B','C','D'].includes(q.correctAnswer)?'single':q.correctAnswer==='ALL'?'all':q.correctAnswer==='MULTIPLE'?'multiple':'deleted_or_all_awarded',explanation:q.explanation,answerSource:'bulk-import',createdAt:serverTimestamp()});}await batch.commit();}
    $('status').className='status';$('status').textContent=`✓ Successfully imported all ${valid.length} questions and registered the ${exam} exam.`;btn.textContent='Imported';
  }catch(e){console.error(e);$('status').className='status error';$('status').textContent='Import failed. Check Firestore permissions and try again. No existing questions were modified.';btn.disabled=false;btn.textContent='Import Valid Questions';}
};
