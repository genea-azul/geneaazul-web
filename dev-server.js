#!/usr/bin/env node
/**
 * Local dev server for Genea Azul.
 * - Serves static files from the project root on http://localhost:8090
 * - Mocks all API endpoints consumed by the frontend
 *
 * Usage: node dev-server.js
 */

var http = require('http');
var fs   = require('fs');
var path = require('path');

var PORT = 8090;
var ROOT = __dirname;

// ─── Argentine "today" ────────────────────────────────────────────────────────
var arDate  = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
var arParts = arDate.split('-');
var arDay   = parseInt(arParts[2], 10);
var arMonth = parseInt(arParts[1], 10);
var arYear  = parseInt(arParts[0], 10);

var GEDCOM_MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
function gedcomDate(day, month1based, year) {
  return day + ' ' + GEDCOM_MONTHS[month1based - 1] + ' ' + year;
}

var todayGedcom = gedcomDate(arDay, arMonth, arYear - 50);
var prevGedcom  = gedcomDate(Math.max(arDay - 2, 1), arMonth, arYear - 80);
var nextGedcom  = gedcomDate(Math.min(arDay + 3, 28), arMonth, arYear - 65);

// ─── Mock data ────────────────────────────────────────────────────────────────

var MOCK_GEDCOM_ANALYZER = { disableObfuscateLiving: false };

var MOCK_METADATA = {
  personsCount:          70000,
  familiesCount:         25000,
  maleCount:             35200,
  femaleCount:           34800,
  deceasedCount:         40000,
  aliveCount:            30000,
  distinguishedCount:    200,
  azulPersonsCount:      12000,
  azulAliveCount:        4800,
  azulSurnamesCount:     4000,
  azulMayorsCount:       40,
  azulDisappearedCount:  20
};

var MOCK_AZUL_TODAY = [
  { uuid: 'mock-t-1', name: 'Roberto L.',  aka: null,   sex: 'M', isAlive: true, dateOfBirth: todayGedcom, placeOfBirth: 'Azul, Buenos Aires', dateOfDeath: null, profilePicture: null },
  { uuid: 'mock-t-2', name: 'Sofía M.',    aka: 'Sofi', sex: 'F', isAlive: true, dateOfBirth: todayGedcom, placeOfBirth: 'Azul, Buenos Aires', dateOfDeath: null, profilePicture: null }
];

var MOCK_EPHEMERIDES = {
  birthdays: [
    { uuid: 'mock-b-1', name: 'Juan Pérez',      aka: null,     sex: 'M', isAlive: false, dateOfBirth: todayGedcom, placeOfBirth: 'Azul, Buenos Aires', dateOfDeath: null, profilePicture: null },
    { uuid: 'mock-b-2', name: 'María González',  aka: 'Maruja', sex: 'F', isAlive: false, dateOfBirth: prevGedcom,  placeOfBirth: 'Azul, Buenos Aires', dateOfDeath: null, profilePicture: null },
    { uuid: 'mock-b-3', name: 'Carlos Rodríguez',aka: null,     sex: 'M', isAlive: false, dateOfBirth: nextGedcom,  placeOfBirth: 'Azul, Buenos Aires', dateOfDeath: null, profilePicture: null }
  ],
  deaths: [
    { uuid: 'mock-d-1', name: 'Ana Martínez',  aka: null,    sex: 'F', isAlive: false, dateOfBirth: gedcomDate(5, arMonth, arYear - 90),  placeOfBirth: 'Azul, Buenos Aires', dateOfDeath: todayGedcom, profilePicture: null },
    { uuid: 'mock-d-2', name: 'Luis Fernández', aka: 'Lucho', sex: 'M', isAlive: false, dateOfBirth: gedcomDate(10, arMonth, arYear - 110), placeOfBirth: 'Azul, Buenos Aires', dateOfDeath: nextGedcom,  profilePicture: null }
  ]
};

// POST /api/search/family — returns one result person with rich tree data
var MOCK_SEARCH_FAMILY = {
  people: [
    {
      uuid: 'mock-person-1',
      name: 'APELLIDO Mock, Nombre',
      aka: 'Apodo',
      sex: 'M',
      isAlive: false,
      dateOfBirth: '15 MAR 1945',
      dateOfDeath: '20 JUN 2010',
      placeOfBirth: 'Azul, Buenos Aires',
      personsCountInTree: 42,
      surnamesCountInTree: 8,
      ancestryGenerations: { ascending: 3, directDescending: 2 },
      maxDistantRelationship: {
        personName: 'LEJANO Mock, Prima',
        relationship: 'prima segunda'
      },
      distinguishedPersonsInTree: [],
      ancestryCountries: ['Argentina', 'España', 'Italia'],
      parents: [
        { name: 'APELLIDO Mock, Padre', sex: 'M', referenceType: null },
        { name: 'MADRE Mock, Madre',    sex: 'F', referenceType: null }
      ],
      spouses: [
        {
          name: 'ESPOSA Mock, Esposa',
          children: [
            { name: 'APELLIDO Mock, Hijo',  sex: 'M', referenceType: null },
            { name: 'APELLIDO Mock, Hija',  sex: 'F', referenceType: null }
          ]
        }
      ]
    }
  ],
  errors: [],
  potentialResults: null
};

// POST /api/search/surnames — returns info for each requested surname
function mockSurnamesResponse(surnames) {
  return {
    surnames: (surnames || []).map(function(s) {
      return {
        surname:       s,
        variants:      [s + 'i', s + 'o'],
        frequency:     Math.floor(Math.random() * 200) + 10,
        countries:     ['Argentina', 'España'],
        firstSeenYear: 1850,
        lastSeenYear:  2020
      };
    })
  };
}

// POST /api/search/connection — returns a 3-step chain
var MOCK_CONNECTION = {
  connections: [
    { relationship: null,      personName: 'PÉREZ Mock, Juan',    personData: 'n. 1945' },
    { relationship: 'padre',   personName: 'PÉREZ Mock, Pedro',   personData: 'n. 1910' },
    { relationship: 'hijo',    personName: 'PÉREZ Mock, Roberto', personData: 'n. 1940' },
    { relationship: 'esposa',  personName: 'GONZÁLEZ Mock, María',personData: 'n. 1970' }
  ],
  errors: []
};

// GET /api/search/family-tree/:uuid/plainPdf — tiny valid PDF as base64
// This is the smallest syntactically valid PDF (renders a blank page).
var MOCK_PDF_BASE64 = 'JVBERi0xLjAKMSAwIG9iajw8L1R5cGUvQ2F0YWxvZy9QYWdlcyAyIDAgUj4+ZW5kb2JqIDIgMCBv' +
  'Ymq8PC9UeXBlL1BhZ2VzL0tpZHNbMyAwIFJdL0NvdW50IDE+PmVuZG9iaiAzIDAgb2JqPDwvVHlw' +
  'ZS9QYWdlL01lZGlhQm94WzAgMCAzIDNdPj5lbmRvYmoKeHJlZgowIDQKMDAwMDAwMDAwMCA2NTUz' +
  'NSBmIAowMDAwMDAwMDA5IDAwMDAwIG4gCjAwMDAwMDAwNTggMDAwMDAgbiAKMDAwMDAwMDExNSAw' +
  'MDAwMCBuIAp0cmFpbGVyPDwvU2l6ZSA0L1Jvb3QgMSAwIFI+PgpzdGFydHhyZWYKMTkwCiUlRU9G';

// GET /api/search/family-tree/:uuid/graphJson — mock graph for 3D viewer
// Complex endogamic graph: 37 persons, 4 generations, cross-generational marriages
var MOCK_GRAPH = {
  focalPersonId: 1,
  truncated: false,
  totalPersons: 37,
  persons: [
    // Gen +2 — founding couples (all deceased)
    { id: 51, displayName: 'Salvatore Ferrara',  sex: 'M', isAlive: false, generation:  2, relationship: 'bisabuelo',   dateOfBirth: '1872', dateOfDeath: '1948' },
    { id: 52, displayName: 'Concetta Romano',    sex: 'F', isAlive: false, generation:  2, relationship: 'bisabuela',   dateOfBirth: '1876', dateOfDeath: '1952' },
    { id: 53, displayName: 'Władysław Nowak',    sex: 'M', isAlive: false, generation:  2, relationship: 'bisabuelo',   dateOfBirth: '1869', dateOfDeath: '1942' },
    { id: 54, displayName: 'Zofia Kowalski',     sex: 'F', isAlive: false, generation:  2, relationship: 'bisabuela',   dateOfBirth: '1873', dateOfDeath: '1945' },
    { id: 55, displayName: 'Carlos García',      sex: 'M', isAlive: false, generation:  2, relationship: 'bisabuelo',   dateOfBirth: '1878', dateOfDeath: '1955' },
    { id: 56, displayName: 'Rosa González',      sex: 'F', isAlive: false, generation:  2, relationship: 'bisabuela',   dateOfBirth: '1880', dateOfDeath: '1960' },
    // Gen +1 — parents & uncles/aunts
    { id: 11, displayName: 'Giuseppe Ferrara',   sex: 'M', isAlive: false, generation:  1, relationship: 'padre',       dateOfBirth: '1895', dateOfDeath: '1972' },
    { id: 12, displayName: 'María F. Ferrara',   sex: 'F', isAlive: false, generation:  1, relationship: 'tía abuela',  dateOfBirth: '1898', dateOfDeath: '1980' },
    { id: 13, displayName: 'Antonio Ferrara',    sex: 'M', isAlive: true,  generation:  1, relationship: 'tío',         dateOfBirth: '1902' },
    { id: 14, displayName: 'Carmela Ferrara',    sex: 'F', isAlive: true,  generation:  1, relationship: 'tía',         dateOfBirth: '1905' },
    { id: 15, displayName: 'Elena Nowak',        sex: 'F', isAlive: false, generation:  1, relationship: 'madre',       dateOfBirth: '1897', dateOfDeath: '1968' },
    { id: 16, displayName: 'Jan Nowak',          sex: 'M', isAlive: true,  generation:  1, relationship: 'tío',         dateOfBirth: '1900' },
    { id: 17, displayName: 'Katarzyna Nowak',    sex: 'F', isAlive: true,  generation:  1, relationship: 'tía',         dateOfBirth: '1904' },
    { id: 18, displayName: 'Rafael García',      sex: 'M', isAlive: true,  generation:  1, relationship: 'tío político',dateOfBirth: '1908' },
    // Gen 0 — focal + siblings + cousins
    { id: 1,  displayName: 'Juan C. Ferrara',    sex: 'M', isAlive: true,  generation:  0, relationship: 'Yo',          dateOfBirth: '1925' },
    { id: 2,  displayName: 'María López',        sex: 'F', isAlive: true,  generation:  0, relationship: 'cónyuge',     dateOfBirth: '1928' },
    { id: 3,  displayName: 'Sofía Ferrara',      sex: 'F', isAlive: true,  generation:  0, relationship: 'hermana',     dateOfBirth: '1927' },
    { id: 4,  displayName: 'Marco Ferrara',      sex: 'M', isAlive: true,  generation:  0, relationship: 'hermano',     dateOfBirth: '1929' },
    { id: 5,  displayName: 'Lucía Ferrara',      sex: 'F', isAlive: true,  generation:  0, relationship: 'hermana',     dateOfBirth: '1931' },
    { id: 6,  displayName: 'Pedro Ferrara',      sex: 'M', isAlive: true,  generation:  0, relationship: 'primo',       dateOfBirth: '1926' },
    { id: 7,  displayName: 'Rosa A. Ferrara',    sex: 'F', isAlive: true,  generation:  0, relationship: 'prima',       dateOfBirth: '1928' },
    { id: 8,  displayName: 'Carla Ferrara',      sex: 'F', isAlive: true,  generation:  0, relationship: 'prima',       dateOfBirth: '1930' },
    { id: 9,  displayName: 'Diego A. Ferrara',   sex: 'M', isAlive: true,  generation:  0, relationship: 'primo',       dateOfBirth: '1932' },
    { id: 10, displayName: 'Miguel Nowak',       sex: 'M', isAlive: true,  generation:  0, relationship: 'primo',       dateOfBirth: '1922' },
    { id: 21, displayName: 'Clara Nowak',        sex: 'F', isAlive: true,  generation:  0, relationship: 'prima',       dateOfBirth: '1924' },
    { id: 22, displayName: 'Alejandro García',   sex: 'M', isAlive: true,  generation:  0, relationship: 'primo',       dateOfBirth: '1932' },
    { id: 23, displayName: 'Paula Ríos',         sex: 'F', isAlive: true,  generation:  0, relationship: 'cuñada',      dateOfBirth: '1935' },
    // Gen -1 — children + endogamic & cross-gen descendants
    { id: 31, displayName: 'Diego Ferrara',      sex: 'M', isAlive: true,  generation: -1, relationship: 'hijo',        dateOfBirth: '1950' },
    { id: 32, displayName: 'Laura Ferrara',      sex: 'F', isAlive: true,  generation: -1, relationship: 'hija',        dateOfBirth: '1952' },
    { id: 33, displayName: 'Valentina Ferrara',  sex: 'F', isAlive: true,  generation: -1, relationship: 'hija',        dateOfBirth: '1955' },
    { id: 34, displayName: 'Bruno Ferrara',      sex: 'M', isAlive: true,  generation: -1, relationship: 'hijo',        dateOfBirth: '1958' },
    { id: 35, displayName: 'Tomás Ferrara',      sex: 'M', isAlive: true,  generation: -1, relationship: 'sobrino',     dateOfBirth: '1948' },
    { id: 36, displayName: 'Isabel Ferrara',     sex: 'F', isAlive: true,  generation: -1, relationship: 'sobrina',     dateOfBirth: '1952' },
    { id: 37, displayName: 'Andrea Ferrara',     sex: 'F', isAlive: true,  generation: -1, relationship: 'sobrina',     dateOfBirth: '1955' },
    { id: 38, displayName: 'Nicolás Ferrara',    sex: 'M', isAlive: true,  generation: -1, relationship: 'sobrino',     dateOfBirth: '1956' },
    // Gen -2 — children of cross-generational F11 (Alejandro gen:0 × Laura gen:-1)
    { id: 39, displayName: 'Mateo García',       sex: 'M', isAlive: true,  generation: -2, relationship: 'nieto',       dateOfBirth: '1978' },
    { id: 40, displayName: 'Valentín García',    sex: 'M', isAlive: true,  generation: -2, relationship: 'nieto',       dateOfBirth: '1982' }
  ],
  families: [
    // Founding gen
    { id: 'F1',  husbandIds: [51], wifeIds: [52], childIds: [11, 12, 13, 14] }, // Ferrara-Romano → 4 children
    { id: 'F2',  husbandIds: [53], wifeIds: [54], childIds: [15, 16, 17]      }, // Nowak-Kowalski → 3 children
    { id: 'F3',  husbandIds: [55], wifeIds: [56], childIds: [18]              }, // García-González → 1 child
    // Parents' gen — cross-family marriages (Ferrara × Nowak)
    { id: 'F4',  husbandIds: [11], wifeIds: [15], childIds: [1, 3, 4, 5]      }, // Giuseppe+Elena → focal + 3 siblings
    { id: 'F5',  husbandIds: [13], wifeIds: [17], childIds: [6, 7, 8, 9]      }, // Antonio+Katarzyna → 4 cousins
    { id: 'F6',  husbandIds: [16], wifeIds: [12], childIds: [10, 21]          }, // Jan+María F. → 2 cousins (in-law endogamy)
    { id: 'F7',  husbandIds: [18], wifeIds: [14], childIds: [22]              }, // Rafael+Carmela → Alejandro
    // Focal gen
    { id: 'F8',  husbandIds: [1],  wifeIds: [2],  childIds: [31, 32, 33, 34]  }, // Juan+María → 4 children
    { id: 'F9',  husbandIds: [6],  wifeIds: [3],  childIds: [35, 36, 37]      }, // Pedro+Sofía — FIRST-COUSIN MARRIAGE
    { id: 'F10', husbandIds: [4],  wifeIds: [23], childIds: [38]              }, // Marco+Paula → 1 child
    { id: 'F11', husbandIds: [22], wifeIds: [32], childIds: [39, 40]          }  // Alejandro+Laura — CROSS-GEN + ENDOGAMIC
  ]
};

// ─── MIME types ───────────────────────────────────────────────────────────────
var MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf'
};

// ─── Server ───────────────────────────────────────────────────────────────────
var server = http.createServer(function(req, res) {
  var url    = req.url.split('?')[0];
  var method = req.method;

  // GET routes
  if (method === 'GET') {
    if (url === '/api/gedcom-analyzer')                    return sendJson(res, MOCK_GEDCOM_ANALYZER);
    if (url === '/api/gedcom-analyzer/metadata')           return sendJson(res, MOCK_METADATA);
    if (url === '/api/birthday/azul-today')                return sendJson(res, MOCK_AZUL_TODAY);
    if (url === '/api/birthday/ephemerides-this-month')    return sendJson(res, MOCK_EPHEMERIDES);
    if (/^\/api\/search\/family-tree\/[^/]+\/plainPdf$/.test(url)) {
      return sendJson(res, { pdf: MOCK_PDF_BASE64 });
    }
    if (/^\/api\/search\/family-tree\/[^/]+\/graphJson$/.test(url)) {
      return sendJson(res, MOCK_GRAPH);
    }
  }

  // POST routes — read body first
  if (method === 'POST') {
    return readBody(req, function(body) {
      if (url === '/api/search/family')     return sendJson(res, MOCK_SEARCH_FAMILY);
      if (url === '/api/search/connection') return sendJson(res, MOCK_CONNECTION);
      if (url === '/api/search/surnames') {
        var surnames = (body && body.surnames) ? body.surnames : [];
        return sendJson(res, mockSurnamesResponse(surnames));
      }
      send404(res, url);
    });
  }

  // Static file serving with SPA fallback
  serveStatic(res, url);
});

function serveStatic(res, url) {
  var filePath = path.join(ROOT, url === '/' ? 'index.html' : url);
  if (filePath.indexOf(ROOT) !== 0) { res.writeHead(403); return res.end('Forbidden'); }
  var ext = path.extname(filePath).toLowerCase();

  fs.stat(filePath, function(err, stat) {
    if (!err && stat.isFile()) {
      return sendFile(res, filePath, ext || '.html');
    }
    // Try clean-URL route entry point: /buscar → buscar.html, /estadisticas/inmigracion → estadisticas/inmigracion.html
    var htmlPath = path.join(ROOT, url.replace(/^\//, '') + '.html');
    if (htmlPath.indexOf(ROOT) !== 0) { return send404(res, url); }
    fs.stat(htmlPath, function(err2, stat2) {
      if (!err2 && stat2.isFile()) {
        return sendFile(res, htmlPath, '.html');
      }
      // SPA fallback
      sendFile(res, path.join(ROOT, 'index.html'), '.html');
    });
  });
}

function sendFile(res, filePath, ext) {
  fs.readFile(filePath, function(err, data) {
    if (err) { res.writeHead(500); return res.end('Internal server error'); }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

function readBody(req, cb) {
  var chunks = [];
  req.on('data', function(chunk) { chunks.push(chunk); });
  req.on('end', function() {
    var raw = Buffer.concat(chunks).toString();
    try { cb(JSON.parse(raw)); } catch(e) { cb({}); }
  });
}

function sendJson(res, data) {
  var body = JSON.stringify(data);
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
  res.end(body);
}

function send404(res, url) {
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found: ' + url);
}

// ─── Route integrity check ────────────────────────────────────────────────────
function integrityCheck() {
  var issues = [];
  function warn(msg) { console.warn('\x1b[33m[check] ' + msg + '\x1b[0m'); issues.push(msg); }
  function readSrc(rel) {
    try { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
    catch(e) { warn('Cannot read ' + rel + ' — ' + e.message); return null; }
  }
  function extractObjKeys(src, varName) {
    var start = src.indexOf('var ' + varName + ' ');
    if (start === -1) return null;
    var brace = src.indexOf('{', start);
    if (brace === -1) return null;
    var keys = [], depth = 0, i = brace;
    while (i < src.length) {
      var ch = src[i];
      if      (ch === '{') { depth++; i++; }
      else if (ch === '}') { depth--; if (!depth) break; i++; }
      else if (depth === 1 && ch === "'") {
        var close = src.indexOf("'", i + 1);
        if (close === -1) break;
        if (/^\s*:/.test(src.slice(close + 1))) keys.push(src.slice(i + 1, close));
        i = close + 1;
      } else { i++; }
    }
    return keys;
  }

  function decodeUnicode(str) {
    return str.replace(/\\u([0-9a-fA-F]{4})/g, function(_, hex) {
      return String.fromCharCode(parseInt(hex, 16));
    });
  }

  // Returns { routeKey: { title, desc } } for routeMeta or ROUTES objects.
  // Handles \uXXXX escapes (router.js) and plain UTF-8 (generate-route-pages.js).
  function extractMetaValues(src, varName) {
    var start = src.indexOf('var ' + varName + ' ');
    if (start === -1) return null;
    var brace = src.indexOf('{', start);
    if (brace === -1) return null;
    var result = {}, depth = 0, i = brace;
    while (i < src.length) {
      var ch = src[i];
      if (ch === '{') { depth++; i++; }
      else if (ch === '}') { depth--; if (!depth) break; i++; }
      else if (depth === 1 && ch === "'") {
        var keyEnd = src.indexOf("'", i + 1);
        if (keyEnd === -1) break;
        var key = src.slice(i + 1, keyEnd);
        var colonPos = src.indexOf(':', keyEnd);
        var valueBrace = src.indexOf('{', colonPos);
        if (valueBrace === -1) break;
        var innerDepth = 0, j = valueBrace;
        while (j < src.length) {
          if (src[j] === '{') { innerDepth++; j++; }
          else if (src[j] === '}') { innerDepth--; if (!innerDepth) { j++; break; } j++; }
          else { j++; }
        }
        var inner = src.slice(valueBrace, j);
        var tm = inner.match(/title\s*:\s*'((?:[^'\\]|\\.)*)'/);
        var dm = inner.match(/desc\s*:\s*'((?:[^'\\]|\\.)*)'/);
        if (tm && dm) result[key] = { title: decodeUnicode(tm[1]), desc: decodeUnicode(dm[1]) };
        i = j;
      } else { i++; }
    }
    return result;
  }

  var routerSrc    = readSrc('js/router.js');
  var genSrc       = readSrc('scripts/generate-route-pages.js');
  var redirectsSrc = readSrc('_redirects');
  var headersSrc   = readSrc('_headers');
  if (!routerSrc || !genSrc || !redirectsSrc || !headersSrc) return;

  var routeMapKeys    = extractObjKeys(routerSrc, 'routeMap');
  var routeMetaKeys   = extractObjKeys(routerSrc, 'routeMeta');
  var initializerKeys = extractObjKeys(routerSrc, 'initializers');
  var genRouteKeys    = extractObjKeys(genSrc,    'ROUTES');

  if (!routeMapKeys || !routeMetaKeys || !initializerKeys || !genRouteKeys) {
    warn('Could not parse route objects — check JS syntax in router.js / generate-route-pages.js');
    return;
  }

  // routeMap key→pageFile pairs e.g. 'estadisticas/inmigracion' → 'estadisticas-inmigracion'
  var pageFilePairs = [];
  var rmBlock = routerSrc.match(/var routeMap\s*=\s*\{([\s\S]+?)\n\s*\};/);
  if (rmBlock) {
    var re = /'([^']+)'\s*:\s*'([^']+)'/g, pm;
    while ((pm = re.exec(rmBlock[1])) !== null) pageFilePairs.push({ route: pm[1], file: pm[2] });
  }
  var pageFileNames = pageFilePairs.map(function(p) { return p.file; });

  var routes = routeMapKeys.filter(function(r) { return r !== 'inicio'; });

  // (no per-route redirects — route HTML files live at root, served via Cloudflare clean URLs)

  // _headers: path lines (no wildcards) followed immediately by no-cache
  var headerRoutes = [];
  var hLines = headersSrc.split('\n');
  for (var hi = 0; hi < hLines.length - 1; hi++) {
    var hm = hLines[hi].match(/^(\/[^*\s#][^*\s]*)$/);
    if (hm && /no-cache/.test(hLines[hi + 1])) headerRoutes.push(hm[1].slice(1));
  }

  // 1. router.js routeMap ↔ routeMeta
  routes.forEach(function(r) {
    if (routeMetaKeys.indexOf(r) === -1) warn('router.js: "' + r + '" in routeMap but missing from routeMeta');
  });
  routeMetaKeys.filter(function(r) { return r !== 'inicio'; }).forEach(function(r) {
    if (routes.indexOf(r) === -1) warn('router.js: "' + r + '" in routeMeta but not in routeMap');
  });

  // 2. router.js initializers keys must be valid routeMap page-file names
  initializerKeys.forEach(function(k) {
    if (pageFileNames.indexOf(k) === -1)
      warn('router.js: initializer key "' + k + '" is not a known page-file name in routeMap');
  });

  // 3. routeMap ↔ generate-route-pages.js ROUTES
  routes.forEach(function(r) {
    if (genRouteKeys.indexOf(r) === -1)
      warn('generate-route-pages.js: "' + r + '" missing from ROUTES — add it and re-run the script');
  });
  genRouteKeys.forEach(function(r) {
    if (routes.indexOf(r) === -1)
      warn('generate-route-pages.js: "' + r + '" in ROUTES but not in routeMap');
  });

  // 4. route HTML entry points exist at root (e.g. buscar.html, estadisticas/inmigracion.html)
  routes.forEach(function(r) {
    if (!fs.existsSync(path.join(ROOT, r + '.html')))
      warn(r + '.html is missing — run: node scripts/generate-route-pages.js');
  });

  // 5. routeMap ↔ _headers no-cache
  routes.forEach(function(r) {
    if (headerRoutes.indexOf(r) === -1) warn('_headers: missing no-cache entry for "/' + r + '"');
  });


  // 7. routeMap page-file values → pages/ fragments exist on disk
  pageFilePairs.forEach(function(p) {
    if (!fs.existsSync(path.join(ROOT, 'pages', p.file + '.html')))
      warn('pages/' + p.file + '.html missing (needed by router for route "' + p.route + '")');
  });

  // 8. routeMeta ↔ ROUTES title + desc values
  var routeMetaValues = extractMetaValues(routerSrc, 'routeMeta');
  var genRouteValues  = extractMetaValues(genSrc,    'ROUTES');
  if (routeMetaValues && genRouteValues) {
    routes.forEach(function(r) {
      var rm = routeMetaValues[r];
      var gr = genRouteValues[r];
      if (!rm || !gr) return; // already caught by key checks above
      if (rm.title !== gr.title)
        warn('title mismatch for "' + r + '":\n    router.js:             ' + rm.title + '\n    generate-route-pages:  ' + gr.title);
      if (rm.desc !== gr.desc)
        warn('desc mismatch for "' + r + '":\n    router.js:             ' + rm.desc + '\n    generate-route-pages:  ' + gr.desc);
    });
  }

  // 9. pages/ fragment <section aria-label> matches title (title === aria-label + ' — Genea Azul')
  if (genRouteValues) {
    pageFilePairs.forEach(function(pair) {
      var gr = genRouteValues[pair.route];
      if (!gr) return;
      var expectedLabel = gr.title.replace(' — Genea Azul', '');
      var fragPath = path.join(ROOT, 'pages', pair.file + '.html');
      var fragSrc;
      try { fragSrc = fs.readFileSync(fragPath, 'utf8'); } catch(e) { return; }
      if (fragSrc.indexOf('aria-label="' + expectedLabel + '"') === -1) {
        warn('pages/' + pair.file + '.html: <section> aria-label should be "' + expectedLabel + '"');
      }
    });
  }

  if (issues.length === 0) {
    console.log('\x1b[32m[check] OK — router.js, generate-route-pages.js, _redirects, _headers, fragments all consistent.\x1b[0m');
  } else {
    console.warn('\x1b[33m[check] ' + issues.length + ' issue(s) found — see warnings above.\x1b[0m');
  }
}

server.listen(PORT, function() {
  integrityCheck();
  console.log('Dev server → http://localhost:' + PORT);
  console.log('AR date   : ' + arDate + ' (day ' + arDay + ')');
  console.log('Highlighted entries: "Juan Pérez" (birthday) and "Ana Martínez" (death) — day ' + arDay);
});
