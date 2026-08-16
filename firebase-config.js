import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js";
import { getFirestore, collection, getDocs, query, orderBy, limit, doc, getDoc } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";
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

window.goLogin = window.goLogin || (path => {
  const u = auth.currentUser;
  if (u) location.href = path;
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
    if (primary && safeInternalUrl(s.primaryUrl)) primary.onclick = () => window.goLogin(safeInternalUrl(s.primaryUrl));
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

/*
 * Shared mobile enhancement.
 * The homepage and dashboard use page-specific inline styles, so these rules
 * are injected from the shared module with !important where necessary.
 * This keeps both pages genuinely phone-first without changing their desktop design.
 */
const mobileStyle = document.createElement('style');
mobileStyle.id = 'true-revise-mobile';
mobileStyle.textContent = `
@media (max-width: 600px) {
  html { width:100%; overflow-x:hidden !important; }
  body { width:100%; max-width:100vw; overflow-x:hidden !important; }

  /* Homepage */
  body:has(.hero-grid) { padding-bottom:78px !important; }
  body:has(.hero-grid) .wrap { width:calc(100% - 24px) !important; max-width:100% !important; }
  body:has(.hero-grid) header { position:sticky !important; top:0 !important; }
  body:has(.hero-grid) .nav { height:58px !important; min-height:58px !important; }
  body:has(.hero-grid) .brand { min-width:0 !important; font-size:17px !important; white-space:nowrap !important; }
  body:has(.hero-grid) .brand .logo { width:34px !important; height:34px !important; flex:0 0 34px !important; }
  body:has(.hero-grid) .links { gap:5px !important; }
  body:has(.hero-grid) .links a:not(.login-link) { display:none !important; }
  body:has(.hero-grid) .login-link { display:inline-flex !important; padding:8px 10px !important; font-size:10px !important; white-space:nowrap !important; }
  body:has(.hero-grid) .hero { padding:25px 0 14px !important; }
  body:has(.hero-grid) .hero-grid { display:flex !important; flex-direction:column !important; gap:18px !important; align-items:stretch !important; }
  body:has(.hero-grid) .hero-grid > div { width:100% !important; min-width:0 !important; }
  body:has(.hero-grid) .badge { max-width:100% !important; font-size:9px !important; padding:7px 9px !important; white-space:normal !important; line-height:1.3 !important; }
  body:has(.hero-grid) h1 { font-size:clamp(36px,11vw,46px) !important; line-height:1 !important; letter-spacing:-2.2px !important; margin:14px 0 !important; overflow-wrap:anywhere !important; }
  body:has(.hero-grid) .lead { font-size:13.5px !important; line-height:1.6 !important; margin-bottom:16px !important; }
  body:has(.hero-grid) .actions { display:grid !important; grid-template-columns:1fr !important; gap:8px !important; width:100% !important; }
  body:has(.hero-grid) .actions .btn { width:100% !important; min-height:48px !important; }
  body:has(.hero-grid) .hero-card { padding:15px !important; border-radius:18px !important; }
  body:has(.hero-grid) .hero-card-top { align-items:flex-start !important; }
  body:has(.hero-grid) .mini-label { font-size:9px !important; line-height:1.3 !important; }
  body:has(.hero-grid) .score { font-size:34px !important; margin:12px 0 2px !important; }
  body:has(.hero-grid) .score small { display:block !important; font-size:10px !important; line-height:1.4 !important; margin-top:2px !important; }
  body:has(.hero-grid) .stats { grid-template-columns:1fr 1fr !important; gap:7px !important; }
  body:has(.hero-grid) .stat { padding:9px !important; min-width:0 !important; }
  body:has(.hero-grid) .stat strong { font-size:13px !important; }
  body:has(.hero-grid) .stat small { font-size:9px !important; }
  body:has(.hero-grid) .section { padding:25px 0 !important; }
  body:has(.hero-grid) .section-head { display:flex !important; flex-direction:column !important; align-items:flex-start !important; gap:5px !important; margin-bottom:12px !important; }
  body:has(.hero-grid) .section-head h2 { font-size:20px !important; }
  body:has(.hero-grid) .section-head p { font-size:11px !important; line-height:1.45 !important; }
  body:has(.hero-grid) .view { font-size:10px !important; }
  body:has(.hero-grid) .live-wrap { border-radius:18px !important; }
  body:has(.hero-grid) .live-panel { padding:13px !important; border-radius:17px !important; }
  body:has(.hero-grid) .live-top { flex-direction:column !important; align-items:flex-start !important; gap:6px !important; }
  body:has(.hero-grid) .live-list { grid-template-columns:1fr !important; gap:9px !important; }
  body:has(.hero-grid) .live-card { padding:14px !important; border-radius:14px !important; }
  body:has(.hero-grid) .live-card h3 { font-size:15px !important; }
  body:has(.hero-grid) .live-card p { font-size:10.5px !important; }
  body:has(.hero-grid) .attempt { min-height:44px !important; }
  body:has(.hero-grid) .exams { grid-template-columns:1fr 1fr !important; gap:9px !important; }
  body:has(.hero-grid) .exam-card { padding:14px 11px !important; border-radius:15px !important; min-width:0 !important; }
  body:has(.hero-grid) .exam-card h3 { font-size:15px !important; }
  body:has(.hero-grid) .exam-card p { font-size:10.5px !important; line-height:1.45 !important; }
  body:has(.hero-grid) .exam-action { min-height:41px !important; font-size:11px !important; }
  body:has(.hero-grid) .pass { grid-template-columns:1fr !important; gap:14px !important; padding:16px !important; border-radius:18px !important; }
  body:has(.hero-grid) .pass h2 { font-size:19px !important; line-height:1.2 !important; }
  body:has(.hero-grid) .pass p { font-size:11px !important; line-height:1.55 !important; }
  body:has(.hero-grid) .benefits { grid-template-columns:1fr !important; gap:6px !important; }
  body:has(.hero-grid) .benefit { font-size:10.5px !important; }
  body:has(.hero-grid) .pass-box { padding:14px !important; }
  body:has(.hero-grid) .pass-box strong { font-size:21px !important; }
  body:has(.hero-grid) .features { grid-template-columns:1fr !important; gap:8px !important; }
  body:has(.hero-grid) .feature { padding:14px !important; }
  body:has(.hero-grid) .cta { flex-direction:column !important; align-items:stretch !important; padding:18px !important; gap:12px !important; margin-bottom:18px !important; }
  body:has(.hero-grid) .cta h2 { font-size:18px !important; }
  body:has(.hero-grid) .cta p { font-size:11px !important; }
  body:has(.hero-grid) .cta .btn { width:100% !important; }
  body:has(.hero-grid) footer { padding:18px 0 90px !important; }
  body:has(.hero-grid) .foot { flex-direction:column !important; gap:5px !important; font-size:10px !important; }
  body:has(.hero-grid) .mobile-nav { left:7px !important; right:7px !important; bottom:7px !important; height:60px !important; border-radius:16px !important; }

  /* Student dashboard */
  body:has(.drawer-nav) { padding-bottom:18px !important; }
  body:has(.drawer-nav) header { padding:9px 10px !important; }
  body:has(.drawer-nav) .header-inner { width:100% !important; gap:6px !important; }
  body:has(.drawer-nav) .brand { min-width:0 !important; gap:7px !important; }
  body:has(.drawer-nav) .brand .icon-btn { width:38px !important; height:38px !important; }
  body:has(.drawer-nav) .logo { font-size:17px !important; white-space:nowrap !important; }
  body:has(.drawer-nav) .header-actions { gap:0 !important; }
  body:has(.drawer-nav) .header-actions .nav-link { width:38px !important; height:38px !important; }
  body:has(.drawer-nav) .container { width:100% !important; max-width:none !important; padding:14px 10px 35px !important; }
  body:has(.drawer-nav) .hero { padding:18px 15px !important; margin-bottom:14px !important; border-radius:18px !important; }
  body:has(.drawer-nav) .hero h1 { font-size:23px !important; line-height:1.15 !important; margin-bottom:6px !important; }
  body:has(.drawer-nav) .hero p { font-size:12px !important; line-height:1.5 !important; }
  body:has(.drawer-nav) .hero:after { right:6px !important; bottom:-10px !important; font-size:58px !important; }
  body:has(.drawer-nav) .search-box { margin:0 0 20px !important; padding:10px 12px !important; border-radius:12px !important; }
  body:has(.drawer-nav) .search-box input { font-size:14px !important; padding:3px 0 !important; }
  body:has(.drawer-nav) .section-title { font-size:18px !important; margin:20px 0 10px !important; }
  body:has(.drawer-nav) .live-grid { grid-template-columns:1fr !important; gap:9px !important; }
  body:has(.drawer-nav) .live-card { padding:14px !important; border-radius:14px !important; margin-bottom:0 !important; }
  body:has(.drawer-nav) .live-card h3 { font-size:15px !important; }
  body:has(.drawer-nav) .live-card p { font-size:11px !important; margin-bottom:10px !important; }
  body:has(.drawer-nav) .exam-grid { grid-template-columns:1fr 1fr !important; gap:8px !important; }
  body:has(.drawer-nav) .exam-grid .card { padding:14px 8px !important; border-radius:14px !important; margin:0 !important; }
  body:has(.drawer-nav) .exam-icon { font-size:25px !important; margin-bottom:7px !important; }
  body:has(.drawer-nav) .exam-grid .card h3 { font-size:13px !important; min-height:32px !important; margin-bottom:9px !important; }
  body:has(.drawer-nav) .exam-grid .card button { padding:9px 6px !important; font-size:11px !important; }
  body:has(.drawer-nav) .info-row { padding:14px !important; gap:10px !important; }
  body:has(.drawer-nav) .info-row h3 { font-size:15px !important; }
  body:has(.drawer-nav) .info-row p { font-size:11px !important; line-height:1.45 !important; margin-bottom:9px !important; }
  body:has(.drawer-nav) .info-row > .material-icons { font-size:30px !important; }
  body:has(.drawer-nav) .info-row button { font-size:11px !important; padding:10px !important; }
  body:has(.drawer-nav) .drawer { width:min(290px,84vw) !important; }
}

@media (max-width:380px) {
  body:has(.hero-grid) .wrap { width:calc(100% - 18px) !important; }
  body:has(.hero-grid) h1 { font-size:34px !important; }
  body:has(.hero-grid) .exams { grid-template-columns:1fr !important; }
  body:has(.drawer-nav) .exam-grid { grid-template-columns:1fr !important; }
}
`;
if (!document.getElementById('true-revise-mobile')) document.head.appendChild(mobileStyle);

if (isHome()) {
  syncStudentNavigation(auth.currentUser);
  onAuthStateChanged(auth, syncStudentNavigation);
  const syncAfterDom = () => { syncStudentNavigation(auth.currentUser); applyHomepageSettings(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', syncAfterDom, { once: true });
  else syncAfterDom();
  window.addEventListener('pageshow', syncAfterDom);

  const liveList = document.getElementById('liveList');
  if (liveList) {
    const esc = s => String(s ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
    const toMillis = raw => {
      if (!raw) return 0;
      if (typeof raw.toMillis === 'function') return raw.toMillis();
      if (typeof raw.seconds === 'number') return raw.seconds * 1000 + Math.floor((raw.nanoseconds || 0) / 1000000);
      if (typeof raw === 'number') return raw;
      const parsed = Date.parse(raw);
      return Number.isNaN(parsed) ? 0 : parsed;
    };
    const renderLive = docs => {
      const now = Date.now();
      const live = docs.map(d => {
        const data = d.data ? d.data() : d;
        const start = toMillis(data.publishedAt);
        return { id: d.id || data.id, ...data, _start: start, _end: start + 86400000 };
      }).filter(t => t._start && now >= t._start && now < t._end);
      if (!live.length) {
        liveList.innerHTML = '<div class="empty-live">No live test is available right now. Check back soon.</div>';
        return;
      }
      liveList.innerHTML = live.map(t => `<article class="live-card"><span class="live-status">● LIVE NOW</span><h3>${esc(t.title || 'Daily Live Test')}</h3><p>${t.questionIds?.length || 0} questions • Available for 24 hours</p><button class="attempt" onclick="location.href='live-test.html?id=${encodeURIComponent(t.id)}'">Attempt Exam →</button></article>`).join('');
    };
    getDocs(query(collection(db, 'dailyLiveTests'), orderBy('publishedAt', 'desc'), limit(10)))
      .then(snap => renderLive(snap.docs))
      .catch(error => {
        console.error('Daily Live Tests failed to load:', error);
        liveList.innerHTML = '<div class="empty-live">Unable to load live tests. Please refresh once.</div>';
      });
  }
}
