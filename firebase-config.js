import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js";
import { getFirestore, collection, getDocs, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";
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

  // Daily live tests are published by daily-live-admin.html into the
  // `dailyTests` collection. Read the newest few records and use their
  // explicit startAt/endAt fields to determine which tests are live.
  const liveList = document.getElementById('liveList');
  if (liveList) {
    const esc = s => String(s ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));

    const toMillis = value => {
      if (!value) return 0;
      if (typeof value?.toMillis === 'function') return value.toMillis();
      if (typeof value?.seconds === 'number') return value.seconds * 1000 + Math.floor((value.nanoseconds || 0) / 1000000);
      if (value instanceof Date) return value.getTime();
      if (typeof value === 'number') return value;
      const parsed = Date.parse(value);
      return Number.isNaN(parsed) ? 0 : parsed;
    };

    const renderLive = docs => {
      const now = Date.now();
      const live = docs.map(d => {
        const data = d.data ? d.data() : d;
        const start = toMillis(data.startAt);
        const end = toMillis(data.endAt);
        return { id: d.id || data.id, ...data, _start: start, _end: end };
      }).filter(t => t._start && t._end && now >= t._start && now < t._end);

      if (!live.length) {
        liveList.innerHTML = '<div class="empty-live">Daily Live Tests are temporarily unavailable.</div>';
        return;
      }

      liveList.innerHTML = live.map(t => `<article class="live-card"><span class="live-status">● LIVE NOW</span><h3>${esc(t.title || 'Daily Live Test')}</h3><p>${t.questionIds?.length || 0} questions • Available until ${new Date(t._end).toLocaleString()}</p><button class="attempt" onclick="goLogin('daily-live-test.html?id=${encodeURIComponent(t.id)}')">Attempt Exam →</button></article>`).join('');
    };

    getDocs(query(collection(db, 'dailyTests'), orderBy('createdAt', 'desc'), limit(10)))
      .then(snap => renderLive(snap.docs))
      .catch(error => {
        console.error('Daily Live Tests failed to load:', error);
        liveList.innerHTML = '<div class="empty-live">Unable to load live tests. Please refresh once.</div>';
      });
  }
}
