# 3D Family Tree Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full-screen 3D family tree modal to the `/buscar` page that renders WebGL busts with force-directed layout, after a successful search.

**Architecture:** An ES5 IIFE (`GeneaAzul.familyTree3d`) in `family-tree-3d.js` handles modal lifecycle and graph data fetching. It lazy-loads a separate ES6 module (`family-tree-3d-scene.js`) which owns all Three.js code. The two files communicate through `window._ga3dInit(data)` and `window._ga3dDispose()` globals exposed by the scene module.

**Tech Stack:** Three.js 0.160.0 (CDN, lazy-loaded), jQuery 3.7.1 (already in project), ES5 IIFE pattern (main module), ES6 module (scene module only).

**Spec:** `docs/superpowers/specs/2026-04-24-3d-family-tree-design.md`

---

## API contract — real endpoint

**Endpoint:** `GET /api/search/family-tree/{personUuid}/graphJson`

**Response shape (`FamilyTreeGraphDto`):**

```json
{
  "focalPersonId": 123,
  "truncated": false,
  "totalPersons": 87,
  "persons": [
    {
      "id": 123,
      "displayName": "Juan C. Pérez",
      "sex": "M",
      "aka": null,
      "profilePicture": null,
      "yearOfBirth": 1950,
      "circaBirth": false,
      "yearOfDeath": null,
      "circaDeath": null,
      "isAlive": true,
      "generation": 0,
      "relationship": "persona principal"
    }
  ],
  "families": [
    {
      "id": "F1",
      "husbandIds": [123],
      "wifeIds": [456],
      "childIds": [789, 790]
    }
  ]
}
```

**Field notes:**
- `focalPersonId` — integer ID of the root person (the one searched for); always the first entry in `persons`
- `truncated` — `true` when the tree was capped at `maxGraphJsonNodesToExport` (default 500); the banner should show `totalPersons`
- `generation` — `distanceToAncestorRootPerson - distanceToAncestorThisPerson`: positive = ancestors (above focal), negative = descendants (below focal), `0` = same generation
- `sex` — one of `"M"`, `"F"`, `"U"`
- `husbandIds` / `wifeIds` — lists of integer person IDs (use `[0]` for the primary husband/wife in connectors)
- All person IDs are integers

---

## File Map

| File | Action | Responsibility |
| --- | --- | --- |
| `dev-server.js` | Modify | Add `GET /api/search/family-tree/:uuid/graphJson` mock |
| `js/family-tree-3d.js` | Create | ES5 IIFE: modal open/close, graph fetch, lazy-load scene module |
| `js/family-tree-3d-scene.js` | Create | ES6 module: Three.js renderer, simulation, busts, connectors |
| `index.html` | Modify | Add modal HTML, add `<script src="js/family-tree-3d.js">` |
| `css/main.css` | Modify | Modal overlay, legend, hint, truncated banner styles |
| `js/search.js` | Modify | Add "Ver árbol 3D" button, wire it in `activateFamilyTreeButtons` |

---

## Task 1: Mock API endpoint in dev-server.js

**Files:**
- Modify: `dev-server.js` (lines 166–173)

- [ ] **Add mock graph data constant** — paste this near the other `MOCK_*` constants (around line 130):

```javascript
// GET /api/search/family-tree/:uuid/graphJson — mock graph for 3D viewer
var MOCK_GRAPH = {
  focalPersonId: 1,
  truncated: false,
  totalPersons: 10,
  persons: [
    { id: 1,  displayName: 'Juan C. Pérez',   sex: 'M', isAlive: true,  generation:  0, relationship: 'Yo' },
    { id: 2,  displayName: 'María López',      sex: 'F', isAlive: true,  generation:  0, relationship: 'cónyuge' },
    { id: 3,  displayName: 'Carlos Pérez',     sex: 'M', isAlive: false, generation:  1, relationship: 'padre' },
    { id: 4,  displayName: 'Elena García',     sex: 'F', isAlive: true,  generation:  1, relationship: 'madre' },
    { id: 5,  displayName: 'Giuseppe Pérez',   sex: 'M', isAlive: false, generation:  2, relationship: 'abuelo paterno' },
    { id: 6,  displayName: 'Rosa Bianchi',     sex: 'F', isAlive: false, generation:  2, relationship: 'abuela paterna' },
    { id: 7,  displayName: 'José García',      sex: 'M', isAlive: false, generation:  2, relationship: 'abuelo materno' },
    { id: 8,  displayName: 'Ana Fernández',    sex: 'F', isAlive: false, generation:  2, relationship: 'abuela materna' },
    { id: 9,  displayName: 'Diego Pérez',      sex: 'M', isAlive: true,  generation: -1, relationship: 'hijo' },
    { id: 10, displayName: 'Laura Pérez',      sex: 'F', isAlive: true,  generation: -1, relationship: 'hija' }
  ],
  families: [
    { id: 'F1', husbandIds: [5],  wifeIds: [6],  childIds: [3]    },
    { id: 'F2', husbandIds: [7],  wifeIds: [8],  childIds: [4]    },
    { id: 'F3', husbandIds: [3],  wifeIds: [4],  childIds: [1]    },
    { id: 'F4', husbandIds: [1],  wifeIds: [2],  childIds: [9, 10] }
  ]
};
```

- [ ] **Register the GET route** — inside the `if (method === 'GET')` block (after the plainPdf line):

```javascript
if (/^\/api\/search\/family-tree\/[^/]+\/graphJson$/.test(url)) {
  return sendJson(res, MOCK_GRAPH);
}
```

- [ ] **Verify** — start the dev server and curl the endpoint:

```bash
node dev-server.js &
curl -s http://localhost:8090/api/search/family-tree/any-uuid/graphJson | head -5
```

Expected: JSON starting with `{"focalPersonId":1,...}`

- [ ] **Commit**

```bash
git add dev-server.js
git commit -m "feat: add mock /api/search/family-tree/:uuid/graphJson endpoint"
```

---

## Task 2: Modal HTML in index.html

**Files:**
- Modify: `index.html`

- [ ] **Add modal HTML** — find the closing `</main>` tag in `index.html` and insert the modal immediately before it:

```html
<!-- 3D family tree modal -->
<div id="ga-tree3d-modal" class="ga-tree3d-modal" style="display:none" role="dialog" aria-modal="true" aria-label="Árbol genealógico 3D">
  <button id="ga-tree3d-close" class="ga-tree3d-close" aria-label="Cerrar">&#x2715;</button>
  <div id="ga-tree3d-canvas-wrap" class="ga-tree3d-canvas-wrap"></div>
  <div id="ga-tree3d-legend" class="ga-tree3d-legend">
    <div><span class="ga-tree3d-dot" style="background:#b07820"></span> Hombre vivo</div>
    <div><span class="ga-tree3d-dot" style="background:#a04040"></span> Mujer viva</div>
    <div><span class="ga-tree3d-dot" style="background:#8090a8;opacity:.8"></span> Hombre fallecido</div>
    <div><span class="ga-tree3d-dot" style="background:#a09090;opacity:.8"></span> Mujer fallecida</div>
  </div>
  <div id="ga-tree3d-hint" class="ga-tree3d-hint">&#x1F5B1; Rotar &nbsp;&middot;&nbsp; &#x1F90F; Zoom &nbsp;&middot;&nbsp; &#x1F446; Tocar persona</div>
  <div id="ga-tree3d-truncated" class="ga-tree3d-truncated d-none"></div>
  <div id="ga-tree3d-loader" class="ga-tree3d-loader">
    <p>Construyendo &aacute;rbol&hellip;</p>
    <div class="ga-tree3d-bar"></div>
  </div>
</div>
```

- [ ] **Verify** — open browser at `http://localhost:8090`, open DevTools Elements panel, confirm `#ga-tree3d-modal` is in the DOM with `display:none`.

- [ ] **Commit**

```bash
git add index.html
git commit -m "feat: add 3D family tree modal HTML shell"
```

---

## Task 3: Modal CSS in main.css

**Files:**
- Modify: `css/main.css`

- [ ] **Add all modal styles** — append to end of `css/main.css`:

```css
/* ── 3D Family Tree Modal ─────────────────────────────────────── */
.ga-tree3d-modal {
  position: fixed;
  inset: 0;
  z-index: 1050;
  background: #f0e4c8;
  display: flex;
  align-items: stretch;
}

.ga-tree3d-canvas-wrap {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.ga-tree3d-canvas-wrap canvas {
  display: block;
  width: 100% !important;
  height: 100% !important;
}

.ga-tree3d-close {
  position: absolute;
  top: 14px;
  right: 14px;
  z-index: 10;
  background: rgba(240, 228, 200, 0.93);
  border: 1px solid rgba(120, 90, 30, 0.25);
  border-radius: 50%;
  width: 36px;
  height: 36px;
  font-size: 16px;
  color: #5a3800;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ga-tree3d-legend {
  position: absolute;
  top: 14px;
  right: 60px;
  background: rgba(240, 228, 200, 0.93);
  border: 1px solid rgba(120, 90, 30, 0.18);
  border-radius: 10px;
  padding: 10px 14px;
  font-size: 11px;
  color: #5a4020;
  font-family: Georgia, serif;
  line-height: 2;
  z-index: 10;
}

.ga-tree3d-dot {
  display: inline-block;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  margin-right: 6px;
  vertical-align: middle;
}

.ga-tree3d-hint {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(240, 228, 200, 0.9);
  border: 1px solid rgba(120, 90, 30, 0.18);
  border-radius: 30px;
  padding: 7px 20px;
  font-size: 11px;
  color: #7a5a30;
  pointer-events: none;
  white-space: nowrap;
  z-index: 10;
}

.ga-tree3d-truncated {
  position: absolute;
  top: 14px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(180, 140, 60, 0.15);
  border: 1px solid rgba(180, 140, 60, 0.4);
  border-radius: 8px;
  padding: 6px 16px;
  font-size: 11px;
  color: #6a4010;
  font-family: Georgia, serif;
  z-index: 10;
  white-space: nowrap;
}

.ga-tree3d-loader {
  position: absolute;
  inset: 0;
  background: #f0e4c8;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 5;
  transition: opacity 0.8s;
}

.ga-tree3d-loader p {
  color: #7a5a20;
  font-size: 12px;
  letter-spacing: 3px;
  text-transform: uppercase;
  margin-bottom: 14px;
  font-family: Georgia, serif;
}

.ga-tree3d-bar {
  width: 160px;
  height: 1px;
  background: rgba(120, 90, 30, 0.2);
  position: relative;
  overflow: hidden;
}

.ga-tree3d-bar::after {
  content: '';
  position: absolute;
  top: 0;
  left: -60px;
  width: 60px;
  height: 1px;
  background: #8b6914;
  animation: ga-tree3d-slide 1.2s ease-in-out infinite;
}

@keyframes ga-tree3d-slide {
  0%   { left: -60px; }
  100% { left: 220px; }
}
```

- [ ] **Verify** — in the browser console, run:

```javascript
document.getElementById('ga-tree3d-modal').style.display = 'flex';
```

Expected: full-screen parchment overlay with close button and legend visible.

- [ ] **Reset** — run `document.getElementById('ga-tree3d-modal').style.display = 'none';` in console.

- [ ] **Commit**

```bash
git add css/main.css
git commit -m "feat: add 3D family tree modal CSS"
```

---

## Task 4: ES5 IIFE skeleton — family-tree-3d.js

**Files:**
- Create: `js/family-tree-3d.js`
- Modify: `index.html` (add script tag)

- [ ] **Create the file:**

```javascript
var GeneaAzul = window.GeneaAzul || {};

GeneaAzul.familyTree3d = (function() {

  var _threeLoaded = false;
  var _threeCallbacks = [];
  var _currentUuid = null;

  /* ── Public: open the modal for a given search UUID ────────────── */
  function init(uuid) {
    _currentUuid = uuid;
    _openModal();
    _fetchGraph(uuid, function(graphData) {
      _ensureSceneLoaded(function() {
        window._ga3dInit(graphData);
      });
    });
  }

  /* ── Public: close and clean up ───────────────────────────────── */
  function dispose() {
    if (window._ga3dDispose) window._ga3dDispose();
    _closeModal();
    _currentUuid = null;
  }

  /* ─────────────────────────────────────────────────────────────── */

  function _openModal() {
    var $modal = $('#ga-tree3d-modal');
    $('#ga-tree3d-loader').css('opacity', '1').show();
    $modal.show();
    document.body.style.overflow = 'hidden';
  }

  function _closeModal() {
    $('#ga-tree3d-modal').hide();
    document.body.style.overflow = '';
  }

  function _fetchGraph(uuid, cb) {
    GeneaAzul.utils.apiGet(
      GeneaAzul.config.apiBaseUrl + '/api/search/family-tree/' + uuid + '/graphJson',
      function(data) { cb(data); },
      function() {
        $('#ga-tree3d-loader').hide();
        alert('Error al cargar el árbol. Intentá de nuevo.');
        dispose();
      }
    );
  }

  function _ensureSceneLoaded(cb) {
    if (_threeLoaded) { cb(); return; }
    _threeCallbacks.push(cb);
    if (_threeCallbacks.length > 1) return; // already injecting
    var s = document.createElement('script');
    s.type = 'module';
    s.src = '/js/family-tree-3d-scene.js';
    s.onload = function() {
      _threeLoaded = true;
      var pending = _threeCallbacks.slice();
      _threeCallbacks = [];
      for (var i = 0; i < pending.length; i++) pending[i]();
    };
    s.onerror = function() {
      _threeCallbacks = [];
      alert('Error al cargar el visualizador 3D.');
      dispose();
    };
    document.head.appendChild(s);
  }

  /* ── Wire close button ────────────────────────────────────────── */
  $(document).on('click', '#ga-tree3d-close', function() { dispose(); });
  $(document).on('keydown', function(e) {
    if (e.key === 'Escape' && _currentUuid) dispose();
  });

  return { init: init, dispose: dispose };

})();
```

- [ ] **Add script tag to index.html** — after all other `js/` script tags, before `</body>`:

```html
<script src="js/family-tree-3d.js"></script>
```

- [ ] **Verify** — open browser console at `http://localhost:8090`, run:

```javascript
typeof GeneaAzul.familyTree3d.init  // → "function"
typeof GeneaAzul.familyTree3d.dispose  // → "function"
```

- [ ] **Commit**

```bash
git add js/family-tree-3d.js index.html
git commit -m "feat: add family-tree-3d IIFE skeleton with modal open/close and lazy-load"
```

---

## Task 5: "Ver árbol 3D" button in search.js

**Files:**
- Modify: `js/search.js` (lines 528–535 and 570–573)

- [ ] **Add the button** — in `buildPersonComponent()`, after the Pyvis `view-family-tree-btn` block (around line 534), append a new row:

```javascript
      .append($('<div>').addClass('mt-1 text-center')
        .append($('<button>').addClass('btn btn-sm btn-dark view-family-tree-3d-btn disabled')
          .attr('id', 'view-family-tree-3d-btn-' + uid)
          .attr('type', 'button')
          .on('click', { personUuid: uid }, function(e) {
            GeneaAzul.familyTree3d.init(e.data.personUuid);
          })
          .html('<i class="bi bi-box-fill me-1"></i>Ver &aacute;rbol 3D')))
```

- [ ] **Enable the button in `activateFamilyTreeButtons`** — add one line (line 573 area):

```javascript
  function activateFamilyTreeButtons(uuid) {
    $('#search-family-tree-wait-sign-' + uuid).addClass('d-none');
    $('#search-family-tree-btn-' + uuid).removeClass('disabled');
    $('#view-family-tree-btn-' + uuid).removeClass('disabled');
    $('#view-family-tree-3d-btn-' + uuid).removeClass('disabled');  // ← add this
  }
```

- [ ] **Verify** — open `http://localhost:8090/buscar`, do a search (any name), wait for the spinner to disappear. Three buttons should appear: PDF, Pyvis, and "Ver árbol 3D". Click "Ver árbol 3D" — the modal overlay should appear with the loading bar. Check the Network tab for a request to `/api/search/family-tree/mock-person-1/graphJson`.

- [ ] **Commit**

```bash
git add js/search.js
git commit -m "feat: add 'Ver árbol 3D' button to search results"
```

---

## Task 6: Three.js scene module — setup

**Files:**
- Create: `js/family-tree-3d-scene.js`

- [ ] **Create the file with scene setup and expose `_ga3dInit` / `_ga3dDispose`:**

```javascript
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { OrbitControls }  from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass }     from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/RenderPass.js';

let _renderer, _scene, _camera, _controls, _composer, _animId;

function _buildMaterials() {
  return {
    maleLive:   new THREE.MeshStandardMaterial({ color: 0xb07820, roughness: 0.55, metalness: 0.15 }),
    femaleLive: new THREE.MeshStandardMaterial({ color: 0xa04040, roughness: 0.55, metalness: 0.10 }),
    focal:      new THREE.MeshStandardMaterial({ color: 0xc89020, roughness: 0.35, metalness: 0.45,
                  emissive: new THREE.Color(0x3a2000), emissiveIntensity: 0.3 }),
    maleDead:   new THREE.MeshStandardMaterial({ color: 0x8090a8, roughness: 0.75, metalness: 0.05, transparent: true, opacity: 0.75 }),
    femaleDead: new THREE.MeshStandardMaterial({ color: 0xa09090, roughness: 0.75, metalness: 0.05, transparent: true, opacity: 0.72 }),
  };
}

let MAT;

function nodeMat(node) {
  if (node.focal)    return MAT.focal;
  if (!node.isAlive) return node.sex === 'M' ? MAT.maleDead : MAT.femaleDead;
  return node.sex === 'M' ? MAT.maleLive : MAT.femaleLive;
}

function _buildScene(containerId) {
  const wrap = document.getElementById(containerId);
  const W = wrap.clientWidth, H = wrap.clientHeight;

  _renderer = new THREE.WebGLRenderer({ antialias: true });
  _renderer.setSize(W, H);
  _renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  _renderer.shadowMap.enabled = true;
  _renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  _renderer.toneMapping = THREE.ACESFilmicToneMapping;
  _renderer.toneMappingExposure = 1.0;
  wrap.appendChild(_renderer.domElement);

  _scene = new THREE.Scene();
  _scene.background = new THREE.Color(0xf0e4c8);
  _scene.fog = new THREE.FogExp2(0xf0e4c8, 0.016);

  _camera = new THREE.PerspectiveCamera(48, W / H, 0.1, 200);
  _camera.position.set(0, 3, 24);

  _controls = new OrbitControls(_camera, _renderer.domElement);
  _controls.enableDamping = true;
  _controls.dampingFactor = 0.06;
  _controls.enablePan = false;
  _controls.minDistance = 5;
  _controls.maxDistance = 55;
  _controls.autoRotate = true;
  _controls.autoRotateSpeed = 0.2;
  _renderer.domElement.addEventListener('pointerdown', () => { _controls.autoRotate = false; });

  _composer = new EffectComposer(_renderer);
  _composer.addPass(new RenderPass(_scene, _camera));

  _scene.add(new THREE.AmbientLight(0xfff8f0, 0.9));
  const sun = new THREE.DirectionalLight(0xffe8b0, 1.6);
  sun.position.set(6, 12, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = sun.shadow.camera.bottom = -24;
  sun.shadow.camera.right = sun.shadow.camera.top = 24;
  sun.shadow.camera.far = 70;
  _scene.add(sun);
  const fillA = new THREE.DirectionalLight(0xd0c8ff, 0.35);
  fillA.position.set(-5, 2, -4); _scene.add(fillA);
  const fillB = new THREE.DirectionalLight(0xffd0a0, 0.25);
  fillB.position.set(0, -5, 6); _scene.add(fillB);

  window.addEventListener('resize', _onResize);
}

function _onResize() {
  if (!_renderer) return;
  const wrap = _renderer.domElement.parentElement;
  if (!wrap) return;
  const W = wrap.clientWidth, H = wrap.clientHeight;
  _camera.aspect = W / H;
  _camera.updateProjectionMatrix();
  _renderer.setSize(W, H);
  _composer.setSize(W, H);
}

window._ga3dInit = function(graphData) {
  // dispose any previous scene first
  if (_renderer) window._ga3dDispose();

  MAT = _buildMaterials();
  _buildScene('ga-tree3d-canvas-wrap');

  // placeholder animate loop — renders blank parchment scene
  function loop() {
    _animId = requestAnimationFrame(loop);
    _controls.update();
    _composer.render();
  }
  loop();

  // hide loader
  const loader = document.getElementById('ga-tree3d-loader');
  if (loader) { loader.style.opacity = '0'; setTimeout(() => loader.style.display = 'none', 800); }
};

window._ga3dDispose = function() {
  if (_animId) cancelAnimationFrame(_animId);
  window.removeEventListener('resize', _onResize);
  if (_scene) {
    _scene.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
        else { if (obj.material.map) obj.material.map.dispose(); obj.material.dispose(); }
      }
    });
  }
  if (MAT) { Object.values(MAT).forEach(m => m.dispose()); MAT = null; }
  if (_renderer) { _renderer.dispose(); if (_renderer.domElement.parentElement) _renderer.domElement.remove(); }
  _renderer = _scene = _camera = _controls = _composer = _animId = null;
};
```

- [ ] **Verify** — click "Ver árbol 3D" in a search result. Expected: loading bar disappears, a blank parchment-colored canvas fills the modal. No console errors. Check Network tab: Three.js CDN requests appear (`three.module.js`, `OrbitControls.js`, etc.).

- [ ] **Commit**

```bash
git add js/family-tree-3d-scene.js
git commit -m "feat: add Three.js scene module with renderer, camera, lights, dispose"
```

---

## Task 7: Force-directed layout simulation

**Files:**
- Modify: `js/family-tree-3d-scene.js`

- [ ] **Add `_runLayout(persons, families)` function** — add before `window._ga3dInit`:

```javascript
const GY = 5.5; // vertical spacing between generations

function _runLayout(persons, families) {
  // Build edge list from families (use first husband/wife entry)
  const edges = [];
  families.forEach(fam => {
    const fatherId = fam.husbandIds && fam.husbandIds[0];
    const motherId = fam.wifeIds    && fam.wifeIds[0];
    if (fatherId && motherId) {
      edges.push({ a: fatherId, b: motherId, t: 'm' });
    }
    (fam.childIds || []).forEach(cid => {
      if (fatherId) edges.push({ a: fatherId, b: cid, t: 'p' });
      if (motherId) edges.push({ a: motherId, b: cid, t: 'p' });
    });
  });

  // Index by integer id
  const idx = {};
  persons.forEach((n, i) => { idx[n.id] = i; });

  // Fibonacci sphere initial positions
  const golden = (1 + Math.sqrt(5)) / 2;
  persons.forEach((n, i) => {
    if (n.focal) { n.pos = new THREE.Vector3(0, 0, 0); n.vel = new THREE.Vector3(); return; }
    const theta = Math.acos(1 - 2 * (i + 0.5) / persons.length);
    const phi   = 2 * Math.PI * i / golden;
    const r     = 9 + Math.abs(n.generation) * 1.5;
    n.pos = new THREE.Vector3(
      r * Math.sin(theta) * Math.cos(phi),
      n.generation * GY * 0.4 + r * Math.cos(theta) * 0.4,
      r * Math.sin(theta) * Math.sin(phi)
    );
    n.vel = new THREE.Vector3();
  });

  // Store sphere start for animation
  persons.forEach(n => { n.spherePos = n.pos.clone(); });

  // Simulate 350 steps
  const F = persons.map(() => new THREE.Vector3());
  for (let iter = 0; iter < 350; iter++) {
    F.forEach(f => f.set(0, 0, 0));

    // Repulsion
    for (let i = 0; i < persons.length; i++) {
      for (let j = i + 1; j < persons.length; j++) {
        const d = persons[i].pos.clone().sub(persons[j].pos);
        const l = Math.max(d.length(), 0.4);
        const f = 16 / (l * l);
        d.normalize().multiplyScalar(f);
        F[i].add(d); F[j].sub(d);
      }
    }

    // Spring attraction along edges
    edges.forEach(e => {
      const i = idx[e.a], j = idx[e.b];
      if (i === undefined || j === undefined) return;
      const d = persons[j].pos.clone().sub(persons[i].pos);
      const l = d.length();
      const rest = e.t === 'm' ? 1.8 : 3.0;
      const f = 0.05 * (l - rest);
      d.normalize().multiplyScalar(f);
      if (!persons[i].focal) F[i].add(d);
      if (!persons[j].focal) F[j].sub(d);
    });

    // Generational gravity (Y) + center gravity (X/Z)
    persons.forEach((n, i) => {
      if (n.focal) return;
      F[i].y  += 0.07 * (n.generation * GY - n.pos.y);
      F[i].x  -= 0.004 * n.pos.x;
      F[i].z  -= 0.004 * n.pos.z;
    });

    // Apply with damping
    persons.forEach((n, i) => {
      if (n.focal) return;
      n.vel.addScaledVector(F[i], 1).multiplyScalar(0.84);
      n.pos.addScaledVector(n.vel, 0.5);
    });
  }

  // Store final positions
  persons.forEach(n => { n.finalPos = n.pos.clone(); });

  // Reset to sphere for settle animation
  persons.forEach(n => { n.pos.copy(n.spherePos); });

  return edges;
}
```

- [ ] **Call `_runLayout` in `_ga3dInit`** — replace the placeholder `loop()` call in `_ga3dInit` with:

```javascript
window._ga3dInit = function(graphData) {
  if (_renderer) window._ga3dDispose();
  MAT = _buildMaterials();
  _buildScene('ga-tree3d-canvas-wrap');

  const persons  = graphData.persons.map(n => Object.assign({}, n));
  const families = graphData.families;
  persons.forEach(n => { n.focal = (n.id === graphData.focalPersonId); });

  const edges = _runLayout(persons, families);  // assigns n.pos, n.spherePos, n.finalPos

  // placeholder loop — just renders scene
  let clock = 0;
  function loop() {
    _animId = requestAnimationFrame(loop);
    clock += 0.013;
    _controls.update();
    _composer.render();
  }
  loop();

  const loader = document.getElementById('ga-tree3d-loader');
  if (loader) { loader.style.opacity = '0'; setTimeout(() => loader.style.display = 'none', 800); }
};
```

- [ ] **Verify** — click "Ver árbol 3D". Open console, add a temporary log before `_buildScene`:

```javascript
// Temporary — add after _runLayout call, remove after verifying:
console.log('focal pos:', persons.find(n=>n.focal).finalPos);
console.log('focal spherePos:', persons.find(n=>n.focal).spherePos);
```

Expected: focal has `finalPos = {x:0, y:0, z:0}`, spherePos with a large radius. Remove the log after verifying.

- [ ] **Commit**

```bash
git add js/family-tree-3d-scene.js
git commit -m "feat: add force-directed layout simulation"
```

---

## Task 8: Bust builder + sprite

**Files:**
- Modify: `js/family-tree-3d-scene.js`

- [ ] **Add `_buildBust(node)` function** — add after `nodeMat`, before `_buildScene`:

```javascript
function _buildBust(node) {
  const mat = nodeMat(node);
  const s   = node.focal ? 1.15 : 1.0;
  const g   = new THREE.Group();

  function part(geo, x, y, z) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true; m.receiveShadow = true;
    m.userData.node = node;
    g.add(m);
  }

  part(new THREE.SphereGeometry(0.22 * s, 18, 18),             0, 0.52 * s, 0); // head
  part(new THREE.CylinderGeometry(0.08*s, 0.10*s, 0.16*s, 12), 0, 0.30 * s, 0); // neck
  part(new THREE.CylinderGeometry(0.19*s, 0.26*s, 0.34*s, 14), 0, 0.10 * s, 0); // chest
  part(new THREE.CylinderGeometry(0.28*s, 0.28*s, 0.05*s, 14), 0, 0.28 * s, 0); // shoulders

  if (node.focal) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.38, 0.025, 8, 40),
      new THREE.MeshBasicMaterial({ color: 0xd4a020, transparent: true, opacity: 0.55 })
    );
    ring.rotation.x = Math.PI / 2; ring.position.y = -0.08;
    g.add(ring);
  }

  if (!node.isAlive) {
    const cMat = new THREE.MeshStandardMaterial({ color: 0x7a7870, roughness: 0.9 });
    const cv = new THREE.Mesh(new THREE.BoxGeometry(0.035*s, 0.18*s, 0.035*s), cMat);
    cv.position.set(0, 0.88 * s, 0); cv.castShadow = true; g.add(cv);
    const ch = new THREE.Mesh(new THREE.BoxGeometry(0.12*s, 0.035*s, 0.035*s), cMat);
    ch.position.set(0, 0.94 * s, 0); ch.castShadow = true; g.add(ch);
  }

  return g;
}
```

- [ ] **Add `_makeSprite(node)` function** — add after `_buildBust`:

```javascript
function _makeSprite(node) {
  const label = node.displayName.split(' ').slice(0, 2).join(' ');
  const CW = 300, CH = 52;
  const cv  = document.createElement('canvas');
  cv.width = CW; cv.height = CH;
  const ctx = cv.getContext('2d');
  const fontSize = node.focal ? 25 : 19;
  ctx.font = `bold ${fontSize}px Georgia, serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

  // WordArt offset shadow layers
  for (let i = 4; i >= 1; i--) {
    ctx.fillStyle = `rgba(80,40,0,${0.18 - i * 0.03})`;
    ctx.fillText(label, CW / 2 + i, CH / 2 + i);
  }

  const col = node.focal    ? '#5a3800'
            : !node.isAlive ? '#72706a'
            : node.sex === 'M' ? '#5a3800' : '#6a2828';
  ctx.fillStyle = col;
  ctx.fillText(label, CW / 2, CH / 2);
  if (node.isAlive) {
    ctx.fillStyle = 'rgba(255,230,160,0.18)';
    ctx.fillText(label, CW / 2, CH / 2 - 1);
  }

  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false
  }));
  sprite.scale.set(1.9, 1.9 * (CH / CW), 1);
  return sprite;
}
```

- [ ] **Place busts and sprites in `_ga3dInit`** — add after `_runLayout`, before the loop:

```javascript
  const nodeMap       = {};
  const avatarGroups  = [];
  const pickMeshes    = [];

  persons.forEach(node => {
    const bust = _buildBust(node);
    bust.position.copy(node.pos);
    _scene.add(bust);
    bust.traverse(c => { if (c.isMesh && c.userData.node) pickMeshes.push(c); });

    const sprite = _makeSprite(node);
    sprite.position.set(node.pos.x, node.pos.y - 0.55, node.pos.z);
    _scene.add(sprite);

    nodeMap[node.id] = { bust, sprite };
    avatarGroups.push({ bust, node });
  });
```

- [ ] **Add cylindrical billboard to the animation loop** — inside `loop()`, before `_composer.render()`:

```javascript
    avatarGroups.forEach(({ bust, node }) => {
      bust.rotation.y = Math.atan2(
        _camera.position.x - node.pos.x,
        _camera.position.z - node.pos.z
      );
    });
```

- [ ] **Verify** — click "Ver árbol 3D". Expected: 10 busts visible (mix of amber/terracotta/stone colors), each with a name label below. Busts rotate to face camera as you drag to rotate the scene. Focal person (Juan C. Pérez) has a gold ring at its base and is slightly larger.

- [ ] **Commit**

```bash
git add js/family-tree-3d-scene.js
git commit -m "feat: add 3D busts and billboard name sprites"
```

---

## Task 9: Family connectors

**Files:**
- Modify: `js/family-tree-3d-scene.js`

- [ ] **Add `_seg()` helper and `_buildConnectors()` function** — add before `window._ga3dInit`:

```javascript
const _edgeParticles = [];

function _seg(p1, p2, col, opacity) {
  const geo = new THREE.BufferGeometry().setFromPoints([p1.clone(), p2.clone()]);
  _scene.add(new THREE.Line(geo, new THREE.LineBasicMaterial({
    color: col, transparent: true, opacity, depthWrite: false
  })));
  const n = Math.max(3, Math.ceil(p1.distanceTo(p2) * 5));
  const pts = [];
  for (let i = 0; i <= n; i++) pts.push(p1.clone().lerp(p2, i / n));
  _scene.add(new THREE.Points(
    new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.PointsMaterial({ color: col, size: 0.04, transparent: true, opacity: opacity * 0.45, depthWrite: false, sizeAttenuation: true })
  ));
}

function _flowPart(p1, p2, col, speed, phase) {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(0.04, 7, 7),
    new THREE.MeshBasicMaterial({ color: col, depthWrite: false })
  );
  _scene.add(m);
  _edgeParticles.push({ mesh: m, p1: p1.clone(), p2: p2.clone(), speed, phase });
}

function _buildConnectors(families, nodeMap) {
  const COUPLE = 0x8b6010, CHILD = 0x7a5828;

  families.forEach(fam => {
    const fatherId = fam.husbandIds && fam.husbandIds[0];
    const motherId = fam.wifeIds    && fam.wifeIds[0];
    const fN = fatherId != null ? nodeMap[fatherId] : null;
    const mN = motherId != null ? nodeMap[motherId] : null;
    if (!fN || !mN) return;

    const fp = fN.bust.position, mp = mN.bust.position;
    const barY    = Math.max(fp.y, mp.y) + 0.28;
    const fBar    = new THREE.Vector3(fp.x, barY, fp.z);
    const mBar    = new THREE.Vector3(mp.x, barY, mp.z);
    const midBar  = fBar.clone().lerp(mBar, 0.5);
    const col     = COUPLE;
    const op      = 0.7;

    _seg(fBar, mBar, col, op);
    const orb = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0xb08020, roughness: 0.4, metalness: 0.3 })
    );
    orb.position.copy(midBar); orb.castShadow = true; _scene.add(orb);
    _flowPart(fBar, mBar, col, 0.25, Math.random());

    if (!fam.childIds || !fam.childIds.length) return;

    const cPos   = fam.childIds.map(id => nodeMap[id] && nodeMap[id].bust.position).filter(Boolean);
    if (!cPos.length) return;
    const cY     = cPos[0].y + 0.28;
    const jY     = (barY + cY) / 2;
    const junc   = new THREE.Vector3(midBar.x, jY, midBar.z);

    _seg(midBar, junc, col, 0.55);
    _flowPart(midBar, junc, col, 0.32, Math.random());

    if (cPos.length === 1) {
      const cT = new THREE.Vector3(cPos[0].x, cY, cPos[0].z);
      _seg(junc, cT, CHILD, 0.55);
      _flowPart(junc, cT, CHILD, 0.28, Math.random());
    } else {
      const sorted = [...cPos].sort((a, b) => a.x - b.x);
      _seg(new THREE.Vector3(sorted[0].x, jY, sorted[0].z),
           new THREE.Vector3(sorted[sorted.length - 1].x, jY, sorted[sorted.length - 1].z),
           CHILD, 0.55);
      cPos.forEach(cp => {
        _seg(new THREE.Vector3(cp.x, jY, cp.z), new THREE.Vector3(cp.x, cY, cp.z), CHILD, 0.55);
        _flowPart(new THREE.Vector3(cp.x, jY, cp.z), new THREE.Vector3(cp.x, cY, cp.z),
                  CHILD, 0.25 + Math.random() * 0.12, Math.random());
      });
    }
  });
}
```

- [ ] **Call `_buildConnectors` in `_ga3dInit`** — add after placing busts/sprites, before the loop:

```javascript
  _buildConnectors(families, nodeMap);
```

- [ ] **Animate flow particles** — inside the `loop()` function, after the billboard update:

```javascript
    _edgeParticles.forEach(p => {
      p.mesh.position.lerpVectors(p.p1, p.p2, (clock * p.speed + p.phase) % 1);
    });
```

- [ ] **Clear particles on dispose** — add to `_ga3dDispose`, before `_renderer.dispose()`:

```javascript
  _edgeParticles.length = 0;
```

- [ ] **Verify** — click "Ver árbol 3D". Expected: sepia right-angle connectors appear between family members — couple bars between parents, vertical drops to children, horizontal span across siblings. Small gold orbs at couple midpoints. Tiny particles flow along connectors.

- [ ] **Commit**

```bash
git add js/family-tree-3d-scene.js
git commit -m "feat: add 3D family connectors with flow particles"
```

---

## Task 10: Settle animation (sphere → final positions)

**Files:**
- Modify: `js/family-tree-3d-scene.js`

The scene currently shows the final positions immediately. This task adds the sphere-start animation.

- [ ] **Update the animation loop in `_ga3dInit`** — replace the `loop()` function body with:

```javascript
  let settleT  = 0;
  let settled  = false;
  const SETTLE_DUR = 1.8; // seconds

  function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  function loop() {
    _animId = requestAnimationFrame(loop);
    clock += 0.013;
    _controls.update();

    // Settle: lerp from sphere positions to final
    if (!settled) {
      settleT += 0.013 / SETTLE_DUR;
      if (settleT >= 1) {
        settleT = 1; settled = true;
        _buildConnectors(families, nodeMap);
      }
      const et = easeInOut(settleT);
      persons.forEach(node => {
        node.pos.lerpVectors(node.spherePos, node.finalPos, et);
        const { bust, sprite } = nodeMap[node.id];
        bust.position.copy(node.pos);
        sprite.position.set(node.pos.x, node.pos.y - 0.55, node.pos.z);
      });
    }

    // Billboard
    avatarGroups.forEach(({ bust, node }) => {
      bust.rotation.y = Math.atan2(_camera.position.x - node.pos.x, _camera.position.z - node.pos.z);
    });

    // Flow particles (only after settled, so they don't chase flying nodes)
    if (settled) {
      _edgeParticles.forEach(p => {
        p.mesh.position.lerpVectors(p.p1, p.p2, (clock * p.speed + p.phase) % 1);
      });
    }

    if (navTarget) {
      _controls.target.lerp(navTarget, 0.07);
      if (_controls.target.distanceTo(navTarget) < 0.01) navTarget = null;
    }

    _composer.render();
  }
```

- [ ] **Add `navTarget` variable** — declare before `loop()`:

```javascript
  let navTarget = null;
```

- [ ] **Remove the `_buildConnectors(families, nodeMap)` call** from before the loop (it is now called inside `loop()` on settle completion).

- [ ] **Verify** — click "Ver árbol 3D". Expected: busts start spread on a sphere, then smoothly settle into the force-directed layout over ~2 seconds. After settling, connectors appear. The animation runs once and does not repeat.

- [ ] **Commit**

```bash
git add js/family-tree-3d-scene.js
git commit -m "feat: add sphere-to-graph settle animation"
```

---

## Task 11: Click to navigate

**Files:**
- Modify: `js/family-tree-3d-scene.js`

- [ ] **Add raycaster and click handler in `_ga3dInit`** — add after declaring `navTarget`:

```javascript
  const raycaster = new THREE.Raycaster();
  const mouse     = new THREE.Vector2();
  let lastTouch   = 0;

  function onPick(cx, cy) {
    if (!settled) return; // don't pick during animation
    mouse.x =  (cx / window.innerWidth)  * 2 - 1;
    mouse.y = -(cy / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, _camera);
    const hits = raycaster.intersectObjects(pickMeshes, false);
    if (!hits.length) return;
    const node = hits[0].object.userData.node;
    if (!node) return;
    navTarget = node.pos.clone();
    _controls.autoRotate = false;
  }

  _renderer.domElement.addEventListener('click', e => onPick(e.clientX, e.clientY));
  _renderer.domElement.addEventListener('touchend', e => {
    const now = Date.now();
    if (now - lastTouch < 400) return; // debounce double-tap
    lastTouch = now;
    if (e.changedTouches.length) onPick(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
  }, { passive: true });
```

- [ ] **Verify** — wait for the settle animation to finish, then click a bust. Expected: the camera smoothly pans so the clicked person is centered. Rotation stops. Click another person — camera moves to them.

- [ ] **Commit**

```bash
git add js/family-tree-3d-scene.js
git commit -m "feat: add click-to-navigate camera targeting"
```

---

## Task 12: Truncated tree banner

**Files:**
- Modify: `js/family-tree-3d-scene.js`
- Modify: `dev-server.js` (temporarily to test)

- [ ] **Show banner in `_ga3dInit`** — add after `_buildScene`, before layout:

```javascript
  if (graphData.truncated) {
    const banner = document.getElementById('ga-tree3d-truncated');
    if (banner) {
      banner.textContent = 'Se muestran las ' + graphData.persons.length + ' personas más cercanas. El árbol completo tiene ' + graphData.totalPersons + ' personas.';
      banner.classList.remove('d-none');
    }
  }
```

- [ ] **Hide banner on dispose** — in `_ga3dDispose`, before the renderer dispose:

```javascript
  const banner = document.getElementById('ga-tree3d-truncated');
  if (banner) banner.classList.add('d-none');
```

- [ ] **Test truncated banner** — temporarily modify `MOCK_GRAPH` in `dev-server.js`:

```javascript
// temporary — revert after verifying
truncated: true,
totalPersons: 312,
```

- [ ] **Verify** — click "Ver árbol 3D". Expected: a subtle amber banner appears near the top of the modal: *"Se muestran las 10 personas más cercanas. El árbol completo tiene 312 personas."*

- [ ] **Revert dev-server.js** — set `truncated: false, totalPersons: 10` back in `MOCK_GRAPH`.

- [ ] **Commit**

```bash
git add js/family-tree-3d-scene.js
git commit -m "feat: show truncated-tree warning banner"
```

---

## Task 13: Full end-to-end smoke test

No new code — validates the complete flow manually before the final commit.

- [ ] **Start dev server:** `node dev-server.js`

- [ ] **Open** `http://localhost:8090/buscar`

- [ ] **Search:** type any name and click "Buscar". Confirm spinner appears, then all three buttons appear (PDF, Pyvis, 3D) in disabled state. Wait for them to become active.

- [ ] **Open 3D modal:** click "Ver árbol 3D". Confirm:
  - Loading bar animates
  - Three.js CDN loads (visible in Network tab, first open only)
  - Busts appear on a sphere then settle (~2 sec)
  - Connectors appear after settle
  - Legend visible top-right, close button top-right, hint bottom-center
  - No console errors

- [ ] **Rotate:** drag to orbit the scene. Busts always face camera.

- [ ] **Zoom:** scroll / pinch. Min/max distances enforce limits.

- [ ] **Click person:** camera pans to center on them.

- [ ] **Close:** click ✕ or press Escape. Modal disappears. Body scroll restored.

- [ ] **Reopen:** click "Ver árbol 3D" again. Scene rebuilds cleanly (no duplicated renderers, no console warnings about lost WebGL context).

- [ ] **Memory check:** in DevTools Performance, check for no lingering requestAnimationFrame loops after close (use the Performance > Record and inspect for frame activity).

---

## Task 14: Final commit

- [ ] **Commit all files together if any were left unstaged:**

```bash
git add js/family-tree-3d.js js/family-tree-3d-scene.js index.html css/main.css js/search.js dev-server.js
git status  # confirm only expected files
git commit -m "feat: 3D family tree viewer — full integration"
```

---

## Self-Review

**Spec coverage check:**

| Spec section | Covered by task |
| --- | --- |
| Modal full-screen | Task 2, 3 |
| Lazy-load Three.js | Task 4 (IIFE `_ensureSceneLoaded`) |
| GET /graphJson endpoint (mock) | Task 1 |
| Force-directed layout | Task 7 |
| Busts (head+neck+chest) | Task 8 |
| Canvas sprite names | Task 8 |
| Family connectors | Task 9 |
| Flow particles | Task 9 |
| Settle animation | Task 10 |
| Click to navigate | Task 11 |
| Truncated tree banner | Task 12 |
| Dispose / cleanup | Task 6 (`_ga3dDispose`) |
| Mobile controls | Task 6 (OrbitControls, `enablePan=false`) |
| Button in search.js | Task 5 |
| index.html script tag | Task 4 |

**Gaps identified and addressed:**
- `MAT` materials moved inside `_buildMaterials()` factory called at the top of `_ga3dInit`, so they are re-created on each open and disposed correctly on close — no stale-material bug on second open.
- `_edgeParticles` array is module-level — verified it persists between `_buildConnectors` calls in Task 9.
- `navTarget` is cleared implicitly when `_ga3dDispose` stops the animation loop — low risk, no fix needed.

**Placeholder scan:** No TBD/TODO placeholders. All code blocks are complete.

**Type consistency:** `node.pos`, `node.spherePos`, `node.finalPos` are all `THREE.Vector3`, assigned in `_runLayout`, read in the loop and billboard — consistent throughout. All person IDs are integers (match `FamilyTreeGraphDto`).
