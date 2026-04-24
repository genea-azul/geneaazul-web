#!/usr/bin/env node
// Generates per-route HTML entry points from index.html.
// Re-run whenever index.html <head> changes: node scripts/generate-route-pages.js

var fs   = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..');
var BASE = 'https://geneaazul.com.ar';

var ROUTES = {
  'buscar': {
    title:  'Buscar personas — Genea Azul',
    desc:   'Buscá personas en la base genealógica azuleña. Encontrá familiares y antepasados del partido de Azul.',
    crumbs: [{ name: 'Buscar personas', path: '/buscar' }]
  },
  'conexiones': {
    title:  'Conexiones entre personas — Genea Azul',
    desc:   'Descubrí cómo dos personas están emparentadas en el árbol genealógico de Azul.',
    crumbs: [{ name: 'Conexiones entre personas', path: '/conexiones' }]
  },
  'estadisticas': {
    title:  'Estadísticas del árbol — Genea Azul',
    desc:   'Estadísticas genealógicas del partido de Azul: personas, familias, apellidos e inmigración.',
    crumbs: [{ name: 'Estadísticas del árbol', path: '/estadisticas' }]
  },
  'estadisticas/inmigracion': {
    title:  'Inmigración en Azul — Genea Azul',
    desc:   'Oleadas inmigratorias que llegaron al partido de Azul, Buenos Aires, Argentina.',
    crumbs: [
      { name: 'Estadísticas',        path: '/estadisticas' },
      { name: 'Inmigración en Azul', path: '/estadisticas/inmigracion' }
    ]
  },
  'estadisticas/personalidades': {
    title:  'Personalidades destacadas — Genea Azul',
    desc:   'Personas distinguidas nacidas o relacionadas con el partido de Azul.',
    crumbs: [
      { name: 'Estadísticas',              path: '/estadisticas' },
      { name: 'Personalidades destacadas', path: '/estadisticas/personalidades' }
    ]
  },
  'estadisticas/apellidos': {
    title:  'Apellidos frecuentes — Genea Azul',
    desc:   'Apellidos más frecuentes en el partido de Azul según la base genealógica.',
    crumbs: [
      { name: 'Estadísticas',         path: '/estadisticas' },
      { name: 'Apellidos frecuentes', path: '/estadisticas/apellidos' }
    ]
  },
  'mapa': {
    title:  'Mapa migratorio — Genea Azul',
    desc:   'Mapa interactivo de los países de origen de las familias que llegaron al partido de Azul.',
    crumbs: [{ name: 'Mapa migratorio', path: '/mapa' }]
  },
  'historias': {
    title:  'Historias de familia — Genea Azul',
    desc:   'Relatos sobre familias y personajes del partido de Azul escritos por la comunidad.',
    crumbs: [{ name: 'Historias de familia', path: '/historias' }]
  },
  'testimonios': {
    title:  'Testimonios — Genea Azul',
    desc:   'Testimonios de personas que encontraron su historia con Genea Azul.',
    crumbs: [{ name: 'Testimonios', path: '/testimonios' }]
  },
  'colabora': {
    title:  'Colaborá — Genea Azul',
    desc:   'Cómo colaborar con el proyecto genealógico comunitario Genea Azul.',
    crumbs: [{ name: 'Colaborá', path: '/colabora' }]
  },
  'recursos': {
    title:  'Recursos genealógicos — Genea Azul',
    desc:   'Recursos genealógicos útiles para investigar familias del partido de Azul.',
    crumbs: [{ name: 'Recursos genealógicos', path: '/recursos' }]
  },
  'cronologia': {
    title:  'Cronología de Azul — Genea Azul',
    desc:   'Línea de tiempo histórica del partido de Azul: eventos, genealogía y curiosidades.',
    crumbs: [{ name: 'Cronología de Azul', path: '/cronologia' }]
  },
  'sobre-nosotros': {
    title:  'Sobre nosotros — Genea Azul',
    desc:   'Conocé al equipo detrás de Genea Azul, el proyecto genealógico comunitario de Azul.',
    crumbs: [{ name: 'Sobre nosotros', path: '/sobre-nosotros' }]
  }
};

// Exact breadcrumb block as it appears in index.html (whitespace must match)
var HOME_BREADCRUMB =
  '        "breadcrumb": {\n' +
  '          "@type": "BreadcrumbList",\n' +
  '          "itemListElement": [\n' +
  '            { "@type": "ListItem", "position": 1, "name": "Inicio", "item": "https://geneaazul.com.ar/" }\n' +
  '          ]\n' +
  '        }';

function buildBreadcrumb(crumbs) {
  var pad = '            ';
  var items = [
    '{ "@type": "ListItem", "position": 1, "name": "Inicio", "item": "' + BASE + '/" }'
  ];
  crumbs.forEach(function(c, i) {
    items.push(
      '{ "@type": "ListItem", "position": ' + (i + 2) +
      ', "name": ' + JSON.stringify(c.name) +
      ', "item": ' + JSON.stringify(BASE + c.path) + ' }'
    );
  });
  return (
    '        "breadcrumb": {\n' +
    '          "@type": "BreadcrumbList",\n' +
    '          "itemListElement": [\n' +
    pad + items.join(',\n' + pad) + '\n' +
    '          ]\n' +
    '        }'
  );
}

var template = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

// Strip <!-- buscar-only:start --> ... <!-- buscar-only:end --> blocks (including surrounding newline)
// from any route that is not 'buscar'.
var BUSCAR_ONLY_RE = /\n[ \t]*<!-- buscar-only:start -->[\s\S]*?<!-- buscar-only:end -->/g;

// Sanity-check that every target string is present in the template exactly once
var CHECKS = [
  '<title>Genea Azul',
  'name="description"',
  'rel="canonical"',
  'og:url',
  'og:title',
  'og:description',
  'twitter:title',
  'twitter:description',
  '"@id": "https://geneaazul.com.ar/#webpage"',
  '"name": "Genea Azul — Genealogía azuleña"',
  'Buscá personas en el árbol genealógico del partido de Azul',
  HOME_BREADCRUMB,
  'type="importmap"'  // must be present so all routes resolve the Three.js ES module
];
CHECKS.forEach(function(s) {
  var idx = template.indexOf(s);
  if (idx === -1) {
    console.error('ERROR: pattern not found in template:\n  ' + s.slice(0, 80));
    process.exit(1);
  }
  if (template.indexOf(s, idx + 1) !== -1) {
    console.error('ERROR: pattern found more than once (ambiguous replacement):\n  ' + s.slice(0, 80));
    process.exit(1);
  }
});

Object.keys(ROUTES).forEach(function(route) {
  var m   = ROUTES[route];
  var url = BASE + '/' + route;
  var html = template;

  // Strip buscar-only blocks for every route except 'buscar'
  if (route !== 'buscar') {
    html = html.replace(BUSCAR_ONLY_RE, '');
  }

  // <head> meta tags
  html = html.replace(/<title>[^<]*<\/title>/,                                    '<title>' + m.title + '</title>');
  html = html.replace(/(<meta name="description" content=")[^"]*(")/,             '$1' + m.desc  + '$2');
  html = html.replace(/(<link rel="canonical" href=")[^"]*(")/,                   '$1' + url     + '$2');
  html = html.replace(/(<meta property="og:url" content=")[^"]*(")/,              '$1' + url     + '$2');
  html = html.replace(/(<meta property="og:title" content=")[^"]*(")/,            '$1' + m.title + '$2');
  html = html.replace(/(<meta property="og:description" content=")[^"]*(")/,      '$1' + m.desc  + '$2');
  html = html.replace(/(<meta name="twitter:title" content=")[^"]*(")/,           '$1' + m.title + '$2');
  html = html.replace(/(<meta name="twitter:description" content=")[^"]*(")/,     '$1' + m.desc  + '$2');

  // JSON-LD WebPage block: @id + url (combined so order doesn't matter)
  html = html.replace(
    /"@id": "https:\/\/geneaazul\.com\.ar\/#webpage",(\s+)"url": "https:\/\/geneaazul\.com\.ar\/"/,
    '"@id": "' + url + '#webpage",$1"url": "' + url + '"'
  );
  // WebPage name (unique: Organization and WebSite only use the short "Genea Azul" name)
  html = html.replace(
    '"name": "Genea Azul — Genealogía azuleña"',
    '"name": "' + m.title + '"'
  );
  // WebPage description (unique value, different from Organization/WebSite descriptions)
  html = html.replace(
    '"description": "Buscá personas en el árbol genealógico del partido de Azul. Más de 70.000 personas, 4.500 apellidos y 50 países de origen."',
    '"description": "' + m.desc + '"'
  );
  // Breadcrumb (exact block match)
  html = html.replace(HOME_BREADCRUMB, buildBreadcrumb(m.crumbs));

  // e.g. 'buscar' → 'buscar.html', 'estadisticas/inmigracion' → 'estadisticas/inmigracion.html'
  var outFile = path.join(ROOT, route + '.html');
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, html, 'utf8');
  console.log('Generated: ' + route + '.html');
});

console.log('Done. ' + Object.keys(ROUTES).length + ' files generated.');
