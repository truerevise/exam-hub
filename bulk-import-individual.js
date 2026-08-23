import { auth, db } from './firebase-config.js';
import { collection, doc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js';

const SUPER_ADMINS=['support@truerevise.com','commercewithkiransingh@gmail.com','kiransingh.smile@gmail.com'];
const MAX_IMAGE_SIZE=10*1024*1024;
const $=id=>document.getElementById(id);
const isSuperAdmin=u=>!!(u?.email&&SUPER_ADMINS.includes(u.email.toLowerCase()));
const slug=v=>String(v||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,100);
const examDocId=name=>'exam-'+slug(name);
const subjectDocId=name=>'subject-'+slug(name);

function status(text,error=false){const el=$('individualStatus');if(el){el.className='status'+(error?' error':'');el.textContent=text;}}
function storageError(e,part){const c=String(e?.code||'').toLowerCase();if(c.includes('permission-denied')||c.includes('unauthorized'))return `❌ Storage permission denied for ${part}. Signed in as ${auth.currentUser?.email||'unknown account'}.`;if(c.includes('unauthenticated'))return '❌ Firebase sign-in expired. Please sign in again.';return `❌ ${part} upload failed: ${e?.message||String(e)}`;}

function addTeluguFields(){
  const grid=$('individualForm')?.querySelector('.individual-grid');
  if(!grid||$('individualQuestionTe'))return;
  const title=document.createElement('div');title.className='field full';title.innerHTML='<div style="margin-top:8px;padding:10px 12px;border-radius:10px;background:#17213a;border:1px solid #30476e;color:#9eb6ff;font-weight:800">🇮🇳 Telugu / తెలుగు (optional)</div><div class="help">Enter Telugu only when an official Telugu version is available.</div>';grid.appendChild(title);
  const add=(id,label,placeholder,full=false)=>{const d=document.createElement('div');d.className='field'+(full?' full':'');d.innerHTML=`<label>🇮🇳 ${label}</label>${full?`<textarea id="${id}" placeholder="${placeholder}" style="min-height:90px;resize:vertical"></textarea>`:`<input id="${id}" placeholder="${placeholder}">`}`;grid.appendChild(d);};
  add('individualQuestionTe','Telugu Question','తెలుగు ప్రశ్నను నమోదు చేయండి',true);add('individualATe','Telugu Option A','తెలుగు ఎంపిక');add('individualBTe','Telugu Option B','తెలుగు ఎంపిక');add('individualCTe','Telugu Option C','తెలుగు ఎంపిక');add('individualDTe','Telugu Option D','తెలుగు ఎంపిక');add('individualExplanationTe','Telugu Explanation','తెలుగు వివరణ (ఐచ్ఛికం)',true);
}

function renderBulkImagePreview(){
  const box=$('bulkImagePreview');if(!box)return;const map=window.__bulkImportImages||{};const entries=[];
  Object.keys(map).sort((a,b)=>Number(a)-Number(b)).forEach(number=>Object.entries(map[number]||{}).forEach(([part,url])=>{if(url)entries.push({number,part,url});}));
  if(!entries.length){box.style.display='none';box.innerHTML='';return;}
  box.style.display='grid';box.innerHTML='<div class="bulk-image-heading">🖼️ Images attached to individually added questions</div>'+entries.map(({number,part,url})=>{const label=part==='question'?'Question image':`Option ${part} image`;return `<div class="bulk-image-card"><a href="${url}" target="_blank" rel="noopener"><img src="${url}" alt="Q${number} ${label}" loading="lazy"></a><div class="bulk-image-label">Q${number} — ${label}</div><button type="button" data-remove-bulk-image="${number}|${part}">Remove image</button></div>`;}).join('');
  box.querySelectorAll('[data-remove-bulk-image]').forEach(btn=>btn.addEventListener('click',()=>{const [n,p]=btn.dataset.removeBulkImage.split('|');if(window.__bulkImportImages[n]){delete window.__bulkImportImages[n][p];if(!Object.values(window.__bulkImportImages[n]).some(Boolean))delete window.__bulkImportImages[n];}renderBulkImagePreview();}));
}
window.renderBulkImagePreview=renderBulkImagePreview;

async function uploadImage(file,exam,subject,number,part,onProgress){
  if(!file)return '';if(!file.type.startsWith('image/'))throw new Error(`${part} must be an image file.`);if(file.size>MAX_IMAGE_SIZE)throw new Error(`${part} is larger than 10 MB.`);
  await auth.authStateReady();const user=auth.currentUser;if(!isSuperAdmin(user))throw new Error(`Admin Firebase sign-in is missing. Current account: ${user?.email||'none'}`);
  const [{storage},{ref,uploadBytesResumable,getDownloadURL}]=await Promise.all([import('./storage-config.js'),import('https://www.gstatic.com/firebasejs/12.17.0/firebase-storage.js')]);
  const ext=(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'')||'jpg';const safePart=part.toLowerCase().replace(/[^a-z0-9]+/g,'-');const path=`question-images/${slug(exam)}/${slug(subject)}/q${number}-${safePart}-${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;const storageRef=ref(storage,path);const task=uploadBytesResumable(storageRef,file,{contentType:file.type,cacheControl:'public,max-age=31536000'});
  return await new Promise((resolve,reject)=>{let done=false;const finish=(fn,v)=>{if(done)return;done=true;clearTimeout(timer);fn(v);};const timer=setTimeout(()=>{try{task.cancel();}catch(_){}finish(reject,new Error(`${part} upload timed out after 5 minutes.`));},300000);task.on('state_changed',s=>onProgress?.(s.totalBytes?Math.round(s.bytesTransferred/s.totalBytes*100):0),e=>finish(reject,e),async()=>{try{finish(resolve,await getDownloadURL(storageRef));}catch(e){finish(reject,e);}});});
}

function appendToBulk(data){
  const source=$('source');if(!source)throw new Error('Bulk Import text field was not found.');const n=data.number;const re=new RegExp(`(?:^|\\n)\\s*(?:Q(?:uestion)?\\s*)0*${n}\\s*[.):-]\\s*`,'im');
  if(re.test(source.value||'')){renderBulkImagePreview();return false;}
  const lines=[`Q${n}.`,`Question: ${data.question}`,`(A) ${data.A}`,`(B) ${data.B}`,`(C) ${data.C}`,`(D) ${data.D}`,`Answer: (${data.answer})`];if(data.explanation)lines.push(`Explanation: ${data.explanation}`);
  if(data.questionTe){lines.push(`Telugu Question: ${data.questionTe}`);if(data.ATe)lines.push(`(A-Telugu) ${data.ATe}`);if(data.BTe)lines.push(`(B-Telugu) ${data.BTe}`);if(data.CTe)lines.push(`(C-Telugu) ${data.CTe}`);if(data.DTe)lines.push(`(D-Telugu) ${data.DTe}`);if(data.explanationTe)lines.push(`Telugu Explanation: ${data.explanationTe}`);}
  source.value=source.value.trim()?`${source.value.replace(/\s+$/,'')}\n\n${lines.join('\n')}`:lines.join('\n');source.dispatchEvent(new Event('input',{bubbles:true}));source.scrollTop=source.scrollHeight;renderBulkImagePreview();return true;
}

async function addQuestion(){
  const btn=$('addIndividual');try{
    await auth.authStateReady();const user=auth.currentUser;if(!isSuperAdmin(user))throw new Error(`Admin Firebase sign-in is missing or unauthorized. Current account: ${user?.email||'none'}`);
    const exam=$('exam')?.value.trim(),subject=$('subject')?.value.trim(),number=Number($('individualQuestionNumber')?.value.trim()),question=$('individualQuestion')?.value.trim(),A=$('individualA')?.value.trim(),B=$('individualB')?.value.trim(),C=$('individualC')?.value.trim(),D=$('individualD')?.value.trim(),answer=$('individualAnswer')?.value||'',explanation=$('individualExplanation')?.value.trim()||'';
    const qTe=$('individualQuestionTe')?.value.trim()||'',ATe=$('individualATe')?.value.trim()||'',BTe=$('individualBTe')?.value.trim()||'',CTe=$('individualCTe')?.value.trim()||'',DTe=$('individualDTe')?.value.trim()||'',eTe=$('individualExplanationTe')?.value.trim()||'';
    if(!exam||!subject)throw new Error('Select an Exam and Subject first.');if(!Number.isInteger(number)||number<1||number>1000)throw new Error('Enter a valid Question No. (1–1000).');if(!question||!A||!B||!C||!D||!answer)throw new Error('English question, all four English options and the correct answer are required.');
    const files={question:$('individualQuestionImage')?.files?.[0],A:$('individualAImage')?.files?.[0],B:$('individualBImage')?.files?.[0],C:$('individualCImage')?.files?.[0],D:$('individualDImage')?.files?.[0]};const selected=Object.values(files).filter(Boolean);if(btn){btn.disabled=true;btn.textContent=selected.length?'Uploading…':'Adding…';}
    const urls={question:'',A:'',B:'',C:'',D:''};const labels={question:'Question image',A:'Option A image',B:'Option B image',C:'Option C image',D:'Option D image'};
    for(const [part,file] of Object.entries(files)){if(!file)continue;status(`Uploading ${labels[part]} (0%)…`);urls[part]=await uploadImage(file,exam,subject,number,part,p=>status(`Uploading ${labels[part]} (${p}%)…`));}
    status('Saving question to Firestore…');const hasTelugu=!!(qTe||ATe||BTe||CTe||DTe||eTe);await setDoc(doc(collection(db,'questions')),{exam,subject,previousExam:$('previousExam')?.value.trim()||'',tags:($('tags')?.value||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean),marks:Number($('marks')?.value)||0,negativeMarks:Number($('negative')?.value)||0,questionNumber:number,question,questionTe:qTe,questionImageUrl:urls.question,options:{A,B,C,D},optionsTe:{A:ATe,B:BTe,C:CTe,D:DTe},optionImageUrls:{A:urls.A,B:urls.B,C:urls.C,D:urls.D},correctAnswer:answer,answerType:'single',explanation,explanationTe:eTe,hasTelugu,availableLanguages:hasTelugu?['en','te']:['en'],answerSource:'individual-bulk-page',createdAt:serverTimestamp()});
    await setDoc(doc(db,'exams',examDocId(exam)),{name:exam,title:exam,subject,updatedAt:serverTimestamp(),createdBy:user.email||''},{merge:true});await setDoc(doc(db,'subjects',subjectDocId(subject)),{name:subject,updatedAt:serverTimestamp(),createdBy:user.email||''},{merge:true});
    const map=window.__bulkImportImages=window.__bulkImportImages||{};const imgs={};for(const p of ['question','A','B','C','D'])if(urls[p])imgs[p]=urls[p];if(Object.keys(imgs).length)map[String(number)]={...(map[String(number)]||{}),...imgs};
    const appended=appendToBulk({number,question,A,B,C,D,answer,explanation,questionTe:qTe,ATe,BTe,CTe,DTe,explanationTe:eTe});
    status(`✓ Question ${number} added to ${exam} → ${subject}${selected.length?' with image(s)':''}${appended?' and added to the bulk text.':' (already in bulk text).'}`);renderBulkImagePreview();
    ['individualQuestionNumber','individualQuestion','individualA','individualB','individualC','individualD','individualQuestionTe','individualATe','individualBTe','individualCTe','individualDTe','individualExplanation','individualExplanationTe'].forEach(id=>{if($(id))$(id).value='';});if($('individualAnswer'))$('individualAnswer').value='';['individualQuestionImage','individualAImage','individualBImage','individualCImage','individualDImage'].forEach(id=>{if($(id))$(id).value='';});
  }catch(e){console.error('Add Question to Series failed',e);status(storageError(e,'question/image'),true);}finally{if(btn){btn.disabled=false;btn.textContent='Add Question to Series';}}
}

function init(){
  addTeluguFields();renderBulkImagePreview();const btn=$('addIndividual');if(btn)btn.onclick=e=>{e.preventDefault();void addQuestion();};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
