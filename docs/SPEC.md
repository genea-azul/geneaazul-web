# Genea Azul — New Landing Page: Design Specification

## 1. Project Overview

**Genea Azul** is a non-profit community genealogy research project focused on the city of Azul (Buenos Aires, Argentina). It maintains a family tree of 70,000+ persons spanning 50 countries of origin, with tools to search for people, discover family connections, and explore immigration history.

This spec defines a **complete redesign** of the public-facing website at `geneaazul.com.ar`. The current site is a single 8,000-line monolithic HTML file with all CSS/JS inline. The new site will be a modern, fast, SPA-like static site with lazy-loaded pages, better UX, and new content sections.

### 1.1 Goals

- **Hero feature is search**: The person search tool must be the most prominent element on the site
- **Better first impression**: A proper landing page that explains what Genea Azul is before dumping users into a form
- **Progressive disclosure**: Two-step search wizard instead of overwhelming 8-card form
- **Lazy loading**: Only load page content when the user navigates to it
- **New content sections**: About, testimonials, immigration map, family stories, contribute
- **Two visual themes**: Heritage (warm) and Modern (clean) for the owner to compare and pick
- **Easy to maintain**: Markdown-based stories, simple JSON/HTML content

### 1.2 Language

The entire site is in **Spanish** (Argentine Spanish). All UI text, labels, error messages, placeholders, etc. must be in Spanish. Use Argentine conventions:
- "vos" form (e.g., "Buscá", "Descubrí", "Completá") — NOT "tú" form
- "Apellido" not "Apellidos"
- Date format: DD/MM/YYYY
- Number format: 70.512 (dot for thousands, comma for decimals)

### 1.3 Constraints

- **Static hosting**: Deployed to Cloudflare Pages (no server-side rendering)
- **No build step**: Plain HTML/CSS/JS — no bundlers, no transpilers, no npm
- **Backend API**: Calls `https://gedcom-analyzer-app.fly.dev` (Spring Boot on Fly.io)
- **CDN libraries only**: jQuery, Bootstrap, marked.js, etc. loaded from CDN
- **Lightweight**: Total initial page load should be under 200KB (excluding images)

---

## 2. Architecture

### 2.1 SPA Routing

Hash-based client-side routing. The `index.html` is the shell (navbar + hero + footer + router logic). Page content is loaded on demand from HTML fragment files in `pages/`.

**Routes:**

| Hash | Page | Loaded from |
|------|------|-------------|
| `#inicio` (default) | Hero / Landing | Inline in `index.html` |
| `#buscar` | Person Search (two-step wizard) | `pages/buscar.html` |
| `#conexiones` | Connections between people | `pages/conexiones.html` |
| `#estadisticas` | Stats highlights | `pages/estadisticas.html` |
| `#estadisticas/inmigracion` | Full immigration ranking | `pages/estadisticas-inmigracion.html` |
| `#estadisticas/personalidades` | Full notable people list | `pages/estadisticas-personalidades.html` |
| `#estadisticas/apellidos` | Full surnames list | `pages/estadisticas-apellidos.html` |
| `#mapa` | Interactive immigration map | `pages/mapa.html` |
| `#historias` | Family Stories listing | `pages/historias.html` |
| `#historias/{slug}` | Individual story detail | Rendered from `stories/{slug}.md` |
| `#testimonios` | Testimonials | `pages/testimonios.html` |
| `#colabora` | Contribute / call to action | `pages/colabora.html` |
| `#sobre-nosotros` | About us | `pages/sobre-nosotros.html` |

### 2.2 Lazy Loading Strategy

```
User clicks nav link or CTA
  → router.js catches hashchange event
  → Checks if page content is already in DOM cache
  → If not: fetch('pages/{page}.html') → inject into #page-content container
  → Run any page-specific JS initializer (e.g., search.js init, map.js init)
  → Scroll to top of content area
```

Each page fragment is a plain HTML snippet (no `<html>`, `<head>`, `<body>` tags). It may include a `<script>` tag at the bottom for page-specific initialization, but preferably JS is in separate files and initialized by the router.

### 2.3 Page-Specific JS Initialization

The router maintains a registry of page initializers:

```javascript
var pageInitializers = {
    'buscar': function() { SearchModule.init(); },
    'conexiones': function() { ConnectionsModule.init(); },
    'estadisticas': function() { StatsModule.init(); },
    'mapa': function() { MapModule.init(); },
    'historias': function() { StoriesModule.init(); }
};
```

Initializers are called after the HTML fragment is injected into the DOM. They bind event handlers, fetch API data, etc.

### 2.4 File Structure

```
geneaazul-web/
├── index.html                          # App shell: navbar, hero, #page-content, footer, router
├── css/
│   ├── main.css                        # Shared layout, components, animations
│   ├── theme-heritage.css              # Warm/earthy theme: browns, parchment, serif fonts
│   └── theme-modern.css                # Clean/crisp theme: blues, whites, sans-serif
├── js/
│   ├── router.js                       # Hash routing + lazy loading + page init registry
│   ├── config.js                       # API base URL, feature flags, constants
│   ├── search.js                       # Two-step search wizard logic
│   ├── connections.js                  # Connections feature logic
│   ├── stats.js                        # Stat counters animation, highlights
│   ├── map.js                          # SVG immigration map interactivity
│   ├── stories.js                      # Markdown loading + rendering
│   ├── i18n.js                         # Spanish display helpers (dates, relationships, errors)
│   └── utils.js                        # Shared helpers (trimToNull, isEmpty, API calls)
├── pages/                              # HTML fragments loaded on demand
│   ├── buscar.html
│   ├── conexiones.html
│   ├── estadisticas.html
│   ├── estadisticas-inmigracion.html
│   ├── estadisticas-personalidades.html
│   ├── estadisticas-apellidos.html
│   ├── mapa.html
│   ├── historias.html
│   ├── testimonios.html
│   ├── colabora.html
│   └── sobre-nosotros.html
├── stories/                            # Markdown story files
│   ├── index.json                      # Story metadata: [{slug, title, date, excerpt, author}]
│   └── origen-apellido-valicenti.md    # Example story
├── data/
│   ├── immigration.json                # Static data: [{country, flag, count, percentage, topSurnames}]
│   ├── personalities.json              # Static data: [{name, title, birthYear, deathYear, birthPlace, ...}]
│   └── surnames.json                   # Static data: [{surname, variants}]
├── img/
│   ├── genea-azul-logo.png             # Existing logo (copy from current project)
│   ├── genea-azul-logo-simple.png      # Small logo variant
│   └── world-map.svg                   # SVG world map for immigration map
├── _redirects                          # Cloudflare Pages: /* /index.html 200
├── docs/
│   ├── SPEC.md                         # This file
│   └── API-REFERENCE.md               # Full backend API documentation
└── README.md                           # Setup, development, deployment instructions
```

---

## 3. Visual Design

### 3.1 Two Theme Variants

Both themes share the same HTML structure and layout. Only colors, fonts, and subtle decorative elements differ. A CSS class on `<body>` toggles between them: `theme-heritage` or `theme-modern`. A small toggle button in the footer or navbar lets the owner switch for comparison purposes (can be removed in production).

#### Theme A: Heritage (Warm)

- **Primary color**: Deep navy blue `#1a365d`
- **Accent color**: Warm gold `#c9a227`
- **Background**: Off-white/parchment `#faf8f0`
- **Card backgrounds**: White `#ffffff` with subtle warm shadow
- **Text**: Dark charcoal `#2d2d2d`
- **Secondary text**: Warm gray `#6b5b4f`
- **Headings font**: `'Playfair Display', Georgia, serif` (from Google Fonts)
- **Body font**: `'Source Sans 3', 'Segoe UI', sans-serif` (from Google Fonts)
- **Decorative**: Subtle paper-like texture on hero background (CSS only, no images)
- **Cards**: Soft rounded corners (8px), warm shadows
- **Buttons**: Solid with slight gradient, rounded

#### Theme B: Modern (Clean)

- **Primary color**: Bright blue `#2563eb`
- **Accent color**: Teal `#0d9488`
- **Background**: Pure white `#ffffff`
- **Card backgrounds**: Light gray `#f8fafc` with crisp shadow
- **Text**: Near black `#1e293b`
- **Secondary text**: Slate `#64748b`
- **Headings font**: `'Inter', 'Segoe UI', system-ui, sans-serif` (from Google Fonts)
- **Body font**: `'Inter', 'Segoe UI', system-ui, sans-serif`
- **Decorative**: Subtle gradient backgrounds, clean lines
- **Cards**: Rounded corners (12px), crisp elevation shadows
- **Buttons**: Solid or outline, pill-shaped (high border-radius)

### 3.2 Responsive Design

- **Mobile first**: All layouts start mobile, expand for larger screens
- **Breakpoints**: Bootstrap 5 defaults (576px sm, 768px md, 992px lg, 1200px xl)
- **Navbar**: Collapses to hamburger on mobile
- **Search forms**: Stack vertically on mobile, horizontal cards on desktop
- **Stats counters**: 2-column grid on mobile, 4-column on desktop
- **Immigration map**: Full-width, scrollable horizontally on very small screens

### 3.3 Animations & Micro-interactions

- **Stat counters**: Animate from 0 to final value when scrolled into view (count-up animation)
- **Page transitions**: Fade-in when lazy-loaded content appears (CSS transition, ~200ms)
- **Cards**: Subtle lift on hover (transform + shadow change)
- **Search wizard step transition**: Slide/fade between Step 1 and Step 2
- **Navbar active state**: Smooth underline indicator
- **Loading states**: Skeleton placeholders or spinner while fetching API data

---

## 4. Page-by-Page Specification

### 4.1 Navbar (Sticky, always visible)

```
┌─────────────────────────────────────────────────────────────┐
│ [Logo]   Inicio  Buscar  Conexiones  Estadísticas  ...  [Social Icons] │
└─────────────────────────────────────────────────────────────┘
```

- **Logo**: Links to `#inicio`. Use `genea-azul-logo.png` (120x60 on desktop, 70x70 on mobile)
- **Nav links**: Inicio, Buscar, Conexiones, Estadísticas, Historias, Sobre Nosotros
- **Active state**: Highlighted/underlined link for current route
- **Social icons** (right side, hidden on mobile in hamburger): Instagram, Facebook, Email
- **Social links**:
  - Instagram: `https://instagram.com/_u/genea.azul`
  - Facebook: `https://facebook.com/genea.azul`
  - Email: `mailto:genea.azul@gmail.com`
- **Mobile**: Hamburger menu with off-canvas or dropdown

### 4.2 Hero Section (`#inicio`) — Inline in index.html

The hero is always loaded (not lazy). It's the first thing visitors see.

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│              [Genea Azul Logo - large]                  │
│                                                         │
│         Descubrí tu historia familiar                   │
│                                                         │
│   Una iniciativa comunitaria sin fines de lucro         │
│   dedicada a investigar, documentar y preservar         │
│   la genealogía del partido de Azul.                    │
│                                                         │
│          [ Buscar mi familia ]  (CTA button)            │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐  │
│  │  70.000+ │  │    50    │  │  4.500+  │  │  7.000+ │  │
│  │ Personas │  │  Países  │  │Apellidos │  │Inmigran.│  │
│  └──────────┘  └──────────┘  └──────────┘  └────────┘  │
│                                                         │
│   [Scroll indicator / down arrow]                       │
└─────────────────────────────────────────────────────────┘
```

**Stat counters**: Animated count-up when page loads. Values are hardcoded initially but could be fetched from `/api/gedcom-analyzer/metadata` (personsCount). Display with Argentine number formatting (dots for thousands).

**Below the hero** (still in #inicio, visible on scroll):

1. **"Cómo funciona" mini-section** — 3 columns:
   - Step 1: Icon + "Buscá tu apellido" + short description
   - Step 2: Icon + "Descubrí tu familia" + short description
   - Step 3: Icon + "Conectá con parientes" + short description

2. **Quick stat highlights** — A visually appealing card/banner showing:
   - "Ranking de inmigración: Italia 56%, España 19%, Francia 16%..." with flag emojis
   - "Personalidades destacadas: Soy Rada, Federico Delbonis, Luli Fernández..." (3-4 examples)
   - Each with a "Ver más →" link to the respective detail page

3. **Call to action**: "¿Tenés raíces azuleñas? Buscá a tu familia" → links to `#buscar`

### 4.3 Person Search — Two-Step Wizard (`#buscar`)

**Step 1: Quick Search**

```
┌─────────────────────────────────────────────────┐
│           Buscador de personas                  │
│    Personas en el árbol: [70.512] (from API)    │
│                                                 │
│  ┌─────────────────────────────────────────┐    │
│  │  Persona principal                      │    │
│  │  [Nombre        ] [Apellido          ]  │    │
│  │  [Año nacimiento] [Lugar nacimiento  ]  │    │
│  │  ☑ Vive  [Año fallecimiento (disabled)] │    │
│  └─────────────────────────────────────────┘    │
│                                                 │
│     [ Buscar ]   [ Búsqueda avanzada ↓ ]        │
│                                                 │
│  ┌─────────────────────────────────────────┐    │
│  │  Resultado de la búsqueda               │    │
│  │  (shows results or "sin resultados")    │    │
│  └─────────────────────────────────────────┘    │
└─────────────────────────────────────────────────┘
```

- Only the main person card visible initially
- "Buscar" button triggers API call with just the individual data
- Results shown below

**Step 2: Advanced Search (expanded on click or if Step 1 has ambiguous results)**

When user clicks "Búsqueda avanzada" or when results suggest refinement is needed:

```
┌─────────────────────────────────────────────────────────────┐
│  [Persona principal]  [Pareja]   [Padre]    [Madre]         │
│                                                             │
│  ☐ Agregar información de abuelos/as                        │
│  [Abuelo pat.] [Abuela pat.] [Abuelo mat.] [Abuela mat.]   │
│                                                             │
│  [Email/Whatsapp/Instagram]     [ Buscar ]                  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Resultado de la búsqueda                             │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

This expanded view mirrors the current form's full capability (spouse, father, mother, grandparents) but is revealed progressively.

**Person card fields** (each card has the same fields):

| Field | HTML | Validation |
|-------|------|------------|
| Nombre | `<input type="text" maxlength="60">` | Optional |
| Apellido | `<input type="text" maxlength="60">` | Optional |
| Sexo | Radio: Mujer / Hombre | Optional, hidden by default, auto-set for parents |
| Año de nacimiento | `<input type="number" min="1400" max="2050">` | Optional |
| Lugar de nacimiento | `<input type="text" maxlength="80">` | Optional |
| Vive | `<input type="checkbox" checked>` | Default: checked |
| Año de fallecimiento | `<input type="number" min="1400" max="2050" disabled>` | Enabled when "Vive" unchecked |

**Sex-based card coloring** (from current site — preserve this behavior):
- Male cards: `border-secondary` / `text-bg-secondary` header
- Female cards: `border-danger` / `text-bg-danger` header
- Default (no sex selected): `border-dark` / `text-bg-dark` header
- Individual and Spouse cards are linked: selecting sex on one sets the opposite on the other

**Contact field**: Below the cards, a text input for "Email, Whatsapp o Instagram" with explanatory text: "Dejanos tu email, Whatsapp o Instagram y nos pondremos en contacto en caso de encontrar personas relacionadas a tu búsqueda en un futuro."

**Search button behavior**:
1. Validate at least one field is filled
2. Show loading spinner on button
3. POST to `/api/search/family` (see API Reference)
4. Display results in result card

**Result display**: Each person result shows:
- Name (with obfuscation: `<private>` → `<nombre privado>`)
- Date/place of birth and death
- Parents (with referenceType label), spouses, children
- Ancestry countries (flags)
- Number of persons in tree branch, number of surnames
- Ancestry generations (ascending/descending)
- Max distant relationship info (complex Spanish relationship name)
- Distinguished persons in their tree (with profile picture if available)
- **"Descargar listado de familiares (PDF)"** button — opens PDF in new tab via `/api/search/family-tree/{uuid}/plainPdf`
- **"Ver árbol genealógico online"** button — opens Pyvis network visualization in new tab via `/family-tree/{uuid}`
- **"Buscar conexión con esta persona"** button (links to `#conexiones` with prefilled data)

**Family tree button delay**: Both the PDF and network viewer buttons start disabled and are enabled after a calculated delay. The backend generates family tree files asynchronously after a search. The delay formula is:
```
timeout = (personsCountInTree / familyTreeProcessPersonsBySec * 1000) + familyTreeProcessFixedDelayMillis
```
Only show the wait countdown if `timeout > minMillisToDisplayWaitCountDown`. See `config.js` for the constants.

**Obfuscation notice**: "Los datos de personas vivas serán ocultados" — shown unless `disableObfuscateLiving` is true from the API health check, or URL param `?f=0` is present.

**Error handling**:
- `TOO-MANY-REQUESTS`: "Realizaste demasiadas consultas en la última hora..."
- Server 500: "El servidor se está reiniciando, intentá de nuevo."
- Server down (status 0): "El servidor está caído, intentá de nuevo."

### 4.4 Connections (`#conexiones`)

```
┌────────────────────────────────────────────────────┐
│         Conexiones entre personas                  │
│  Se visualiza cómo están relacionadas dos          │
│  personas en el árbol                              │
│                                                    │
│  ┌─────────────┐    ┌─────────────┐                │
│  │  Persona 1  │    │  Persona 2  │                │
│  │  [Nombre  ] │    │  [Nombre  ] │    [ Buscar ]  │
│  │  [Apellido] │    │  [Apellido] │                │
│  │  [Año nac.] │    │  [Año nac.] │                │
│  └─────────────┘    └─────────────┘                │
│                                                    │
│  ┌──────────────────────────────────────────────┐  │
│  │  Resultado de conexiones                     │  │
│  │  Persona1 → relación → Persona2             │  │
│  │  (chain of connections)                      │  │
│  └──────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────┘
```

- POST to `/api/search/connection`
- Result is a list of `ConnectionDto` objects forming a chain
- Display: `Persona1 [relación] Persona2 [relación] ... PersonaN`
- Each connection shows: relationship name (in Spanish), person name, person data

**Error codes** (displayed in Spanish):
- `CONNECTIONS-PERSON-1-NOT-FOUND` / `CONNECTIONS-PERSON-2-NOT-FOUND`: Person not found
- `CONNECTIONS-PERSON-1-AMBIGUOUS` / `CONNECTIONS-PERSON-2-AMBIGUOUS`: More than one result
- `CONNECTIONS-SAME-PERSON`: Same person entered for both
- `TOO-MANY-REQUESTS`: Rate limited

### 4.5 Statistics Highlights (`#estadisticas`)

A curated overview page with visual highlights. NOT the full data dumps.

**Section 1: Key Numbers** (grid of stat cards)
- Personas en el árbol: 70.512
- Hombres: 35.513 (50,36%)
- Mujeres: 34.999 (49,64%)
- Fallecidas: 49.463 (70,15%)
- Vivas: 21.049 (29,85%)
- Nacidos/as en Azul: 26.331
- Azuleños/as: 40.576
- Azuleños/as vivos/as: 14.590
- Jefes comunales de Azul: 48
- Personas desaparecidas: 26
- Personalidades destacadas: 255 (245 listed in detail + others referenced)
- Cantidad de países: 50
- Cantidad de inmigrantes: 7.041
- Apellidos azuleños: 4.557

**Section 2: Top Immigration Countries** (top 10 with flag emojis and bar chart visualization)
Show top 10 from the full list, with a "Ver ranking completo →" link to `#estadisticas/inmigracion`

**Section 3: Featured Notable People** (card grid, ~10 people)
Show a selection of the most recognizable names, with "Ver todas las personalidades →" link to `#estadisticas/personalidades`

**Section 4: Surnames Preview**
Show top 50 surnames in a flowing tag cloud or column layout, with "Ver todos los apellidos →" link to `#estadisticas/apellidos`

**Data source**: The stats data is static (updated manually when the tree is updated). Store in `data/immigration.json`, `data/personalities.json`, `data/surnames.json`. These JSON files are loaded when the user navigates to the stats page.

### 4.6 Stats Detail Pages

Three separate lazy-loaded pages for full data:

**`#estadisticas/inmigracion`** — Full immigration ranking
- 44 countries ordered by immigrant count
- Each entry: flag emoji, country name, count, percentage, top surnames on hover/expand
- Consider a searchable/filterable list

**`#estadisticas/personalidades`** — Full notable people list
- 245+ entries
- Each: title/rank prefix, full name, nickname (if any), birth year, death year, birth/death places
- Searchable by name

**`#estadisticas/apellidos`** — Full surnames list
- 4,557+ entries
- Each: primary surname, variants in parentheses
- Searchable by surname
- Consider alphabetical jump links (A, B, C, ...)

### 4.7 Interactive Immigration Map (`#mapa`)

An SVG-based world map showing countries of immigrant origin.

**Implementation approach**:
- Use a simplified SVG world map (public domain) with country paths identified by ISO codes
- Color countries based on immigrant count (heat map: darker = more immigrants)
- On hover: tooltip showing country name, flag, count, percentage, top 5 surnames
- On click: highlight country, show detail panel below map
- Countries with zero immigrants: neutral/gray
- Color scale: light blue (1-10) → medium blue (11-50) → deep blue (51-200) → dark navy (200+) → gold for Italy (3,989)

**Data source**: `data/immigration.json` (same file used by stats page)

**Mobile**: Map should be zoomable/pannable, or show a simplified list view on very small screens with a "Ver mapa" toggle.

### 4.8 Family Stories (`#historias`)

A blog-like section where family history stories are published.

**Listing page** (`#historias`):

```
┌────────────────────────────────────────────┐
│          Historias Familiares               │
│  Relatos sobre el origen y la historia     │
│  de las familias azuleñas                  │
│                                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │ [image]  │  │ [image]  │  │ [image]  │ │
│  │ Title    │  │ Title    │  │ Title    │ │
│  │ Date     │  │ Date     │  │ Date     │ │
│  │ Excerpt  │  │ Excerpt  │  │ Excerpt  │ │
│  │ Leer más │  │ Leer más │  │ Leer más │ │
│  └──────────┘  └──────────┘  └──────────┘ │
└────────────────────────────────────────────┘
```

**Story detail** (`#historias/{slug}`):
- Fetch `stories/{slug}.md`
- Parse with marked.js (CDN)
- Render into a styled article container
- Back link to `#historias`

**Story metadata** (`stories/index.json`):

```json
[
  {
    "slug": "origen-apellido-valicenti",
    "title": "El origen del apellido Valicenti",
    "date": "2026-04-14",
    "author": "Genea Azul",
    "excerpt": "La historia de los Valicenti, desde Calabria hasta Azul...",
    "image": "img/stories/valicenti.jpg"
  }
]
```

**Markdown format** for stories: Standard markdown. The first `# Heading` is the title. Support for images, links, blockquotes, etc.

### 4.9 Testimonials (`#testimonios`)

```
┌────────────────────────────────────────────────────────┐
│           Lo que dicen las familias                    │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │  "Gracias a Genea Azul descubrí que mi bisabuelo │  │
│  │   llegó desde Calabria en 1890..."               │  │
│  │                          — María G., Azul        │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │  "No sabía que estaba emparentado con..."        │  │
│  │                          — Juan P., Buenos Aires │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

- Hardcoded in the HTML fragment for simplicity
- Quote cards with name/location attribution
- Can be a carousel on mobile, grid on desktop
- Placeholder testimonials initially (owner will add real ones)

### 4.10 Contribute / Call to Action (`#colabora`)

```
┌──────────────────────────────────────────────────────┐
│              Colaborá con Genea Azul                  │
│                                                      │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐     │
│  │ 📋         │  │ 🌳         │  │ 🤝         │     │
│  │ Compartí   │  │ Accedé al  │  │ Sumate     │     │
│  │ tus datos  │  │ árbol en   │  │ como       │     │
│  │ familiares │  │ MyHeritage │  │ voluntario │     │
│  │            │  │            │  │            │     │
│  │ Envianos   │  │ Solicitá   │  │ Ayudanos a │     │
│  │ nombres,   │  │ acceso al  │  │ investigar │     │
│  │ fechas...  │  │ árbol      │  │ y cargar   │     │
│  └────────────┘  └────────────┘  └────────────┘     │
│                                                      │
│  Contactanos:                                        │
│  📷 @genea.azul  📘 genea.azul  ✉️ genea.azul@gmail │
└──────────────────────────────────────────────────────┘
```

Three action cards explaining how to help:
1. **Share family data**: Send names, dates, places to complete the tree
2. **Access the tree on MyHeritage**: Request access to view/edit
3. **Volunteer**: Help with research, data entry, historical sources

Each card links to the appropriate contact method (Instagram DM, email).

### 4.11 About Us (`#sobre-nosotros`)

```
┌───────────────────────────────────────────────────┐
│            Sobre Genea Azul                       │
│          «mi pasatiempo»                          │
│                                                   │
│  [Full project history narrative — see below]     │
│                                                   │
│  Contacto: ...                                    │
└───────────────────────────────────────────────────┘
```

- Static content, hardcoded in HTML
- **The existing site has a complete "La historia de Genea Azul" narrative** in the "Historia" tab (`#history-tab`). This content MUST be ported to this section. It covers:
  - How it started in 2014 with a small family tree
  - The trip to Italy and the connection with Leonardo De Luca
  - Growth through FamilySearch, Geneanet, Portale Antenati, Filae
  - DNA testing in 2020
  - Named "Genea Azul" in February 2022 with ~15,000 persons
  - Declared "Interés Comunitario, Histórico y Cultural" by Concejo Deliberante de Azul in November 2024
  - Over 62,000 persons by 2025
- The narrative is in the current `index.ftlh` at the `#history-tab` section (lines ~6413-6444). Port the text (converting HTML entities to UTF-8) and style it as a readable article.

### 4.12 Familias Azuleñas (Intentionally Deferred)

The current site has a "Familias" tab (`#families-tab`) with detailed tables for specific families (Andrich, Cachenaut, etc.), each showing individual records with birth/death dates, places, spouses, and parents — with links to FamilySearch profiles.

**This section is intentionally NOT included in the initial redesign.** Reasons:
- The data is manually curated (not from an API) and hard to maintain
- The search feature provides better discovery for individual families
- The content may be revisited later as a "Familias destacadas" feature or as part of the family stories section

If the owner wants this content preserved, it can be added as a separate page (`#familias`) in a future iteration.

### 4.13 Footer

```
┌─────────────────────────────────────────────────────┐
│  [Logo small]                                       │
│  Genea Azul — Estudio de genealogía azuleña         │
│                                                     │
│  Declarado de Interés Comunitario, Histórico y      │
│  Cultural por el Concejo Deliberante de Azul.       │
│                                                     │
│  ¡Solicitá acceso al árbol y cargá info!            │
│                                                     │
│  Navegación: Inicio | Buscar | Conexiones | ...     │
│                                                     │
│  📷 Instagram  📘 Facebook  ✉️ Email                │
│                                                     │
│  Hecho con amor en Azul, Buenos Aires               │
│  © 2024-2026 Genea Azul. Todos los derechos res.    │
│                                                     │
│  [Theme toggle: Heritage / Modern] (dev only)       │
└─────────────────────────────────────────────────────┘
```

---

## 5. Backend API Integration

See `docs/API-REFERENCE.md` for the complete API documentation.

### 5.1 API Base URL

```javascript
// In js/config.js
var API_BASE_URL = (window.location.hostname === 'localhost')
    ? window.location.origin
    : 'https://gedcom-analyzer-app.fly.dev';
```

### 5.2 CORS

The backend allows CORS from `geneaazul.com.ar` and subdomains. The current `@CrossOrigin` annotation on the backend allows:
- `http://geneaazul.com.ar:[*]`
- `https://geneaazul.com.ar:[*]`
- `http://*.geneaazul.com.ar:[*]`
- `https://*.geneaazul.com.ar:[*]`

**Important**: If the new site is deployed to a different domain (e.g., `geneaazul.pages.dev`) during development, the backend CORS configuration will need updating. For production, `geneaazul.com.ar` will work.

### 5.3 Startup Flow

When the page loads:
1. Call `GET {API_BASE_URL}/api/gedcom-analyzer` (health check)
   - On success: Site is operational, enable search features
   - Response includes `disableObfuscateLiving` flag
   - On error (timeout 10s): Show error message with contact info
2. Call `GET {API_BASE_URL}/api/gedcom-analyzer/metadata`
   - Returns `{ personsCount: 70512, modifiedDateTime: "..." }`
   - Use `personsCount` for the hero counter and search page

---

## 6. CDN Dependencies

All loaded from CDN (no local copies, no npm):

| Library | Version | CDN URL | Purpose |
|---------|---------|---------|---------|
| Bootstrap CSS | 5.3.3 | `cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css` | Layout, components |
| Bootstrap JS | 5.3.3 | `cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js` | Dropdowns, modals, collapse |
| Bootstrap Icons | 1.11.3 | `cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css` | Icons |
| jQuery | 3.7.1 | `cdn.jsdelivr.net/npm/jquery@3.7.1/dist/jquery.min.js` | DOM manipulation, AJAX |
| marked.js | 15.x | `cdn.jsdelivr.net/npm/marked/marked.min.js` | Markdown rendering |
| Google Fonts | — | `fonts.googleapis.com` | Playfair Display, Source Sans 3, Inter |

---

## 7. Data Files

### 7.1 `data/immigration.json`

```json
[
  {
    "country": "Italia",
    "flag": "🇮🇹",
    "isoCode": "IT",
    "count": 3989,
    "percentage": 56.65,
    "topSurnames": ["Valicenti", "Scavuzzo", "Cirigliano", "Vitale", "Ciancio", "Fittipaldi", "Zaffora", "Nasello", "Vazzano", "Bongiorno"]
  },
  {
    "country": "España",
    "flag": "🇪🇸",
    "isoCode": "ES",
    "count": 1330,
    "percentage": 18.89,
    "topSurnames": ["Rodríguez", "García", "Pérez", "González", "Martínez", "Fernández", "Álvarez", "Villanueva", "Zubiri", "López"]
  }
]
```

This file is **already complete** in `data/immigration.json` — 38 entries covering 44 individual countries (some entries combine related countries, e.g., "Alemania / Rusia", "Siria / Líbano", "Croacia / Eslovenia / Serbia").

### 7.2 `data/personalities.json`

```json
[
  {
    "name": "Pablo Acosta",
    "title": null,
    "nickname": null,
    "birthYear": "aprox. 1802",
    "deathYear": "1840",
    "birthPlace": "San Nicolás de los Arroyos",
    "deathPlace": "Bahía Blanca"
  }
]
```

**SAMPLE ONLY** — 15 entries provided. Full data (245 entries) must be extracted from the existing `index.ftlh` (accordion section `flush-collapseTwo`). See `data/README.md` for extraction instructions.

### 7.3 `data/surnames.json`

```json
[
  { "surname": "Rodríguez", "variants": ["Rodrigues"] },
  { "surname": "García", "variants": [] },
  { "surname": "López", "variants": [] },
  { "surname": "Vazzano", "variants": ["Bassano", "Bazzano"] }
]
```

**SAMPLE ONLY** — 25 entries provided. Full data (4,557+ entries) must be extracted from the existing `index.ftlh` (accordion section `flush-collapseThree`). See `data/README.md` for extraction instructions.

### 7.4 `stories/index.json`

```json
[
  {
    "slug": "origen-apellido-valicenti",
    "title": "El origen del apellido Valicenti",
    "date": "2026-04-14",
    "author": "Genea Azul",
    "excerpt": "La historia de una familia calabresa que llegó a Azul a fines del siglo XIX...",
    "image": null
  }
]
```

---

## 8. JavaScript Module Specifications

### 8.1 `js/config.js`

```javascript
var GeneaAzul = window.GeneaAzul || {};

GeneaAzul.config = {
    apiBaseUrl: (window.location.hostname === 'localhost')
        ? window.location.origin
        : 'https://gedcom-analyzer-app.fly.dev',
    obfuscateLiving: true,
    familyTreeProcessPersonsBySec: 225,
    familyTreeProcessFixedDelayMillis: 3250,
    minMillisToDisplayWaitCountDown: 7500
};
```

### 8.2 `js/router.js`

Responsibilities:
- Listen to `hashchange` events
- Parse the hash into a route (e.g., `#estadisticas/inmigracion` → page `estadisticas-inmigracion`)
- Fetch the corresponding HTML fragment from `pages/`
- Inject into `#page-content` container
- Call the page-specific initializer if one exists
- Cache loaded pages in memory (don't re-fetch on revisit)
- Update navbar active state
- Scroll to top on navigation

```javascript
GeneaAzul.router = {
    cache: {},
    currentPage: null,
    
    init: function() { /* bind hashchange, load initial route */ },
    navigate: function(hash) { /* programmatic navigation */ },
    loadPage: function(pageName) { /* fetch + inject + init */ },
    getPageName: function(hash) { /* parse hash to page file name */ }
};
```

### 8.3 `js/search.js`

Responsibilities:
- Initialize the two-step search wizard
- Bind form events (sex toggling, alive/dead toggling, card colors)
- Collect form data into `SearchFamilyDto` JSON
- POST to `/api/search/family`
- Render results (person cards with full detail)
- Handle "Búsqueda avanzada" toggle
- Handle grandparents toggle
- Display family tree PDF download links
- Display "Buscar conexión" button per result person

Key functions to port from current `index.ftlh`:
- `toggleYearOfDeath()`
- `toggleCardColorBySex()`
- `toggleContainers()`
- Search result rendering (person card building)
- Surname search result rendering
- Relationship name display in Spanish (`getRelationshipInSpanish()`)
- Date display in Spanish (`displayDateInSpanish()`)
- Name obfuscation display (`displayNameInSpanish()`)
- Error code display (`displayErrorCodeInSpanish()`)

### 8.4 `js/connections.js`

Responsibilities:
- Initialize the connections form
- Collect person1 and person2 data
- POST to `/api/search/connection`
- Render the chain of connections
- Handle error codes

### 8.5 `js/stats.js`

Responsibilities:
- Animate stat counters (count-up effect using `requestAnimationFrame`)
- Load and render immigration, personalities, and surnames data from JSON files
- Handle "Ver más" links

### 8.6 `js/map.js`

Responsibilities:
- Load immigration data from `data/immigration.json`
- Color SVG map paths by country ISO code
- Bind hover/click events for tooltips
- Create color scale legend

### 8.7 `js/stories.js`

Responsibilities:
- Fetch `stories/index.json` for listing
- Render story cards
- On story click: fetch `stories/{slug}.md`, parse with `marked.parse()`, render
- Handle back navigation

### 8.8 `js/i18n.js`

Port all the Spanish localization functions from the current `index.ftlh`:

- `displayRelationshipInSpanish(relationship)` — converts full `RelationshipDto` (used for `maxDistantRelationship`) to Spanish text. This is the complex one (~100 lines) that handles generation, grade, in-law, half, adoption, and tree side logic.
- `displayReferenceTypeInSpanish(referenceType, sex)` — converts a `ReferenceType` enum + sex to Spanish label. Used for parent references in search results (e.g., "padre", "madre", "padre adoptivo"). Simpler than `displayRelationshipInSpanish`.
- `getTreeSideInSpanish(treeSides, defaultValue)` — "padre", "madre", "padre/madre"
- `getSexSuffixInSpanish(relationship)` — "o" or "a"
- `getGradeSuffixInSpanish(grade, sexSuffix)` — "segundo/a", "tercero/a", etc.
- `getAdoptionSuffixInSpanish(adoptionType, sexSuffix)` — "adoptivo/a", "de crianza"
- `displayErrorCodeInSpanish(errorCode)` — user-friendly error messages
- `displayNameInSpanish(name)` — obfuscation replacements (`<private>` → `<nombre privado>`, etc.)
- `displayDateInSpanish(date)` — GEDCOM date format to Spanish (handles ABT, EST, BEF, AFT, BET, month abbreviations)

### 8.9 `js/utils.js`

Shared utilities:

- `trimToNull(str)` — trim string, return null if empty
- `isEmpty(str)` — null/undefined/empty check
- `toNumber(str)` — parse int or null
- `maxLengthCheck(input)` — enforce max length on number inputs
- `formatNumber(num)` — Argentine number formatting (70.512)
- `apiGet(url, successFn, errorFn)` — wrapper for jQuery AJAX GET
- `apiPost(url, data, successFn, errorFn)` — wrapper for jQuery AJAX POST

---

## 9. Deployment

### 9.1 Cloudflare Pages Setup

1. Create a GitHub repo: `geneaazul-web` (or similar)
2. In Cloudflare dashboard: Workers & Pages → Create → Connect to Git
3. Select the repo, set build output directory to `/` (root, no build step)
4. Build command: (leave empty — no build needed)
5. Add custom domain: `geneaazul.com.ar` (Cloudflare will auto-configure DNS since it's already on Cloudflare)

### 9.2 `_redirects` File

For Cloudflare Pages:

```
/* /index.html 200
```

**Note**: Since we use **hash-based routing** (`#buscar`, `#conexiones`, etc.), the browser never sends the hash fragment to the server — all requests hit the root `/` and JavaScript handles routing client-side. This means `_redirects` is technically not needed for the current architecture. However, it's included as a safety net: if a user somehow lands on a non-root URL (e.g., from a misconfigured link), it will serve `index.html` instead of a 404. It also future-proofs the site if we ever switch to path-based routing.

### 9.3 Development

To develop locally:
- Open `index.html` in a browser via a local server (e.g., `python3 -m http.server 8080` or VS Code Live Server)
- The API calls will go to `gedcom-analyzer-app.fly.dev` (configured in `config.js`)
- For local backend testing, change `config.js` to point to `localhost:8080` (or wherever your Spring Boot app runs)

---

## 10. Migration Checklist

When building the new site, ensure all current functionality is preserved:

- [ ] Health check on load (wake up Fly.io backend)
- [ ] Person search with all fields (individual, spouse, father, mother, 4 grandparents)
- [ ] Sex-based card coloring toggle
- [ ] Alive/dead toggle enabling year of death
- [ ] Spouse card show/hide toggle
- [ ] Grandparents card show/hide toggle
- [ ] Contact field
- [ ] Search results display (full person card with all details)
- [ ] Family tree PDF download links ("Descargar listado de familiares")
- [ ] Family tree network viewer links ("Ver árbol genealógico online")
- [ ] Family tree button enable delay (calculated from personsCountInTree)
- [ ] Surname search results
- [ ] Obfuscation of living persons' data
- [ ] URL param `?f=0` to disable obfuscation
- [ ] Connections search between two people
- [ ] Connection chain display
- [ ] All Spanish localization (relationship names, dates, errors)
- [ ] Rate limiting error handling
- [ ] Statistics data (all 3 lists: immigration, personalities, surnames)
- [ ] Social links (Instagram, Facebook, Email)
- [ ] Persons count display from API metadata
- [ ] "La historia de Genea Azul" narrative ported to Sobre Nosotros page
- [ ] "Interés Comunitario" declaration in footer
- [ ] "Familias" tab content intentionally deferred (document decision)

---

## 11. Implementation Priority

Build in this order:

1. **Project scaffolding**: `index.html` shell, CSS files, `router.js`, `config.js`, `utils.js`
2. **Hero section**: Landing page with stat counters and CTA
3. **Search page** (`buscar.html` + `search.js`): Port the full search functionality
4. **Connections page** (`conexiones.html` + `connections.js`)
5. **Stats highlights** (`estadisticas.html` + `stats.js`)
6. **Stats detail pages** (3 pages + JSON data files)
7. **Immigration map** (`mapa.html` + `map.js` + SVG)
8. **Family stories** (`historias.html` + `stories.js` + marked.js)
9. **Testimonials** (`testimonios.html`)
10. **Contribute** (`colabora.html`)
11. **About** (`sobre-nosotros.html`)
12. **Theme variants** (heritage + modern CSS)
13. **Polish**: Animations, transitions, responsive testing, accessibility

---

## 12. Accessibility

- Semantic HTML: use `<nav>`, `<main>`, `<article>`, `<section>`, `<header>`, `<footer>`
- ARIA labels on interactive elements
- Keyboard navigable (tab order, focus styles)
- Color contrast: minimum WCAG AA (4.5:1 for text)
- Alt text on all images
- Form labels associated with inputs (already using Bootstrap floating labels)
- Screen reader friendly: hidden text for icon-only buttons
