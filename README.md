# Planejador WiFi

**Plan your home Wi-Fi before you buy.** Draw your floor plan, drop routers and mesh nodes on it, and see the estimated coverage on 2.4, 5 and 6 GHz.

**Live at [planejadorwifi.com](https://planejadorwifi.com)**, free and with no sign-up, in [Portuguese](https://planejadorwifi.com/), [English](https://planejadorwifi.com/en/) and [Spanish](https://planejadorwifi.com/es/).

[![Live site](https://img.shields.io/badge/live-planejadorwifi.com-2F43C4)](https://planejadorwifi.com)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![AI-assisted contributions welcome](https://img.shields.io/badge/AI--assisted-welcome-8D9BFF.svg)](#building-with-ai)

[![Donate with Lightning](https://img.shields.io/badge/donate-%E2%9A%A1%20Lightning-F7931A)](https://planejadorwifi.com/#support)

## Features

- Draw walls by material: brick, concrete, drywall, wooden door, glass, metal. Add several floors, and the slab loss between them is counted.
- See a heat map per band, check the backhaul quality between mesh nodes, and get a suggestion for where an extra node helps most.
- Pick a built-in router model (TP-Link Deco, eero, Orbi, Mercusys, ISP router) or add your own.
- Keep several projects in the browser, and export or import them as JSON.
- Use a photo of your floor plan as the background, with scale calibration.
- Get a short guided tour on the first visit, which you can replay from the menu.
- Use it in Portuguese, English or Spanish. The language is detected from the browser and can be switched at any time.
- Everything runs in the browser. Projects never leave the visitor's device.

## Quick start

You need Node.js 22 or newer. The project has no dependencies to install.

```bash
npm start          # build, serve at http://localhost:8080 and rebuild on changes
npm test           # unit tests (propagation model, storage, build)
npm run build      # production build into dist/
npm run preview    # build, then serve dist/
npm run check      # secret scan + tests + build, same as CI
```

## How it is built

This is a fully static site: HTML, CSS and vanilla JavaScript ES modules. It has no backend and no framework. `scripts/build.mjs` renders the page templates once per language and writes everything to `dist/`, using only the Node standard library.

```
src/index.html                simulator page and guide template
src/privacy.html, src/404.html other page templates
src/partials/                 shared head, header and footer
i18n/pt-BR.json, en.json, es.json  every visible text, one file per language
assets/js/i18n.js             runtime translations (t(), raw())
assets/js/tour.js             first-visit guided tour
assets/js/site.js             language switcher
assets/js/engine.js           propagation model, pure functions
assets/js/store.js            projects and custom models in localStorage
assets/js/app.js              user interface
scripts/build.mjs             production build (pages, hreflang, sitemap)
scripts/dev.mjs               build + serve + rebuild on change
scripts/check-secrets.mjs     fails CI if credentials or real IDs are committed
tests/                        node:test suites
.github/workflows/            secret scan, tests and build on every push and pull request
```

### Languages

Portuguese is served at `/`, English at `/en/` and Spanish at `/es/`. Each version has its own canonical URL, `hreflang` links and sitemap entries, so search engines index all three. The Portuguese home page sends people (not crawlers) to `/en/` or `/es/` based on the browser language, and the switcher in the header remembers the visitor's choice.

Every visible text lives in `i18n/*.json`. Templates use `{{key}}`, scripts use `t('key')`, and `tests/i18n.test.js` fails if the three files drift apart. To add a language, copy `i18n/en.json`, translate it, give it its own `paths`, and add it to `LANGS` in `scripts/build.mjs`.

### Build extensions

The repository contains no analytics, ads or other third-party code. A deployment can add its own features through build extensions, listed in the `SITE_EXTENSIONS` environment variable; without them, `dist/` loads nothing from third parties. See [docs/deployment.md](docs/deployment.md).

### The propagation model

Each point gets a log-distance path loss (exponent 2.5), plus the attenuation of every wall crossed and of each slab between floors. The per-material values live in `assets/js/engine.js`, and the build generates the guide table from them. Typical error is ±8 dB, so the tool compares placements and does not replace a site survey. Better models and calibration data are very welcome contributions.

## Contributing

Ideas, bug reports and pull requests are welcome, and so is AI-assisted code.

- **Suggest a feature:** open an issue on GitHub with the *Feature request* template.
- **Report a bug:** use the *Bug report* template and include the exported project JSON if you can.
- **Send code:** fork the repository, create a branch, run `npm run check`, and open a pull request.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the details.

## Building with AI

This project is written with AI coding assistants and encourages contributors to use them.

- [AGENTS.md](AGENTS.md) holds the rules every assistant must follow: stack limits, the no-secrets policy, language conventions, and the commands to run. Claude Code, Codex, Cursor, Copilot, Gemini CLI and most other agents read it automatically. `CLAUDE.md` and `.github/copilot-instructions.md` point to it.
- **Getting started:** clone the repository, open your assistant at the project root, and describe the change. For example: *"Add a 'balcony' material to the wall list, with tests and the guide table updated."*
- **Before you open the pull request:**
  - Read the diff yourself.
  - Run `npm run check`.
  - Test the change in the browser with `npm start`.
  - Mention in the description which assistant you used. This is for transparency, not a judgement.
- **When you change the model or any text:** update `engine.js` and all three `i18n/*.json` files together. The test suite enforces this.

## Deployment

`npm run build` writes a static site to `dist/` that any web server or static host can serve. Requirements and server settings: [docs/deployment.md](docs/deployment.md). Pull requests are reviewed and merged here on GitHub, where the workflow runs the secret scan, the tests and the build.

## Privacy

The app stores projects only in the visitor's `localStorage` and sends them nowhere. The code in this repository sets no cookies and loads no tracking or advertising scripts.

## Support the project

If the planner saved you a bad router purchase, you can send any amount of bitcoin over the Lightning Network. Scan the BOLT 12 offer with a wallet that supports it (Phoenix, Zeus and others), or copy it from [planejadorwifi.com/#support](https://planejadorwifi.com/#support).

<p align="center"><a href="https://planejadorwifi.com/#support"><img src="https://planejadorwifi.com/assets/img/lightning-offer.svg" width="200" height="200" alt="QR code of the Lightning BOLT 12 donation offer"></a></p>

## License

[MIT](LICENSE)
