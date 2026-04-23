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
  var ext = path.extname(filePath).toLowerCase();

  fs.stat(filePath, function(err, stat) {
    if (!err && stat.isFile()) {
      return sendFile(res, filePath, ext || '.html');
    }
    // Try route entry point: /buscar → routes/buscar.html, /estadisticas/inmigracion → routes/estadisticas-inmigracion.html
    var routeFile = url.replace(/^\//, '').replace(/\//g, '-') + '.html';
    var htmlPath = path.join(ROOT, 'routes', routeFile);
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

  // _redirects: '/route /routes/file.html 200' — capture both route key and actual filename
  var redirectRoutes = [], redirectFiles = [];
  redirectsSrc.split('\n').forEach(function(line) {
    var m = line.match(/^(\/[^\s#]+)\s+\/routes\/([^\s]+)/);
    if (m) { redirectRoutes.push(m[1].slice(1)); redirectFiles.push(m[2]); }
  });

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

  // 4. routeMap ↔ _redirects
  routes.forEach(function(r) {
    if (redirectRoutes.indexOf(r) === -1) warn('_redirects: missing rewrite rule for "/' + r + '"');
  });
  redirectRoutes.forEach(function(r) {
    if (routes.indexOf(r) === -1) warn('_redirects: "/' + r + '" has no matching entry in routeMap');
  });

  // 5. routeMap ↔ _headers no-cache
  routes.forEach(function(r) {
    if (headerRoutes.indexOf(r) === -1) warn('_headers: missing no-cache entry for "/' + r + '"');
  });

  // 6. _redirects → routes/ files actually exist on disk
  redirectFiles.forEach(function(f) {
    if (!fs.existsSync(path.join(ROOT, 'routes', f)))
      warn('routes/' + f + ' is missing — run: node scripts/generate-route-pages.js');
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

  if (issues.length === 0) {
    console.log('\x1b[32m[check] OK — router.js, generate-route-pages.js, _redirects, _headers all consistent.\x1b[0m');
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
