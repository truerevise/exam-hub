import { auth, db } from './firebase-config.js';
import { doc, getDoc, serverTimestamp, setDoc } from 'https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js';

const REPORTS = 'questionReports';
const $ = (id) => document.getElementById(id);
let currentUser = null;
let initialized = false;
let observer = null;
let lastQuestionSignature = '';

function esc(value) {
  return String(value ?? '').replace(/[&<>\"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#039;' }[c]));
}

function pageContext() {
  const p = new URLSearchParams(location.search);
  return {
    page: location.pathname.split('/').pop() || 'test.html',
    exam: p.get('exam') || '',
    subject: p.get('subject') || '',
    testId: p.get('id') || '',
    batchId: p.get('batchId') || '',
    questionNo: ($('questionNo')?.textContent || $('no')?.textContent || '').trim()
  };
}

function currentQuestion() {
  const el = $('question') || $('q');
  if (!el) return null;
  const text = (el.textContent || '').replace(/^\s*\d+\.?\s*/, '').replace(/\s+/g, ' ').trim();
  if (!text || /^loading/i.test(text)) return null;
  const options = {};
  for (const letter of ['A','B','C','D']) {
    const option = $('option' + letter) || $(letter);
    if (option) options[letter] = (option.textContent || '').replace(new RegExp('^' + letter + '\\.?\\s*'), '').replace(/\s+/g, ' ').trim();
  }
  return { text, options, element: el };
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function toast(message, ok = true) {
  let el = $('questionReportToast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'questionReportToast';
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.className = 'question-report-toast show' + (ok ? '' : ' error');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), 3200);
}

async function submitReport(reason) {
  if (!currentUser) {
    toast('Please sign in to report a question.', false);
    return;
  }
  const q = currentQuestion();
  if (!q) {
    toast('The question is still loading. Please try again.', false);
    return;
  }
  const context = pageContext();
  const key = await sha256(`${currentUser.uid}|${context.page}|${context.testId}|${context.batchId}|${context.exam}|${context.subject}|${context.questionNo}|${q.text}|${reason}`);
  const ref = doc(db, REPORTS, key);
  try {
    const existing = await getDoc(ref);
    if (existing.exists()) {
      toast('You already reported this issue. Thank you.');
      return;
    }
    await setDoc(ref, {
      reportId: key,
      uid: currentUser.uid,
      userEmail: currentUser.email || '',
      anonymous: !!currentUser.isAnonymous,
      reason,
      status: 'new',
      page: context.page,
      exam: context.exam,
      subject: context.subject,
      testId: context.testId,
      batchId: context.batchId,
      questionNo: context.questionNo,
      question: q.text,
      options: q.options,
      url: location.href,
      reportedAt: serverTimestamp()
    });
    toast('Question reported successfully. Thank you!');
  } catch (error) {
    console.error('Question report failed:', error);
    const code = error?.code || '';
    toast(code === 'permission-denied' ? 'Report permission was denied. Please try again after refreshing.' : 'Could not send the report. Please try again.', false);
  }
}

function injectStyles() {
  if ($('questionReportStyles')) return;
  const style = document.createElement('style');
  style.id = 'questionReportStyles';
  style.textContent = `
    .question-report-wrap{position:relative;display:inline-flex;flex:0 0 auto;margin-left:4px}
    .question-report-btn{border:1px solid #46546b;background:#202a39;color:#dbe5ff;border-radius:10px;padding:9px 10px;cursor:pointer;font-weight:900;font-size:13px;line-height:1}
    .question-report-btn:hover,.question-report-btn:focus{border-color:#f59e0b;color:#fbbf24;outline:none}
    .question-report-menu{position:absolute;right:0;top:calc(100% + 7px);width:245px;background:#151c27;border:1px solid #39465a;border-radius:12px;padding:6px;box-shadow:0 18px 40px #000b;z-index:80;display:none}
    .question-report-wrap.open .question-report-menu{display:block}
    .question-report-menu button{width:100%;border:0;background:transparent;color:#e8edf5;text-align:left;padding:10px 11px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700}
    .question-report-menu button:hover,.question-report-menu button:focus{background:#253044;color:#fff;outline:none}
    .question-report-label{font-size:10px;color:#8f9bad;padding:7px 10px 5px;font-weight:800;text-transform:uppercase;letter-spacing:.06em}
    .question-report-toast{position:fixed;left:50%;bottom:92px;transform:translate(-50%,18px);opacity:0;pointer-events:none;background:#163a2e;border:1px solid #2f8f6d;color:#eafff6;padding:11px 15px;border-radius:12px;z-index:200;font-weight:800;font-size:13px;box-shadow:0 14px 35px #0008;transition:.2s ease;max-width:min(92vw,430px);text-align:center}
    .question-report-toast.error{background:#3a1b1b;border-color:#9b4a4a;color:#ffecec}
    .question-report-toast.show{opacity:1;transform:translate(-50%,0)}
    @media(max-width:520px){.question-report-btn{padding:8px 9px;font-size:12px}.question-report-menu{width:225px}.question-report-menu button{padding:11px 10px}}
  `;
  document.head.appendChild(style);
}

function attachReportButton(saveButton) {
  if ($('questionReportRoot') || !saveButton?.parentNode) return;
  const wrap = document.createElement('div');
  wrap.id = 'questionReportRoot';
  wrap.className = 'question-report-wrap';
  wrap.innerHTML = `
    <button type="button" class="question-report-btn" aria-label="Report question" title="Report this question">⚑</button>
    <div class="question-report-menu" role="menu">
      <div class="question-report-label">Report this question</div>
      <button type="button" data-reason="No correct answer">⚠️ No correct answer</button>
      <button type="button" data-reason="Question wording/frame is wrong">📝 Question wording/frame is wrong</button>
      <button type="button" data-reason="Wrong or missing option">❌ Wrong or missing option</button>
      <button type="button" data-reason="Other issue">💬 Other issue</button>
    </div>`;
  saveButton.parentNode.insertBefore(wrap, saveButton.nextSibling);
  const button = wrap.querySelector('.question-report-btn');
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    wrap.classList.toggle('open');
  });
  wrap.querySelectorAll('[data-reason]').forEach((item) => item.addEventListener('click', async (event) => {
    event.stopPropagation();
    wrap.classList.remove('open');
    await submitReport(item.dataset.reason);
  }));
  document.addEventListener('click', () => wrap.classList.remove('open'), { passive: true });
}

function refresh() {
  const question = currentQuestion();
  const save = $('saveBtn');
  if (!question || !save) return false;
  injectStyles();
  attachReportButton(save);
  const signature = `${pageContext().questionNo}|${question.text}`;
  if (signature !== lastQuestionSignature) lastQuestionSignature = signature;
  return true;
}

function start() {
  if (initialized) return;
  initialized = true;
  injectStyles();
  refresh();
  observer = new MutationObserver(() => {
    if (!refresh()) return;
    clearTimeout(start.refreshTimer);
    start.refreshTimer = setTimeout(refresh, 60);
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
}

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  if (user) start();
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start, { once: true });
} else {
  start();
}
