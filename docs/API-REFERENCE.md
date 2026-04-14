# Genea Azul — Backend API Reference

## Base URL

```
Production: https://gedcom-analyzer-app.fly.dev
Local dev:  http://localhost:8080  (or wherever Spring Boot runs)
```

The frontend determines the base URL dynamically:
```javascript
var API_BASE_URL = (window.location.hostname === 'localhost')
    ? window.location.origin
    : 'https://gedcom-analyzer-app.fly.dev';
```

## CORS

The backend allows CORS from these origins:
- `http://geneaazul.com.ar:[*]`
- `https://geneaazul.com.ar:[*]`
- `http://*.geneaazul.com.ar:[*]`
- `https://*.geneaazul.com.ar:[*]`

During development on `localhost` or `*.pages.dev`, you may need to update the backend's `@CrossOrigin` annotations or use a proxy.

## Important Notes

- **Fly.io cold starts**: The backend runs on Fly.io and may take 10-30 seconds to wake up from a cold start. The health check endpoint is used to trigger this on page load. Use a 10-second timeout.
- **Rate limiting**: The backend tracks searches by IP address. Too many searches in a short period returns a `TOO-MANY-REQUESTS` error.
- **Content-Type**: All POST requests must send `Content-Type: application/json`.

---

## Endpoints

### 1. Health Check / App Info

```
GET /api/gedcom-analyzer
```

**Purpose**: Wake up the backend (Fly.io cold start), check if the API is available, get configuration flags.

**Response** (200 OK):
```json
{
  "env": "fly",
  "version": "1.2.3",
  "disableObfuscateLiving": false
}
```

| Field | Type | Description |
|-------|------|-------------|
| `env` | string | Active Spring profile ("fly", "local", etc.) |
| `version` | string | Backend version |
| `disableObfuscateLiving` | boolean | If `true`, don't obfuscate living persons' data |

**Frontend usage**:
- Call on page load with 10s timeout
- On success: enable search features, show the search page
- On failure: show "server unavailable" message with contact links
- If `disableObfuscateLiving` is true, set `obfuscateLiving = false` globally

---

### 2. Metadata

```
GET /api/gedcom-analyzer/metadata
```

**Purpose**: Get the tree's metadata (person count, last update date).

**Response** (200 OK):
```json
{
  "personsCount": 70512,
  "modifiedDateTime": "2026-04-13T12:00:00-03:00",
  "reloadDuration": null
}
```

| Field | Type | Description |
|-------|------|-------------|
| `personsCount` | integer | Total persons in the tree |
| `modifiedDateTime` | ISO datetime | Last time the tree was updated |
| `reloadDuration` | string/null | Only present after reload, shows reload duration |

**Frontend usage**:
- Call after successful health check
- Display `personsCount` in hero counters and search page header
- Format with Argentine locale: `70.512`

---

### 3. Search Family (Main Search)

```
POST /api/search/family
Content-Type: application/json
```

**Purpose**: Search for a person in the family tree using data about them and their relatives.

**Request body** (`SearchFamilyDto`):
```json
{
  "individual": {
    "givenName": "Juan",
    "surname": "Pérez",
    "sex": null,
    "isAlive": true,
    "yearOfBirth": 1985,
    "yearOfDeath": null,
    "placeOfBirth": "Azul"
  },
  "spouse": null,
  "father": {
    "givenName": "Carlos",
    "surname": "Pérez",
    "sex": null,
    "isAlive": true,
    "yearOfBirth": null,
    "yearOfDeath": null,
    "placeOfBirth": null
  },
  "mother": null,
  "paternalGrandfather": null,
  "paternalGrandmother": null,
  "maternalGrandfather": null,
  "maternalGrandmother": null,
  "contact": "juanperez@gmail.com",
  "obfuscateLiving": true,
  "onlySecondaryDescription": true,
  "isForceRewrite": false
}
```

**SearchPersonDto fields**:

| Field | Type | Max Length | Constraints | Description |
|-------|------|-----------|-------------|-------------|
| `givenName` | string | 60 | Optional | First name(s) |
| `surname` | string | 60 | Optional | Last name |
| `sex` | enum | — | `"M"`, `"F"`, or `null` | Biological sex |
| `isAlive` | boolean | — | Optional | Whether the person is alive |
| `yearOfBirth` | integer | — | 0-2025 | Year of birth |
| `yearOfDeath` | integer | — | 0-2025 | Year of death (only if not alive) |
| `placeOfBirth` | string | 80 | Optional | Place of birth (free text) |

**Top-level SearchFamilyDto fields**:

| Field | Type | Description |
|-------|------|-------------|
| `individual` | SearchPersonDto | The main person being searched |
| `spouse` | SearchPersonDto | Their spouse/partner (optional) |
| `father` | SearchPersonDto | Their father (optional) |
| `mother` | SearchPersonDto | Their mother (optional) |
| `paternalGrandfather` | SearchPersonDto | Paternal grandfather (optional) |
| `paternalGrandmother` | SearchPersonDto | Paternal grandmother (optional) |
| `maternalGrandfather` | SearchPersonDto | Maternal grandfather (optional) |
| `maternalGrandmother` | SearchPersonDto | Maternal grandmother (optional) |
| `contact` | string (max 180) | Email, WhatsApp, or Instagram handle |
| `obfuscateLiving` | boolean | Whether to hide living persons' details (default: true) |
| `onlySecondaryDescription` | boolean | Use secondary description format (default: true) |
| `isForceRewrite` | boolean | Force regeneration of family tree files (default: false) |

**Response** (`SearchFamilyResultDto`, 200 OK):
```json
{
  "people": [
    {
      "uuid": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "sex": "M",
      "isAlive": true,
      "name": "Juan Carlos Pérez",
      "aka": null,
      "profilePicture": null,
      "dateOfBirth": "15 MAR 1985",
      "placeOfBirth": "Azul, Buenos Aires, Argentina",
      "dateOfDeath": null,
      "parents": [
        {
          "relationship": "father",
          "personName": "Carlos Alberto Pérez",
          "personData": "1955 – vive"
        }
      ],
      "spouses": [
        {
          "personName": "María García",
          "personData": "1987 – vive",
          "children": [
            {
              "personName": "<private> Pérez",
              "personData": "<private>"
            }
          ]
        }
      ],
      "personsCountInTree": 342,
      "surnamesCountInTree": 87,
      "ancestryCountries": ["🇮🇹", "🇪🇸", "🇫🇷"],
      "ancestryGenerations": {
        "ascending": 8,
        "descending": 3
      },
      "maxDistantRelationship": {
        "personIndex": 0,
        "personSex": "M",
        "personIsAlive": false,
        "personName": "Giuseppe Pérez",
        "personYearOfBirth": 1820,
        "personYearOfBirthIsAbout": true,
        "personCountryOfBirth": "🇮🇹",
        "referenceType": "PARENT",
        "generation": 5,
        "grade": 1,
        "isInLaw": false,
        "isHalf": false,
        "adoptionType": null,
        "spouseSex": null,
        "isSeparated": false,
        "isDistinguishedPerson": false,
        "treeSides": ["FATHER"],
        "isObfuscated": false
      },
      "distinguishedPersonsInTree": [
        {
          "name": "Federico Delbonis",
          "profilePicture": null
        }
      ]
    }
  ],
  "potentialResults": 0,
  "errors": []
}
```

**PersonDto fields**:

| Field | Type | Description |
|-------|------|-------------|
| `uuid` | UUID string | Unique person identifier (used for family tree PDF URL) |
| `sex` | `"M"` or `"F"` | Sex |
| `isAlive` | boolean | Whether alive |
| `name` | string | Full display name. May contain `<private>` if obfuscated |
| `aka` | string/null | Nickname or "also known as" |
| `profilePicture` | string/null | URL to profile picture (if any) |
| `dateOfBirth` | string | GEDCOM date format (see Date Formats below) |
| `placeOfBirth` | string | Full place name |
| `dateOfDeath` | string/null | GEDCOM date format or null if alive |
| `parents` | array | List of parent references |
| `spouses` | array | List of spouses with children |
| `personsCountInTree` | integer | Number of persons in this branch |
| `surnamesCountInTree` | integer | Number of distinct surnames in this branch |
| `ancestryCountries` | string array | Country flag emojis of ancestry |
| `ancestryGenerations` | object | `{ ascending: N, descending: N }` |
| `maxDistantRelationship` | RelationshipDto | Most distant known relative |
| `distinguishedPersonsInTree` | array | Notable people in the tree |

**Error responses** (in the `errors` array, NOT HTTP errors):
- `"TOO-MANY-REQUESTS"` — rate limited, too many searches from this IP

**HTTP error responses**:
- `500` — Server restarting
- `0` (no response) — Server down

---

### 4. Search Connection

```
POST /api/search/connection
Content-Type: application/json
```

**Purpose**: Find the family connection path between two people.

**Request body** (`SearchConnectionDto`):
```json
{
  "person1": {
    "givenName": "Juan",
    "surname": "Pérez",
    "sex": null,
    "isAlive": null,
    "yearOfBirth": 1985,
    "yearOfDeath": null,
    "placeOfBirth": null
  },
  "person2": {
    "givenName": "María",
    "surname": "García",
    "sex": null,
    "isAlive": null,
    "yearOfBirth": 1990,
    "yearOfDeath": null,
    "placeOfBirth": null
  }
}
```

Both `person1` and `person2` use the same `SearchPersonDto` structure. `givenName` and `surname` are required here (unlike family search where everything is optional).

**Response** (`SearchConnectionResultDto`, 200 OK):
```json
{
  "connections": [
    {
      "relationship": "self",
      "personName": "Juan Carlos Pérez",
      "personData": "(1985 – vive)"
    },
    {
      "relationship": "hijo",
      "personName": "Carlos Alberto Pérez",
      "personData": "(1955 – vive)"
    },
    {
      "relationship": "padre",
      "personName": "Roberto Pérez García",
      "personData": "(1980 – vive)"
    },
    {
      "relationship": "pareja",
      "personName": "María García",
      "personData": "(1990 – vive)"
    }
  ],
  "errors": []
}
```

The `connections` array forms a chain: Person1 → (relationship) → IntermediatePerson → ... → Person2. The first element is always Person1 with relationship "self".

**ConnectionDto fields**:

| Field | Type | Description |
|-------|------|-------------|
| `relationship` | string | Relationship label in Spanish (already localized by backend) |
| `personName` | string | Display name of person in the chain |
| `personData` | string | Parenthetical data (birth-death years) |

**Error codes** (in the `errors` array):
- `"TOO-MANY-REQUESTS"` — rate limited
- `"CONNECTIONS-PERSON-1-NOT-FOUND"` — person 1 not in the tree
- `"CONNECTIONS-PERSON-1-AMBIGUOUS"` — multiple matches for person 1
- `"CONNECTIONS-PERSON-2-NOT-FOUND"` — person 2 not in the tree
- `"CONNECTIONS-PERSON-2-AMBIGUOUS"` — multiple matches for person 2
- `"CONNECTIONS-SAME-PERSON"` — both inputs resolve to the same person

---

### 5. Family Tree PDF Download

```
GET /api/search/family-tree/{personUuid}/plainPdf?obfuscateLiving=true&onlySecondaryDescription=true
```

**Purpose**: Download a PDF of a person's family tree.

**Path parameters**:
- `personUuid` (UUID) — the `uuid` from the `PersonDto` in search results

**Query parameters**:
- `obfuscateLiving` (boolean, default: true) — obfuscate living persons
- `onlySecondaryDescription` (boolean, default: true)
- `forceRewrite` (boolean, default: false)

**Response**: Binary PDF file with `Content-Disposition: attachment` header.

**Response headers**:
- `Content-Disposition: attachment; filename=family-tree-perez-juan-carlos.pdf`
- `Content-Language: es`
- `File-Name: family-tree-perez-juan-carlos.pdf`

**Error response** (400): HTML body with error message.

**Frontend usage**:
- After search results, for each person with a UUID, show a "Descargar árbol" link
- Link URL: `{API_BASE_URL}/api/search/family-tree/{uuid}/plainPdf?obfuscateLiving={value}`
- Open in new tab or trigger download

---

### 6. Search Surnames

```
POST /api/search/surnames
Content-Type: application/json
```

**Purpose**: Search for surname information in the tree.

**Request body** (`SearchSurnamesDto`):
```json
{
  "surnames": ["Valicenti", "Cirigliano"]
}
```

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `surnames` | string array | Each max 60 chars, not blank | Surnames to search |

**Response** (`SearchSurnamesResultDto`, 200 OK):
```json
{
  "surnames": [
    {
      "surname": "Valicenti",
      "normalizedSurname": "VALICENTI",
      "frequency": 245,
      "variants": ["Valicente"],
      "countries": ["🇮🇹", "🇦🇷"],
      "firstSeenYear": 1875,
      "lastSeenYear": 2020
    }
  ]
}
```

**SearchSurnameResultDto fields**:

| Field | Type | Description |
|-------|------|-------------|
| `surname` | string | The surname as stored |
| `normalizedSurname` | string | Uppercase normalized form |
| `frequency` | integer | Number of persons with this surname |
| `variants` | string array | Known spelling variants |
| `countries` | string array | Country flag emojis where this surname appears |
| `firstSeenYear` | integer/null | Earliest year of event for this surname |
| `lastSeenYear` | integer/null | Latest year of event for this surname |

---

## Date Format Reference

The backend returns dates in GEDCOM format. The frontend must convert these to Spanish display format.

**GEDCOM date formats**:

| Format | Example | Spanish display |
|--------|---------|-----------------|
| `YYYY` | `1985` | `1985` |
| `DD MMM YYYY` | `15 MAR 1985` | `15 de mar de 1985` |
| `MMM YYYY` | `MAR 1985` | `mar de 1985` |
| `ABT YYYY` | `ABT 1985` | `aprox. 1985` |
| `EST YYYY` | `EST 1985` | `se estima 1985` |
| `BEF YYYY` | `BEF 1985` | `antes de 1985` |
| `AFT YYYY` | `AFT 1985` | `después de 1985` |
| `BET YYYY AND YYYY` | `BET 1980 AND 1990` | `entre 1980 y 1990` |
| `<private>` | `<private>` | `<fecha de nac. privada>` |

**Month abbreviations** (GEDCOM → Spanish):

| GEDCOM | Spanish |
|--------|---------|
| `JAN` | `ene` |
| `FEB` | `feb` |
| `MAR` | `mar` |
| `APR` | `abr` |
| `MAY` | `may` |
| `JUN` | `jun` |
| `JUL` | `jul` |
| `AUG` | `ago` |
| `SEP` | `sep` |
| `OCT` | `oct` |
| `NOV` | `nov` |
| `DEC` | `dic` |

---

## Relationship Types Reference

The `RelationshipDto` describes how a person relates to the search subject. Key fields:

### `referenceType` enum values:
- `"PARENT"` — ancestor (parent, grandparent, etc.)
- `"CHILD"` — descendant (child, grandchild, etc.)
- `"SIBLING"` — same generation (sibling, cousin, etc.)

### `generation` field:
- `1` = parent/child/sibling
- `2` = grandparent/grandchild/uncle/cousin
- `3` = great-grandparent/etc.
- Higher values for more distant relations

### `grade` field:
- `1` = direct (sibling, uncle, nephew)
- `2` = second (second cousin, etc.)
- Higher values for more distant grades

### `isInLaw` flag:
If true, the relationship is through marriage (e.g., "suegro", "cuñado", "yerno", "nuera")

### `isHalf` flag:
If true, half-sibling relationship (shares one parent, not both)

### `adoptionType` enum values:
- `null` — biological
- `"ADOPTIVE"` — adopted
- `"FOSTER"` — foster/crianza

### `treeSides` set values:
- `"FATHER"` — relationship through father's side
- `"MOTHER"` — relationship through mother's side
- Both can be present

### Spanish Relationship Name Logic

The complete relationship naming logic is complex and must be ported from the existing `index.ftlh` (the `getRelationshipInSpanish()` function, approximately 100 lines). Key mappings:

**Direct ancestors** (referenceType = PARENT):
- Gen 1: padre/madre
- Gen 2: abuelo/a
- Gen 3: bisabuelo/a
- Gen 4: tatarabuelo/a
- Gen 5+: trastatarabuelo/a + grade suffix

**Direct descendants** (referenceType = CHILD):
- Gen 1: hijo/a
- Gen 2: nieto/a
- Gen 3: bisnieto/a
- Gen 4: tataranieto/a
- Gen 5+: trastataraniet/o/a + grade suffix

**Same generation** (referenceType = SIBLING):
- Gen 1, Grade 1: hermano/a
- Gen 1, Grade 2+: primo/a + grade suffix
- Gen 2+: tío/a or sobrino/a (depending on generation direction)

**In-law** prefixes:
- `isInLaw=true` with parent: suegro/a
- `isInLaw=true` with child gen 1: yerno/nuera
- `isInLaw=true` with sibling gen 1 grade 1: cuñado/a
- Other in-law: "esposo/a de" + relationship

**Grade suffixes**:
- 2: segundo/a
- 3: tercero/a
- 4: cuarto/a
- 5: quinto/a
- 6: sexto/a
- 7: séptimo/a
- 8: octavo/a
- 9: noveno/a
- 10+: de Nº grado

---

## SexType Enum Values

- `"M"` — Male (Hombre)
- `"F"` — Female (Mujer)

---

## Error Handling Summary

| Scenario | Detection | User Message (Spanish) |
|----------|-----------|----------------------|
| Server cold start taking long | Health check pending >1.5s | Show spinner: "Iniciando el buscador, esperá unos segundos..." |
| Server down | Health check timeout (10s) or status 0 | "Hubo un problema iniciando el buscador. Por favor intentá ingresar nuevamente o contactanos..." + social links |
| Server error | HTTP 5xx | "El servidor se está reiniciando, intentá de nuevo." |
| Rate limited | `errors` contains `"TOO-MANY-REQUESTS"` | "Realizaste demasiadas consultas en la última hora, por favor esperá unos minutos o contactanos en redes sociales: @genea.azul" |
| Person 1 not found (connections) | `errors` contains `"CONNECTIONS-PERSON-1-NOT-FOUND"` | "La persona 1 no fue encontrada. La persona no se encuentra en el sistema..." |
| Person 1 ambiguous (connections) | `errors` contains `"CONNECTIONS-PERSON-1-AMBIGUOUS"` | "Más de un resultado para la persona 1. Completá el segundo nombre..." |
| Person 2 not found (connections) | `errors` contains `"CONNECTIONS-PERSON-2-NOT-FOUND"` | "La persona 2 no fue encontrada..." |
| Person 2 ambiguous (connections) | `errors` contains `"CONNECTIONS-PERSON-2-AMBIGUOUS"` | "Más de un resultado para la persona 2..." |
| Same person (connections) | `errors` contains `"CONNECTIONS-SAME-PERSON"` | "Las personas 1 y 2 son las mismas. No se puede calcular la conexión entre mismas personas." |
| Vacation mode | `config.onVacations === true` | "Nos tomamos vacaciones y apagamos el servidor. La página volverá a estar disponible a mediados de [mes]." |
