#!/usr/bin/env node
/**
 * Local dev server for Genea Azul.
 * - Serves static files from the project root on http://localhost:8080
 * - Mocks all API endpoints consumed by the frontend
 *
 * Usage: node dev-server.js
 */

var http = require('http');
var fs   = require('fs');
var path = require('path');

var PORT = 8080;
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
  personsCount:          70512,
  familiesCount:         28340,
  maleCount:             34100,
  femaleCount:           36412,
  deceasedCount:         51000,
  aliveCount:            19512,
  distinguishedCount:    258,
  azulPersonsCount:      12450,
  azulAliveCount:        4800,
  azulSurnamesCount:     4080,
  azulMayorsCount:       47,
  azulDisappearedCount:  12
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
    if (err || !stat.isFile()) {
      filePath = path.join(ROOT, 'index.html');
      ext = '.html';
    }
    fs.readFile(filePath, function(err2, data) {
      if (err2) { res.writeHead(500); return res.end('Internal server error'); }
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      res.end(data);
    });
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

server.listen(PORT, function() {
  console.log('Dev server → http://localhost:' + PORT);
  console.log('AR date   : ' + arDate + ' (day ' + arDay + ')');
  console.log('Highlighted entries: "Juan Pérez" (birthday) and "Ana Martínez" (death) — day ' + arDay);
});
