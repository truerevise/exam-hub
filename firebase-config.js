import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";
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

// Keep the authenticated student session available when moving between
// login.html and verify-account.html on mobile browsers.
export const authReady = setPersistence(auth, browserLocalPersistence).catch(() => {});

// Keep the public-home navigation in sync with the Firebase session.
// This is intentionally resilient to module timing and browser Back/cache
// behaviour: it checks immediately, on auth changes, and after DOM loading.
const syncStudentNavigation = user => {
  if (!(location.pathname.endsWith('/') || location.pathname.endsWith('/index.html'))) return;
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

if (location.pathname.endsWith('/') || location.pathname.endsWith('/index.html')) {
  // Handle an already-restored Firebase session.
  syncStudentNavigation(auth.currentUser);

  // Handle Firebase restoring the session asynchronously.
  onAuthStateChanged(auth, syncStudentNavigation);

  // Handle module/DOM timing and browser Back navigation.
  const syncAfterDom = () => syncStudentNavigation(auth.currentUser);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', syncAfterDom, { once: true });
  } else {
    syncAfterDom();
  }
  window.addEventListener('pageshow', syncAfterDom);
}
