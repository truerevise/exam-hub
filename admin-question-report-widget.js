import { auth, db } from './firebase-config.js';
import { collection, getDocs } from 'https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js';

const id = 'questionReportAdminWidget';
function addWidget(count) {
  let box = document.getElementById(id);
  if (!box) {
    box = document.createElement('a');
    box.id = id;
    box.href = 'admin-question-reports.html';
    box.setAttribute('aria-label','Question reports');
    box.innerHTML = '<span class="qr-icon">🚩</span><span class="qr-text"><b>Question Reports</b><small>Student-reported questions</small></span><span class="qr-count">0</span>';
    const style = document.createElement('style');
    style.textContent = `#questionReportAdminWidget{position:fixed;right:18px;bottom:18px;z-index:90;display:flex;align-items:center;gap:10px;padding:12px 14px;background:#171f2c;border:1px solid #46546b;border-radius:14px;color:#fff;text-decoration:none;box-shadow:0 18px 45px #0009;font-size:13px}#questionReportAdminWidget:hover{border-color:#f59e0b;transform:translateY(-1px)}#questionReportAdminWidget .qr-icon{font-size:20px}#questionReportAdminWidget .qr-text{display:flex;flex-direction:column;gap:2px}#questionReportAdminWidget small{color:#9aa5b5;font-size:10px}.qr-count{min-width:24px;height:24px;border-radius:999px;display:grid;place-items:center;background:#3a2c0b;color:#ffd86b;font-weight:900;padding:0 7px}@media(max-width:520px){#questionReportAdminWidget{right:10px;bottom:10px;padding:10px 11px}.qr-text small{display:none}}`;
    document.head.appendChild(style);
    document.body.appendChild(box);
  }
  box.querySelector('.qr-count').textContent = String(count);
  box.style.display = 'flex';
}

onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  try {
    const snap = await getDocs(collection(db,'questionReports'));
    const count = snap.docs.filter(d => (d.data().status || 'new') === 'new').length;
    addWidget(count);
  } catch (e) {
    console.warn('Question report admin widget unavailable:', e.message);
  }
});
