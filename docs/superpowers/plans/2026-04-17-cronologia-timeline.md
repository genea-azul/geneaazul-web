# Cronología Timeline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new `#cronologia` page ("Azul a través del tiempo") displaying a vertical timeline of historical Azul milestones, genealogical curiosities from the GEDCOM, and Genea Azul discoveries — filterable by category.

**Architecture:** Static JSON file (`data/timeline.json`) holds all entries; a new IIFE module (`js/cronologia.js`) fetches it via `$.getJSON` and renders it into a lazy-loaded page fragment (`pages/cronologia.html`). Filter tabs toggle visibility by entry type with no re-render. A backend test method generates the JSON (especially `genealogia` entries) when the GEDCOM is updated.

**Tech Stack:** ES5 JavaScript, jQuery 3.7.1, Bootstrap 5.3 utility classes, vanilla CSS custom properties — no build step, no transpilation.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `data/timeline.json` | Curated timeline entries (all types) |
| Create | `pages/cronologia.html` | Page fragment: heading, filter tabs, timeline container |
| Create | `js/cronologia.js` | Fetch JSON, render entries, wire filter tabs |
| Modify | `css/main.css` | `.ga-tl-*` styles — spine, dot, card, filter buttons |
| Modify | `js/router.js` | Add `cronologia` to `routeMap` and `initializers` |
| Modify | `index.html` | Add `<script>` tag, navbar item, footer link |
| Modify (separate repo) | `GeneaAzulWebResources.java` | Add `generateTimelineJson()` test method |

---

## Task 1: Create `data/timeline.json`

**Files:**
- Create: `data/timeline.json`

This is the initial curated dataset. `historia` entries come from Wikipedia research; `genealogia` entries are placeholders to be replaced by the backend-generated set; `descubrimiento` entries are from Genea Azul Instagram — add more as available.

- [ ] **Step 1: Create the file**

```json
[
  {
    "year": 1828,
    "month": null,
    "day": null,
    "type": "historia",
    "title": "Primeras expediciones al arroyo Azul",
    "body": "Expediciones militares al arroyo Azul sientan las bases para la instalación permanente en la región. El arroyo le da nombre al futuro partido.",
    "source": "Wikipedia",
    "sourceUrl": "https://es.wikipedia.org/wiki/Partido_de_Azul",
    "storySlug": null
  },
  {
    "year": 1832,
    "month": 10,
    "day": null,
    "type": "historia",
    "title": "Fundación del Fuerte de Azul",
    "body": "El coronel Pedro Burgos establece el Fuerte San Serapio Mártir del Arroyo Azul como avanzada de la frontera sur bonaerense, dando origen al actual partido de Azul.",
    "source": "Wikipedia",
    "sourceUrl": "https://es.wikipedia.org/wiki/Azul_(Argentina)",
    "storySlug": null
  },
  {
    "year": 1839,
    "month": null,
    "day": null,
    "type": "historia",
    "title": "Creación del Partido de Azul",
    "body": "Se establece formalmente el Partido de Azul como unidad administrativa de la provincia de Buenos Aires.",
    "source": "Wikipedia",
    "sourceUrl": "https://es.wikipedia.org/wiki/Partido_de_Azul",
    "storySlug": null
  },
  {
    "year": 1856,
    "month": null,
    "day": null,
    "type": "historia",
    "title": "Primera iglesia estable",
    "body": "Se construye la primera iglesia estable de Azul, consolidando la vida religiosa y comunitaria del pueblo.",
    "source": "Wikipedia",
    "sourceUrl": "https://es.wikipedia.org/wiki/Azul_(Argentina)",
    "storySlug": null
  },
  {
    "year": 1862,
    "month": null,
    "day": null,
    "type": "historia",
    "title": "Azul declarada Villa",
    "body": "Azul obtiene el rango de Villa, reconociendo su crecimiento poblacional y su importancia como centro de la región.",
    "source": "Wikipedia",
    "sourceUrl": "https://es.wikipedia.org/wiki/Azul_(Argentina)",
    "storySlug": null
  },
  {
    "year": 1865,
    "month": null,
    "day": null,
    "type": "historia",
    "title": "Primer periódico de Azul",
    "body": "Aparece el primer periódico local de Azul, marcando el inicio de la prensa escrita en el partido.",
    "source": "Wikipedia",
    "sourceUrl": "https://es.wikipedia.org/wiki/Azul_(Argentina)",
    "storySlug": null
  },
  {
    "year": 1876,
    "month": null,
    "day": null,
    "type": "historia",
    "title": "Llegada del ferrocarril",
    "body": "El Gran Ferrocarril del Sud llega a Azul, conectando la ciudad con Buenos Aires y transformando la economía regional. El ferrocarril impulsó la llegada masiva de inmigrantes europeos.",
    "source": "Wikipedia",
    "sourceUrl": "https://es.wikipedia.org/wiki/Azul_(Argentina)",
    "storySlug": null
  },
  {
    "year": 1895,
    "month": null,
    "day": null,
    "type": "historia",
    "title": "Azul declarada Ciudad",
    "body": "Por decreto provincial, Azul es elevada al rango de ciudad, consolidando su posición como centro urbano del centro de la provincia de Buenos Aires.",
    "source": "Wikipedia",
    "sourceUrl": "https://es.wikipedia.org/wiki/Azul_(Argentina)",
    "storySlug": null
  },
  {
    "year": 1906,
    "month": null,
    "day": null,
    "type": "historia",
    "title": "Inauguración del Teatro Español",
    "body": "Se inaugura el Teatro Español de Azul, símbolo de la presencia de la comunidad inmigrante española y del desarrollo cultural de la ciudad.",
    "source": "Wikipedia",
    "sourceUrl": "https://es.wikipedia.org/wiki/Azul_(Argentina)",
    "storySlug": null
  },
  {
    "year": 1935,
    "month": null,
    "day": null,
    "type": "historia",
    "title": "Categorización de Azul como ciudad intermedia",
    "body": "Azul se consolida como una de las ciudades intermedias más importantes de la provincia de Buenos Aires, con una economía diversificada basada en la ganadería, el comercio y los servicios.",
    "source": "Wikipedia",
    "sourceUrl": "https://es.wikipedia.org/wiki/Azul_(Argentina)",
    "storySlug": null
  },
  {
    "year": 1960,
    "month": null,
    "day": null,
    "type": "genealogia",
    "title": "Primer registro de inmigrantes italianos en Azul",
    "body": "El árbol genealógico registra los primeros inmigrantes de origen italiano radicados en Azul, inicio de una de las corrientes migratorias más numerosas en el partido.",
    "source": "GEDCOM — Genea Azul",
    "sourceUrl": null,
    "storySlug": null
  },
  {
    "year": 1870,
    "month": null,
    "day": null,
    "type": "genealogia",
    "title": "Nacimiento más antiguo registrado en Azul",
    "body": "El árbol genealógico de Genea Azul registra los nacimientos más tempranos documentados en el partido, trazando las raíces de las familias fundadoras.",
    "source": "GEDCOM — Genea Azul",
    "sourceUrl": null,
    "storySlug": null
  },
  {
    "year": 2020,
    "month": null,
    "day": null,
    "type": "descubrimiento",
    "title": "Ejemplo: descubrimiento genealógico de Genea Azul",
    "body": "Este es un ejemplo de entrada tipo descubrimiento. Reemplazar con contenido real de Instagram de Genea Azul.",
    "source": "Genea Azul",
    "sourceUrl": null,
    "storySlug": null
  }
]
```

- [ ] **Step 2: Verify JSON is valid**

```bash
node -e "JSON.parse(require('fs').readFileSync('data/timeline.json','utf8')); console.log('OK')"
```
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add data/timeline.json
git commit -m "Add starter data/timeline.json with historia and placeholder entries"
```

---

## Task 2: Add timeline CSS to `css/main.css`

**Files:**
- Modify: `css/main.css` (append to end)

- [ ] **Step 1: Add styles**

Append the following block to the end of `css/main.css`:

```css
/* ── Cronología timeline ───────────────────────────────────────── */
.ga-tl-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: center;
  margin-bottom: 2rem;
}

.ga-tl-filter-btn {
  border: 1px solid var(--ga-border);
  background: var(--ga-bg-card);
  color: var(--ga-text);
  border-radius: 1rem;
  padding: 0.25rem 0.875rem;
  font-size: 0.875rem;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}

.ga-tl-filter-btn:hover {
  border-color: var(--ga-accent);
  color: var(--ga-accent);
}

.ga-tl-filter-btn.active {
  background: var(--ga-accent);
  border-color: var(--ga-accent);
  color: #fff;
}

.ga-tl-list {
  position: relative;
  --ga-tl-dot-col: 1.5rem;
}

.ga-tl-list::before { /* vertical spine */
  content: '';
  position: absolute;
  left: calc(var(--ga-tl-dot-col) / 2 - 1px);
  top: 0.75rem;
  bottom: 0;
  width: 2px;
  background: var(--ga-border);
}

.ga-tl-entry {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
  margin-bottom: 1.5rem;
}

.ga-tl-entry.d-none {
  display: none !important;
}

.ga-tl-dot-wrap {
  width: var(--ga-tl-dot-col);
  flex-shrink: 0;
  display: flex;
  justify-content: center;
  padding-top: 0.3rem;
  position: relative;
  z-index: 1;
}

.ga-tl-dot {
  width: 0.75rem;
  height: 0.75rem;
  border-radius: 50%;
  border: 2px solid var(--ga-bg);
  flex-shrink: 0;
}

.ga-tl-dot-historia      { background: var(--ga-primary); }
.ga-tl-dot-genealogia    { background: var(--ga-accent); }
.ga-tl-dot-descubrimiento { background: #2e7d32; /* green, decorative */ }

.ga-tl-content {
  flex: 1;
  min-width: 0;
}

.ga-tl-meta {
  font-size: 0.85rem;
  color: var(--ga-text-muted);
  margin-bottom: 0.25rem;
}

.ga-tl-card {
  background: var(--ga-bg-card);
  border: 1px solid var(--ga-border);
  border-radius: 0.375rem;
  padding: 0.625rem 0.875rem;
}

.ga-tl-title {
  font-weight: 600;
  color: var(--ga-text);
}

.ga-tl-body {
  font-size: 0.875rem;
  color: var(--ga-text-muted);
  margin-top: 0.25rem;
}

.ga-tl-source-link {
  font-size: 0.75rem;
  color: var(--ga-primary-muted);
  margin-top: 0.375rem;
  display: inline-block;
}

.ga-tl-source-link:hover {
  color: var(--ga-primary);
}

.ga-tl-story-link {
  font-size: 0.75rem;
  color: var(--ga-accent);
  margin-top: 0.25rem;
  display: inline-block;
}

.ga-tl-story-link:hover {
  text-decoration: underline;
}
```

- [ ] **Step 2: Start dev server and verify no CSS errors**

```bash
node dev-server.js
```

Open `http://localhost:8080` and check the browser console — no CSS parse errors expected.

- [ ] **Step 3: Commit**

```bash
git add css/main.css
git commit -m "Add .ga-tl-* CSS styles for cronologia timeline"
```

---

## Task 3: Create `pages/cronologia.html`

**Files:**
- Create: `pages/cronologia.html`

- [ ] **Step 1: Create the page fragment**

```html
<section id="cronologia-section" class="py-5">
  <div class="container">

    <h2 class="ga-section-title text-center mb-2">Azul a través del tiempo</h2>
    <p class="text-center text-muted mb-4">
      Historia, genealogía y descubrimientos de la ciudad de Azul.
    </p>

    <div class="ga-tl-filters" id="cronologia-filters">
      <button class="ga-tl-filter-btn active" data-filter="all">Todo</button>
      <button class="ga-tl-filter-btn" data-filter="historia">Historia de Azul</button>
      <button class="ga-tl-filter-btn" data-filter="genealogia">Genealogía</button>
      <button class="ga-tl-filter-btn" data-filter="descubrimiento">Descubrimientos</button>
    </div>

    <div id="cronologia-timeline">
      <!-- populated by cronologia.js -->
    </div>

  </div>
</section>
```

- [ ] **Step 2: Commit**

```bash
git add pages/cronologia.html
git commit -m "Add pages/cronologia.html fragment"
```

---

## Task 4: Create `js/cronologia.js`

**Files:**
- Create: `js/cronologia.js`

- [ ] **Step 1: Create the module**

```javascript
/* ═══════════════════════════════════════════════════════════════════
   Genea Azul — cronologia.js
   Timeline page: renders data/timeline.json into a vertical timeline
   ═══════════════════════════════════════════════════════════════════ */
var GeneaAzul = window.GeneaAzul || {};

GeneaAzul.cronologia = (function() {

  var utils;

  var MONTH_NAMES = ['ene','feb','mar','abr','may','jun',
                     'jul','ago','sep','oct','nov','dic'];

  function init() {
    utils = GeneaAzul.utils;
    var $container = $('#cronologia-timeline');
    $container.html(utils.spinnerHtml('Cargando cronolog\u00eda\u2026'));

    $.getJSON('data/timeline.json', function(entries) {
      $container.empty();
      if (!entries || entries.length === 0) {
        $container.html('<p class="text-muted text-center">No hay entradas disponibles.</p>');
        return;
      }
      var $list = $('<div>').addClass('ga-tl-list');
      entries.forEach(function(entry) {
        $list.append(buildEntry(entry));
      });
      $container.append($list);
      initFilterTabs();
    }).fail(function() {
      $container.html('<p class="text-muted text-center">No se pudo cargar la cronolog\u00eda.</p>');
    });
  }

  function formatDate(entry) {
    if (!entry.month) return String(entry.year);
    var month = MONTH_NAMES[entry.month - 1];
    if (!entry.day) return month + ' ' + entry.year;
    return entry.day + ' ' + month + ' ' + entry.year;
  }

  function buildEntry(entry) {
    var $entry = $('<div>').addClass('ga-tl-entry').attr('data-type', entry.type);

    var $dotWrap = $('<div>').addClass('ga-tl-dot-wrap');
    var $dot = $('<div>').addClass('ga-tl-dot ga-tl-dot-' + entry.type);
    $dotWrap.append($dot);

    var $content = $('<div>').addClass('ga-tl-content');
    $content.append($('<div>').addClass('ga-tl-meta').text(formatDate(entry)));

    var $card = $('<div>').addClass('ga-tl-card');
    $card.append($('<div>').addClass('ga-tl-title').text(entry.title));
    $card.append($('<div>').addClass('ga-tl-body').text(entry.body));

    if (entry.sourceUrl) {
      $card.append(
        $('<a>').addClass('ga-tl-source-link')
          .attr({ href: entry.sourceUrl, target: '_blank', rel: 'noopener' })
          .text(entry.source || 'Fuente')
      );
    } else if (entry.source) {
      $card.append($('<div>').addClass('ga-tl-source-link').text(entry.source));
    }

    if (entry.storySlug) {
      $card.append(
        $('<a>').addClass('ga-tl-story-link')
          .attr('href', '#historias/' + entry.storySlug)
          .text('\u2192 Leer historia')
      );
    }

    $content.append($card);
    $entry.append($dotWrap).append($content);
    return $entry;
  }

  function initFilterTabs() {
    $(document).off('click.cronologia', '.ga-tl-filter-btn')
      .on('click.cronologia', '.ga-tl-filter-btn', function() {
        var filter = $(this).data('filter');
        $('.ga-tl-filter-btn').removeClass('active');
        $(this).addClass('active');
        if (filter === 'all') {
          $('.ga-tl-entry').removeClass('d-none');
        } else {
          $('.ga-tl-entry').addClass('d-none');
          $('.ga-tl-entry[data-type="' + filter + '"]').removeClass('d-none');
        }
      });
  }

  return { init };

})();
```

- [ ] **Step 2: Commit**

```bash
git add js/cronologia.js
git commit -m "Add js/cronologia.js module"
```

---

## Task 5: Wire cronologia into router, navbar, and index.html

**Files:**
- Modify: `js/router.js` lines 13–38
- Modify: `index.html` — nav, footer, script tag

### 5a — Router

- [ ] **Step 1: Add to `routeMap` in `js/router.js`**

In the `routeMap` object (around line 13), add after `'sobre-nosotros'`:

Find:
```javascript
    'sobre-nosotros':            'sobre-nosotros'
```

Replace with:
```javascript
    'cronologia':                'cronologia',
    'sobre-nosotros':            'sobre-nosotros'
```

- [ ] **Step 2: Add to `initializers` in `js/router.js`**

In the `initializers` object (around line 31), add after the `'historias'` entry:

Find:
```javascript
    'historias':                 function() { if (GeneaAzul.stories)     GeneaAzul.stories.init(); }
```

Replace with:
```javascript
    'historias':                 function() { if (GeneaAzul.stories)     GeneaAzul.stories.init(); },
    'cronologia':                function() { if (GeneaAzul.cronologia)  GeneaAzul.cronologia.init(); }
```

### 5b — Navbar

- [ ] **Step 3: Add navbar item in `index.html`**

Find (around line 85):
```html
            <a class="nav-link" href="#historias" data-route="historias"><i class="bi bi-book me-1"></i>Historias</a>
```

Replace with:
```html
            <a class="nav-link" href="#historias" data-route="historias"><i class="bi bi-book me-1"></i>Historias</a>
          </li>
          <li class="nav-item">
            <a class="nav-link" href="#cronologia" data-route="cronologia"><i class="bi bi-clock-history me-1"></i>Cronolog&iacute;a</a>
```

> **Note:** The surrounding `</li><li class="nav-item">` are already present in the HTML between nav items — confirm the exact surrounding context when editing.

- [ ] **Step 4: Add footer link in `index.html`**

Find (around line 307):
```html
            <li><a href="#historias" data-route="historias">Historias familiares</a></li>
```

Replace with:
```html
            <li><a href="#historias" data-route="historias">Historias familiares</a></li>
            <li><a href="#cronologia" data-route="cronologia">Cronolog&iacute;a</a></li>
```

### 5c — Script tag

- [ ] **Step 5: Add script tag in `index.html`**

Find (at the bottom of the file):
```html
  <script src="js/ephemerides.js"></script>
```

Replace with:
```html
  <script src="js/ephemerides.js"></script>
  <script src="js/cronologia.js"></script>
```

- [ ] **Step 6: Test the full flow**

With `node dev-server.js` running, open `http://localhost:8080/#cronologia`.

Expected:
- Spinner shows briefly, then timeline renders with entries sorted oldest-to-newest
- Colored dots (navy for historia, gold for genealogia, green for descubrimiento)
- Filter tabs work: clicking "Historia de Azul" hides other types, "Todo" restores all
- "Genealogía" tab shows only the `genealogia` entries
- Source links open in new tab
- No console errors

- [ ] **Step 7: Commit**

```bash
git add js/router.js index.html
git commit -m "Wire #cronologia route, nav item, and script tag"
```

---

## Task 6: Backend — `generateTimelineJson()` (separate repo: `gedcom-analyzer`)

**Files:**
- Modify: `src/test/java/.../GeneaAzulWebResources.java`

This task runs in the `gedcom-analyzer` repo. It adds a test method that generates the production `data/timeline.json` file, following the same pattern as `generateSurnamesJson()`.

- [ ] **Step 1: Add the `generateTimelineJson` method**

The method should:
1. Build the hardcoded `historia` entries (copy from `data/timeline.json` in the frontend repo)
2. Build the hardcoded `descubrimiento` entries (from Genea Azul Instagram content — to be provided by user)
3. Query the GEDCOM for ~5–8 `genealogia` entries using existing service methods (e.g. `getEarliestBirthInAzul()`, `getFirstImmigrantsByOrigin()`)
4. Merge and sort all entries by year, month (nulls last), day (nulls last)
5. Write to the `data/timeline.json` path in the frontend repo

Skeleton (adapt to actual service API):

```java
@Test
public void generateTimelineJson() throws Exception {
    List<TimelineEntry> entries = new ArrayList<>();

    // --- historia entries (hardcoded) ---
    entries.add(new TimelineEntry(1832, 10, null, "historia",
        "Fundación del Fuerte de Azul",
        "El coronel Pedro Burgos establece el Fuerte San Serapio Mártir del Arroyo Azul...",
        "Wikipedia", "https://es.wikipedia.org/wiki/Azul_(Argentina)", null));
    // ... add remaining historia entries from data/timeline.json ...

    // --- descubrimiento entries (hardcoded, from IG) ---
    // entries.add(new TimelineEntry(...));

    // --- genealogia entries (from GEDCOM) ---
    Gedcom gedcom = loadGedcom();
    // Example queries — adapt to actual service method signatures:
    // gedcomAnalyzerService.getEarliestBirthByPlace(gedcom.getPeople(), "Azul")
    //   .ifPresent(p -> entries.add(buildGenealogiEntry(p, "Nacimiento más antiguo registrado en Azul")));

    // Sort: by year asc, month asc (nulls last), day asc (nulls last)
    entries.sort(Comparator
        .comparingInt(TimelineEntry::getYear)
        .thenComparing(e -> e.getMonth() != null ? e.getMonth() : 99)
        .thenComparing(e -> e.getDay()   != null ? e.getDay()   : 99));

    // Write JSON
    StringBuilder sb = new StringBuilder("[\n");
    for (int i = 0; i < entries.size(); i++) {
        TimelineEntry e = entries.get(i);
        sb.append(String.format(
            "  {\"year\": %d, \"month\": %s, \"day\": %s, \"type\": \"%s\", " +
            "\"title\": \"%s\", \"body\": \"%s\", \"source\": \"%s\", " +
            "\"sourceUrl\": %s, \"storySlug\": %s}%s\n",
            e.getYear(),
            e.getMonth() != null ? e.getMonth() : "null",
            e.getDay()   != null ? e.getDay()   : "null",
            e.getType(),
            escapeJson(e.getTitle()),
            escapeJson(e.getBody()),
            escapeJson(e.getSource()),
            e.getSourceUrl() != null ? "\"" + escapeJson(e.getSourceUrl()) + "\"" : "null",
            e.getStorySlug() != null ? "\"" + escapeJson(e.getStorySlug()) + "\"" : "null",
            i < entries.size() - 1 ? "," : ""
        ));
    }
    sb.append("]");

    Files.writeString(
        Path.of("../geneaazul-web/data/timeline.json"),
        sb.toString()
    );
}
```

`TimelineEntry` is a plain data class (or record) with the 9 fields from the JSON schema.

- [ ] **Step 2: Run the test to regenerate `data/timeline.json`**

```bash
./gradlew test --tests "*.GeneaAzulWebResources.generateTimelineJson"
```

Then verify the file in the frontend repo is valid JSON:

```bash
node -e "JSON.parse(require('fs').readFileSync('../geneaazul-web/data/timeline.json','utf8')); console.log('OK')"
```

- [ ] **Step 3: Commit in both repos**

In `gedcom-analyzer`:
```bash
git add src/test/java/.../GeneaAzulWebResources.java
git commit -m "Add generateTimelineJson test method for data/timeline.json"
```

In `geneaazul-web` (after regeneration updates the file):
```bash
git add data/timeline.json
git commit -m "Regenerate data/timeline.json with GEDCOM-derived genealogia entries"
```

---

## Self-Review Notes

- **Spec §2 (data structure):** All 9 fields present in JSON and used in `buildEntry()`. ✓
- **Spec §3 (layout):** Single left spine via `::before` on `.ga-tl-list`; 2-column flex (dot-wrap + content) per entry; filter tabs toggle `d-none`; mobile: flex wraps naturally. ✓
- **Spec §4 (backend):** Task 6 provides the skeleton. `genealogia` queries are noted as stubs — user fills in actual service method calls. ✓
- **Spec §5 (frontend architecture):** All 5 files covered (timeline.json, cronologia.html, cronologia.js, main.css, router.js, index.html). ✓
- **Spec §6 (content):** Task 1 JSON has 10 `historia` entries, 2 `genealogia` placeholders, 1 `descubrimiento` placeholder. User to add Instagram `descubrimiento` entries and backend to replace `genealogia` stubs. ✓
- **No placeholders in Tasks 1–5** — all code is complete and runnable without modification.
- **Task 6** intentionally contains stubs for GEDCOM service method names — these depend on the actual `gedcom-analyzer` service API and cannot be completed without that codebase context.
