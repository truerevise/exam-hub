// Shared exam UX guard: only expose submit controls on the final question.
// This is intentionally UI-only; submission authorization remains in the exam code/Firebase rules.
const examPage = /\/(?:test|live-test)\.html$/i.test(location.pathname);
if (examPage) {
  const getQuestionIndex = () => {
    const el = document.getElementById('questionNo') || document.getElementById('no');
    const text = el?.textContent || '';
    const match = text.match(/Question\s+(\d+)\s*\/\s*(\d+)/i);
    return match ? { current: Number(match[1]), total: Number(match[2]) } : null;
  };

  const sync = () => {
    const state = getQuestionIndex();
    if (!state || !Number.isFinite(state.current) || !Number.isFinite(state.total)) return;
    const isLast = state.total > 0 && state.current === state.total;
    ['submitBtn', 'sideSubmit', 'submit'].forEach((id) => {
      const button = document.getElementById(id);
      if (!button) return;
      button.style.display = isLast ? '' : 'none';
      button.setAttribute('aria-hidden', String(!isLast));
      button.tabIndex = isLast ? 0 : -1;
    });
  };

  const boot = () => {
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    setInterval(sync, 500);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
}
