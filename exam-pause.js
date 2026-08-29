const EXAM_PAGE = /\/(?:test|live-test)\.html$/i.test(location.pathname);
if (EXAM_PAGE) {
  const nativeSetInterval = window.setInterval.bind(window);
  const nativeClearInterval = window.clearInterval.bind(window);
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const $ = (id) => document.getElementById(id);
  const progressKey = () => `trueReviseExamProgress:${location.pathname}:${location.search}`;

  let timerCallback = null;
  let timerArgs = [];
  let timerHandle = null;
  let timerPaused = false;
  let timerRestored = false;
  let uiReady = false;
  let progressRestored = false;
  let restoring = false;
  let submitRequested = false;

  function readState() {
    try { const raw = localStorage.getItem(progressKey()); return raw ? JSON.parse(raw) : null; }
    catch (_) { return null; }
  }

  function writeState(patch = {}) {
    try {
      const old = readState() || {};
      const state = {
        ...old,
        ...patch,
        answers: Array.isArray(patch.answers) ? patch.answers : (Array.isArray(old.answers) ? old.answers : []),
        currentIndex: Number.isFinite(patch.currentIndex) ? patch.currentIndex : Number(old.currentIndex || 0),
        remainingSeconds: Number.isFinite(patch.remainingSeconds) ? patch.remainingSeconds : old.remainingSeconds,
        updatedAt: Date.now()
      };
      localStorage.setItem(progressKey(), JSON.stringify(state));
      return state;
    } catch (_) { return null; }
  }

  function clearState() { try { localStorage.removeItem(progressKey()); } catch (_) {} }

  function questionIndex() {
    const text = ($('questionNo')?.textContent || $('no')?.textContent || '').trim();
    const m = text.match(/Question\s+(\d+)/i);
    return m ? Math.max(0, Number(m[1]) - 1) : -1;
  }

  function timerElement() { return $('timer') || $('time'); }

  function readTimerSeconds() {
    const el = timerElement();
    if (!el) return null;
    const m = String(el.textContent || '').match(/(\d+)\s*:\s*(\d+)/);
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
  }

  function setTimerDisplay(seconds) {
    const el = timerElement();
    if (!el || !Number.isFinite(seconds)) return;
    const safe = Math.max(0, Math.floor(seconds));
    el.textContent = `${String(Math.floor(safe / 60)).padStart(2,'0')}:${String(safe % 60).padStart(2,'0')}`;
  }

  function optionElement(letter) { return $('option' + letter) || $(letter); }
  function paletteButtons() { return [...document.querySelectorAll('#palette button, #pal button')]; }

  function saveCurrentProgress(extra = {}) {
    const old = readState() || {};
    const idx = questionIndex();
    const remaining = readTimerSeconds();
    writeState({
      ...extra,
      currentIndex: idx >= 0 ? idx : Number(old.currentIndex || 0),
      answers: Array.isArray(old.answers) ? old.answers : [],
      remainingSeconds: remaining == null ? old.remainingSeconds : remaining,
      paused: extra.paused ?? old.paused ?? false
    });
  }

  function injectStyles() {
    if ($('examPauseStyles')) return;
    const style = document.createElement('style');
    style.id = 'examPauseStyles';
    style.textContent = `.exam-pause-btn{border:1px solid #46546b;background:#202a39;color:#dbe5ff;border-radius:10px;padding:8px 11px;cursor:pointer;font-weight:900;font-size:12px;white-space:nowrap}.exam-pause-btn:hover,.exam-pause-btn:focus{border-color:#6f92ff;color:#fff;outline:none}.exam-pause-overlay{position:fixed;inset:0;z-index:9999;display:none;place-items:center;padding:20px;background:rgba(3,7,14,.88);backdrop-filter:blur(7px)}.exam-pause-overlay.show{display:grid}.exam-pause-card{width:min(430px,92vw);padding:28px 22px;text-align:center;background:#151d2a;border:1px solid #3a4a64;border-radius:18px;box-shadow:0 24px 70px #000b}.exam-pause-icon{font-size:42px;line-height:1;margin-bottom:12px}.exam-pause-card h2{margin:0 0 8px;color:#fff;font-size:24px}.exam-pause-card p{margin:0;color:#aeb9ca;font-size:13px;line-height:1.6}.exam-resume-btn{width:100%;margin-top:20px;min-height:48px;border:0;border-radius:11px;background:#2563eb;color:#fff;font-weight:900;font-size:14px;cursor:pointer}@media(max-width:520px){.exam-pause-btn{padding:8px 9px;font-size:11px}.exam-pause-card{padding:24px 18px}}`;
    document.head.appendChild(style);
  }

  function setOverlay(show) {
    const overlay = $('examPauseOverlay');
    if (overlay) overlay.classList.toggle('show', show);
    const btn = $('examPauseBtn');
    if (btn) {
      btn.textContent = show ? '▶ Resume' : '⏸ Pause';
      btn.setAttribute('aria-label', show ? 'Resume exam' : 'Pause exam');
    }
  }

  function pauseExam() {
    timerPaused = true;
    if (timerHandle !== null) {
      nativeClearInterval(timerHandle);
      timerHandle = null;
    }
    saveCurrentProgress({ paused: true });
    setOverlay(true);
  }

  function resumeExam() {
    timerPaused = false;
    saveCurrentProgress({ paused: false });
    setOverlay(false);
    if (timerCallback && timerHandle === null) timerHandle = nativeSetInterval(timerCallback, 1000, ...timerArgs);
  }

  function injectUI() {
    if (uiReady || !document.body) return;
    const header = document.querySelector('.header');
    const headLeft = document.querySelector('.head-left');
    const menu = $('menuBtn') || $('menu');
    if (!header || !headLeft) return;

    injectStyles();
    const pauseBtn = document.createElement('button');
    pauseBtn.id = 'examPauseBtn';
    pauseBtn.type = 'button';
    pauseBtn.className = 'exam-pause-btn';
    pauseBtn.textContent = '⏸ Pause';
    pauseBtn.title = 'Pause exam and save progress';
    pauseBtn.addEventListener('click', () => timerPaused ? resumeExam() : pauseExam());
    if (menu?.parentElement) menu.parentElement.insertBefore(pauseBtn, menu);
    else header.appendChild(pauseBtn);

    const overlay = document.createElement('div');
    overlay.id = 'examPauseOverlay';
    overlay.className = 'exam-pause-overlay';
    overlay.innerHTML = '<div class="exam-pause-card" role="dialog" aria-modal="true"><div class="exam-pause-icon">⏸️</div><h2>Exam Paused</h2><p>Your answers and remaining time are saved on this device. You can return to this exam later and continue from where you stopped.</p><button id="examResumeBtn" class="exam-resume-btn" type="button">▶ Resume Exam</button></div>';
    document.body.appendChild(overlay);
    $('examResumeBtn').addEventListener('click', resumeExam);
    uiReady = true;

    const state = readState();
    timerPaused = !!state?.paused;
    if (Number.isFinite(Number(state?.remainingSeconds))) setTimerDisplay(Number(state.remainingSeconds));
    setOverlay(timerPaused);
  }

  async function waitForQuestion(index, timeout = 4000) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      if (questionIndex() === index) return true;
      await sleep(40);
    }
    return questionIndex() === index;
  }

  async function restoreProgress() {
    if (progressRestored || restoring) return;
    const state = readState();
    if (!state || state.completed) return;
    const palette = paletteButtons();
    if (!palette.length || questionIndex() < 0) return;

    progressRestored = true;
    restoring = true;
    const answers = Array.isArray(state.answers) ? state.answers : [];
    try {
      for (let n = 0; n < Math.min(answers.length, palette.length); n++) {
        const answer = String(answers[n] || '').trim().toUpperCase();
        if (!/^[ABCD]$/.test(answer)) continue;
        palette[n]?.click();
        await waitForQuestion(n);
        await sleep(60);
        optionElement(answer)?.click();
        await sleep(60);
      }

      const target = Math.max(0, Math.min(Number(state.currentIndex || 0), palette.length - 1));
      palette[target]?.click();
      await waitForQuestion(target);
      await sleep(80);
      timerPaused = !!state.paused;
      if (Number.isFinite(Number(state.remainingSeconds))) setTimerDisplay(Number(state.remainingSeconds));
      setOverlay(timerPaused);
      saveCurrentProgress({ paused: timerPaused });
    } finally {
      restoring = false;
    }
  }

  // Bubble phase is intentional: the exam's option onclick runs first, then
  // we capture the newly selected answer into localStorage.
  document.addEventListener('click', (event) => {
    if (restoring) return;
    const target = event.target;
    if (!(target instanceof Element)) return;

    const option = target.closest('#optionA,#optionB,#optionC,#optionD,#A,#B,#C,#D');
    if (option) {
      setTimeout(() => {
        const letter = option.id.replace('option', '').toUpperCase();
        const idx = questionIndex();
        if (!/^[ABCD]$/.test(letter) || idx < 0) return;
        const state = readState() || {};
        const answers = Array.isArray(state.answers) ? [...state.answers] : [];
        answers[idx] = letter;
        writeState({
          answers,
          currentIndex: idx,
          remainingSeconds: readTimerSeconds() ?? state.remainingSeconds,
          paused: timerPaused
        });
      }, 0);
      return;
    }

    if (target.closest('#palette button,#pal button') || target.closest('#prevBtn,#nextBtn,#prev,#next')) {
      setTimeout(() => saveCurrentProgress(), 0);
    }

    if (target.closest('#submitBtn,#sideSubmit,#submit')) {
      submitRequested = true;
      setTimeout(() => { submitRequested = false; }, 1800);
    }
  });

  // test.html starts its one-second timer after firebase-config.js finishes.
  // firebase-config awaits this module, so this wrapper is installed before
  // the exam timer exists.
  window.setInterval = function(callback, delay, ...args) {
    if (Number(delay) !== 1000 || timerCallback) return nativeSetInterval(callback, delay, ...args);

    timerArgs = args;
    timerCallback = function(...cbArgs) {
      if (timerPaused) return;

      if (!timerRestored) {
        timerRestored = true;
        const state = readState();
        const initial = readTimerSeconds();
        const saved = Number(state?.remainingSeconds);
        if (Number.isFinite(saved) && saved >= 0 && Number.isFinite(initial) && initial > saved) {
          restoring = true;
          const skip = Math.min(initial - saved, 12000);
          for (let n = 0; n < skip; n++) callback(...cbArgs);
          restoring = false;
          setTimerDisplay(saved);
          saveCurrentProgress({ remainingSeconds: saved, paused: false });
          if (saved <= 0) clearState();
          return;
        }
      }

      callback(...cbArgs);
      const remaining = readTimerSeconds();
      if (remaining != null) saveCurrentProgress({ remainingSeconds: remaining, paused: false });
      if (remaining === 0) clearState();
    };

    const state = readState();
    if (state?.paused) timerPaused = true;
    timerHandle = nativeSetInterval(timerCallback, 1000, ...args);
    if (state?.paused && Number.isFinite(Number(state.remainingSeconds))) setTimerDisplay(Number(state.remainingSeconds));
    return timerHandle;
  };

  window.clearInterval = function(handle) {
    if (handle === timerHandle) {
      nativeClearInterval(handle);
      timerHandle = null;
      return;
    }
    return nativeClearInterval(handle);
  };

  function boot() {
    injectUI();
    const state = readState();
    if (state?.paused) timerPaused = true;
    if (Number.isFinite(Number(state?.remainingSeconds))) setTimerDisplay(Number(state.remainingSeconds));
    setOverlay(timerPaused);

    const observer = new MutationObserver(() => {
      injectUI();
      if (!progressRestored) restoreProgress().catch(() => {});
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    restoreProgress().catch(() => {});
    nativeSetInterval(() => {
      if (!progressRestored) restoreProgress().catch(() => {});
      if (!timerPaused && !restoring) saveCurrentProgress();
    }, 1000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  window.addEventListener('pagehide', () => {
    if (submitRequested) clearState();
    else saveCurrentProgress({ paused: timerPaused });
  });
}