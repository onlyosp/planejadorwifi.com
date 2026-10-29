# Instructions for AI coding agents

These rules apply to every AI assistant working in this repository (Claude Code, Codex, Cursor, Copilot, Gemini CLI and others). Human contributors follow them too.

## Project

Planejador WiFi is a static, browser-only Wi-Fi coverage and mesh planner, published at https://planejadorwifi.com in Brazilian Portuguese (`/`), English (`/en/`) and Spanish (`/es/`). Users draw a floor plan, place routers and see estimated signal per band.

## Commands

```bash
npm start           # builds dist/, serves it at http://localhost:8080 and rebuilds on changes
npm test            # node:test suites in tests/
npm run build       # production build into dist/
npm run check       # secret scan + tests + build; must pass before every commit
```

The project uses Node.js 22 or newer and has no npm dependencies.

## Hard rules

1. **No secrets in the repository, ever.** This covers API tokens, passwords, private keys and account IDs of any service. `scripts/check-secrets.mjs` runs in CI and fails the build if it finds one. Never weaken that script to make it pass.
2. **Static output only.** The site must deploy as plain files: no server, no serverless functions, no database, no runtime API keys. A framework or bundler is acceptable only if it outputs static files, and only after an issue discusses it. Today the stack is vanilla JS ES modules with no dependencies; do not add npm packages without a clear need.
3. **No third-party code in this repository.** No analytics, ads, tracking pixels, external widgets, CDNs or hosted fonts: every file the site loads is served from the site itself (fonts live in `assets/fonts/`). Deployment-specific features belong in build extensions outside the repository, through the generic extension points in `scripts/build.mjs` (`SITE_EXTENSIONS`, slots, flags; see `docs/deployment.md`). Keep those extension points generic: never name or special-case a specific service. Usage events go through `track()` in `app.js`, which only dispatches a `planejador:track` DOM event.
4. **Privacy first.** Projects stay in the visitor's browser. Do not send user data anywhere.
5. **Keep the interface simple.** Prefer one clear control over several options. New features should not crowd the toolbar or the side panel.
6. **Every visible text exists in Portuguese, English and Spanish.** See the next section. A change that adds or edits user-facing text in only one language is incomplete.

## Languages (required)

The site ships in three languages: **pt-BR** (default, served at `/`), **en** (`/en/`) and **es** (`/es/`).

- **No hard-coded text.** Every string a visitor can see or hear, including `aria-label`s, `title`s, placeholders, toasts, dialog texts, tour steps and the text summary, lives in `i18n/pt-BR.json`, `i18n/en.json` and `i18n/es.json`. HTML templates in `src/` use `{{key}}` (escaped) or `{{{key}}}` (raw HTML). JavaScript uses `t('key', { param })` and `raw('key')` from `assets/js/i18n.js`, which reads the page's `ui` section.
- **Same change, three files.** When you add or edit a string, update all three files in the same commit with a real translation, never a copy of the Portuguese. `tests/i18n.test.js` fails if the files differ in keys, array lengths or `{placeholders}`.
- **Write naturally.** Use the conventions of each audience: Brazilian Portuguese, US English, and neutral Latin American Spanish. Keep product and brand names as they are (Planejador WiFi, Deco, eero).
- **Numbers and units.** Format numbers with the page locale (`fmt()` in `app.js`); keep units metric.
- **New pages.** Every page needs a path in each language's `paths`; canonical URLs, hreflang links, the language switcher, the sitemap and `llms.txt` are generated from those paths. Then pick the kind of page:
  - **Guide:** add an entry to `GUIDES` in `scripts/build.mjs` (id, publish date, example home, related guides), its texts under `guides.items.<id>` and its path under `paths["guide-<id>"]`. All guides share `src/guide.html`.
  - **Reference page** (like the methodology and about pages): add an entry to `DOCS` (publish date, schema type, links at the end) and its texts under a top-level key with the page's name. These share `src/doc.html`.
  - **Anything else:** add a template to `src/` and register it in `PAGES`.
  - `tests/build.test.js` checks every indexable page for a unique title and description, complete hreflang, valid JSON-LD and its entries in the sitemap and `llms.txt`.
- **Routing.** Only the Portuguese home page redirects by browser language, and only for people (crawlers are skipped). Do not add other automatic redirects: every language version must stay reachable and indexable.
- **Project data is not translated.** Names people type (projects, rooms) stay as typed. Names the app generates (floor names, the example house) are recognized in any language and shown in the page language by `localizeDefaults()` in `app.js`; if you add another generated name, add it to `defaultNames()` in `scripts/build.mjs`.

## Conventions

- **Language of the code:** code, comments, commit messages, documentation and issues are in English. Site text follows the Languages section above.
- **Model numbers are never typed by hand.** Page texts write `{tokens}` (attenuation per material and band, signal levels, ranges, coverage of the example homes, tables and more; the list is in the comment above `fillModel()` in `scripts/build.mjs`) and the build fills them from `assets/js/engine.js`. An unknown token stops the build. `llms.txt` quotes the same values.
- **Model changes:** the example homes in `scripts/scenarios.mjs` are covered with the planner's own engine, and the guides quote their results. Some guide sentences state those results in words ("one node is enough up to 120 m²"); `tests/build.test.js` checks them. If a model change breaks one, rewrite the sentence in the three language files and the test in the same change.
- **Project links:** "Copy link" puts the whole project in the link's fragment (`#p=…`, `encodeShare()` and `decodeShare()` in `store.js`). Links already sent must keep opening: to change the format, raise `SHARE_VERSION` and keep decoding the old versions. The fragment never leaves the browser: `site.js` removes it from the address before other scripts run, and no code may send it anywhere, `track()` included.
- **Module boundaries:** `engine.js` holds pure functions only, with no DOM or storage access. Storage goes through `store.js`, and every `localStorage` access is wrapped in try/catch.
- **Colors:** every color is a CSS token in `assets/css/style.css`, defined for light and dark themes.
- **Accessibility:** controls have labels, keyboard focus stays visible, and layouts work at 375 px wide with no horizontal scroll.
- **Generated output:** do not edit files in `dist/`. They are generated.
- **Commits:** keep them small and focused, with a Conventional Commits style message (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`).

## Before you finish a task

1. Run `npm run check` and make sure it passes.
2. For UI changes, run `npm start` and test the flow in a browser, at desktop and phone width, in light and dark mode, and in at least one language other than Portuguese.
3. Summarize what changed and what you could not verify.
4. In the pull request description, say which AI assistant helped.
