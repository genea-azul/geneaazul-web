# Árbol Genealógico 3D — Diseño

**Fecha:** 2026-04-24  
**Estado:** Aprobado — listo para implementación

---

## Resumen

Agregar una visualización 3D interactiva del árbol genealógico a la página `/buscar`. Tras una búsqueda exitosa, el usuario puede abrir un modal a pantalla completa con un árbol renderizado en WebGL (Three.js): figuras semipersonales (busto 3D) por cada persona, conectores estilo MyHeritage, layout automático por fuerza física, y navegación libre por cámara (rotar, zoom, tocar para ir a una persona).

---

## Contexto de diseño

### Lo que se agrega

Un botón **"Ver árbol 3D"** aparece junto a los botones de PDF y Pyvis después de una búsqueda exitosa. Al hacer clic abre un modal a pantalla completa con la escena Three.js.

### Decisiones clave acordadas en el brainstorming

| Aspecto | Decisión |
| --- | --- |
| Modalidad | Modal full-screen con botón de cerrar |
| Mobile | Mobile-first; pinch zoom, drag para rotar |
| Punto de partida | Cámara centrada en la persona encontrada |
| Interacción | Tap/clic en persona navega la cámara a ella |
| Figuras | Busto 3D (cabeza + cuello + pecho) con primitivas Three.js |
| Nombres | Canvas Sprite billboard (WordArt con capas de sombra) |
| Conectores | MyHeritage-style (right-angle), adaptados a 3D |
| Paleta | Pergamino y sepia — fondo cálido `#f0e4c8`, figuras arcilla/piedra |
| Color figuras | Vivo hombre=ámbar, vivo mujer=terracota, muerto=piedra translúcida |
| Layout | Force-directed 3D con gravedad generacional; refinado en implementación |
| Límite nodos | 150 nodos; si el árbol es mayor, avisar y recortar al subgrafo más cercano |
| Three.js | CDN lazy-loaded al abrir el modal (no en carga de página) |

---

## Arquitectura

```text
/buscar
  └── search.js
        ├── enableFamilyTreeButtons()   ← agrega botón "Ver árbol 3D"
        └── activateFamilyTreeButtons() ← habilita tras delay actual

js/family-tree-3d.js   ← módulo nuevo (GeneaAzul.familyTree3d IIFE)
  ├── init(uuid)        ← lazy-load Three.js, fetch graph, open modal
  ├── buildScene()      ← renderer, luces, materiales, post-processing
  ├── layout()          ← simulación force-directed → posiciones x,y,z
  ├── render()          ← busts, sprites, connectors, flow particles
  └── dispose()         ← limpia WebGL al cerrar modal

CSS: css/main.css       ← estilos del modal, leyenda, botones
API: GET /api/search/family-tree/{uuid}/graph  ← endpoint nuevo en backend
```

---

## 1. Endpoint API

### `GET /api/search/family-tree/{uuid}/graph`

Responde con el grafo de nodos y aristas necesario para la visualización.

**Response body:**

```json
{
  "focalPersonId": "abc-123",
  "nodes": [
    {
      "id": "abc-123",
      "name": "Nicolás Pérez García",
      "sex": "M",
      "alive": true,
      "generation": 0,
      "dateOfBirth": "15 MAR 1980",
      "dateOfDeath": null
    }
  ],
  "families": [
    {
      "id": "fam-1",
      "fatherId": "p1",
      "motherId": "p2",
      "childIds": ["abc-123", "sib-1"],
      "endogamic": false
    }
  ],
  "truncated": false,
  "totalNodes": 47
}
```

**Reglas del backend:**
- Máximo 150 nodos. Si el árbol es mayor, recortar al subgrafo del BFS más cercano al `focalPersonId`, priorizando línea directa sobre colaterales.
- Si se recortó: `truncated: true`, `totalNodes` refleja el conteo real.
- `generation`: 0 = focal, positivo = ancestros, negativo = descendientes.
- `endogamic: true` en una family cuando alguno de los padres ya aparece como hijo en otra family dentro del mismo grafo (ciclo detectado por el backend).
- Las personas privadas se envían como `"name": "<privado>"` (el frontend usa `GeneaAzul.i18n.displayNameInSpanish`).

---

## 2. Módulo frontend — `GeneaAzul.familyTree3d`

Archivo: `js/family-tree-3d.js`

```javascript
var GeneaAzul = window.GeneaAzul || {};

GeneaAzul.familyTree3d = (function() {

  var _scene, _renderer, _camera, _controls, _composer;
  var _nodes = [], _families = [], _nodeMap = {};
  var _avatarGroups = [], _pickMeshes = [], _edgeParticles = [];
  var _animId = null;

  function init(uuid) { /* lazy-load Three.js, fetch graph, openModal */ }
  function _loadThree(cb) { /* inyecta script tags CDN si no están */ }
  function _fetchGraph(uuid, cb) { /* apiGet /graph → cb(data) */ }
  function _openModal() { /* crea overlay full-screen */ }
  function _buildScene() { /* renderer, camera, lights, materials */ }
  function _layout() { /* force-directed simulation */ }
  function _buildBust(node) { /* head+neck+chest THREE primitives */ }
  function _makeSprite(node) { /* canvas billboard con WordArt */ }
  function _buildConnectors() { /* MyHeritage-style per FAMILIES */ }
  function _animate() { /* billboard + particles + camera lerp */ }
  function dispose() { /* cancelAnimationFrame, dispose renderer, remove DOM */ }

  return { init, dispose };

})();
```

### Lazy-loading de Three.js

Three.js (~600 KB minificado) se carga **solo al abrir el modal** inyectando los `<script>` del CDN. Si ya están en el DOM (reapertura), se reutilizan.

```javascript
// CDN a inyectar — versión fija three@0.160.0 (probada en prototipos):
// https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js
// https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js
// https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/EffectComposer.js
// https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/RenderPass.js
```

Usar `<script type="importmap">` + `<script type="module">` igual que en los prototipos.

### Compatibilidad ES5

El módulo IIFE es ES5. El código Three.js (ES modules) vive en un `<script type="module">` inline generado dinámicamente dentro del modal. Este script interno usa `import` y llama de vuelta al módulo IIFE mediante `window.GeneaAzul.familyTree3d._onThreeReady(data)`.

---

## 3. Layout — Simulación force-directed

### Algoritmo

1. **Inicialización:** distribuir nodos en esfera de Fibonacci con radio proporcional a la distancia de generación al focal.
2. **Simulación (350 iteraciones, pre-render):**
   - Repulsión O(n²): `F = k_r / d²` entre todo par de nodos.
   - Resorte por arista: `F = k_a * (d - rest)` donde `rest_marriage = 1.8`, `rest_parent_child = 3.0`.
   - Gravedad generacional (eje Y): `F_y = k_g * (gen * GY - pos.y)` — mantiene la jerarquía legible.
   - Gravedad central (X/Z leve): evita que ramas se escapen al infinito.
   - Focal fijo en `(0, 0, 0)`.
3. **Resultado:** posiciones `(x, y, z)` para cada nodo. Animación de "asentamiento" desde posiciones esféricas hasta finales (easing `easeInOut`, ~120 frames).

### Constantes de partida (refinar en implementación)

| Constante | Valor inicial |
|---|---|
| `GY` (separación generacional Y) | `5.5` |
| `k_r` (repulsión) | `16` |
| `k_a` (resorte) | `0.05` |
| `k_g` (gravedad generacional) | `0.07` |
| `damping` | `0.84` |
| `rest_marriage` | `1.8` |
| `rest_parent_child` | `3.0` |

> **Nota de implementación:** estos valores requieren calibración con árboles reales de distintos tamaños (10, 50, 100, 150 nodos). Prioritario: que la persona focal quede visualmente centrada y los ancestros en la mitad superior de la escena.

---

## 4. Figuras — Busto 3D

Cada persona se representa con un grupo Three.js de primitivas:

| Parte | Geometría | Posición Y local |
|---|---|---|
| Cabeza | `SphereGeometry(0.22, 18, 18)` | `0.52` |
| Cuello | `CylinderGeometry(0.08, 0.10, 0.16, 12)` | `0.30` |
| Pecho | `CylinderGeometry(0.19, 0.26, 0.34, 14)` | `0.10` |
| Hombros (disco) | `CylinderGeometry(0.28, 0.28, 0.05, 14)` | `0.28` |

**Modificadores:**
- Focal: escala `1.15×`, anillo dorado en base, `emissive` activo.
- Fallecido: cruz pequeña sobre la cabeza, material translúcido (`opacity ≈ 0.75`).

**Materiales (MeshStandardMaterial):**

| Estado | Color | Roughness | Metalness |
|---|---|---|---|
| Hombre vivo | `#b07820` (ámbar arcilla) | 0.55 | 0.15 |
| Mujer viva | `#a04040` (terracota) | 0.55 | 0.10 |
| Focal | `#c89020` (oro) | 0.35 | 0.45 + emissive |
| Hombre fallecido | `#8090a8` (piedra azulada) | 0.75 | 0.05 + transparent |
| Mujer fallecida | `#a09090` (piedra cálida) | 0.75 | 0.05 + transparent |

**Billboard cilíndrico:** en cada frame, rotar el grupo alrededor del eje Y para mirar a la cámara:
```javascript
bust.rotation.y = Math.atan2(
  camera.position.x - node.pos.x,
  camera.position.z - node.pos.z
);
```

---

## 5. Nombres — Canvas Sprite

`THREE.Sprite` con `CanvasTexture`. Siempre mira a la cámara (comportamiento nativo del Sprite).

- Fuente: `bold 19px Georgia, serif` (focal: `25px`)
- Efecto WordArt: 4 capas de sombra desplazadas (offset 1–4px, opacidad decreciente)
- Color texto: sepia oscuro para vivos, gris para fallecidos
- Canvas: `300 × 52px`
- Escala sprite en escena: `1.9 × 0.33`
- Posición: `node.pos.y - 0.55` (debajo del busto)

**No usar TextGeometry** — genera extrusiones que se convierten en "rieles infinitos" al combinarse con el bloom.

---

## 6. Conectores — Estilo MyHeritage en 3D

Por cada `family` en el grafo:

1. **Barra de pareja** (`couple bar`): línea entre los dos padres a `pos.y + 0.28`.
2. **Orbe central:** `SphereGeometry` dorado en el punto medio de la barra.
3. **Bajada vertical:** desde el punto medio hasta el nivel `junctionY = (barY + childY) / 2`.
4. **Travesaño horizontal:** de izquierda a derecha sobre todos los hijos, en `junctionY`.
5. **Bajadas a hijos:** desde el punto del travesaño encima de cada hijo hasta su posición.

En el layout force-directed los padres pueden estar en distintas posiciones `z`, por lo que los conectores son líneas rectas en 3D (no necesariamente en el plano XY). Esto es legible y refuerza visualmente la "mezcla de ramas".

**Familias endogámicas:** misma estructura, pero color dorado (`0xc89020`) en lugar del sepia estándar.

**Partículas de flujo:** esfera pequeña animada que recorre cada segmento con `lerpVectors`. Opacidad baja, solo refuerza la dirección del parentesco.

> **Nota de implementación:** con topologías muy complejas (un nodo apareciendo en múltiples familias) los conectores pueden superponerse. Considerar en implementación: (a) reducir opacidad de líneas cuando hay muchas, (b) solo dibujar la barra de pareja sin los travesaños para familias secundarias del mismo nodo.

---

## 7. Iluminación y entorno

```javascript
scene.background = new THREE.Color(0xf0e4c8);    // pergamino
scene.fog = new THREE.FogExp2(0xf0e4c8, 0.016);  // niebla cálida para profundidad

// Luces
AmbientLight(0xfff8f0, 0.9)                       // luz ambiente cálida
DirectionalLight(0xffe8b0, 1.6)  pos(6,12,8)      // sol, con shadow map
DirectionalLight(0xd0c8ff, 0.35) pos(-5,2,-4)     // fill frío
DirectionalLight(0xffd0a0, 0.25) pos(0,-5,6)      // rebote cálido desde abajo

// Tone mapping
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.0
```

**Sin bloom (UnrealBloomPass):** causa lavado en fondos claros. La profundidad se logra con niebla + shadow mapping.

---

## 8. Cámara e interacción

### Configuración inicial
```javascript
camera.position.set(0, 3, 24)   // frente al focal
controls.target.set(0, 0, 0)    // apuntando al focal
controls.autoRotate = true
controls.autoRotateSpeed = 0.2
```

### Controles (OrbitControls)
- Rotar: arrastrar mouse / un dedo
- Zoom: scroll / pinch
- Pan: `controls.enablePan = false` (confunde en mobile)
- `enableDamping = true` para movimiento suave

### Navegar a persona (tap/clic)
Raycaster sobre los meshes del busto. Al detectar hit, lerp del `controls.target` hacia la posición del nodo:
```javascript
controls.target.lerp(targetPos, 0.07); // en el loop de animación
```

### Aviso de árbol grande
Si `truncated: true` en la respuesta API, mostrar un banner dentro del modal:
> "Se muestran las [N] personas más cercanas. El árbol completo tiene [totalNodes] personas."

---

## 9. Modal y lifecycle

### Apertura
1. Usuario hace clic en "Ver árbol 3D"
2. Se muestra spinner en el modal
3. Se lazy-load Three.js (si no está cargado)
4. Se hace `GET /api/search/family-tree/{uuid}/graph`
5. Se construye la escena y empieza el render loop

### Cierre
```javascript
function dispose() {
  cancelAnimationFrame(_animId);
  _renderer.dispose();
  _renderer.domElement.remove();
  // Dispose geometries, materials, textures
  _scene.traverse(obj => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      if (obj.material.map) obj.material.map.dispose();
      obj.material.dispose();
    }
  });
  _scene = _renderer = _camera = null;
}
```

### HTML del modal
```html
<div id="ga-tree3d-modal" class="ga-tree3d-modal" style="display:none">
  <button id="ga-tree3d-close" class="ga-tree3d-close">✕</button>
  <div id="ga-tree3d-canvas-wrap"></div>
  <div id="ga-tree3d-legend">...</div>
  <div id="ga-tree3d-hint">...</div>
  <div id="ga-tree3d-truncated-banner" style="display:none">...</div>
</div>
```

El canvas de Three.js se inserta en `#ga-tree3d-canvas-wrap`. El modal usa `position:fixed; inset:0; z-index:1000`.

---

## 10. Performance y restricciones

| Restricción | Medida |
|---|---|
| Three.js no bloquea carga inicial | Lazy-load al abrir modal |
| Máximo 150 nodos | Truncado en backend |
| Memoria al cerrar | `dispose()` completo al cerrar modal |
| Mobile GPU | `setPixelRatio(Math.min(devicePixelRatio, 2))`, sin SSAO ni bloom |
| Shadow map | Solo para el sol; `mapSize 1024×1024` |
| Re-apertura rápida | Si Three.js ya está cargado, saltar el lazy-load |

---

## 11. Integración con search.js

### Botón
En `enableFamilyTreeButtons(uuid)`, agregar junto a los existentes:
```javascript
var btn3d = $('#ga-tree3d-btn');
btn3d.attr('data-uuid', uuid).prop('disabled', true);
```

En `activateFamilyTreeButtons()`:
```javascript
$('#ga-tree3d-btn').prop('disabled', false);
```

### Click handler
```javascript
$('#ga-tree3d-btn').on('click', function() {
  var uuid = $(this).data('uuid');
  GeneaAzul.familyTree3d.init(uuid);
});
```

### HTML del botón (en buscar.html / pages/buscar.html)
```html
<button id="ga-tree3d-btn" class="btn ga-btn-secondary" disabled>
  <i class="bi bi-box-fill"></i> Ver árbol 3D
</button>
```

---

## 12. Lo que queda para la implementación (refinamiento)

- Calibrar constantes del layout force-directed con árboles reales
- Manejar el caso donde un nodo (persona con múltiples matrimonios) aparece en varios FAMILIES simultáneamente — posiblemente reducir la prominencia visual de los conectores secundarios
- Diseñar el comportamiento exacto del banner de truncado
- Estilo exacto del botón "Ver árbol 3D" (consistente con los botones PDF/Pyvis existentes)
- Probar performance en dispositivos móviles de gama media
- Definir qué pasa si el endpoint `/graph` falla (mensaje de error dentro del modal)
- Optimización opcional: si el grafo tiene > 80 nodos, omitir las partículas de flujo para mantener FPS
