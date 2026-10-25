# Contributing

Thanks for helping make home Wi-Fi planning easier. Every kind of contribution counts: ideas, bug reports, measurements from real homes, documentation, and code. AI-assisted contributions are welcome.

## Where to contribute

Issues and pull requests live on GitHub at [onlyosp/planejadorwifi.com](https://github.com/onlyosp/planejadorwifi.com), and pull requests are reviewed and merged there. The maintainer publishes `main` to planejadorwifi.com.

## Suggesting a feature

Open an issue with the **Feature request** template. Describe the problem you want to solve before the solution. "I can't tell whether my garage gets signal" is more useful than "add a 3D view". Screenshots or an exported project JSON help a lot.

## Reporting a bug

Open an issue with the **Bug report** template. Include:

- what you did, what you expected, and what happened;
- browser and device;
- the exported project (**Arquivo › Exportar JSON**), if the bug depends on a plan.

## Sending a pull request

1. Fork the repository and create a branch from `main`.
2. Make a focused change. One feature or fix per pull request.
3. Run `npm run check`. It runs the secret scan, the tests and the build.
4. For UI changes, test with `npm start` at desktop and phone width, in light and dark mode.
5. Open the pull request with the template filled in.

Follow the rules in [AGENTS.md](AGENTS.md). They apply to humans and AI alike. In short:

- No secrets, keys or third-party scripts (analytics, ads, trackers) in the code.
- Static output only.
- Every visible text in Portuguese, English and Spanish (`i18n/*.json`); code and docs in English.
- Keep the interface simple.

## Using AI assistants

You are encouraged to use Claude Code, Codex, Copilot, Cursor or any other assistant. They read [AGENTS.md](AGENTS.md) for the project rules. You remain responsible for the change:

- Read and understand the diff before you submit it.
- Make sure the tests cover the new behavior.
- Say in the pull request which assistant helped. Nobody will judge you for it; it helps reviewers know where to look.

## Good first contributions

- Wall materials with measured attenuation values, with sources.
- More router presets (name, bands, relative power), with a link to the spec sheet.
- Accessibility and keyboard improvements in the drawing tools.
- Better translations, or a new language (add `i18n/<lang>.json` and register it in `scripts/build.mjs`).

## Code of conduct

Be kind and assume good intent. Harassment or discrimination of any kind is not tolerated. Maintainers may remove comments, issues or pull requests that break this rule.
