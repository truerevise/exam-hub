const EXAM_PAGE = /\/(?:test|live-test)\.html$/i.test(location.pathname);
if (EXAM_PAGE) {
  const nativeSetInterval = window.setInterval.bind(window);
  const nativeClearInterval = window.clearInterval.bind(window);
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const $ = (id) => document.getElementById(id);

  let initialTimerHandle = null;
  let activeTimerHandle = null;
  let timerCallback = null;
  let timerArgs = [];
  let timerPaused = false;
  let timerRestored = false;
  let uiReady = false;
  let progressRestored = false;
  let submitRequested = false;

  const progressKey = () => `trueReviseExamProgress:${location.pathname}:${location.search}`;

  function readState() {
    try {
      const raw = localStorage.getItem(progressKey());
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
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
    } catch (_) {
      return null;
    }
  }

  function clearState() {
    try { localStorage.removeItem(progressKey()); } catch (_) {}
  }

  function questionIndex() {
    const text = ($('questionNo')?.textContent || $('no')?.textContent || '').trim();
    const m = text.match(/Question\s+(\d+)/i);
    return m ? Math.max(0, Number(m[1]) - 1) : -1;
  }

  function timerElement() {
    return $('timer') || $('time');
  }

  function readTimerSeconds() {
    const el = timerElement();
    if (!el) return null;
    const m = String(el.textContent || '').match(/(\d+)\s*:\s*(\d+)/);
    if (!m) return null;
    return Number(m[1]) * 60 + Number(m[2]);
  }

  function optionElement(letter) {
    return $('option' + letter) || $(letter);
  }

  function paletteButtons() {
    return [...document.querySelectorAll('#palette button, #pal button')];
  }

  function saveCurrentProgress(extra = {}) {
    const state = readState() || {};
    const idx = questionIndex();
    const remaining = readTimerSeconds();
    writeState({
      ...extra,
      currentIndex: idx >= 0 ? idx : Number(state.currentIndex || 0),
      answers: Array.isArray(state.answers) ? state.answers : [],
      remainingSeconds: remaining == null ? state.remainingSeconds : remaining,
      paused: extra.paused ?? state.paused ?? false
    });
  }

  function injectStyles() {
    if ($('examPauseStyles')) return;
    const style = document.createElement('style');
    style.id = 'examPauseStyles';
    style.textContent = `
      .exam-pause-btn{border:1px solid #46546b;background:#202a39;color:#dbe5ff;border-radius:10px;padding:8px 11px;cursor:pointer;font-weight:900;font-size:12px;white-space:nowrap}
      .exam-pause-btn:hover,.exam-pause-btn:focus{border-color:#6f92ff;color:#fff;outline:none}
      .exam-pause-overlay{position:fixed;inset:0;z-index:9999;display:none;place-items:center;padding:20px;background:rgba(3,7,14,.88);backdrop-filter:blur(7px)}
      .exam-pause-overlay.show{display:grid}
      .exam-pause-card{width:min(430px,92vw);padding:28px 22px;text-align:center;background:#151d2a;border:1px solid #3a4a64;border-radius:18px;box-shadow:0 24px 70px #000b}
      .exam-pause-icon{font-size:42px;line-height:1;margin-bottom:12px}
      .exam-pause-card h2{margin:0 0 8px;color:#fff;font-size:24px}
      .exam-pause-card p{margin:0;color:#aeb9ca;font-size:13px;line-height:1.6}
      .exam-resume-btn{width:100%;margin-top:20px;min-height:48px;border:0;border-radius:11px;background:#2563eb;color:#fff;font-weight:900;font-size:14px;cursor:pointer}
      .exam-resume-btn:hover{background:#3475ff}
      @media(max-width:520px){.exam-pause-btn{padding:8px 9px;font-size:11px}.exam-pause-card{padding:24px 18px}}
    `;
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
    if (activeTimerHandle !== null) {
      nativeClearInterval(activeTimerHandle);
      activeTimerHandle = null;
    }
    saveCurrentProgress({ paused: true });
    setOverlay(true);
  }

  function resumeExam() {
    timerPaused = false;
    saveCurrentProgress({ paused: false });
    setOverlay(false);
    if (timerCallback && activeTimerHandle === null) {
      activeTimerHandle = nativeSetInterval(timerCallback, 1000, ...timerArgs);
    }
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
    pauseBtn.addEventListener('click', () => {
      if (timerPaused) resumeExam();
      else pauseExam();
    });

    if (menu && menu.parentElement) menu.parentElement.insertBefore(pauseBtn, menu);
    else header.appendChild(pauseBtn);

    const overlay = document.createElement('div');
    overlay.id = 'examPauseOverlay';
    overlay.className = 'exam-pause-overlay';
    overlay.innerHTML = `
      <div class="exam-pause-card" role="dialog" aria-modal="true" aria-labelledby="examPauseTitle">
        <div class="exam-pause-icon">⏸️</div>
        <h2 id="examPauseTitle">Exam Paused</h2>
        <p>Your answers and remaining time are saved on this device. You can return to this exam later and continue from where you stopped.</p>
        <button id="examResumeBtn" class="exam-resume-btn" type="button">▶ Resume Exam</button>
      </div>`;
    document.body.appendChild(overlay);
    $('examResumeBtn').addEventListener('click', resumeExam);

    uiReady = true;
    const state = readState();
    timerPaused = !!state?.paused;
    setOverlay(timerPaused);
  }

  async function restoreProgress() {
    if (progressRestored) return;
    const state = readState();
    if (!state || state.completed) return;

    const palette = paletteButtons();
    if (!palette.length || questionIndex() < 0) return;
    progressRestored = true;

    const answers = Array.isArray(state.answers) ? state.answers : [];
    const count = Math.min(answers.length, palette.length);

    for (let n = 0; n < count; n++) {
      const answer = String(answers[n] || '').trim().toUpperCase();
      if (!answer || !optionElement(answer)) continue;
      palette[n]?.click();
      await sleep(35);
      optionElement(answer)?.click();
      await sleep(35);
    }

    const target = Math.max(0, Math.min(Number(state.currentIndex || 0), palette.length - 1));
    palette[target]?.click();
    await sleep(60);

    timerPaused = !!state.paused;
    setOverlay(timerPaused);
    saveCurrentProgress({ paused: timerPaused });
  }

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const option = target.closest('#optionA,#optionB,#optionC,#optionD,#A,#B,#C,#D');
    if (option) {
      const id = option.id;
      const letter = id.replace('option', '').toUpperCase();
      if (/^[ABCD]$/.test(letter)) {
        const state = readState() || {};
        const answers = Array.isArray(state.answers) ? [...state.answers] : [];
        const idx = questionIndex();
        if (idx >= 0) answers[idx] = letter;
        writeState({ answers, currentIndex: idx >= 0 ? idx : state.currentIndex, paused: timerPaused, remainingSeconds: readTimerSeconds() ?? state.remainingSeconds });
      }
      return;
    }

    const paletteButton = target.closest('#palette button,#pal button');
    if (paletteButton) {
      setTimeout(() => saveCurrentProgress(), 0);
      return;
    }

    const nav = target.closest('#prevBtn,#nextBtn,#prev,#next');
    if (nav) setTimeout(() => saveCurrentProgress(), 0);

    const submit = target.closest('#submitBtn,#sideSubmit,#submit');
    if (submit) {
      submitRequested = true;
      setTimeout(() => { submitRequested = false; }, 1800);
    }
  }, true);

  window.setInterval = function(callback, delay, ...args) {
    if (!EXAM_PAGE || Number(delay) !== 1000 || timerCallback) {
      return nativeSetInterval(callback, delay, ...args);
    }

    timerCallback = function(...cbArgs) {
      if (timerPaused) return;

      if (!timerRestored) {
        timerRestored = true;
        const state = readState();
        const initial = readTimerSeconds();
        const saved = Number(state?.remainingSeconds);
        if (Number.isFinite(saved) && saved > 0 && Number.isFinite(initial) && initial > saved) {
          const skip = Math.min(initial - saved, 12000);
          for (let n = 0; n < skip; n++) callback(...cbArgs);
          saveCurrentProgress({ remainingSeconds: saved, paused: false });
          return;
        }
      }

      callback(...cbArgs);
      const remaining = readTimerSeconds();
      if (remaining != null) saveCurrentProgress({ remainingSeconds: remaining, paused: false });
      if (remaining === 0) {
        clearState();
      }
    };
    timerArgs = args;
    initialTimerHandle = nativeSetInterval(timerCallback, delay, ...args);
    activeTimerHandle = initialTimerHandle;

    const state = readState();
    if (state?.paused) {
      timerPaused = true;
      nativeClearInterval(activeTimerHandle);
      activeTimerHandle = null;
    }
    return initialTimerHandle;
  };

  window.clearInterval = function(handle) {
    if (EXAM_PAGE && initialTimerHandle !== null && handle === initialTimerHandle) {
      if (activeTimerHandle !== null) nativeClearInterval(activeTimerHandle);
      activeTimerHandle = null;
      nativeClearInterval(handle);
      return;
    }
    return nativeClearInterval(handle);
  };

  function boot() {
    injectUI();
    const state = readState();
    timerPaused = !!state?.paused;
    setOverlay(timerPaused);

    const observer = new MutationObserver(() => {
      injectUI();
      if (!progressRestored) restoreProgress().catch(() => {});
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    restoreProgress().catch(() => {});
    nativeSetInterval(() => {
      if (!progressRestored) restoreProgress().catch(() => {});
      if (!timerPaused) saveCurrentProgress();
    }, 1000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  window.addEventListener('pagehide', () => {
    if (submitRequested) {
      clearState();
    } else {
      saveCurrentProgress({ paused: timerPaused });
    }
  });
}
