// Shared by every page: the language switcher. The choice is remembered so the Portuguese
// home page stops redirecting by browser language (see LANG_REDIRECT in scripts/build.mjs).
// Phones fold the site menu behind one button so the planner gets the screen.
const navBtn = document.getElementById('navToggle');
if (navBtn) {
  const head = navBtn.closest('.site');
  head.classList.add('has-toggle');
  const setOpen = open => { head.classList.toggle('nav-open', open); navBtn.setAttribute('aria-expanded', String(open)); };
  navBtn.addEventListener('click', () => setOpen(!head.classList.contains('nav-open')));
  document.getElementById('siteNav').addEventListener('click', e => { if (e.target.closest('a,button')) setOpen(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && head.classList.contains('nav-open')) { setOpen(false); navBtn.focus(); } });
}

const sel = document.getElementById('langSel');
if (sel) {
  sel.addEventListener('change', () => {
    const opt = sel.selectedOptions[0];
    try { localStorage.setItem('planejador:lang', opt.dataset.lang); } catch { /* storage unavailable */ }
    location.href = opt.value + location.hash;
  });
}
