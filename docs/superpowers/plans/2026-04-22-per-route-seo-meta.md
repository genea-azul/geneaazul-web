# Per-Route SEO Meta Tags Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix Google Search showing the same description for every SPA route by generating per-route HTML entry-point files with route-specific `<head>` meta tags.

**Architecture:** A Node.js script (`scripts/generate-route-pages.js`) reads `index.html` as a template and emits one `{route}/index.html` per SPA route. Cloudflare Pages serves actual files before falling back to `_redirects`, so each route gets its own `<head>` for crawlers. The existing `updatePageMeta()` in `router.js` continues to update tags client-side on navigation. The dev server's `serveStatic` is updated to try `url/index.html` when a directory is requested, mirroring Cloudflare Pages behaviour.

**Tech Stack:** Node.js built-ins only (`fs`, `path`) — no npm, no build step. Generated files are committed.

---

## Files

| Action | Path |
|--------|------|
| Create | `scripts/generate-route-pages.js` |
| Create | `buscar/index.html` (generated) |
| Create | `conexiones/index.html` (generated) |
| Create | `estadisticas/index.html` (generated) |
| Create | `estadisticas/inmigracion/index.html` (generated) |
| Create | `estadisticas/personalidades/index.html` (generated) |
| Create | `estadisticas/apellidos/index.html` (generated) |
| Create | `mapa/index.html` (generated) |
| Create | `historias/index.html` (generated) |
| Create | `testimonios/index.html` (generated) |
| Create | `colabora/index.html` (generated) |
| Create | `recursos/index.html` (generated) |
| Create | `cronologia/index.html` (generated) |
| Create | `sobre-nosotros/index.html` (generated) |
| Modify | `dev-server.js` |

---

### Task 1: Write the generation script

**Files:**
- Create: `scripts/generate-route-pages.js`

- [ ] **Step 1: Create the script**

Create `scripts/generate-route-pages.js` with the following content:

```javascript
#!/usr/bin/env node
// Generates per-route HTML entry points from index.html.
// Re-run whenever index.html changes: node scripts/generate-route-pages.js

var fs   = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..');

var ROUTES = {
  'buscar':                      { title: 'Buscar familia — Genea Azul',               desc: 'Buscá personas en la base genealógica azuleña. Encontrá familiares y antepasados del partido de Azul.' },
  'conexiones':                  { title: 'Conexiones familiares — Genea Azul',        desc: 'Descubrí cómo dos personas están emparentadas en el árbol genealógico de Azul.' },
  'estadisticas':                { title: 'Estadísticas — Genea Azul',            desc: 'Estadísticas genealógicas del partido de Azul: personas, familias, apellidos e inmigración.' },
  'estadisticas/inmigracion':    { title: 'Inmigración — Genea Azul',             desc: 'Oleadas inmigratorias que llegaron al partido de Azul, Buenos Aires, Argentina.' },
  'estadisticas/personalidades': { title: 'Personalidades — Genea Azul',               desc: 'Personas distinguidas nacidas o relacionadas con el partido de Azul.' },
  'estadisticas/apellidos':      { title: 'Apellidos — Genea Azul',                    desc: 'Apellidos más frecuentes en el partido de Azul según la base genealógica.' },
  'mapa':                        { title: 'Mapa de orígenes — Genea Azul',        desc: 'Mapa interactivo de los países de origen de las familias que llegaron al partido de Azul.' },
  'historias':                   { title: 'Historias de familia — Genea Azul',         desc: 'Relatos sobre familias y personajes del partido de Azul escritos por la comunidad.' },
  'testimonios':                 { title: 'Testimonios — Genea Azul',                  desc: 'Testimonios de personas que encontraron su historia con Genea Azul.' },
  'colabora':                    { title: 'Colaborá — Genea Azul',                desc: 'Cómo colaborar con el proyecto genealógico comunitario Genea Azul.' },
  'recursos':                    { title: 'Recursos — Genea Azul',                     desc: 'Recursos genealógicos útiles para investigar familias del partido de Azul.' },
  'cronologia':                  { title: 'Cronología — Genea Azul',              desc: 'Línea de tiempo histórica del partido de Azul: eventos, genealogía y curiosidades.' },
  'sobre-nosotros':              { title: 'Sobre nosotros — Genea Azul',               desc: 'Conocé al equipo detrás de Genea Azul, el proyecto genealógico comunitario de Azul.' }
};

var template = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

Object.keys(ROUTES).forEach(function(route) {
  var m   = ROUTES[route];
  var url = 'https://geneaazul.com.ar/' + route;
  var html = template;

  html = html.replace(/<title>[^<]*<\/title>/, '<title>' + m.title + '</title>');
  html = html.replace(/(<meta name="description" content=")[^"]*(")/,   '$1' + m.desc  + '$2');
  html = html.replace(/(<link rel="canonical" href=")[^"]*(")/,         '$1' + url     + '$2');
  html = html.replace(/(<meta property="og:url" content=")[^"]*(")/,    '$1' + url     + '$2');
  html = html.replace(/(<meta property="og:title" content=")[^"]*(")/,  '$1' + m.title + '$2');
  html = html.replace(/(<meta property="og:description" content=")[^"]*(")/,  '$1' + m.desc + '$2');
  html = html.replace(/(<meta name="twitter:title" content=")[^"]*(")/,       '$1' + m.title + '$2');
  html = html.replace(/(<meta name="twitter:description" content=")[^"]*(")/,  '$1' + m.desc  + '$2');

  var outDir = path.join(ROOT, route);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'index.html'), html, 'utf8');
  console.log('Generated: ' + route + '/index.html');
});

console.log('Done. ' + Object.keys(ROUTES).length + ' files generated.');
```

- [ ] **Step 2: Verify the script is syntactically valid**

```bash
node --check scripts/generate-route-pages.js
```

Expected: no output (no errors).

---

### Task 2: Run the script and verify output

**Files:**
- Create: all 13 `{route}/index.html` files

- [ ] **Step 1: Run the generator**

```bash
node scripts/generate-route-pages.js
```

Expected output:
```
Generated: buscar/index.html
Generated: conexiones/index.html
Generated: estadisticas/index.html
Generated: estadisticas/inmigracion/index.html
Generated: estadisticas/personalidades/index.html
Generated: estadisticas/apellidos/index.html
Generated: mapa/index.html
Generated: historias/index.html
Generated: testimonios/index.html
Generated: colabora/index.html
Generated: recursos/index.html
Generated: cronologia/index.html
Generated: sobre-nosotros/index.html
Done. 13 files generated.
```

- [ ] **Step 2: Verify `buscar/index.html` has the correct meta tags**

```bash
grep -E '<title>|name="description"|canonical|og:title|og:description|twitter:title|twitter:description|og:url' buscar/index.html
```

Expected — all seven lines must show "Buscar familia — Genea Azul" or the buscar URL and description, with NO home page values remaining:

```
  <title>Buscar familia — Genea Azul</title>
  <meta name="description" content="Buscá personas en la base genealógica azuleña. Encontrá familiares y antepasados del partido de Azul.">
  <link rel="canonical" href="https://geneaazul.com.ar/buscar">
  <meta property="og:url" content="https://geneaazul.com.ar/buscar">
  <meta property="og:title" content="Buscar familia — Genea Azul">
  <meta property="og:description" content="Buscá personas en la base genealógica azuleña. Encontrá familiares y antepasados del partido de Azul.">
  <meta name="twitter:title" content="Buscar familia — Genea Azul">
  <meta name="twitter:description" content="Buscá personas en la base genealógica azuleña. Encontrá familiares y antepasados del partido de Azul.">
```

- [ ] **Step 3: Verify nested route `estadisticas/inmigracion/index.html`**

```bash
grep -E '<title>|name="description"|canonical' estadisticas/inmigracion/index.html
```

Expected:
```
  <title>Inmigración — Genea Azul</title>
  <meta name="description" content="Oleadas inmigratorias que llegaron al partido de Azul, Buenos Aires, Argentina.">
  <link rel="canonical" href="https://geneaazul.com.ar/estadisticas/inmigracion">
```

- [ ] **Step 4: Verify home page `index.html` is unchanged**

```bash
grep -E '<title>|name="description"|canonical' index.html
```

Expected — home page values intact:
```
  <title>Genea Azul — Genealogía azuleña</title>
  <meta name="description" content="Genea Azul — Investigación genealógica comunitaria del partido de Azul, Argentina. Buscá tu familia, descubrí tu historia.">
  <link rel="canonical" href="https://geneaazul.com.ar/">
```

---

### Task 3: Update dev-server.js to serve directory index files

**Files:**
- Modify: `dev-server.js` lines 193–208 (`serveStatic` function)

The current `serveStatic` falls back to `index.html` when the path resolves to a directory. It needs to first try `url/index.html` so that e.g. `GET /buscar` serves `buscar/index.html` (matching Cloudflare Pages behaviour).

- [ ] **Step 1: Update `serveStatic`**

Replace the `serveStatic` function (lines 193–208) with:

```javascript
function serveStatic(res, url) {
  var filePath = path.join(ROOT, url === '/' ? 'index.html' : url);
  var ext = path.extname(filePath).toLowerCase();

  fs.stat(filePath, function(err, stat) {
    if (!err && stat.isFile()) {
      return readAndSend(res, filePath, ext || '.html');
    }
    // Try directory index (mirrors Cloudflare Pages behaviour)
    var indexPath = path.join(ROOT, url.replace(/\/$/, ''), 'index.html');
    fs.stat(indexPath, function(err2, stat2) {
      if (!err2 && stat2.isFile()) {
        return readAndSend(res, indexPath, '.html');
      }
      // SPA fallback
      readAndSend(res, path.join(ROOT, 'index.html'), '.html');
    });
  });
}

function readAndSend(res, filePath, ext) {
  fs.readFile(filePath, function(err, data) {
    if (err) { res.writeHead(500); return res.end('Internal server error'); }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}
```

- [ ] **Step 2: Verify the old inline `fs.readFile` call is gone**

```bash
grep -n 'fs.readFile' dev-server.js
```

Expected: only the new `readAndSend` function definition appears (line ~210). No other `fs.readFile` call should exist.

---

### Task 4: Test locally

- [ ] **Step 1: Start the dev server**

```bash
node dev-server.js
```

Expected:
```
Dev server → http://localhost:8090
```

- [ ] **Step 2: Verify `/buscar` serves the route-specific file**

In a second terminal:

```bash
curl -s http://localhost:8090/buscar | grep '<title>'
```

Expected:
```
  <title>Buscar familia — Genea Azul</title>
```

- [ ] **Step 3: Verify `/estadisticas/inmigracion` serves the nested route**

```bash
curl -s http://localhost:8090/estadisticas/inmigracion | grep '<title>'
```

Expected:
```
  <title>Inmigración — Genea Azul</title>
```

- [ ] **Step 4: Verify `/` still serves home page**

```bash
curl -s http://localhost:8090/ | grep '<title>'
```

Expected:
```
  <title>Genea Azul — Genealogía azuleña</title>
```

- [ ] **Step 5: Verify an unknown route still falls back to home page**

```bash
curl -s http://localhost:8090/ruta-inexistente | grep '<title>'
```

Expected:
```
  <title>Genea Azul — Genealogía azuleña</title>
```

- [ ] **Step 6: Stop the dev server** (`Ctrl+C`)

---

### Task 5: Update `_headers` for generated route directories

The `_headers` file currently covers `css/*`, `js/*`, `data/*`, `img/*`. The new `buscar/index.html`, `mapa/index.html`, etc. are HTML files — they should get `no-cache` like `index.html` (always revalidate). Check the current `_headers`:

- [ ] **Step 1: Read `_headers`**

```bash
cat _headers
```

- [ ] **Step 2: Decide if a rule is needed**

If `_headers` has no catch-all rule for HTML files at sub-paths, Cloudflare Pages will apply default caching to the generated files. Since these are HTML entry points that must stay in sync with `index.html`, they need `no-cache`.

Add a rule for route-level HTML after any existing `/*` rule:

```
/*/index.html
  Cache-Control: no-cache
```

If `_headers` already has a `/*` rule that covers all paths with `no-cache`, no change is needed.

---

### Task 6: Commit

- [ ] **Step 1: Stage all new and modified files**

```bash
git add scripts/generate-route-pages.js
git add buscar/ conexiones/ estadisticas/ mapa/ historias/ testimonios/ colabora/ recursos/ cronologia/ sobre-nosotros/
git add dev-server.js
git add _headers
```

- [ ] **Step 2: Verify what is staged**

```bash
git status
```

Expected: 13 new `index.html` files in route directories, `scripts/generate-route-pages.js`, `dev-server.js`, and `_headers` listed as modified/new.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: generate per-route HTML entry points for SEO meta tags

Each SPA route now has its own index.html with route-specific title,
description, canonical URL, og:, and twitter: tags so Google sees
distinct descriptions per page rather than the home page description
for all routes.

A generation script (scripts/generate-route-pages.js) produces the
13 route files from index.html. Re-run the script whenever index.html
head content changes. Dev server updated to try directory/index.html
before the SPA fallback, matching Cloudflare Pages behaviour."
```
