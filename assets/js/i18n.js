// Runtime translations. The build embeds the page language's `ui` strings as JSON in #i18n.
const data = (() => {
  try { return JSON.parse(document.getElementById('i18n')?.textContent || '{}'); } catch { return {}; }
})();

export const lang = data.lang || document.documentElement.lang || 'pt-BR';
export const locale = data.locale || lang;
export const paths = data.paths || {};
// Generated names (floors, example project) in every language, from scripts/build.mjs.
export const defaults = data.defaults || {};

// Raw value (string, array or object) at a dotted key, e.g. raw('tour.steps').
export const raw = key => key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), data.ui);

// Translated string with {name} placeholders filled from params. Falls back to the key.
export function t(key, params) {
  const v = raw(key);
  const s = typeof v === 'string' ? v : key;
  return params ? s.replace(/\{(\w+)\}/g, (m, p) => (p in params ? String(params[p]) : m)) : s;
}
