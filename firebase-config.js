import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";
import { getAuth, setPersistence, browserLocalPersistence, onAuthStateChanged, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";

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

// Daily Live Tests are intentionally available before login. Wait for Firebase
// Auth persistence first, then create a temporary anonymous identity before
// live-test.html registers its auth listener. This prevents the initial null
// auth state from redirecting guests to the login page.
const isDailyLivePage = () => location.pathname.endsWith('/live-test.html');
if (isDailyLivePage()) {
  await authReady;
  if (!auth.currentUser) {
    try {
      await signInAnonymously(auth);
    } catch (e) {
      console.warn('Anonymous Daily Live Test sign-in unavailable:', e.message);
    }
  }
}

// Keep client-side super-admin access aligned with the Firestore rules.
// This is a UI guard only; Firestore rules remain the source of truth.
const SUPER_ADMINS = new Set([
  'support@truerevise.com',
  'commercewithkiransingh@gmail.com',
  'kiransingh.smile@gmail.com'
]);
export const isSuperAdmin = user => !!(
  user?.email && SUPER_ADMINS.has(String(user.email).trim().toLowerCase())
);
window.isSuperAdmin = window.isSuperAdmin || isSuperAdmin;

window.goLogin = window.goLogin || (path => {
  const u = auth.currentUser;
  if (u && !u.isAnonymous) location.href = path;
  else location.href = 'login.html?next=' + encodeURIComponent(path);
});

const isHome = () => location.pathname.endsWith('/') || location.pathname.endsWith('/index.html');
const safeInternalUrl = value => {
  const v = String(value || '').trim();
  return v && !/^(javascript:|data:|https?:\/\/)/i.test(v) ? v : '';
};

const syncStudentNavigation = user => {
  if (!isHome()) return;
  const link = document.querySelector('.login-link');
  if (!link) return;
  if (user && !user.isAnonymous) {
    link.textContent = 'Dashboard';
    link.href = 'dashboard.html';
    link.setAttribute('aria-label', 'Student Dashboard');
  } else {
    link.textContent = 'Student Login';
    link.href = 'login.html';
    link.removeAttribute('aria-label');
  }
};

async function applyHomepageSettings() {
  if (!isHome()) return;
  try {
    const snap = await getDoc(doc(db, 'appSettings', 'homepage'));
    if (!snap.exists()) return;
    const s = snap.data();
    const badge = document.querySelector('.badge');
    const headline = document.querySelector('.hero h1');
    const highlight = document.querySelector('.hero h1 span');
    const lead = document.querySelector('.hero .lead');
    const primary = document.querySelector('.actions .primary');
    const secondary = document.querySelector('.actions .secondary');
    const passTitle = document.querySelector('.pass h2');
    const passDescription = document.querySelector('.pass > div:first-child p');
    const passBoxTitle = document.querySelector('.pass-box strong');
    const passBoxText = document.querySelector('.pass-box small');
    const passButton = document.querySelector('.pass-btn');
    if (badge && s.badge) badge.textContent = s.badge;
    if (headline && s.headline) {
      const prefix = String(s.headline);
      headline.firstChild.textContent = prefix + (prefix.endsWith(' ') ? '' : ' ');
    }
    if (highlight && s.highlight) highlight.textContent = s.highlight;
    if (lead && s.description) lead.textContent = s.description;
    if (primary && s.primaryText) primary.textContent = s.primaryText;
    if (primary && safeInternalUrl(s.primaryUrl)) primary.onclick = () => window.goLogin(s.safeInternalUrl || safeInternalUrl(s.primaryUrl));
    if (secondary && s.secondaryText) secondary.textContent = s.secondaryText;
    if (secondary && safeInternalUrl(s.secondaryUrl)) secondary.href = safeInternalUrl(s.secondaryUrl);
    if (passTitle && s.passTitle) passTitle.textContent = s.passTitle;
    if (passDescription && s.passDescription) passDescription.textContent = s.passDescription;
    if (passBoxTitle && s.passPrice) passBoxTitle.textContent = s.passPrice;
    if (passBoxText && s.passTitle) passBoxText.textContent = s.passTitle;
    if (passButton && s.passButton) passButton.textContent = s.passButton + ' →';
    if (passButton && safeInternalUrl(s.primaryUrl)) passButton.onclick = () => location.href = 'pass-access.html';

    let announcement = document.getElementById('siteAnnouncement');
    if (s.announcementEnabled && s.announcement) {
      if (!announcement) {
        announcement = document.createElement('div');
        announcement.id = 'siteAnnouncement';
        announcement.style.cssText = 'margin:14px auto 0;width:min(1120px,calc(100% - 32px));padding:12px 15px;border:1px solid rgba(96,165,250,.25);border-radius:13px;background:rgba(59,130,246,.08);color:#bfdbfe;font-size:12px;font-weight:700';
        document.querySelector('main')?.prepend(announcement);
      }
      announcement.textContent = s.announcement;
    } else if (announcement) announcement.remove();

    if (s.promo) {
      let promo = document.getElementById('sitePromo');
      if (!promo) {
        promo = document.createElement('div');
        promo.id = 'sitePromo';
        promo.style.cssText = 'margin:0 auto 18px;width:min(1120px,calc(100% - 32px));padding:12px 15px;border:1px solid rgba(251,191,36,.2);border-radius:13px;background:rgba(251,191,36,.06);color:#fde68a;font-size:12px;font-weight:700';
        const pass = document.getElementById('pass');
        pass?.parentElement?.insertBefore(promo, pass);
      }
      promo.textContent = s.promo;
    }
  } catch (e) {
    console.warn('Homepage settings unavailable:', e.message);
  }
}

const mobileStyle = document.createElement('style');
mobileStyle.id = 'true-revise-mobile';
mobileStyle.textContent = `
@media (max-width: 600px) {
  html { width:100%; overflow-x:hidden !important; }
  body { width:100%; max-width:100vw; overflow-x:hidden !important; }
}`;
document.head.appendChild(mobileStyle);

onAuthStateChanged(auth, user => {
  syncStudentNavigation(user);
});

applyHomepageSettings();

if (location.pathname.endsWith('/test.html') || location.pathname.endsWith('/live-test.html')) {
  await import('./exam-pause.js?v=2').catch(e => console.warn('Exam pause handler unavailable:', e));
}

if (location.pathname.endsWith('/test.html')) {
  import('./bilingual-test.js?v=1').catch(e => console.warn('Bilingual test handler unavailable:', e));
}