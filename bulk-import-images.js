import { auth, db } from './firebase-config.js';
import { storage } from './storage-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js';
import { collection, getDocs, doc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js';
import { ref, uploadBytesResumable, getDownloadURL } from 'https://www.gstatic.com/firebasejs/12.17.0/firebase-storage.js';

const ADMIN='kiransingh.smile@gmail.com';
const MAX_IMAGE_SIZE=5*1024*1024;
const UPLOAD_TIMEOUT_MS=300000;
const $=id=>document.getElementById(id);
let authed=false;
const slug=v=>String(v||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,100);
const examDocId=name=>'exam-'+slug(name);
const subjectDocId=name=>'subject-'+slug(name);

function status(text,error=false){const el=$('individualStatus');if(el){el.className='status'+(error?' error':'');el.textContent=text;}}
function friendlyStorageError(error,part){const code=String(error?.code||'').toLowerCase();if(code.includes('unauthorized')||code.includes('permission-denied'))return `Firebase Storage permission denied for ${part}. Deploy the Storage rules from storage.rules and make sure the admin account is signed in.`;if(code.includes('unauthenticated'))return `Firebase Storage requires admin sign-in for ${part}. Please sign in again.`;if(code.includes('canceled')||code.includes('cancelled'))return `${part} upload was cancelled.`;if(code.includes('quota'))return `Firebase Storage quota/limit was reached while uploading ${part}.`;if(code.includes('retry-limit'))return `${part} upload could not complete because the network connection was interrupted.`;if(code.includes('invalid-checksum'))return `${part} upload failed integrity validation. Please choose the image again.`;if(code.includes('unknown'))return `Firebase Storage could not complete the ${part} upload. Check Storage is enabled for the Firebase project.`;return `${part} upload failed: ${error?.message||'unknown Firebase Storage error'}`;}

function addImageFields(){const form=$('individualForm'),grid=form?.querySelector('.individual-grid');if(!grid||grid.querySelector('#individualQuestionImage'))return;const fields=[['individualQuestionImage','Question Image','Optional image for the question.'],['individualAImage','Option A Image','Optional image for option A.'],['individualBImage','Option B Image','Optional image for option B.'],['individualCImage','Option C Image','Optional image for option C.'],['individualDImage','Option D Image','Optional image for option D.']];fields.forEach(([id,label,help])=>{const div=document.createElement('div');div.className='field image-field';div.innerHTML=`<label>🖼️ ${label}</label><input id="${id}" type="file" accept="image/*"><div class="help">${help} Maximum 5 MB.</div>`;grid.appendChild(div);});}
async function nextQuestionNumber(exam,subject){const snap=await getDocs(collection(db,'questions'));let max=0;snap.docs.forEach(d=>{const q=d.data();if(String(q.exam||'').trim()===exam&&String(q.subject||'').trim()===subject){const n=Number(q.questionNumber);if(Number.isFinite(n)&&n>max)max=n;}});return max+1;}
async function uploadImage(file,exam,subject,questionNumber,part,onProgress){if(!file)return '';if(!file.type.startsWith('image/'))throw new Error(`${part} must be an image file.`);if(file.size>MAX_IMAGE_SIZE)throw new Error(`${part} is larger than 5 MB.`);const ext=(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'')||'jpg';const safePart=part.toLowerCase().replace(/[^a-z0-9]+/g,'-');const path=`question-images/${slug(exam)}/${slug(subject)}/q${questionNumber}-${safePart}-${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;const storageRef=ref(storage,path);const task=uploadBytesResumable(storageRef,file,{contentType:file.type,cacheControl:'public,max-age=31536000'});return await new Promise((resolve,reject)=>{let settled=false;const finish=(fn,value)=>{if(settled)return;settled=true;clearTimeout(timer);fn(value);};const timer=setTimeout(()=>{try{task.cancel();}catch(_e){}finish(reject,new Error(`${part} upload timed out after 5 minutes. Check your internet connection and Firebase Storage.`));},UPLOAD_TIMEOUT_MS);task.on('state_changed',snapshot=>{const percent=snapshot.totalBytes?Math.round(snapshot.bytesTransferred/snapshot.totalBytes*100):0;if(typeof onProgress==='function')onProgress(percent);},error=>finish(reject,error),async()=>{try{const url=await getDownloadURL(storageRef);finish(resolve,url);}catch(error){finish(reject,error);}});});}

async function addWithImages(){
  if(!authed)return;
  const exam=$('exam').value.trim(),subject=$('subject').value.trim();
  const question=$('individualQuestion').value.trim(),A=$('individualA').value.trim(),B=$('individualB').value.trim(),C=$('individualC').value.trim(),D=$('individualD').value.trim();
  const numberRaw=$('individualQuestionNumber')?.value.trim()||'';
  const questionNumber=Number(numberRaw);
  const correctAnswer=$('individualAnswer').value,explanation=$('individualExplanation').value.trim();
  const previousExam=$('previousExam').value.trim(),tags=$('tags').value.split(',').map(x=>x.trim().toLowerCase()).filter(Boolean),marks=Number($('marks').value)||0,negativeMarks=Number($('negative').value)||0;
  if(!exam||!subject)return status('Select an Exam and Subject first.',true);
  if(!numberRaw||!Number.isInteger(questionNumber)||questionNumber<1||questionNumber>1000)return status('Enter a valid Question No. (1–1000).',true);
  if(!question||!A||!B||!C||!D||!correctAnswer)return status('Question, all four options and the correct answer are required.',true);

  const files={question:$('individualQuestionImage')?.files?.[0],A:$('individualAImage')?.files?.[0],B:$('individualBImage')?.files?.[0],C:$('individualCImage')?.files?.[0],D:$('individualDImage')?.files?.[0]};
  const selected=Object.entries(files).filter(([,file])=>file);const btn=$('addIndividual');btn.disabled=true;btn.textContent=selected.length?'Uploading…':'Adding…';status('');
  try{
    const uploaded={question:'',A:'',B:'',C:'',D:''};const labels={question:'Question image',A:'Option A image',B:'Option B image',C:'Option C image',D:'Option D image'};
    for(const [key,file] of Object.entries(files)){if(!file)continue;status(`Uploading ${labels[key]} (0%)…`);uploaded[key]=await uploadImage(file,exam,subject,questionNumber,key,percent=>status(`Uploading ${labels[key]} (${percent}%)…`));}
    status('Saving question…');
    const questionRef=doc(collection(db,'questions'));
    await setDoc(questionRef,{exam,subject,previousExam,tags,marks,negativeMarks,questionNumber,question,questionImageUrl:uploaded.question,options:{A,B,C,D},optionImageUrls:{A:uploaded.A,B:uploaded.B,C:uploaded.C,D:uploaded.D},correctAnswer,answerType:'single',explanation,answerSource:'individual-bulk-page',createdAt:serverTimestamp()});
    await setDoc(doc(db,'exams',examDocId(exam)),{name:exam,title:exam,subject,updatedAt:serverTimestamp(),createdBy:ADMIN},{merge:true});
    await setDoc(doc(db,'subjects',subjectDocId(subject)),{name:subject,updatedAt:serverTimestamp(),createdBy:ADMIN},{merge:true});
    status(`✓ Question ${questionNumber} added to ${exam} → ${subject}${selected.length?' with image(s).':''}`);
    ['individualQuestionNumber','individualQuestion','individualA','individualB','individualC','individualD','individualExplanation'].forEach(id=>{if($(id))$(id).value='';});$('individualAnswer').value='';['individualQuestionImage','individualAImage','individualBImage','individualCImage','individualDImage'].forEach(id=>{if($(id))$(id).value='';});
  }catch(e){console.error('Individual question/image upload failed:',e);const failedPart=selected.length?'Image upload':'Question save';status(e?.code?friendlyStorageError(e,failedPart):String(e?.message||'Could not add question. Please try again.'),true);}finally{btn.disabled=false;btn.textContent='Add Question to Series';}
}

onAuthStateChanged(auth,u=>{authed=u?.email?.toLowerCase()===ADMIN.toLowerCase();if(authed)addImageFields();});
window.addEventListener('load',()=>addImageFields());
window.addEventListener('load',()=>{const btn=$('addIndividual');if(!btn)return;btn.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();addWithImages();},true);});