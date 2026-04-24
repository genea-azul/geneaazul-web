# Genea Azul — Web (AI Agent Context)

Project-level context for AI coding agents. Read this before making any change.

---

## What this project is

Public-facing static website for **Genea Azul** (`geneaazul.com.ar`), a non-profit community genealogy research project focused on the city and district of Azul, Buenos Aires, Argentina. The site lets people search for family members, visualise immigration patterns, explore statistics, and read family stories — all backed by a GEDCOM database exposed via a REST API.

---

## Stack at a glance

| Layer   | Technology                                                                |
| ------- | ------------------------------------------------------------------------- |
| HTML    | `index.html` shell; per-route entry points at root (`buscar.html`, `estadisticas/inmigracion.html`, …); page fragments in `pages/*.html` (lazy-loaded) |
| CSS     | Vanilla CSS with custom properties; no preprocessor, no build step        |
| JS      | ES5-compatible, jQuery 3.7.1, IIFE module pattern — **no bundler**        |
| Icons   | Bootstrap Icons 1.13.1 (CDN)                                              |
| Hosting | Cloudflare Pages (auto-deploy from `main`; no build command)              |
| Backend | `https://gedcom-analyzer-app.fly.dev` (Spring Boot on Fly.io)             |

**There is no build step.** Files are served as-is. Do not introduce `npm`, TypeScript, JSX, ES modules (`import`/`export`), or any syntax that requires transpilation.

---

## Module pattern — always follow this

Every JS file exposes a single global namespace object using the **IIFE revealing-module pattern**:

```javascript
var GeneaAzul = window.GeneaAzul || {};

GeneaAzul.myFeature = (function() {

  function init() { /* ... */ }
  function privateHelper() { /* ... */ }

  return { init };

})();
```

- `GeneaAzul` is the single global namespace — never pollute `window` with anything else.
- Public API is declared in `return { ... }` at the bottom.
- All other functions are private.
- Each module lives in its own file under `js/`.
- New modules must be included in `index.html` with a `<script>` tag and initialised in the `$(document).ready` block.

---

## CSS conventions

### Custom properties (do not hardcode colours)

All colours, spacing, and typography use CSS custom properties defined in `css/theme-heritage.css` and `css/theme-modern.css`. **Never use raw hex colours for anything that should adapt to theming.** Use these variables:

| Variable             | Usage                     |
| -------------------- | ------------------------- |
| `--ga-primary`       | Primary brand colour      |
| `--ga-accent`        | Accent / highlight colour |
| `--ga-bg`            | Page background           |
| `--ga-bg-card`       | Card surface background   |
| `--ga-text`          | Main body text            |
| `--ga-text-muted`    | Secondary / subdued text  |
| `--ga-border`        | Borders and dividers      |
| `--ga-font-heading`  | Serif heading font        |
| `--ga-font-body`     | Sans-serif body font      |

Exception: one-off decorative values not tied to theme (e.g. `color: #b8860b` for a gold birthday star) may use raw values with a comment.

### Class naming

All custom classes are prefixed `ga-`. Bootstrap utility classes are used freely alongside them.

### Where to add styles

All styles go in `css/main.css`. Do not add `<style>` blocks inline in HTML. Do not create new CSS files unless introducing a full new theme.

---

## Key utilities (available everywhere)

All helpers are on `GeneaAzul.utils` (defined in `js/utils.js`):

| Method                                                   | Purpose                                                             |
| -------------------------------------------------------- | ------------------------------------------------------------------- |
| `GeneaAzul.utils.apiGet(url, successFn, errorFn)`        | GET request via jQuery AJAX                                         |
| `GeneaAzul.utils.apiGetCached(url, successFn, errorFn)`  | Like `apiGet` but deduplicates: all callers for the same URL share one request; use for read-only endpoints called from multiple modules (e.g. `/metadata`, `/api/gedcom-analyzer`) |
| `GeneaAzul.utils.apiPost(url, data, successFn, errorFn)` | POST request                                                        |
| `GeneaAzul.utils.escHtml(s)`                             | HTML-escape a value before inserting into DOM — **always use this** |
| `GeneaAzul.utils.formatNumber(n)`                        | Argentine locale number format (e.g. `70.512`)                      |
| `GeneaAzul.utils.spinnerHtml(text)`                      | Bootstrap spinner HTML string                                       |
| `GeneaAzul.utils.getQueryParams()`                       | Parse query-string params from `window.location.search`             |

**Security rule**: always call `escHtml()` on any server-supplied string before inserting it into HTML via `.html()`. Strings inserted via `.text()` are safe.

### Localisation helpers (`GeneaAzul.i18n` — `js/i18n.js`)

| Method | Purpose |
| --- | --- |
| `GeneaAzul.i18n.displayNameInSpanish(name)` | HTML-escapes a person name and replaces GEDCOM tokens (`<private>`, `<no name>`, `<no spouse>`) with Spanish equivalents |
| `GeneaAzul.i18n.displayDateInSpanish(date)` | Converts GEDCOM date string to Spanish (e.g. `"15 APR 1985"` → `"15 de abr de 1985"`, `"ABT 1940"` → `"aprox. 1940"`) |
| `GeneaAzul.i18n.displayReferenceTypeInSpanish(type, sex)` | Converts `ADOPTED_CHILD` / `FOSTER_CHILD` / etc. to a Spanish adjective label |
| `GeneaAzul.i18n.displayRelationshipInSpanish(rel)` | Full Spanish relationship label from a `maxDistantRelationship` object (padre, abuela, primo segundo, etc.) |
| `GeneaAzul.i18n.displayErrorCodeInSpanish(code)` | User-facing Spanish HTML for API error codes (`TOO-MANY-REQUESTS`, etc.) |

`displayNameInSpanish` and `displayDateInSpanish` already call `escHtml` internally — do not double-escape their output.

---

## Routing

`js/router.js` implements History API routing (`pushState`/`popstate`). Routes correspond to `pages/*.html` fragments that are lazy-loaded into `#page-content`.

### Two-layer HTML structure

There are **two distinct layers** of HTML files — do not confuse them:

1. **Per-route entry points** — `buscar.html`, `estadisticas.html`, `estadisticas/inmigracion.html`, etc. at the project root. These are copies of `index.html` with route-specific `<head>` meta tags (title, description, canonical, OG, JSON-LD). Cloudflare Pages serves them transparently at clean URLs (`/buscar` → `buscar.html`) with no HTTP redirect — this is separate from the `/* /index.html 200` SPA catch-all which handles unknown paths and story slugs. Generated by `scripts/generate-route-pages.js`; re-run it after any `<head>` change in `index.html`.

2. **Page fragments** — `pages/buscar.html`, `pages/estadisticas-inmigracion.html`, etc. These contain only the page body (no `<html>`/`<head>`). The router fetches them via AJAX and injects them into `#page-content` on client-side navigation.

### Navigation rules

- Navigation uses `<a href="/route" data-route="route">` anchors. The router intercepts all `[data-route]` clicks, calls `history.pushState`, and loads the fragment.
- The landing page (route key `"inicio"`) maps to path `/` — it is the `index.html` shell itself with no lazy-loaded fragment.
- All static file fetches (fragments, data, stories) use **absolute paths** (leading `/`) so they resolve correctly from any route depth, including two-segment paths like `/estadisticas/inmigracion`.
- **In-page scroll anchors** on the landing page (`#cumpleanos`, `#efemerides`) are genuine fragment links — they do NOT use `data-route` and are not intercepted by the router. After revealing a hidden card via API, scroll to it programmatically when the hash matches:

  ```javascript
  if (window.location.hash === '#cumpleanos') {
    $card[0].scrollIntoView({ behavior: 'smooth' });
  }
  ```

- `GeneaAzul.router.navigate(routeKey)` navigates programmatically. Pass the route key without leading `#` or `/` (e.g. `'historias'`, `'historias/mi-historia'`).

---

## Time zone

**Always use Argentine time** (`America/Argentina/Buenos_Aires`, UTC−3, no DST) when creating or formatting dates for display. Never use `new Date()` without a time zone when the result is shown to users.

```javascript
new Date().toLocaleDateString('es-AR', {
  timeZone: 'America/Argentina/Buenos_Aires',
  day: 'numeric', month: 'long'
});
```

---

## Landing page sections (index.html)

The landing page has these dynamic sections in order:

| Section                 | ID            | Module                      | Notes                                                              |
| ----------------------- | ------------- | --------------------------- | ------------------------------------------------------------------ |
| Hero stats              | `#hero-stats` | `config.js` (GeneaAzul.app) | Animated counters; live person count from API                      |
| Highlights (3-up cards) | —             | Static HTML                 | Immigration, map, personalidades                                   |
| Azul birthdays          | `#cumpleanos` | `js/birthdays.js`           | Alive azuleños born today; shuffled; hidden until API returns data |
| Efemérides del mes      | `#efemerides` | `js/ephemerides.js`         | Distinguished persons born/died this month; mixed & sorted by day  |
| Final CTA               | —             | Static HTML                 | Link to search                                                     |

Both `#cumpleanos` and `#efemerides` start with `display:none` and are revealed only when the API returns non-empty data. They expose direct anchor links (`#cumpleanos`, `#efemerides`) visible on header hover.

---

## API integration

### Base URL

```javascript
GeneaAzul.config.apiBaseUrl
// → 'https://gedcom-analyzer-app.fly.dev' in prod
// → window.location.origin on localhost (assumes local backend on same port)
```

### Backend suspend/wake behaviour

The backend runs on Fly.io with `auto_stop_machines = 'suspend'` and `min_machines_running = 0` — it suspends when idle to save resources and auto-wakes on the first incoming request (cold start takes a few seconds).

Two mechanisms account for this:

1. **Early wake-up** — `config.js` calls `/api/gedcom-analyzer/metadata` on every page load. This pings the backend immediately, giving it a head start before the user navigates to a feature page.

2. **Form gate** — `search.js` and `connections.js` call `/api/gedcom-analyzer` and keep their forms hidden until it responds. On success the form is revealed (and `disableObfuscateLiving` is read from the response in `search.js`); on failure an error message is shown. Do not remove or skip this call — it is the UI readiness gate, not just a wake-up ping.

`apiGetCached` is used for both calls so visiting `#buscar` then `#conexiones` fires only one health-check request total.

### GEDCOM date format

The backend returns dates as GEDCOM-formatted strings, e.g. `"15 APR 1985"`, `"ABT 1940"`. To extract parts:

```javascript
// Year
dateStr.match(/\b(\d{4})\b/)[1]

// Day (only present for full dates like "15 APR 1985")
dateStr.match(/^(\d{1,2})\s+[A-Z]{3}/) // → ["15 APR", "15"]
```

### Birthday endpoints

| Endpoint                                   | Returns                                | Notes                                                    |
| ------------------------------------------ | -------------------------------------- | -------------------------------------------------------- |
| `GET /api/birthday/azul-today`             | `SimplePersonDto[]`                    | Alive persons from Azul born today; shuffled server-side |
| `GET /api/birthday/ephemerides-this-month` | `EphemeridesDto { birthdays, deaths }` | Distinguished persons for the current month              |

Key `SimplePersonDto` display fields: `name`, `aka` (show as `«nickname»`), `dateOfBirth`, `dateOfDeath`, `profilePicture`. Full DTO spec and all other endpoints: `docs/API-REFERENCE.md`.

---

## Static data files

| File                      | Contents                                                                                               | Used by                                           |
| ------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------- |
| `data/personalities.json` | 250+ notable persons with `givenName`, `surname`, `birthYear`, `deathYear`, `birthPlace`, `deathPlace` | `pages/estadisticas-personalidades.html`          |
| `data/immigration.json`   | Immigration waves by origin country                                                                    | `js/stats.js`, hero counters                      |
| `data/surnames.json`      | Surname list with frequency                                                                            | Hero counter, `pages/estadisticas-apellidos.html` |
| `data/timeline.json`      | Timeline entries for `/cronologia` (see schema below)                                                  | `js/cronologia.js`                                |

**Important**: `personalities.json` contains only year-level data (no day/month). For day-of-month efemérides, the backend GEDCOM indexes must be used — not this file.

### timeline.json schema

Each entry has: `year` (int), `month` (int|null), `day` (int|null), `type`, `title`, `body`, `source`, `sourceUrl`, `storySlug`, `imageUrl`.

- `type`: `"historia"` (Azul milestones), `"genealogia"` (GEDCOM data), `"curiosidades"` (interesting facts)
- `sourceUrl` must start with `http` to render as a link; otherwise plain text
- `storySlug`: renders a "→ Leer historia" link to `#historias/<slug>`
- `imageUrl`: thumbnail path/URL; local images live in `img/timeline/`
- Array must be sorted by year ascending

`genealogia` entries are generated by the backend (`generateTimelineJson()`). `historia` and `curiosidades` entries are curated manually.

---

## Hosting and caching

- **Deployment**: push to `main` → Cloudflare Pages auto-deploys (no build command).
- **SPA routing**: `_redirects` contains `/* /index.html 200` so all routes serve `index.html`.
- **Cache headers**: defined in `_headers`:
  - `index.html`, root (`/`), and all route paths (`/buscar`, `/estadisticas/inmigracion`, etc.): `no-cache` (always revalidates — picks up new deploys immediately)
  - `css/*`, `js/*`, `data/*`: `public, max-age=3600, stale-while-revalidate=60` (1 hour)
  - `img/*`: 1 week; `fonts/*`: 1 year + `immutable`
- **No content hashing** in filenames — this is why CSS/JS TTL is kept short (1 hour).

---

## Local development

Run `node dev-server.js` (no `npm install` needed — Node.js built-ins only). It serves static files on `http://localhost:8090` **and** mocks all backend API endpoints, so the full landing page works without a running backend.

Mocked endpoints:

| Method | Path                                     | Notes                                                       |
| ------ | ---------------------------------------- | ----------------------------------------------------------- |
| GET    | `/api/gedcom-analyzer`                   | Health check — unlocks search and connections forms         |
| GET    | `/api/gedcom-analyzer/metadata`          | Full stats (personsCount, familiesCount, etc.)              |
| GET    | `/api/birthday/azul-today`               | Two living persons born today (AR time)                     |
| GET    | `/api/birthday/ephemerides-this-month`   | Births and deaths; two entries fall on today's day          |
| POST   | `/api/search/family`                     | One result person with parents, spouse, children, tree data |
| POST   | `/api/search/surnames`                   | Generates a response for whatever surnames were submitted   |
| GET    | `/api/search/family-tree/:uuid/plainPdf` | Minimal valid PDF as base64                                 |
| POST   | `/api/search/connection`                 | Four-step connection chain                                  |

The server computes today's Argentine date at startup and uses it for ephemerides/birthday mock data — so the `ga-ephem-today` highlight is always visible.

---

## Things NOT to do

- Do not use `import`/`export`, `async`/`await`, arrow functions, template literals, or any ES6+ syntax that requires a transpiler. Keep ES5 compatibility.
- Do not add `<style>` blocks to HTML files.
- Do not hardcode theme colours — use CSS variables.
- Do not forget `escHtml()` when inserting server data into `.html()`.
- Do not use hash fragments as route URLs — the router uses History API (`pushState`). All `[data-route]` links must use `/path` hrefs, not `#hash` hrefs.
- Do not add new files without including them in `index.html`.
- Do not touch `_redirects` — the single SPA rewrite rule is intentional.

---

## Related project

The backend is in a sibling repo: `gedcom-analyzer` (Spring Boot). Its own context file lives there. For this frontend, the backend is a black box accessed via HTTP — do not modify backend code from this repo.
