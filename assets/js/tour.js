// First-visit guided tour: a spotlight on each step's target plus a small card.
// Steps and labels come from i18n (ui.tour). Esc or "Skip" closes it; the flag below stops it
// from opening again on its own, and the header button replays it.
import { raw, t } from './i18n.js';

const SEEN_KEY = 'planejador:tour-done';
let state = null;

export function tourSeen() {
  try { return localStorage.getItem(SEEN_KEY) === '1'; } catch { return true; }
}
function markSeen() {
  try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* ignore */ }
}

export function startTour() {
  // Steps whose target is hidden in the current layout (the collapsed bottom sheet on phones,
  // for instance) are skipped.
  const shown = el => el && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden';
  const steps = (raw('tour.steps') || []).filter(s => !s.target || shown(document.querySelector(s.target)));
  if (!steps.length || state) return;
  const root = document.createElement('div');
  root.className = 'tour';
  root.innerHTML = `<div class="tour-spot" aria-hidden="true"></div>
    <div class="tour-card" role="dialog" aria-modal="true" aria-labelledby="tourTitle" tabindex="-1">
      <p class="tour-count"></p><h2 id="tourTitle"></h2><p class="tour-body"></p>
      <div class="btnrow tour-actions">
        <button type="button" class="ghost" data-tour="skip">${t('tour.skip')}</button>
        <span class="tour-gap"></span>
        <button type="button" data-tour="back">${t('tour.back')}</button>
        <button type="button" class="primary" data-tour="next"></button>
      </div>
    </div>`;
  document.body.append(root);
  state = { steps, i: 0, root, lastFocus: document.activeElement };
  root.addEventListener('click', e => {
    const act = e.target.closest('[data-tour]')?.dataset.tour;
    if (act === 'next') go(state.i + 1);
    else if (act === 'back') go(state.i - 1);
    else if (act === 'skip') close();
  });
  document.addEventListener('keydown', onKey, true);
  window.addEventListener('resize', place);
  window.addEventListener('scroll', place, { passive: true });
  go(0);
}

function onKey(e) {
  if (!state) return;
  const card = state.root.querySelector('.tour-card');
  if (e.key === 'Escape') { e.preventDefault(); close(); }
  else if (e.key === 'ArrowRight') go(state.i + 1);
  else if (e.key === 'ArrowLeft') go(state.i - 1);
  // Enter on the card itself moves on; on a button it presses that button as usual.
  else if (e.key === 'Enter' && e.target === card) { e.preventDefault(); go(state.i + 1); }
  else if (e.key === 'Tab') {
    // Keep keyboard focus inside the tour card while it is open.
    const items = [...card.querySelectorAll('button')].filter(b => !b.hidden);
    const first = items[0], last = items[items.length - 1];
    if (!card.contains(document.activeElement) || document.activeElement === card) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    return;
  }
  // The planner's single-key shortcuts stay quiet while the tour is open; buttons still work.
  e.stopPropagation();
}

function go(i) {
  if (!state) return;
  if (i >= state.steps.length) { close(); return; }
  state.i = Math.max(0, i);
  const step = state.steps[state.i], card = state.root.querySelector('.tour-card');
  card.querySelector('.tour-count').textContent = t('tour.of', { i: state.i + 1, n: state.steps.length });
  card.querySelector('h2').textContent = step.title;
  card.querySelector('.tour-body').innerHTML = step.body;
  card.querySelector('[data-tour=back]').hidden = state.i === 0;
  card.querySelector('[data-tour=next]').textContent = state.i === state.steps.length - 1 ? t('tour.done') : t('tour.next');
  const target = step.target && document.querySelector(step.target);
  // Targets inside the planner bring the whole workspace into view, not just themselves. A target
  // further down a scrolling panel (the results drawer) is first scrolled into that panel's view.
  const host = target && target.closest('.ws');
  if (target && host) revealInside(target, host);
  if (target) (host || target).scrollIntoView({ block: host ? 'end' : 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  place();
  setTimeout(place, 350);
  setTimeout(place, 800);
  card.focus({ preventScroll: true });
}

function revealInside(target, host) {
  for (let el = target.parentElement; el && el !== host; el = el.parentElement) {
    const oy = getComputedStyle(el).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight) {
      const t = target.getBoundingClientRect(), r = el.getBoundingClientRect();
      if (t.top < r.top || t.bottom > r.bottom) el.scrollTop += t.top - r.top - 12;
    }
  }
}

function place() {
  if (!state) return;
  const step = state.steps[state.i], spot = state.root.querySelector('.tour-spot'), card = state.root.querySelector('.tour-card');
  const target = step.target && document.querySelector(step.target);
  const vw = window.innerWidth, vh = window.innerHeight, pad = 6, gap = 12;
  const cw = Math.min(360, vw - 32);
  card.style.width = cw + 'px';
  if (!target) {
    spot.style.cssText = `left:${vw / 2}px;top:${vh / 2}px;width:0;height:0`;
    card.style.left = (vw - cw) / 2 + 'px';
    card.style.top = Math.max(16, (vh - card.offsetHeight) / 2) + 'px';
    return;
  }
  const r = target.getBoundingClientRect();
  spot.style.cssText = `left:${r.left - pad}px;top:${r.top - pad}px;width:${r.width + pad * 2}px;height:${r.height + pad * 2}px`;
  const ch = card.offsetHeight;
  let top = r.bottom + gap;
  if (top + ch > vh - 16) top = r.top - gap - ch;
  if (top < 16) top = Math.min(vh - ch - 16, Math.max(16, r.top));
  let left = r.left;
  if (r.right + gap + cw < vw - 16 && (r.bottom + gap + ch > vh - 16) && r.top - gap - ch < 16) left = r.right + gap;
  card.style.left = Math.min(Math.max(16, left), vw - cw - 16) + 'px';
  card.style.top = Math.max(16, Math.min(top, vh - ch - 16)) + 'px'; // never off screen
}

function close() {
  if (!state) return;
  markSeen();
  document.removeEventListener('keydown', onKey, true);
  window.removeEventListener('resize', place);
  window.removeEventListener('scroll', place);
  state.root.remove();
  const back = state.lastFocus;
  state = null;
  if (back && back.focus) back.focus({ preventScroll: true });
}
