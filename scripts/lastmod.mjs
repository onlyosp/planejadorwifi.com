// Last-modified dates for the sitemap and the pages, read from git history.
//
// A page changes when its template changes or when its own part of a language file changes
// (privacy texts, one guide...). Edits to other strings in the same file do not count, so a
// new button label does not make every page look updated. Uncommitted changes count as today.
// Without git (a tarball, a shallow CI clone) every date falls back to the newest one known.

import { execFileSync } from 'node:child_process';

const today = () => new Date().toISOString().slice(0, 10);

export function createDates(root) {
  const git = (args, input) => {
    try { return execFileSync('git', args, { cwd: root, input, stdio: [input ? 'pipe' : 'ignore', 'pipe', 'ignore'], maxBuffer: 256 << 20 }); }
    catch { return null; }
  };
  const head = String(git(['log', '-1', '--format=%cs']) || '').trim() || today();
  const dirty = files => String(git(['status', '--porcelain', '--', ...files]) || '').trim() !== '';

  // Newest commit date touching any of these files.
  function filesDate(files) {
    if (!files.length) return null;
    if (dirty(files)) return today();
    return String(git(['log', '-1', '--format=%cs', '--', ...files]) || '').trim() || null;
  }

  // Every committed version of a file, newest first, read in one `git cat-file --batch` call.
  const versionsCache = new Map();
  function versions(file) {
    if (versionsCache.has(file)) return versionsCache.get(file);
    const log = String(git(['log', '--format=%H %cs', '--', file]) || '').trim().split('\n').filter(Boolean).map(l => l.split(' '));
    const out = [];
    if (log.length) {
      const buf = git(['cat-file', '--batch'], log.map(([h]) => `${h}:${file}`).join('\n') + '\n');
      let at = 0;
      for (const [, date] of log) {
        if (!buf) break;
        const nl = buf.indexOf(10, at), header = buf.subarray(at, nl).toString();
        const size = +header.split(' ')[2];
        if (!Number.isFinite(size)) { out.push({ date, json: null }); at = nl + 1; continue; }
        const body = buf.subarray(nl + 1, nl + 1 + size).toString();
        let json = null;
        try { json = JSON.parse(body); } catch { /* an unreadable old version counts as different */ }
        out.push({ date, json });
        at = nl + 1 + size + 1;
      }
    }
    versionsCache.set(file, out);
    return out;
  }

  // Date of the commit that last changed one key path (e.g. "guides.items.router") in a JSON file.
  function sectionDate(file, key, current) {
    const pick = o => key.split('.').reduce((v, k) => (v == null ? undefined : v[k]), o);
    const now = JSON.stringify(pick(current));
    const list = versions(file);
    if (!list.length) return null;
    if (JSON.stringify(pick(list[0].json)) !== now) return today();
    let date = list[0].date;
    for (const v of list.slice(1)) {
      if (JSON.stringify(pick(v.json)) !== now) break;
      date = v.date;
    }
    return date;
  }

  // files: repository paths; sections: [{ file, key, current }] with `current` the parsed working copy.
  return function pageDate({ files = [], sections = [] }) {
    const dates = [filesDate(files), ...sections.map(s => sectionDate(s.file, s.key, s.current))].filter(Boolean);
    return dates.length ? dates.sort().at(-1) : head;
  };
}
