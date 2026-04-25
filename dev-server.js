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
var arDate  = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }); // en-CA → guaranteed ASCII YYYY-MM-DD
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
      personsCountInTree: 72,
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
// 72 persons, gen+2→gen-2, 8-child family, 3-marriage person, endogamy on two levels
var MOCK_GRAPH = {
  focalPersonId: 1,
  truncated: false,
  totalPersons: 72,
  persons: [
    // Gen +2 — grandparents (6 people)
    { id: 51, displayName: 'Salvatore Ferrara',   sex: 'M', isAlive: false, generation:  2, relationship: 'abuelo',          dateOfBirth: null,          dateOfDeath: '5 NOV 1948' },
    { id: 52, displayName: 'Concetta Romano',     sex: 'F', isAlive: false, generation:  2, relationship: 'abuela',          dateOfBirth: '8 JUL 1876',  dateOfDeath: '14 FEB 1952' },
    { id: 53, displayName: 'Władysław Nowak',     sex: 'M', isAlive: false, generation:  2, relationship: 'abuelo',          dateOfBirth: '3 SEP 1869',  dateOfDeath: null },
    { id: 54, displayName: 'Zofia Kowalski',      sex: 'F', isAlive: false, generation:  2, relationship: 'abuela',          dateOfBirth: '18 APR 1873', dateOfDeath: null },
    { id: 55, displayName: 'Carlos García',       sex: 'M', isAlive: false, generation:  2, relationship: 'abuelo',          dateOfBirth: null,          dateOfDeath: '11 MAR 1955' },
    { id: 56, displayName: 'Rosa González',       sex: 'F', isAlive: false, generation:  2, relationship: 'abuela',          dateOfBirth: null,          dateOfDeath: null },

    // Gen +1 — 8 Ferrara children (F1, >6 ✓), 3 Nowak, 2 García
    { id: 11, displayName: 'Giuseppe Ferrara',    sex: 'M', isAlive: false, generation:  1, relationship: 'padre',           dateOfBirth: '3 FEB 1895',  dateOfDeath: '12 JUL 1972' },
    { id: 12, displayName: 'Antonio Ferrara',     sex: 'M', isAlive: true,  generation:  1, relationship: 'tío',             dateOfBirth: '19 MAY 1898' },
    { id: 13, displayName: 'Carmen Ferrara',      sex: 'F', isAlive: true,  generation:  1, relationship: 'tía',             dateOfBirth: '7 NOV 1900' },
    { id: 14, displayName: 'Rosario Ferrara',     sex: 'M', isAlive: false, generation:  1, relationship: 'tío',             dateOfBirth: '22 AUG 1902', dateOfDeath: '4 MAR 1978' },
    { id: 15, displayName: 'Lucia Ferrara',       sex: 'F', isAlive: true,  generation:  1, relationship: 'tía',             dateOfBirth: '14 JAN 1905' },
    { id: 16, displayName: 'Piero Ferrara',       sex: 'M', isAlive: true,  generation:  1, relationship: 'tío',             dateOfBirth: '30 MAR 1907' },
    { id: 17, displayName: 'Nunzio Ferrara',      sex: 'M', isAlive: false, generation:  1, relationship: 'tío',             dateOfBirth: '9 OCT 1909',  dateOfDeath: '16 JUN 1944' },
    { id: 18, displayName: 'Graziella Ferrara',   sex: 'F', isAlive: true,  generation:  1, relationship: 'tía',             dateOfBirth: '27 FEB 1912' },
    { id: 19, displayName: 'Elena Nowak',         sex: 'F', isAlive: false, generation:  1, relationship: 'madre',           dateOfBirth: '15 JUN 1897', dateOfDeath: '9 APR 1968' },
    { id: 20, displayName: 'Jan Nowak',           sex: 'M', isAlive: true,  generation:  1, relationship: 'tío',             dateOfBirth: '4 OCT 1900' },
    { id: 21, displayName: 'Katarzyna Nowak',     sex: 'F', isAlive: true,  generation:  1, relationship: 'tía',             dateOfBirth: '11 MAR 1904' },
    { id: 22, displayName: 'Rafael García',       sex: 'M', isAlive: true,  generation:  1, relationship: 'tío político',   dateOfBirth: '8 SEP 1908' },
    { id: 23, displayName: 'Mercedes García',     sex: 'F', isAlive: false, generation:  1, relationship: 'tía política',   dateOfBirth: '21 DEC 1910', dateOfDeath: '2 JAN 1985' },

    // Gen +1 — spouses from outside
    { id: 24, displayName: 'Beatriz Herrera',     sex: 'F', isAlive: false, generation:  1, relationship: 'tía',             dateOfBirth: '6 APR 1900',  dateOfDeath: '14 AUG 1930' },
    { id: 25, displayName: 'Sofía Méndez',        sex: 'F', isAlive: false, generation:  1, relationship: 'tía',             dateOfBirth: '17 SEP 1908', dateOfDeath: '30 NOV 1975' },
    { id: 26, displayName: 'Valentina Cruz',      sex: 'F', isAlive: true,  generation:  1, relationship: 'tía',             dateOfBirth: '23 JAN 1925' },
    { id: 27, displayName: 'Hugo Romero',         sex: 'M', isAlive: true,  generation:  1, relationship: 'tío político',   dateOfBirth: '11 MAY 1898' },
    { id: 28, displayName: 'Marta Sosa',          sex: 'F', isAlive: false, generation:  1, relationship: 'tía',             dateOfBirth: '3 JUN 1904',  dateOfDeath: '7 SEP 1980' },
    { id: 29, displayName: 'Fernando Ruiz',       sex: 'M', isAlive: true,  generation:  1, relationship: 'tío político',   dateOfBirth: '19 FEB 1902' },
    { id: 30, displayName: 'Alicia Pedraza',      sex: 'F', isAlive: true,  generation:  1, relationship: 'tía política',   dateOfBirth: '8 NOV 1909' },
    { id: 31, displayName: 'Diego Álvarez',       sex: 'M', isAlive: true,  generation:  1, relationship: 'tío político',   dateOfBirth: '24 AUG 1910' },
    { id: 32, displayName: 'Patricia Vidal',      sex: 'F', isAlive: true,  generation:  1, relationship: 'tía política',   dateOfBirth: '13 JUL 1903' },
    { id: 33, displayName: 'Roberto Reyes',       sex: 'M', isAlive: true,  generation:  1, relationship: 'tío político',   dateOfBirth: '2 MAR 1902' },
    { id: 34, displayName: 'Inés López',          sex: 'F', isAlive: true,  generation:  1, relationship: 'tía política',   dateOfBirth: '16 OCT 1911' },
    { id: 35, displayName: 'Bernardo Torres',     sex: 'M', isAlive: false, generation:  1, relationship: 'tío político',   dateOfBirth: '28 JAN 1908', dateOfDeath: '3 MAY 1992' },

    // Gen 0 — focal + siblings + spouse
    { id: 1,  displayName: 'Juan C. Ferrara',     sex: 'M', isAlive: true,  generation:  0, relationship: 'Yo',              dateOfBirth: '7 MAR 1925' },
    { id: 2,  displayName: 'Sofía Ferrara',       sex: 'F', isAlive: true,  generation:  0, relationship: 'hermana',         dateOfBirth: '14 OCT 1927' },
    { id: 3,  displayName: 'Marco Ferrara',       sex: 'M', isAlive: true,  generation:  0, relationship: 'hermano',         dateOfBirth: '9 JUN 1929' },
    { id: 4,  displayName: 'Lucía Ferrara',       sex: 'F', isAlive: true,  generation:  0, relationship: 'hermana',         dateOfBirth: '22 FEB 1932' },
    { id: 5,  displayName: 'María López',         sex: 'F', isAlive: true,  generation:  0, relationship: 'cónyuge',         dateOfBirth: '18 MAY 1928' },

    // Gen 0 — cousins from Antonio (3 marriages: F5a, F5b, F5c)
    { id: 6,  displayName: 'Pedro Ferrara',       sex: 'M', isAlive: true,  generation:  0, relationship: 'primo',           dateOfBirth: '3 JAN 1922' },
    { id: 7,  displayName: 'Rosa A. Ferrara',     sex: 'F', isAlive: true,  generation:  0, relationship: 'prima',           dateOfBirth: '19 NOV 1924' },
    { id: 8,  displayName: 'Alberto Ferrara',     sex: 'M', isAlive: true,  generation:  0, relationship: 'primo',           dateOfBirth: '30 MAY 1932' },
    { id: 9,  displayName: 'Carlos Ferrara',      sex: 'M', isAlive: true,  generation:  0, relationship: 'primo',           dateOfBirth: '14 AUG 1935' },
    { id: 10, displayName: 'Ana Ferrara',         sex: 'F', isAlive: true,  generation:  0, relationship: 'prima',           dateOfBirth: '7 APR 1938' },
    { id: 71, displayName: 'Fabio Ferrara',       sex: 'M', isAlive: true,  generation:  0, relationship: 'primo',           dateOfBirth: '12 DEC 1950' },

    // Gen 0 — cousins from Carmen, Rosario, Lucia, Piero, Graziella
    { id: 72, displayName: 'Valentina Romero',    sex: 'F', isAlive: true,  generation:  0, relationship: 'prima',           dateOfBirth: '25 SEP 1926' },
    { id: 73, displayName: 'Hugo Jr. Romero',     sex: 'M', isAlive: true,  generation:  0, relationship: 'primo',           dateOfBirth: '8 FEB 1928' },
    { id: 74, displayName: 'Isabel Romero',       sex: 'F', isAlive: true,  generation:  0, relationship: 'prima',           dateOfBirth: '17 JUL 1931' },
    { id: 75, displayName: 'Tomás Ferrara',       sex: 'M', isAlive: true,  generation:  0, relationship: 'primo',           dateOfBirth: '2 MAR 1926' },
    { id: 76, displayName: 'Flor Ferrara',        sex: 'F', isAlive: true,  generation:  0, relationship: 'prima',           dateOfBirth: '29 AUG 1928' },
    { id: 77, displayName: 'Diego Ruiz',          sex: 'M', isAlive: true,  generation:  0, relationship: 'primo',           dateOfBirth: '11 APR 1930' },
    { id: 78, displayName: 'Carla Ruiz',          sex: 'F', isAlive: true,  generation:  0, relationship: 'prima',           dateOfBirth: '6 NOV 1932' },
    { id: 79, displayName: 'Gianni Ferrara',      sex: 'M', isAlive: true,  generation:  0, relationship: 'primo',           dateOfBirth: '13 JAN 1933' },
    { id: 80, displayName: 'Silvia Ferrara',      sex: 'F', isAlive: true,  generation:  0, relationship: 'prima',           dateOfBirth: '4 SEP 1935' },
    { id: 81, displayName: 'Bruno Ferrara',       sex: 'M', isAlive: true,  generation:  0, relationship: 'primo',           dateOfBirth: '21 MAR 1938' },
    { id: 82, displayName: 'Nicolás Álvarez',     sex: 'M', isAlive: true,  generation:  0, relationship: 'primo',           dateOfBirth: '8 JUN 1934' },
    { id: 83, displayName: 'Clara Álvarez',       sex: 'F', isAlive: true,  generation:  0, relationship: 'prima',           dateOfBirth: '30 OCT 1936' },

    // Gen 0 — cousins from Jan, Katarzyna (Nowak line), Rafael, Mercedes (García line)
    { id: 84, displayName: 'Pablo Nowak',         sex: 'M', isAlive: true,  generation:  0, relationship: 'primo',           dateOfBirth: '17 MAR 1928' },
    { id: 85, displayName: 'Agustina Nowak',      sex: 'F', isAlive: true,  generation:  0, relationship: 'prima',           dateOfBirth: '9 AUG 1930' },
    { id: 86, displayName: 'Rodrigo Reyes',       sex: 'M', isAlive: true,  generation:  0, relationship: 'primo',           dateOfBirth: '5 FEB 1930' },
    { id: 87, displayName: 'Elena García',        sex: 'F', isAlive: true,  generation:  0, relationship: 'prima',           dateOfBirth: '22 NOV 1935' },
    { id: 88, displayName: 'Manuel García',       sex: 'M', isAlive: true,  generation:  0, relationship: 'primo',           dateOfBirth: '14 APR 1938' },
    { id: 89, displayName: 'Beatriz Torres',      sex: 'F', isAlive: true,  generation:  0, relationship: 'prima',           dateOfBirth: '11 SEP 1933' },

    // Gen -1 — focal's children
    { id: 93, displayName: 'Valentina Ferrara',   sex: 'F', isAlive: true,  generation: -1, relationship: 'hija',            dateOfBirth: '18 JAN 1952' },
    { id: 94, displayName: 'Roberto Ferrara',     sex: 'M', isAlive: true,  generation: -1, relationship: 'hijo',            dateOfBirth: '29 JUN 1954' },
    { id: 95, displayName: 'Giulia Ferrara',      sex: 'F', isAlive: true,  generation: -1, relationship: 'hija',            dateOfBirth: '3 NOV 1957' },

    // Gen -1 — children of 1st-cousin marriage F16: Pedro(6)×Sofía(2) — ENDOGAMY Lv.1
    { id: 90, displayName: 'Claudio Ferrara',     sex: 'M', isAlive: true,  generation: -1, relationship: 'sobrino',         dateOfBirth: '4 MAY 1950' },
    { id: 91, displayName: 'Paola Ferrara',       sex: 'F', isAlive: true,  generation: -1, relationship: 'sobrina',         dateOfBirth: '12 OCT 1952' },
    { id: 92, displayName: 'Sergio Ferrara',      sex: 'M', isAlive: true,  generation: -1, relationship: 'sobrino',         dateOfBirth: '7 MAR 1955' },

    // Gen -1 — children of 1st-cousin marriage F17: Marco(3)×Agustina(85) — ENDOGAMY Lv.1 Nowak line
    { id: 98, displayName: 'Elena Ferrara-N.',    sex: 'F', isAlive: true,  generation: -1, relationship: 'sobrina',         dateOfBirth: '22 APR 1955' },
    { id: 99, displayName: 'Ricardo Ferrara-N.',  sex: 'M', isAlive: true,  generation: -1, relationship: 'sobrino',         dateOfBirth: '14 SEP 1957' },

    // Gen -2 — children of 2nd-cousin marriage F18: Claudio(90)×Valentina(93) — ENDOGAMY Lv.2
    { id: 96, displayName: 'Luca Ferrara',        sex: 'M', isAlive: true,  generation: -2, relationship: 'nieto',           dateOfBirth: '6 FEB 1978' },
    { id: 97, displayName: 'Chiara Ferrara',      sex: 'F', isAlive: true,  generation: -2, relationship: 'nieta',           dateOfBirth: '30 AUG 1981' },

    // Gen -2 — children of single husband F19: Roberto(94)
    { id: 100, displayName: 'Mauro Ferrara',       sex: 'M', isAlive: true,  generation: -2, relationship: 'nieto',           dateOfBirth: null },
    { id: 101, displayName: 'Ailén Ferrara',       sex: 'F', isAlive: true,  generation: -2, relationship: 'nieta',           dateOfBirth: null }
  ],
  families: [
    // Gen+2 → Gen+1
    { id: 'F1',  husbandIds: [51], wifeIds: [52], childIds: [11,12,13,14,15,16,17,18] }, // 8 children ✓
    { id: 'F2',  husbandIds: [53], wifeIds: [54], childIds: [19,20,21]                },
    { id: 'F3',  husbandIds: [55], wifeIds: [56], childIds: [22,23]                   },

    // Gen+1 → Gen+0
    { id: 'F4',  husbandIds: [11], wifeIds: [19], childIds: [1,2,3,4]                 }, // Ferrara×Nowak cross-family
    { id: 'F5a', husbandIds: [12], wifeIds: [24], childIds: [6,7]                     }, // Antonio 1st marriage
    { id: 'F5b', husbandIds: [12], wifeIds: [25], childIds: [8,9,10]                  }, // Antonio 2nd marriage
    { id: 'F5c', husbandIds: [12], wifeIds: [26], childIds: [71]                      }, // Antonio 3rd marriage ✓
    { id: 'F6',  husbandIds: [27], wifeIds: [13], childIds: [72,73,74]                },
    { id: 'F7',  husbandIds: [14], wifeIds: [28], childIds: [75,76]                   },
    { id: 'F8',  husbandIds: [29], wifeIds: [15], childIds: [77,78]                   },
    { id: 'F9',  husbandIds: [16], wifeIds: [30], childIds: [79,80,81]                },
    { id: 'F10', husbandIds: [31], wifeIds: [18], childIds: [82,83]                   },
    { id: 'F11', husbandIds: [20], wifeIds: [32], childIds: [84,85]                   },
    { id: 'F12', husbandIds: [33], wifeIds: [21], childIds: [86]                      },
    { id: 'F13', husbandIds: [22], wifeIds: [34], childIds: [87,88]                   },
    { id: 'F14', husbandIds: [35], wifeIds: [23], childIds: [89]                      },

    // Gen+0 marriages
    { id: 'F15', husbandIds: [1],  wifeIds: [5],  childIds: [93,94,95]                },
    { id: 'F16', husbandIds: [6],  wifeIds: [2],  childIds: [90,91,92]                }, // 1st-cousin endogamy ✓
    { id: 'F17', husbandIds: [3],  wifeIds: [85], childIds: [98,99]                   }, // 1st-cousin endogamy (Nowak) ✓

    // Gen-1 × Gen-1
    { id: 'F18', husbandIds: [90], wifeIds: [93], childIds: [96,97]                   }, // 2nd-cousin endogamy ✓

    // Gen-1 single husband
    { id: 'F19', husbandIds: [94], wifeIds: [],   childIds: [100,101]                 }
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
      return sendPdf(res, MOCK_PDF_BASE64);
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

function sendPdf(res, base64) {
  var buf = Buffer.from(base64, 'base64');
  res.writeHead(200, { 'Content-Type': 'application/pdf', 'Content-Length': buf.length, 'Access-Control-Allow-Origin': '*' });
  res.end(buf);
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
