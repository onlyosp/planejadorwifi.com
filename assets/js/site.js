// Shared by every page: the language switcher. The choice is remembered so the Portuguese
// home page stops redirecting by browser language (see LANG_REDIRECT in scripts/build.mjs).
const sel = document.getElementById('langSel');
if (sel) {
  sel.addEventListener('change', () => {
    const opt = sel.selectedOptions[0];
    try { localStorage.setItem('planejador:lang', opt.dataset.lang); } catch { /* storage unavailable */ }
    location.href = opt.value + location.hash;
  });
}
