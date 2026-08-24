import { auth, db } from './firebase-config.js';
import { addDoc, collection, doc, getDoc, getDocs, query, where, serverTimestamp, setDoc } from 'https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js';

const $ = (id) => document.getElementById(id);
const REPORTS = 'questionReports';
let currentUser = null;
let questionMediaToken = 0;

onAuthStateChanged(auth, (u) => {
  currentUser = u;
  if (u) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
    else init();
  }
});

function esc(v) {
  return String(v ?? '').replace(/[&<>\"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#039;' }[c]));
}

function getPageContext() {
  const p = new URLSearchParams(location.search);
  return {
    page: location.pathname.split('/').pop() || 'test.html',
    exam: p.get('exam') || '',
    subject: p.get('subject') || '',
    testId: p.get('id') || '',
    questionNo: ($('questionNo')?.textContent || $('no')?.textContent || '').trim()
  };
}

function getCurrentQuestion() {
  const questionEl = $('question') || $('q');
  if (!questionEl) return null;
  const text = (questionEl.textContent || '').replace(/^\s*\d+\.?\s*/, '').trim();
  if (!text || /^loading/i.test(text)) return null;
  const options = {};
  ['A','B','C','D'].forEach((letter) => {
    const el = $('option' + letter) || $(letter);
    if (el) options[letter] = (el.textContent || '').replace(new RegExp('^' + letter + '\\.?\\s*'), '').trim();
  });
  return { text, options };
}

async function hash(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function showToast(message, ok = true) {
  let toast = $('questionReportToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'questionReportToast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.className = ok ? 'question-report-toast show' : 'question-report-toast show error';
  clearTimeout(showToast.t);
  showToast.t = setTimeout(() => toast.classList.remove('show'), 3200);
}

async function submitReport(reason) {
  if (!currentUser) {
    showToast('Please sign in to report a question.', false);
    return;
  }
  const q = getCurrentQuestion();
  if (!q) return;
  const context = getPageContext();
  const key = await hash(`${currentUser.uid}|${context.page}|${context.testId}|${context.exam}|${q.text}|${reason}`);
  const ref = doc(db, REPORTS, key);
  try {
    const existing = await getDoc(ref);
    if (existing.exists()) {
      showToast('You have already reported this issue. Thank you.');
      return;
    }
    await setDoc(ref, {
      reportId: key,
      uid: currentUser.uid,
      userEmail: currentUser.email || '',
      reason,
      status: 'new',
      page: context.page,
      exam: context.exam,
      subject: context.subject,
      testId: context.testId,
      questionNo: context.questionNo,
      question: q.text,
      options: q.options,
      url: location.href,
      reportedAt: serverTimestamp()
    });
    showToast('Question reported successfully. Thank you!');
  } catch (e) {
    console.error('Question report failed:', e);
    showToast('Could not send the report. Please try again.', false);
  }
}

async function loadQuestionImage() {
  const questionEl = $('question') || $('q');
  if (!questionEl) return;
  const context = getPageContext();
  if (!context.exam || !context.subject) return;
  const q = getCurrentQuestion();
  if (!q) return;
  const token = ++questionMediaToken;
  const old = $('questionMedia');
  if (old) old.remove();
  try {
    const snap = await getDocs(query(collection(db, 'questions'), where('exam', '==', context.exam), where('subject', '==', context.subject)));
    if (token !== questionMediaToken) return;
    const match = snap.docs.find(d => String(d.data().question || '').trim() === q.text.trim());
    const src = match?.data()?.questionImage || '';
    if (!src || token !== questionMediaToken) return;
    const wrap = document.createElement('div');
    wrap.id = 'questionMedia';
    wrap.className = 'question-media-wrap';
    const img = document.createElement('img');
    img.className = 'question-media-image';
    img.src = src;
    img.alt = 'Question diagram';
    img.loading = 'lazy';
    wrap.appendChild(img);
    questionEl.insertAdjacentElement('afterend', wrap);
  } catch (e) {
    console.warn('Question image could not be loaded:', e.message);
  }
}

function injectStyles() {
  if ($('questionReportStyles')) return;
  const s = document.createElement('style');
  s.id = 'questionReportStyles';
  s.textContent = `
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
    .question-media-wrap{margin:10px 0 18px;padding:10px;border-radius:12px;background:#0d1422;border:1px solid #303b4b;text-align:center}
    .question-media-image{display:block;max-width:100%;max-height:420px;width:auto;height:auto;margin:auto;object-fit:contain;border-radius:8px;background:#fff;padding:8px}
    .matching-question{margin-top:2px}
    .matching-intro{font-size:inherit;line-height:1.6;font-weight:800;margin-bottom:14px}
    .matching-grid{display:grid;gap:9px;margin:10px 0 14px}
    .matching-row{display:grid;grid-template-columns:minmax(0,1fr) 34px minmax(0,1fr);align-items:stretch;background:#171f2b;border:1px solid #303d50;border-radius:12px;overflow:hidden}
    .matching-cell{padding:11px 12px;line-height:1.5;font-size:14px}
    .matching-left{color:#f4f7fb;font-weight:750}
    .matching-right{color:#c9d5e8;background:#111822}
    .matching-label{display:inline-flex;min-width:25px;margin-right:7px;color:#8fb0ff;font-weight:900}
    .matching-arrow{display:flex;align-items:center;justify-content:center;color:#6f83a3;font-weight:900;background:#111822;border-left:1px solid #303d50;border-right:1px solid #303d50}
    .matching-telugu{margin:12px 0 0;padding:12px 13px;background:#101722;border:1px solid #2c394b;border-radius:12px;color:#dce5f2;line-height:1.7;font-size:14px}
    .matching-telugu b{display:block;color:#8faeff;font-size:11px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px}
    @media(max-width:520px){.question-report-btn{padding:8px 9px;font-size:12px}.question-report-menu{width:225px}.question-report-menu button{padding:11px 10px}.question-media-image{max-height:300px}.matching-row{grid-template-columns:minmax(0,1fr) 28px minmax(0,1fr)}.matching-cell{padding:10px 9px;font-size:13px}.matching-arrow{font-size:12px}.matching-telugu{font-size:13px}}
  `;
  document.head.appendChild(s);
}

function formatMatchingQuestion() {
  const question = $('question') || $('q');
  if (!question) return;
  const raw = (question.textContent || '').replace(/\s+/g, ' ').trim();
  if (!raw || /^loading/i.test(raw) || !/match\s+the\s+following|match\s+the\s+following/i.test(raw)) return;
  if (question.dataset.matchingSource === raw) return;

  const optionsMarker = /\s+(?:telugu\s+)?options\s*:/i;
  const optionsIndex = raw.search(optionsMarker);
  const body = optionsIndex >= 0 ? raw.slice(0, optionsIndex).trim() : raw;
  const marker = /(?:^|\s)([a-d])\)\s*/gi;
  const matches = [...body.matchAll(marker)].slice(0, 4);
  if (matches.length < 2) return;

  const intro = body.slice(0, matches[0].index).trim();
  const rows = matches.map((m, n) => {
    const end = n + 1 < matches.length ? matches[n + 1].index : body.length;
    let chunk = body.slice(m.index, end).trim();
    chunk = chunk.replace(/^[a-d]\)\s*/i, '');
    const teluguPos = chunk.search(/\s+Telugu\s*:/i);
    if (teluguPos >= 0) chunk = chunk.slice(0, teluguPos).trim();
    const arrow = chunk.match(/\s(?:→|->|–>|⟶)\s/);
    if (!arrow) return { label: m[1].toUpperCase(), left: chunk, right: '' };
    const pos = arrow.index;
    return { label: m[1].toUpperCase(), left: chunk.slice(0, pos).trim(), right: chunk.slice(pos + arrow[0].length).trim() };
  });

  let telugu = '';
  const teluguMatch = body.match(/\s+Telugu\s*:\s*(.*)$/i);
  if (teluguMatch) telugu = teluguMatch[1].trim();

  const wrap = document.createElement('div');
  wrap.className = 'matching-question';
  wrap.innerHTML = `<div class="matching-intro">${esc(intro)}</div><div class="matching-grid">${rows.map(r => `<div class="matching-row"><div class="matching-cell matching-left"><span class="matching-label">${esc(r.label)}.</span>${esc(r.left)}</div><div class="matching-arrow">↔</div><div class="matching-cell matching-right">${esc(r.right)}</div></div>`).join('')}</div>${telugu ? `<div class="matching-telugu"><b>తెలుగు</b>${esc(telugu)}</div>` : ''}`;
  question.innerHTML = '';
  question.appendChild(wrap);
  question.dataset.matchingSource = raw;
}

function init() {
  if ($('questionReportRoot')) return;
  const save = $('saveBtn');
  const question = $('question') || $('q');
  if (!question) return;
  injectStyles();
  formatMatchingQuestion();

  if (save) {
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
    save.parentNode.insertBefore(wrap, save.nextSibling);

    const btn = wrap.querySelector('.question-report-btn');
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      wrap.classList.toggle('open');
    });
    wrap.querySelectorAll('[data-reason]').forEach((b) => b.addEventListener('click', async (e) => {
      e.stopPropagation();
      wrap.classList.remove('open');
      await submitReport(b.dataset.reason);
    }));
    document.addEventListener('click', () => wrap.classList.remove('open'));
  }

  const observer = new MutationObserver(() => {
    clearTimeout(init.mediaTimer);
    init.mediaTimer = setTimeout(() => {
      formatMatchingQuestion();
      loadQuestionImage();
    }, 80);
  });
  observer.observe(question, { childList: true, characterData: true, subtree: true });
  loadQuestionImage();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
else init();
