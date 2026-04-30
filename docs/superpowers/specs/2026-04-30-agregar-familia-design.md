# Diseño: Página "Agregá tu familia al árbol de Azul" (`/agregar-familia`)

**Fecha:** 2026-04-30  
**Estado:** Aprobado

---

## Objetivo

Permitir a nuevos visitantes construir visualmente su mini-árbol familiar (ego + pareja + padres + abuelos + hijos), buscar coincidencias automáticamente en el GEDCOM de Genea Azul mientras cargan datos, y enviar su información al proyecto para que sea incorporada al árbol.

---

## Decisiones de diseño

| Decisión | Elección | Alternativas descartadas |
|---|---|---|
| UX del árbol | Visual interactivo (nodos + CSS) | Wizard paso a paso, acordeón jerárquico |
| Ubicación | Nueva página `/agregar-familia` | Tab dentro de `/buscar`, reemplazar `/buscar` |
| Búsqueda | Automática al guardar cada nodo | Botón explícito, búsqueda por nodo individual |
| Envío al backend | Nuevo endpoint REST en Spring Boot | Email, Google Form, WhatsApp |
| Storage backend | Nueva tabla JPA en la DB existente | JSON file en volumen, H2 en memoria |
| Scope familiar | Ego + pareja + 2 padres + 4 abuelos + hijos | Sin bisabuelos, tíos, hermanos, nueras/yernos |

---

## Archivos nuevos (frontend)

| Archivo | Propósito |
|---|---|
| `agregar-familia.html` | Entry point con meta tags SEO propios (título, descripción, canonical, OG, JSON-LD) |
| `pages/agregar-familia.html` | Fragment del cuerpo de la página, cargado por el router vía AJAX |
| `js/tree-builder.js` | Módulo `GeneaAzul.treeBuilder` — toda la lógica del árbol |
| Clases `ga-tree-*` en `css/main.css` | Estilos del árbol visual, nodos, conectores y modal |

## Archivos modificados (frontend)

| Archivo | Cambio |
|---|---|
| `js/router.js` | Nueva entrada de ruta `agregar-familia` → `pages/agregar-familia.html` |
| `index.html` | Nuevo `<script src="/js/tree-builder.js">` + link en navbar + inicialización en `$(document).ready` |
| `_headers` | Entrada `no-cache` para `/agregar-familia` y `agregar-familia.html` |
| `sitemap.xml` | Nueva URL `/agregar-familia` |
| `scripts/generate-route-pages.js` | Nueva entrada para generar `agregar-familia.html` desde `index.html` |

---

## Estado interno del módulo (`GeneaAzul.treeBuilder`)

El módulo mantiene un objeto de estado con todos los nodos. Estructura de cada nodo:

```javascript
{
  givenName:   string | null,
  surname:     string | null,
  sex:         'M' | 'F' | null,       // null = sin especificar
  birthDay:    number | null,           // 1-31
  birthMonth:  number | null,           // 1-12
  birthYear:   number | null,
  birthPlace:  string | null,           // ciudad libre
  isDeceased:  boolean,
  deathDay:    number | null,
  deathMonth:  number | null,
  deathYear:   number | null,
  deathPlace:  string | null
}
```

El nodo `partner` tiene un campo adicional:
```javascript
  relationshipType: 'CURRENT_PARTNER' | 'FORMER_PARTNER' | 'MARRIED' | 'DIVORCED' | null
```

El estado completo del módulo:
```javascript
{
  ego:                 PersonNode,
  partner:             PartnerNode,
  father:              PersonNode,
  mother:              PersonNode,
  paternalGrandfather: PersonNode,
  paternalGrandmother: PersonNode,
  maternalGrandfather: PersonNode,
  maternalGrandmother: PersonNode,
  children:            PersonNode[]   // array dinámico, sin límite fijo
}
```

API pública del módulo: `{ init, cleanup }` — mismo patrón que los otros módulos.

---

## Layout visual del árbol

Cinco filas con conectores CSS entre ellas:

```
[ Ab. paterno ] [ Ab. paterna ]        [ Ab. materno ] [ Ab. materna ]
        └──────────┘                          └──────────┘
            [ Padre ]                              [ Madre ]
                         └──────────┘
                    [ Vos ]  〰  [ (Ex) Pareja ]
                         └──────────┘
               [ Hijo/a ] [ Hijo/a ] [ + Agregar hijo/a ]
```

### Nodo vacío
- Borde punteado gris (`1.5px dashed`)
- Texto "＋ Agregar" centrado
- Clic → abre Bootstrap modal con formulario en blanco

### Nodo lleno
- Borde sólido con color según generación (azul para ego, azul más claro para padres/abuelos, verde para hijos)
- Muestra: nombre, fecha de nacimiento (día/mes/año según disponibilidad), ciudad
- Si fallecido: icono † + año de fallecimiento
- Clic → reabre modal con datos pre-cargados para editar

### Conector entre ego y pareja
- Ícono Bootstrap `bi-people` o similar — no alianzas

### Mobile
- El árbol tiene `overflow-x: auto` — scrollable horizontalmente
- Nodos con `min-width` fijo para mantener legibilidad

---

## Modal de persona (Bootstrap modal)

Campos del formulario:

| Campo | Tipo | Requerido | Notas |
|---|---|---|---|
| Nombre | text | No (sí para ego en búsqueda) | |
| Apellido | text | No (sí para ego en búsqueda) | |
| Sexo | radio M / F / Sin especificar | No | Default: Sin especificar. Nota: "se puede inferir del nombre" |
| Nacimiento: día | number 1-31 | No | |
| Nacimiento: mes | number 1-12 | No | |
| Nacimiento: año | number | No | |
| Nacimiento: ciudad | text | No | Texto libre |
| Está fallecida/o | checkbox | No | Revela bloque de fallecimiento |
| Fallecimiento: día | number 1-31 | No | Solo visible si fallecido checked |
| Fallecimiento: mes | number 1-12 | No | Solo visible si fallecido checked |
| Fallecimiento: año | number | No | Solo visible si fallecido checked |
| Fallecimiento: ciudad | text | No | Solo visible si fallecido checked |
| Tipo de vínculo | radio | No | **Solo en nodo pareja.** Opciones: Pareja actual / Ex pareja / Matrimonio / Matrimonio disuelto |

Botones del modal: **Guardar** (primary) / **Eliminar** (danger, solo si el nodo ya tiene datos).

---

## Búsqueda automática (flujo)

1. Usuario guarda un nodo con datos (al menos un campo no vacío)
2. Si `ego.givenName` existe → se construye el `SearchFamilyDto` y se llama a `POST /api/search/family`
3. Si `ego.givenName` no existe todavía → no se busca; se muestra un hint "Completá tu nombre para buscar coincidencias"
4. El panel de resultados debajo del árbol muestra un spinner durante la búsqueda
5. Al recibir respuesta → se actualizan los resultados usando `buildPersonComponent`. Para reutilizarla, se agrega a la API pública de `GeneaAzul.search`: `return { init, cleanup, buildPersonComponent }`. `tree-builder.js` la llama como `GeneaAzul.search.buildPersonComponent(person, idx)`.
6. Si el nodo guardado quedó vacío (usuario abrió modal y lo cerró sin datos) → no se dispara búsqueda

### Mapeo de fechas y campos para el search API

El API existente solo acepta `yearOfBirth` / `yearOfDeath` (enteros) e `isAlive` (boolean). Al construir el `SearchFamilyDto`:
- `yearOfBirth` ← `birthYear` del nodo (solo el año)
- `yearOfDeath` ← `deathYear` del nodo (solo el año)
- `isAlive` ← `!isDeceased` del nodo
- Las fechas completas (día/mes) y ciudades se ignoran para la búsqueda pero se envían completas en la submission
- El campo `sex` del nodo se pasa directamente (null si sin especificar — el API lo acepta)

### Mapeo de nodos al SearchFamilyDto

| Nodo del árbol | Campo del SearchFamilyDto |
|---|---|
| `ego` | `individual` |
| `partner` | `spouse` |
| `father` | `father` |
| `mother` | `mother` |
| `paternalGrandfather` | `paternalGrandfather` |
| `paternalGrandmother` | `paternalGrandmother` |
| `maternalGrandfather` | `maternalGrandfather` |
| `maternalGrandmother` | `maternalGrandmother` |
| `children` | *(no enviados — API no los acepta como input de búsqueda)* |

El campo `contact` del `SearchFamilyDto`: si el usuario ya ingresó su contacto en el campo inferior, se incluye en el request; de lo contrario se envía como `null`. El API lo acepta vacío sin error.

---

## Envío al backend

### Validaciones antes de enviar
- `ego.givenName` y `ego.surname` presentes
- Campo de contacto presente (email, WhatsApp o @instagram)

### Request body — `POST /api/tree-builder/submit`

```json
{
  "ego": {
    "givenName": "Juan", "surname": "Pérez", "sex": "M",
    "birthDay": 15, "birthMonth": 6, "birthYear": 1985,
    "birthPlace": "Azul",
    "isDeceased": false,
    "deathDay": null, "deathMonth": null, "deathYear": null, "deathPlace": null
  },
  "partner": {
    "givenName": "María", "surname": "García", "sex": "F",
    "birthDay": null, "birthMonth": null, "birthYear": 1987,
    "birthPlace": "Buenos Aires",
    "isDeceased": false,
    "deathDay": null, "deathMonth": null, "deathYear": null, "deathPlace": null,
    "relationshipType": "MARRIED"
  },
  "father": { "givenName": "Carlos", "surname": "Pérez", "sex": "M", "birthDay": null, "birthMonth": null, "birthYear": 1955, "birthPlace": "Azul", "isDeceased": false, "deathDay": null, "deathMonth": null, "deathYear": null, "deathPlace": null },
  "mother": null,
  "paternalGrandfather": null,
  "paternalGrandmother": null,
  "maternalGrandfather": { "givenName": "Giuseppe", "surname": "Russo", "sex": "M", "birthDay": 12, "birthMonth": 3, "birthYear": 1880, "birthPlace": "Palermo", "isDeceased": true, "deathDay": null, "deathMonth": null, "deathYear": 1955, "deathPlace": null },
  "maternalGrandmother": null,
  "children": [
    { "givenName": "Sofía", "surname": "Pérez", "sex": "F", "birthDay": null, "birthMonth": null, "birthYear": 2012, "birthPlace": "Azul", "isDeceased": false, "deathDay": null, "deathMonth": null, "deathYear": null, "deathPlace": null }
  ],
  "contact": "juanperez@gmail.com"
}
```

Los nodos vacíos se envían como `null`.

### Response (200 OK)
```json
{ "submissionId": "uuid-aqui" }
```

### Mensaje de éxito al usuario
Texto en español confirmando el envío e indicando que el equipo de Genea Azul lo revisará.

### Errores
- Validación fallida: mensaje en español inline (mismo estilo que `/buscar`)
- Error de red/server: `displayErrorCodeInSpanish('ERROR')` existente

---

## Backend — cambios en `gedcom-analyzer` (Spring Boot)

### Nuevos endpoints

#### `POST /api/tree-builder/submit`
- Público (sin autenticación)
- Guarda la submission en DB: almacena `treeJson` (el body completo serializado como TEXT), `contact`, `ipAddress`, `submittedAt`
- Devuelve `{ submissionId: UUID }`
- Rate limiting: aplicar el mismo mecanismo que `/api/search/family`

#### `GET /api/tree-builder/submissions`
- Protegido: accesible solo desde localhost o con un header secreto (`X-Admin-Key`)
- Devuelve lista de submissions ordenadas por `submittedAt` desc
- Respuesta: `[ { submissionId, contact, submittedAt, ipAddress, treeJson } ]`

### Nueva entidad JPA

```
TreeSubmission {
  id:           UUID (PK, generado)
  submittedAt:  OffsetDateTime
  ipAddress:    String
  contact:      String (max 180)
  treeJson:     TEXT (el body completo)
}
```

### CORS
Agregar `/api/tree-builder/**` a la configuración CORS existente del backend.

---

## Consideraciones de seguridad

- `contact` y `treeJson` son datos de usuario — sanitizar antes de almacenar (trim, max length)
- El endpoint de submissions (`GET`) debe estar protegido; nunca expuesto públicamente
- Rate limiting en el endpoint de submit igual que en búsquedas
- No se almacena información sensible de personas vivas más allá de lo que el usuario voluntariamente ingresa

---

## Out of scope (v1)

- Bisabuelos, tíos/tías, hermanos, nueras/yernos, nietos
- Drag & drop de nodos
- Exportar el árbol como imagen o PDF
- Múltiples parejas para el ego (solo una pareja/ex pareja)
- Interfaz de revisión de submissions (solo endpoint GET directo)
- Notificación por email al recibir una submission
