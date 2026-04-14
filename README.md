# Genea Azul — Website

Public-facing website for [Genea Azul](https://geneaazul.com.ar), a non-profit community genealogy research project focused on the city of Azul (Buenos Aires, Argentina).

## Architecture

- **Static SPA** — single `index.html` shell with hash-based routing and lazy-loaded page fragments
- **No build step** — plain HTML, CSS, and JavaScript (jQuery + Bootstrap 5)
- **Backend API** — calls `https://gedcom-analyzer-app.fly.dev` (Spring Boot on Fly.io)
- **Hosting** — Cloudflare Pages (auto-deploys from this repo)

## Quick Start

```bash
# Clone the repo
git clone https://github.com/genea-azul/geneaazul-web.git
cd geneaazul-web

# Serve locally (any static server works)
python3 -m http.server 8080

# Open in browser
open http://localhost:8080
```

API calls will go to `gedcom-analyzer-app.fly.dev` in production. To use a local backend, edit `js/config.js` and change `apiBaseUrl`.

## Project Structure

```
geneaazul-web/
├── index.html              # App shell: navbar, hero, footer, router
├── css/
│   ├── main.css            # Shared layout and components
│   ├── theme-heritage.css  # Warm/earthy theme (browns, serif fonts)
│   └── theme-modern.css    # Clean/crisp theme (blues, sans-serif)
├── js/
│   ├── config.js           # API URL, feature flags, constants
│   ├── router.js           # Hash-based routing + lazy loading
│   ├── search.js           # Person search wizard
│   ├── connections.js      # Connections between people
│   ├── stats.js            # Statistics counters and data
│   ├── map.js              # Interactive immigration map
│   ├── stories.js          # Markdown story rendering
│   ├── i18n.js             # Spanish localization helpers
│   └── utils.js            # Shared utilities
├── pages/                  # HTML fragments (lazy loaded)
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
├── stories/                # Markdown files for family stories
│   ├── index.json          # Story metadata
│   └── *.md                # Individual stories
├── data/                   # Static JSON data
│   ├── immigration.json
│   ├── personalities.json
│   └── surnames.json
├── img/                    # Images and SVG assets
├── _redirects              # Cloudflare Pages SPA routing
├── docs/
│   ├── SPEC.md             # Full design specification
│   └── API-REFERENCE.md    # Backend API documentation
└── README.md               # This file
```

## Documentation

- **[Design Specification](docs/SPEC.md)** — complete design doc covering architecture, visual design, page-by-page specs, JS modules, data formats, and implementation priority
- **[API Reference](docs/API-REFERENCE.md)** — full backend API documentation with request/response examples, error handling, date formats, and relationship type references

## Deployment

### Cloudflare Pages

1. Push to the `main` branch of this repo
2. Cloudflare Pages auto-deploys (no build step)
3. Custom domain `geneaazul.com.ar` is configured in Cloudflare DNS

### Manual

Upload all files to any static hosting provider. The `_redirects` file handles SPA routing on Cloudflare Pages; for other hosts, configure equivalent rewrite rules.

## CDN Dependencies

| Library | Version | Purpose |
|---------|---------|---------|
| Bootstrap | 5.3.3 | Layout and components |
| Bootstrap Icons | 1.11.3 | Icons |
| jQuery | 3.7.1 | DOM manipulation, AJAX |
| marked.js | 15.x | Markdown rendering |
| Google Fonts | — | Playfair Display, Source Sans 3, Inter |

## Contributing

This is a community project. To contribute family data, request tree access, or volunteer, contact:

- Instagram: [@genea.azul](https://instagram.com/genea.azul)
- Facebook: [genea.azul](https://facebook.com/genea.azul)
- Email: genea.azul@gmail.com
