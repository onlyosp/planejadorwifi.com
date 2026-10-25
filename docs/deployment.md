# Building and hosting

Planejador WiFi builds to plain static files. Any web server or static host can serve them.

## Build

You need Node.js 22 or newer. There are no dependencies to install.

```bash
npm run check      # secret scan, tests and build
npm run build      # writes the site to dist/
npm run preview    # builds and serves dist/ at http://localhost:8080
```

`dist/` contains:

```
index.html, politica-de-privacidade.html, 404.html   Portuguese (default)
en/index.html, en/privacy.html, en/404.html            English
es/index.html, es/privacidad.html, es/404.html         Spanish
assets/                                                CSS, JavaScript, images
sitemap.xml, site.webmanifest
```

## Settings

| Environment variable | Default | Purpose |
|---|---|---|
| `SITE_URL` | `https://planejadorwifi.com` | Public origin used in canonical links, `hreflang` links and the sitemap. Set it when you host your own copy. |
| `SITE_EXTENSIONS` | empty | Build extensions to include (see below). |

Example:

```bash
SITE_URL=https://wifi.example.org npm run build
```

## What the server must do

1. **Serve pages without the `.html` extension.** Links point to `/politica-de-privacidade`, `/en/privacy` and `/es/privacidad`, which are the files `politica-de-privacidade.html`, `en/privacy.html` and `es/privacidad.html`.
2. **Serve `index.html` for directory URLs** such as `/en/` and `/es/`.
3. **Answer unknown URLs with status 404** and the `404.html` of the closest language folder (`/en/404.html` under `/en/`, `/404.html` elsewhere).
4. **Use HTTPS.**

Example for nginx:

```nginx
root /var/www/planejadorwifi/dist;

location / {
  try_files $uri $uri.html $uri/ =404;
}
location /en/ { error_page 404 /en/404.html; try_files $uri $uri.html $uri/ =404; }
location /es/ { error_page 404 /es/404.html; try_files $uri $uri.html $uri/ =404; }
error_page 404 /404.html;
```

## Crawler files

The build does not create `robots.txt` or other crawler instructions: they depend on how and where you host the site. Add them on your server or write them from a build extension (`writeFiles`). The generated `sitemap.xml` is at the site root.

## Caching

Every CSS and JavaScript URL carries a content hash (`style.css?v=1a2b3c4d5e`), so files under `/assets/css/` and `/assets/js/` can be cached for a year (`Cache-Control: public, max-age=31536000, immutable`). Serve HTML with a short cache or none, so a new deploy shows up right away.

The language versions are separate pages. Do not add server-side redirects based on the browser language: the Portuguese home page already sends people to `/en/` or `/es/`, and crawlers must reach every version.

## Build extensions

The repository has no analytics, ads or other third-party code. A deployment can add its own features without changing the repository through **build extensions**: ES modules listed, comma-separated, in `SITE_EXTENSIONS`.

```bash
SITE_EXTENSIONS=../my-extensions/stats.mjs npm run build
```

An extension's default export receives `{ env, langs }` and returns any of:

| Field | Meaning |
|---|---|
| `flags` | `{ name: true }`, usable as `<!-- build:name -->…<!-- /build:name -->` in templates. Set `thirdParty: true` when the extension loads anything from a third party: the privacy page then drops its "no third-party cookies" statement. |
| `i18n` | Texts per language, `{ 'pt-BR': {...}, en: {...}, es: {...} }`, merged into `i18n/*.json`. Provide all three languages. |
| `slots` | HTML inserted at fixed points: `head`, `bodyEnd`, `afterTool` (below the planner workspace), `inResults` (at the end of the planner's results drawer), `inGuide`, `afterGuide`, `footer`, `privacy`. Slots use the same `{{key}}` syntax as the templates. |
| `writeFiles(outDir)` | Writes extra files (scripts, styles, server configuration) before CSS and JavaScript are fingerprinted. |

The app announces usage events (`project_create`, `project_export`, `project_import`, `suggest_node`, `model_create`, `copy_summary`) as a `planejador:track` DOM event, which an extension can listen to. If your extension collects anything about visitors, describe it in the `privacy` slot, in every language, and ask for consent where the law requires it.

`tests/build.test.js` shows a complete example extension.
