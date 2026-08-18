import { auth, db } from './firebase-config.js';
import { storage } from './storage-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js';
import { collection, getDocs, doc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js';
import { ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/12.17.0/firebase-storage.js';

const ADMIN='kiransingh.smile@gmail.com';
const $=id=>document.getElementById(id);
let authed=false;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const slug=v=>String(v||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,100);
const examDocId=name=>'exam-'+slug(name);
const subjectDocId=name=>'subject-'+slug(name);

function status(text,error=false){
  const el=$('individualStatus');
  if(el){el.className='status'+(error?' error':'');el.textContent=text;}
}

function addImageFields(){
  const form=$('individualForm'), grid=form?.querySelector('.individual-grid');
  if(!grid || grid.querySelector('#individualQuestionImage')) return;
  const fields=[
    ['individualQuestionImage','Question Image','Optional image for the question.'],
    ['individualAImage','Option A Image','Optional image for option A.'],
    ['individualBImage','Option B Image','Optional image for option B.'],
    ['individualCImage','Option C Image','Optional image for option C.'],
    ['individualDImage','Option D Image','Optional image for option D.']
  ];
  fields.forEach(([id,label,help])=>{
    const div=document.createElement('div'); div.className='field';
    div.innerHTML=`<label>${label}</label><input id="${id}" type="file" accept="image/*"><div class="help">${help}</div>`;
    grid.appendChild(div);
  });
}

async function nextQuestionNumber(exam,subject){
  const snap=await getDocs(collection(db,'questions'));
  let max=0;
  snap.docs.forEach(d=>{const q=d.data();if(String(q.exam||'').trim()===exam&&String(q.subject||'').trim()===subject){const n=Number(q.questionNumber);if(Number.isFinite(n)&&n>max)max=n;}});
  return max+1;
}

async function uploadImage(file,exam,subject,questionNumber,part){
  if(!file) return '';
  if(!file.type.startsWith('image/')) throw new Error(`${part} must be an image file.`);
  if(file.size>5*1024*1024) throw new Error(`${part} is larger than 5 MB.`);
  const ext=(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'');
  const path=`question-images/${slug(exam)}/${slug(subject)}/q${questionNumber}-${part.toLowerCase().replace(/[^a-z0-9]+/g,'-')}-${Date.now()}.${ext||'jpg'}`;
  const storageRef=ref(storage,path);
  await uploadBytes(storageRef,file,{contentType:file.type});
  return getDownloadURL(storageRef);
}

async function addWithImages(){
  if(!authed)return;
  const exam=$('exam').value.trim(),subject=$('subject').value.trim();
  const question=$('individualQuestion').value.trim(), A=$('individualA').value.trim(),B=$('individualB').value.trim(),C=$('individualC').value.trim(),D=$('individualD').value.trim();
  const correctAnswer=$('individualAnswer').value,explanation=$('individualExplanation').value.trim();
  const previousExam=$('previousExam').value.trim(),tags=$('tags').value.split(',').map(x=>x.trim().toLowerCase()).filter(Boolean),marks=Number($('marks').value)||0,negativeMarks=Number($('negative').value)||0;
  if(!exam||!subject)return status('Select an Exam and Subject first.',true);
  if(!question||!A||!B||!C||!D||!correctAnswer)return status('Question, all four options and the correct answer are required.',true);
  const files={question:$('individualQuestionImage')?.files?.[0],A:$('individualAImage')?.files?.[0],B:$('individualBImage')?.files?.[0],C:$('individualCImage')?.files?.[0],D:$('individualDImage')?.files?.[0]};
  const btn=$('addIndividual');btn.disabled=true;btn.textContent='Uploading & Adding…';status('');
  try{
    const questionNumber=await nextQuestionNumber(exam,subject);
    const [questionImage,AImage,BImage,CImage,DImage]=await Promise.all([
      uploadImage(files.question,exam,subject,questionNumber,'question'),
      uploadImage(files.A,exam,subject,questionNumber,'option-a'),
      uploadImage(files.B,exam,subject,questionNumber,'option-b'),
      uploadImage(files.C,exam,subject,questionNumber,'option-c'),
      uploadImage(files.D,exam,subject,questionNumber,'option-d')
    ]);
    const ref=doc(collection(db,'questions'));
    await setDoc(ref,{exam,subject,previousExam,tags,marks,negativeMarks,questionNumber,question,questionImageUrl:questionImage,options:{A,B,C,D},optionImageUrls:{A:AImage,B:BImage,C:CImage,D:DImage},correctAnswer,answerType:'single',explanation,answerSource:'individual-bulk-page',createdAt:serverTimestamp()});
    await setDoc(doc(db,'exams',examDocId(exam)),{name:exam,title:exam,subject,updatedAt:serverTimestamp(),createdBy:ADMIN},{merge:true});
    await setDoc(doc(db,'subjects',subjectDocId(subject)),{name:subject,updatedAt:serverTimestamp(),createdBy:ADMIN},{merge:true});
    status(`✓ Question ${questionNumber} added to ${exam} → ${subject}. Images uploaded successfully.`);
    ['individualQuestion','individualA','individualB','individualC','individualD','individualExplanation'].forEach(id=>{if($(id))$(id).value='';});
    $('individualAnswer').value='';
    ['individualQuestionImage','individualAImage','individualBImage','individualCImage','individualDImage'].forEach(id=>{if($(id))$(id).value='';});
  }catch(e){console.error(e);status(e.message||'Could not add question. Check Firebase Storage/Firestore permissions.',true);}
  finally{btn.disabled=false;btn.textContent='Add Question to Series';}
}

onAuthStateChanged(auth,u=>{authed=u?.email?.toLowerCase()===ADMIN.toLowerCase();if(authed)addImageFields();});
window.addEventListener('load',()=>addImageFields());

// Replace the existing individual-question click handler with the image-aware version.
// Capture phase prevents the older onclick handler in bulk-import.js from running.
window.addEventListener('load',()=>{
  const btn=$('addIndividual');
  if(!btn)return;
  btn.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();addWithImages();},true);
});