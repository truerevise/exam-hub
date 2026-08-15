import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js";
import { getFirestore, collection, getDocs, query, where, orderBy, limit, Timestamp } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";
import { getAuth, setPersistence, browserLocalPersistence, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDQPGrwNBGS1EOdOg6t3uyuby0IDQwO9Uw",
  authDomain: "exam-hub-db0eb.firebaseapp.com",
  projectId: "exam-hub-db0eb",
  storageBucket: "exam-hub-db0eb.firebasestorage.app",
  messagingSenderId: "836139140800",
  appId: "1:836139140800:web:e6d6414a584acabbc18f25"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

export const authReady = setPersistence(auth, browserLocalPersistence).catch(() => {});

const isHome = () => location.pathname.endsWith('/') || location.pathname.endsWith('/index.html');

// Keep the public-home navigation in sync with the Firebase session.
const syncStudentNavigation = user => {
  if (!isHome()) return;
  const link = document.querySelector('.login-link');
  if (!link) return;
  if (user) {
    link.textContent = 'Dashboard';
    link.href = 'dashboard.html';
    link.setAttribute('aria-label', 'Student Dashboard');
  } else {
    link.textContent = 'Student Login';
    link.href = 'login.html';
    link.removeAttribute('aria-label');
  }
};

if (isHome()) {
  syncStudentNavigation(auth.currentUser);
  onAuthStateChanged(auth, syncStudentNavigation);
  const syncAfterDom = () => syncStudentNavigation(auth.currentUser);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', syncAfterDom, { once: true });
  else syncAfterDom();
  window.addEventListener('pageshow', syncAfterDom);

  // Fast path for the Daily Live Tests section. The old homepage query reads
  // up to 10 historical documents and filters them in the browser. This query
  // asks Firestore for only tests published during the last 24 hours and
  // returns at most 3 records, greatly reducing reads and response size.
  const liveList = document.getElementById('liveList');
  if (liveList) {
    const esc = s => String(s ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
    const renderLive = docs => {
      const now = Date.now();
      const live = docs.map(d => {
        const data = d.data ? d.data() : d;
        const start = data.publishedAt?.seconds ? data.publishedAt.seconds * 1000 : Number(data.publishedAt || 0);
        return { id: d.id || data.id, ...data, _start: start };
      }).filter(t => t._start && now >= t._start && now < t._start + 86400000);
      if (!live.length) {
        liveList.innerHTML = '<div class="empty-live">No live test is available right now. Check back soon.</div>';
        return;
      }
      liveList.innerHTML = live.map(t => `<article class="live-card"><span class="live-status">● LIVE NOW</span><h3>${esc(t.title || 'Daily Live Test')}</h3><p>${t.questionIds?.length || 0} questions • Available for 24 hours</p><button class="attempt" onclick="goLogin('live-test.html?id=${encodeURIComponent(t.id)}')">Attempt Exam →</button></article>`).join('');
    };
    const liveQuery = query(
      collection(db, 'dailyLiveTests'),
      where('publishedAt', '>=', Timestamp.fromMillis(Date.now() - 86400000)),
      orderBy('publishedAt', 'desc'),
      limit(3)
    );
    getDocs(liveQuery).then(snap => renderLive(snap.docs)).catch(() => {});
  }
}
