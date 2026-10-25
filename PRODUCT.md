# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Anyone planning Wi-Fi for a home, served equally:

- **Laypeople** about to buy a router or mesh kit who want to get it right before spending. They do not know what dBm or backhaul mean and should not need to.
- **Technical enthusiasts** (home lab, gamers, networking hobbyists) who want control over materials, bands, models and placement.
- **Installers and technicians** who plan networks for clients and need a quick, shareable estimate.

The default experience speaks to the layperson; technical depth (dBm values, attenuation per band, backhaul quality, custom router models) is available without being required.

## Product Purpose

Planejador WiFi lets people draw their floor plan, mark what the walls are made of, place a router and mesh nodes, and see the estimated coverage on 2.4, 5 and 6 GHz before buying anything.

Success means:

- the visitor leaves knowing how many nodes to buy, which kind (dual-band or tri-band, wired or wireless backhaul) and where to put them;
- the site is found through search engines and AI assistants, in Portuguese, English and Spanish;
- the official deployment at planejadorwifi.com covers its costs and earns revenue through optional donations and advertising, without compromising the planner.

## Positioning

- **Runs entirely in the browser.** No account, no server, no upload: projects stay on the visitor's device.
- **Free and open source** (MIT), with contributions welcome on GitHub, including AI-assisted ones.
- **Physics-based estimate, honestly framed:** log-distance path loss plus per-material, per-band wall attenuation, slab loss between floors, backhaul quality between nodes and a "suggest a spot" search, with a stated typical error of ±8 dB. It compares placements; it does not pretend to replace a site survey.
- **Vendor-neutral:** built-in presets for several brands plus the visitor's own models.
- **Trilingual:** Brazilian Portuguese (default), English and Spanish, each with its own indexable URL.

## Operating Context

- People use it at home, often while deciding between router or mesh kits, sometimes with a photo of the floor plan as the drawing background (scale calibrated with the measure tool).
- They compare bands and placements, then export the project as JSON or copy a text summary to ask a forum, a technician or an AI assistant.
- Use is split evenly between desktop (mouse) and phone (touch); drawing must work well on both.
- A guided tour runs on the first visit and can be replayed from the menu.

## Capabilities and Constraints

- Fully static output: HTML, CSS and vanilla JavaScript ES modules with no runtime dependencies; Node.js only for the build and tests.
- Every visible text exists in `i18n/pt-BR.json`, `en.json` and `es.json`.
- The public code loads nothing from third parties (fonts are self-hosted). Deployment-specific features (advertising, statistics, donations, hosting files) live in private build extensions through generic extension points.
- Projects and custom models persist in `localStorage`; storage keys keep the legacy `planta-wifi` prefix so saved work survives.
- Terminology in the UI: mesh node ("nó mesh"), main node, backhaul, band (2.4 / 5 / 6 GHz), dBm, coverage categories (excellent, good, fair, weak, no usable signal).
- Open decisions: whether to add more content pages (buying guides, model comparisons) for search traffic.

## Brand Commitments

- Name: **Planejador WiFi**, domain planejadorwifi.com, logo is a floor-plan square with a Wi-Fi arc (`assets/img/favicon.svg`).
- Voice: plain, direct and honest about uncertainty. Never overstate accuracy or invent social proof.

## Evidence on Hand

- Built-in router presets (TP-Link Deco BE25, BE65, BE85; eero 7 and Pro 7; Netgear Orbi 370; Mercusys Halo H47BE; generic ISP router) in `assets/js/engine.js`.
- Attenuation values per material and band, and the signal-level scale, in `engine.js` and the in-page guide.
- An example house loaded on the first visit (`exampleProject()` in `assets/js/store.js`).
- No testimonials, user counts, reviews, press or measured field validation exist. Future work must not fabricate any of them.

## Product Principles

1. **Honest estimate over false precision:** show the uncertainty, compare options, never promise a measurement.
2. **Plain language first, depth on demand:** a layperson finishes the job without jargon; experts can open the detail.
3. **Privacy by construction:** nothing about a project leaves the device; the public product runs no third-party code.
4. **Equal on desktop and phone:** every drawing and reading task works with mouse and touch.
5. **One product, three languages:** no feature or text ships in only one language.

## Accessibility & Inclusion

- Controls are labeled, keyboard focus stays visible, and the planner has keyboard shortcuts for every tool.
- Layouts work at 375 px wide with no horizontal scroll, in light and dark themes.
- Signal quality is never conveyed by color alone: values in dBm and category names accompany the heat map.
