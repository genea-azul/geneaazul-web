// Full CDN URLs so no import map is required — works in Safari iOS 15 and any
// browser that supports ES modules but not import maps (Safari 16.0–16.3).
import * as THREE               from 'https://cdn.jsdelivr.net/npm/three@0.184.0/build/three.module.min.js';
import { OrbitControls }        from 'https://cdn.jsdelivr.net/npm/three@0.184.0/examples/jsm/controls/OrbitControls.js';

let _renderer, _scene, _camera, _controls, _animId, _clock, _sun;
let _ctrlV    = null; // { dTheta, dPhi, dRadius, pan: Vector3 }
let _navRadius = null; // target orbit radius after click-to-navigate
let _navReset  = null; // { target, spherical } for reset-to-home animation
// Home-position snapshot captured after layout settles in _adjustSceneForTree;
// used by the reset action and cinematic exit to restore a well-defined camera pose.
let _initCamPos, _initTarget;
// Stored listener refs so they can be removed on dispose
let _onPointerDown, _onWheel, _onCanvasClick, _onCanvasTouchEnd;
// Generation counter for in-flight logo texture loads.
// Incremented on every _buildLogoWalls call and on dispose so stale callbacks
// from a previous open can never add walls to the new scene.
let _wallTexGen = 0;
// Render-on-demand: only draw when something changed
let _needsRender = true;
// Shared connector materials (pooled across all edges to avoid per-edge allocations)
let _connMats = null;
// Shared particle geometry — one sphere reused across every edge flow mesh
let _particleGeo = null;
// Focal person name used for PNG export filename
let _focalName = '';
// Timer ID for the loader fade-out — cancelled on dispose so a rapid close/reopen
// doesn't hide the loader that the second init just made visible.
let _loaderHideTimer = null;
// Pointer-down position — compared against click position to skip drag-end events in onPick
let _pdX = 0, _pdY = 0;
// Cinematic flythrough state
let _cinematic = false;
let _cinematicT = 0;
let _cinematicPath = null;  // { camCurve, lookCurve, speed }
let _cinematicFogBase = 0;
let _cinematicPersons    = null; // kept so path can be rebuilt on each activation
let _cinematicTreeRadius = 0;
let _cinematicAspectIsPortrait = null; // last aspect bucket the path was built for
// Warmup: smooth camera fly-in from current position to path start
const CINEMATIC_WARMUP_DUR = 2.5; // seconds
let _cinematicInWarmup  = false;
let _cinematicWarmupT   = 0;
let _cinematicEntryPos  = null; // camera position when cinematic was activated
let _cinematicEntryLook = null; // controls.target when cinematic was activated
// Y bounds of tree nodes — look-at target is clamped to this range so the
// camera never stares above the tree top or below the lowest node (spline overshoot)
let _cinematicTreeMinY = null;
let _cinematicTreeMaxY = null;
// Pooled work objects reused every frame by the render loop (prevents GC churn
// in hot paths — _ctrlV block, navigation, cinematic banking).
const _tmpSph   = new THREE.Spherical();
const _tmpVec3A = new THREE.Vector3();
const _tmpBank  = new THREE.Vector3();

function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

function _buildMaterials() {
  return {
    maleLive:   new THREE.MeshStandardMaterial({ color: 0x2c6fa0, roughness: 0.45, metalness: 0.25 }),
    femaleLive: new THREE.MeshStandardMaterial({ color: 0x9b4c6e, roughness: 0.45, metalness: 0.20 }),
    focal:      new THREE.MeshStandardMaterial({ color: 0xc89020, roughness: 0.25, metalness: 0.55,
                  emissive: new THREE.Color(0x3a2000), emissiveIntensity: 0.5 }),
    maleDead:   new THREE.MeshStandardMaterial({ color: 0x5a7890, roughness: 0.80, metalness: 0.05, transparent: true, opacity: 0.72 }),
    femaleDead: new THREE.MeshStandardMaterial({ color: 0x806070, roughness: 0.80, metalness: 0.05, transparent: true, opacity: 0.70 }),
    deadCross:  new THREE.MeshStandardMaterial({ color: 0x7a7870, roughness: 0.9 }),
  };
}

function _buildConnectorMats() {
  const COUPLE = 0x8b6010, CHILD = 0x7a5828;
  return {
    // LineBasicMaterial works on all WebGL implementations including Android mobile GPUs.
    // LineMaterial/LineSegments2 (fat lines) uses instanced rendering that silently
    // misbehaves on some Android GPU drivers — the visual difference at 1-1.2 px is negligible.
    coupleLine:   new THREE.LineBasicMaterial({ color: COUPLE, transparent: true, opacity: 0.65, depthWrite: false }),
    childLine:    new THREE.LineBasicMaterial({ color: CHILD,  transparent: true, opacity: 0.55, depthWrite: false }),
    couplePoints: new THREE.PointsMaterial({ color: COUPLE, size: 0.07, transparent: true, opacity: 0.35, depthWrite: false, sizeAttenuation: true }),
    childPoints:  new THREE.PointsMaterial({ color: CHILD,  size: 0.06, transparent: true, opacity: 0.30, depthWrite: false, sizeAttenuation: true }),
    coupleFlow:   new THREE.MeshBasicMaterial({ color: COUPLE, depthWrite: false }),
    childFlow:    new THREE.MeshBasicMaterial({ color: CHILD,  depthWrite: false }),
    orbMat:       new THREE.MeshStandardMaterial({ color: 0xd4a020, roughness: 0.15, metalness: 0.75 }),
  };
}

let MAT;

function nodeMat(node) {
  if (node.focal)    return MAT.focal;
  if (!node.isAlive) return node.sex === 'F' ? MAT.femaleDead : MAT.maleDead;
  return node.sex === 'F' ? MAT.femaleLive : MAT.maleLive;
}

function _buildScene(containerId) {
  const wrap = document.getElementById(containerId);
  let W = wrap.clientWidth, H = wrap.clientHeight;
  if (!W || !H) { W = window.innerWidth; H = window.innerHeight; }

  const _isMobile   = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  // Flag low-end mobile only: ≤2 GB RAM (deviceMemory, Chrome/Android) or ≤4 CPU cores.
  // High-end phones (≥6 cores, ≥4 GB) render at full quality.
  // iOS never exposes deviceMemory; A-series GPUs are fast enough to skip degradation.
  const _isSlowMobile = _isMobile && (
    (navigator.deviceMemory      && navigator.deviceMemory      <= 2) ||
    (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4)
  );
  _renderer = new THREE.WebGLRenderer({ antialias: !_isSlowMobile });
  _renderer.setSize(W, H);
  _renderer.setPixelRatio(Math.min(devicePixelRatio, _isSlowMobile ? 1.5 : 2));
  _renderer.shadowMap.enabled = true;
  _renderer.shadowMap.type = THREE.PCFShadowMap;
  _renderer.toneMapping = THREE.ACESFilmicToneMapping;
  _renderer.toneMappingExposure = 1.0;
  wrap.appendChild(_renderer.domElement);

  _scene = new THREE.Scene();
  _scene.background = new THREE.Color(0xf0e4c8);
  _scene.fog = new THREE.FogExp2(0xf0e4c8, 0.016);

  _camera = new THREE.PerspectiveCamera(W / H < 0.75 ? 68 : 48, W / H, 0.1, 200);
  _camera.position.set(0, 3, 24);

  _controls = new OrbitControls(_camera, _renderer.domElement);
  _controls.enableDamping = true;
  _controls.dampingFactor = 0.06;
  _controls.enablePan = true;
  _controls.minDistance = 5;
  _controls.maxDistance = 55;
  _controls.autoRotate = true;
  _controls.autoRotateSpeed = 0.2;
  _controls.zoomSpeed = 3;
  _onPointerDown = e => { _controls.autoRotate = false; if (e) { _pdX = e.clientX; _pdY = e.clientY; } };
  _renderer.domElement.addEventListener('pointerdown', _onPointerDown);
  _controls.addEventListener('change', () => { _needsRender = true; });

  // MacBook trackpad: 2-finger drag fires wheel events with deltaX != 0.
  // Intercept those as pan; pure vertical scroll (deltaX=0) and pinch (ctrlKey)
  // are left to OrbitControls for zoom.
  _onWheel = function(e) {
    if (e.ctrlKey || e.deltaX === 0) return;
    e.preventDefault();
    e.stopPropagation();
    _controls.autoRotate = false;
    if (!_ctrlV) _ctrlV = { dTheta: 0, dPhi: 0, dRadius: 0, pan: new THREE.Vector3() };
    const dist = _camera.position.distanceTo(_controls.target);
    const scale = dist * 0.001;
    _camera.getWorldDirection(_tmpVec3A);
    _tmpBank.crossVectors(_tmpVec3A, _camera.up).normalize();
    _ctrlV.pan.addScaledVector(_tmpBank,   e.deltaX * scale);
    _ctrlV.pan.addScaledVector(_camera.up, -e.deltaY * scale);
  };
  _renderer.domElement.addEventListener('wheel', _onWheel, { passive: false, capture: true });

  _scene.add(new THREE.AmbientLight(0xfff8f0, 0.9));
  _sun = new THREE.DirectionalLight(0xffe8b0, 1.6);
  _sun.position.set(6, 12, 8);
  _sun.castShadow = true;
  _sun.shadow.mapSize.set(_isSlowMobile ? 512 : 2048, _isSlowMobile ? 512 : 2048);
  _sun.shadow.intensity = 0.75; // r162+: softer shadows suit the warm parchment palette
  _scene.add(_sun);
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
  if (!W || !H) return;
  const aspect = W / H;
  _camera.aspect = aspect;
  // Wider vertical FOV on portrait so the horizontal frustum isn't too narrow
  _camera.fov = aspect < 0.75 ? 68 : 48;
  _camera.updateProjectionMatrix();
  _renderer.setSize(W, H);
  // Rebuild cinematic path only when the portrait/landscape bucket actually
  // changes. Mobile URL-bar show/hide and on-screen keyboards fire resize
  // events constantly within the same bucket — rebuilding on every one would
  // reset _cinematicT = 0 and snap the camera back to the overview each time.
  if (_cinematic && _cinematicPersons && _cinematicTreeRadius > 0) {
    const isPortrait = aspect < 0.75;
    if (_cinematicAspectIsPortrait !== isPortrait) {
      _cinematicPath      = _buildCinematicPath(_cinematicPersons, _cinematicTreeRadius, aspect);
      _cinematicAspectIsPortrait = isPortrait;
      _cinematicT         = 0;
      _cinematicEntryPos  = _camera.position.clone();
      _cinematicEntryLook = _controls.target.clone();
      _cinematicInWarmup  = true;
      _cinematicWarmupT   = 0;
    }
  }
}

// ── Force-directed layout ────────────────────────────────────────────────────

const GY = 5.5;

function _runLayout(persons, families) {
  const edges = [];
  families.forEach(fam => {
    const fatherId = (fam.husbandIds && fam.husbandIds.length) ? fam.husbandIds[0] : null;
    const motherId = (fam.wifeIds    && fam.wifeIds.length)    ? fam.wifeIds[0]    : null;
    if (fatherId != null && motherId != null) {
      edges.push({ a: fatherId, b: motherId, t: 'm' });
    }
    (fam.childIds || []).forEach(cid => {
      if (fatherId != null) edges.push({ a: fatherId, b: cid, t: 'p' });
      if (motherId != null) edges.push({ a: motherId, b: cid, t: 'p' });
    });
  });

  const idx = {};
  persons.forEach((n, i) => { idx[n.id] = i; });

  const golden = (1 + Math.sqrt(5)) / 2;
  persons.forEach((n, i) => {
    if (n.focal) { n.pos = new THREE.Vector3(0, 0, 0); n.vel = new THREE.Vector3(); return; }
    const theta = Math.acos(1 - 2 * (i + 0.5) / persons.length);
    const phi   = 2 * Math.PI * i / golden;
    const r     = 9 + Math.abs(n.generation || 0) * 1.5;
    n.pos = new THREE.Vector3(
      r * Math.sin(theta) * Math.cos(phi),
      (n.generation || 0) * GY * 0.4 + r * Math.cos(theta) * 0.4,
      r * Math.sin(theta) * Math.sin(phi)
    );
    n.vel = new THREE.Vector3();
  });

  persons.forEach(n => { n.spherePos = n.pos.clone(); });

  const F    = persons.map(() => new THREE.Vector3());
  const diff = new THREE.Vector3(); // reused every iteration — avoids per-pair allocations
  const maxIter = Math.min(350, Math.max(100, persons.length * 5));
  for (let iter = 0; iter < maxIter; iter++) {
    F.forEach(f => f.set(0, 0, 0));

    for (let i = 0; i < persons.length; i++) {
      for (let j = i + 1; j < persons.length; j++) {
        diff.subVectors(persons[i].pos, persons[j].pos);
        const l = Math.max(diff.length(), 0.4);
        const f = 16 / (l * l);
        diff.normalize().multiplyScalar(f);
        F[i].add(diff); F[j].sub(diff);
      }
    }

    edges.forEach(e => {
      const i = idx[e.a], j = idx[e.b];
      if (i === undefined || j === undefined) return;
      diff.subVectors(persons[j].pos, persons[i].pos);
      const l = diff.length();
      const rest = e.t === 'm' ? 1.8 : 3.0;
      const f = 0.05 * (l - rest);
      diff.normalize().multiplyScalar(f);
      if (!persons[i].focal) F[i].add(diff);
      if (!persons[j].focal) F[j].sub(diff);
    });

    persons.forEach((n, i) => {
      if (n.focal) return;
      F[i].y  += 0.18 * ((n.generation || 0) * GY - n.pos.y);
      F[i].x  -= 0.004 * n.pos.x;
      F[i].z  -= 0.004 * n.pos.z;
    });

    persons.forEach((n, i) => {
      if (n.focal) return;
      n.vel.addScaledVector(F[i], 1).multiplyScalar(0.84);
      n.pos.addScaledVector(n.vel, 0.5);
    });

    // Early exit when velocities have decayed (layout converged)
    if (iter > 60 && iter % 20 === 0) {
      let maxV = 0;
      persons.forEach(n => { if (!n.focal) { const vl = n.vel.length(); if (vl > maxV) maxV = vl; } });
      if (maxV < 0.005) break;
    }
  }

  persons.forEach(n => { n.finalPos = n.pos.clone(); });
  // Override Y with the exact generation target so family size (child count) has
  // no influence on height. Without this, nodes with many children are pulled down
  // by parent-child springs more than nodes with few children, causing same-generation
  // couples to sit at different heights despite having the same generation value.
  persons.forEach(n => { n.finalPos.y = (n.generation || 0) * GY; });
  persons.forEach(n => { n.pos.copy(n.spherePos); });

  return edges;
}

// ── Bust builder + sprite ───────────────────────────────────────────────────


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

  part(new THREE.SphereGeometry(0.22 * s, 24, 24),             0, 0.52 * s, 0);
  part(new THREE.CylinderGeometry(0.08*s, 0.10*s, 0.16*s, 18), 0, 0.30 * s, 0);
  part(new THREE.CylinderGeometry(0.19*s, 0.26*s, 0.34*s, 20), 0, 0.10 * s, 0);
  part(new THREE.CylinderGeometry(0.28*s, 0.28*s, 0.05*s, 20), 0, 0.28 * s, 0);

  if (node.focal) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.38, 0.03, 14, 64),
      new THREE.MeshStandardMaterial({ color: 0xd4a020, roughness: 0.15, metalness: 0.85,
        transparent: true, opacity: 0.82 })
    );
    ring.rotation.x = Math.PI / 2; ring.position.y = -0.08;
    g.add(ring);
    g.userData.ring = ring; // stored for render-loop animation
  }

  if (!node.isAlive) {
    const cv = new THREE.Mesh(new THREE.BoxGeometry(0.035*s, 0.18*s, 0.035*s), MAT.deadCross);
    cv.position.set(0, 0.88 * s, 0); cv.castShadow = true; g.add(cv);
    const ch = new THREE.Mesh(new THREE.BoxGeometry(0.12*s, 0.035*s, 0.035*s), MAT.deadCross);
    ch.position.set(0, 0.94 * s, 0); ch.castShadow = true; g.add(ch);
  }

  return g;
}

function _makeSprite(node) {
  const rawName = node.displayName || '';
  const label = rawName || '?';

  const bYear = (node.yearOfBirth != null) ? String(node.yearOfBirth) : null;
  const dYear = (node.yearOfDeath != null) ? String(node.yearOfDeath) : null;
  let years = '';
  if (bYear && dYear)       years = bYear + ' – ' + dYear;
  else if (bYear && !node.isAlive) years = bYear + ' – ?';
  else if (bYear)           years = bYear;
  else if (dYear)           years = '? – ' + dYear;

  const hasYears = years.length > 0;
  const S = 2; // supersample: 2× canvas resolution → sharper text at same sprite size
  const CW_B = 300, CH_B = hasYears ? 112 : 74;
  const CW = CW_B * S, CH = CH_B * S;
  const cv  = document.createElement('canvas');
  cv.width = CW; cv.height = CH;
  const ctx = cv.getContext('2d');

  // Translucent parchment pill — keeps text readable over any scene backdrop
  {
    const bpx = 4 * S, bpy = 3 * S, br = 12 * S;
    ctx.fillStyle = 'rgba(245, 234, 208, 0.22)';
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(bpx, bpy, CW - bpx * 2, CH - bpy * 2, br);
    } else {
      ctx.rect(bpx, bpy, CW - bpx * 2, CH - bpy * 2);
    }
    ctx.fill();
  }

  let fontSize = (node.focal ? 38 : 28) * S;
  const nameY = (hasYears ? Math.round(CH_B * 0.38) : CH_B / 2) * S;

  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `bold ${fontSize}px Georgia, serif`;
  const maxNameW = CW * 0.92;
  while (ctx.measureText(label).width > maxNameW && fontSize > 14 * S) {
    fontSize -= S;
    ctx.font = `bold ${fontSize}px Georgia, serif`;
  }

  for (let i = 4; i >= 1; i--) {
    ctx.fillStyle = `rgba(20,30,50,${0.20 - i * 0.04})`;
    ctx.fillText(label, CW / 2 + i * S, nameY + i * S);
  }

  const isFemale = node.sex === 'F';
  const col = node.focal    ? '#1a0800'
            : !node.isAlive ? (isFemale ? '#200010' : '#0a1018')
            : isFemale      ? '#180008'
            : '#040c18';
  ctx.fillStyle = col;
  ctx.fillText(label, CW / 2, nameY);
  if (node.isAlive) {
    ctx.fillStyle = 'rgba(200,220,255,0.10)';
    ctx.fillText(label, CW / 2, nameY - S);
  }

  if (hasYears) {
    const ySize = (node.focal ? 25 : 19) * S;
    ctx.font = `${ySize}px Georgia, serif`;
    const yearsY = Math.round(CH_B * 0.72) * S;
    const yCol = node.focal    ? '#2a1400'
               : !node.isAlive ? (isFemale ? '#28101a' : '#1a2028')
               : isFemale      ? '#280010'
               : '#08161e';
    ctx.fillStyle = yCol;
    ctx.fillText(years, CW / 2, yearsY);
  }

  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false
  }));
  sprite.scale.set(2.8, 2.8 * (CH_B / CW_B), 1);
  sprite.userData.baseSW = 2.8;
  sprite.userData.baseSH = 2.8 * (CH_B / CW_B);
  return sprite;
}

// ── Family connectors ────────────────────────────────────────────────────────

const _edgeParticles = [];

function _flowPart(p1, p2, mat, speed, phase) {
  // Share a single sphere geometry across every flow particle — a large tree
  // can have hundreds of these, so per-particle geometry allocation was
  // wasting GPU buffer slots for no visual gain.
  if (!_particleGeo) _particleGeo = new THREE.SphereGeometry(0.04, 7, 7);
  const m = new THREE.Mesh(_particleGeo, mat);
  _scene.add(m);
  _edgeParticles.push({ mesh: m, p1: p1.clone(), p2: p2.clone(), speed, phase });
}

function _buildConnectors(families, nodeMap) {
  if (!_connMats) _connMats = _buildConnectorMats();
  const { coupleLine, childLine, couplePoints, childPoints, coupleFlow, childFlow, orbMat } = _connMats;
  const coupleSegs = [], childSegs = [];
  // Accumulate dot-point positions for a single batched draw call each instead of one
  // THREE.Points object per segment (which was hundreds of draw calls on large trees).
  const coupleAllPts = [], childAllPts = [];

  function _seg(p1, p2, segArr, ptsArr) {
    segArr.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
    const n = Math.max(3, Math.ceil(p1.distanceTo(p2) * 5));
    for (let i = 0; i <= n; i++) {
      const f = i / n;
      ptsArr.push(p1.x + (p2.x - p1.x) * f, p1.y + (p2.y - p1.y) * f, p1.z + (p2.z - p1.z) * f);
    }
  }

  families.forEach(fam => {
    const fatherId = (fam.husbandIds && fam.husbandIds.length) ? fam.husbandIds[0] : null;
    const motherId = (fam.wifeIds    && fam.wifeIds.length)    ? fam.wifeIds[0]    : null;
    const fN = fatherId != null ? nodeMap[fatherId] : null;
    const mN = motherId != null ? nodeMap[motherId] : null;
    if (!fN && !mN) return;

    if (fN && mN) {
      const fp = fN.bust.position, mp = mN.bust.position;
      // Place the couple bar at the BOTTOM of the parent spheres (toward children),
      // so parents visually sit above the bar and the junction below them.
      const barY   = Math.min(fp.y, mp.y) - 0.07;
      const fBot   = new THREE.Vector3(fp.x, fp.y - 0.07, fp.z);
      const mBot   = new THREE.Vector3(mp.x, mp.y - 0.07, mp.z);
      const fBar   = new THREE.Vector3(fp.x, barY, fp.z);
      const mBar   = new THREE.Vector3(mp.x, barY, mp.z);
      const midBar = fBar.clone().lerp(mBar, 0.5);

      // Vertical legs from each spouse down to the couple bar (only when heights differ)
      if (fBot.y > barY + 0.05) _seg(fBot, fBar, coupleSegs, coupleAllPts);
      if (mBot.y > barY + 0.05) _seg(mBot, mBar, coupleSegs, coupleAllPts);
      // Horizontal couple bar
      _seg(fBar, mBar, coupleSegs, coupleAllPts);
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 16), orbMat);
      orb.position.copy(midBar); orb.castShadow = true; _scene.add(orb);

      if (!fam.childIds || !fam.childIds.length) return;
      const cNodes = fam.childIds.map(id => nodeMap[id]).filter(Boolean);
      if (!cNodes.length) return;

      _flowPart(fBar, midBar, coupleFlow, 0.35, Math.random());
      _flowPart(mBar, midBar, coupleFlow, 0.35, Math.random() * 0.5);

      // Junction: positioned between the couple bar and the highest child.
      // When children spread wide in XZ the junction rises toward the parents so
      // all sibling lines stay clearly inclined (distinguishable from couple lines).
      // Factor ranges from 0.4 (compact families) to 0.75 (very wide spreads).
      const minParentY = Math.min(fp.y, mp.y);
      const maxChildY = Math.max(...cNodes.map(n => n.bust.position.y));
      let maxChildHoriz = 0;
      cNodes.forEach(function(cn) {
        const dx = cn.bust.position.x - midBar.x, dz = cn.bust.position.z - midBar.z;
        const d = Math.sqrt(dx * dx + dz * dz);
        if (d > maxChildHoriz) maxChildHoriz = d;
      });
      const juncFactor = Math.min(0.75, 0.4 + Math.max(0, maxChildHoriz - 4) * 0.025);
      const juncY = Math.min(maxChildY + (barY - maxChildY) * juncFactor, minParentY - 0.3);
      const junc  = new THREE.Vector3(midBar.x, juncY, midBar.z);

      _seg(midBar, junc, coupleSegs, coupleAllPts);
      _flowPart(midBar, junc, coupleFlow, 0.32, Math.random());

      // Draw from junction to each child's top (sphere top = closest point toward junction)
      cNodes.forEach(cn => {
        const cp = cn.bust.position;
        const cTop = new THREE.Vector3(cp.x, cp.y + 0.28, cp.z);
        _seg(junc, cTop, childSegs, childAllPts);
        _flowPart(junc, cTop, childFlow, 0.25 + Math.random() * 0.12, Math.random());
      });
    } else {
      // Only one parent is present in the tree (the other was filtered out or never loaded).
      // Draw a vertical drop from the known parent down to a junction, then fan out to children.
      if (!fam.childIds || !fam.childIds.length) return;
      const cNodes = fam.childIds.map(id => nodeMap[id]).filter(Boolean);
      if (!cNodes.length) return;

      const parentN = fN || mN;
      const pp   = parentN.bust.position;
      const pBot = new THREE.Vector3(pp.x, pp.y - 0.07, pp.z);
      const maxChildY = Math.max(...cNodes.map(n => n.bust.position.y));
      let maxChildHorizSingle = 0;
      cNodes.forEach(function(cn) {
        const dx = cn.bust.position.x - pBot.x, dz = cn.bust.position.z - pBot.z;
        const d = Math.sqrt(dx * dx + dz * dz);
        if (d > maxChildHorizSingle) maxChildHorizSingle = d;
      });
      const juncFactorSingle = Math.min(0.75, 0.4 + Math.max(0, maxChildHorizSingle - 4) * 0.025);
      const juncY = Math.min(maxChildY + (pBot.y - maxChildY) * juncFactorSingle, pBot.y - 0.3);
      const junc  = new THREE.Vector3(pBot.x, juncY, pBot.z);

      _seg(pBot, junc, coupleSegs, coupleAllPts);
      _flowPart(pBot, junc, coupleFlow, 0.32, Math.random());

      cNodes.forEach(cn => {
        const cp = cn.bust.position;
        const cTop = new THREE.Vector3(cp.x, cp.y + 0.28, cp.z);
        _seg(junc, cTop, childSegs, childAllPts);
        _flowPart(junc, cTop, childFlow, 0.25 + Math.random() * 0.12, Math.random());
      });
    }
  });

  // Flush lines — two draw calls total (one for couple connectors, one for child connectors)
  if (coupleSegs.length) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(coupleSegs, 3));
    _scene.add(new THREE.LineSegments(geo, coupleLine));
  }
  if (childSegs.length) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(childSegs, 3));
    _scene.add(new THREE.LineSegments(geo, childLine));
  }
  // Flush dot points — two draw calls total instead of one per segment
  if (coupleAllPts.length) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(coupleAllPts, 3));
    _scene.add(new THREE.Points(geo, couplePoints));
  }
  if (childAllPts.length) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(childAllPts, 3));
    _scene.add(new THREE.Points(geo, childPoints));
  }
}

// ── Tree-size-dependent scene tuning ─────────────────────────────────────────

function _adjustSceneForTree(treeRadius) {
  // Camera: start outside the tree so the connector network is visible as a
  // 3D structure. Capping to 15 placed the camera INSIDE large trees (radius 25+)
  // making the connectors look like a starburst radiating from inside.
  // Now: at least treeRadius away in Z, plus a Y elevation that scales with size
  // so the generational layers are visible from the opening shot.
  const initZ = Math.max(treeRadius * 0.7, 8);
  const initY = Math.max(treeRadius * 0.2, 2);
  _camera.position.set(0, initY, initZ);
  _camera.lookAt(0, 0, 0);
  _initCamPos = _camera.position.clone();

  // Controls: let users zoom out 3.5× the tree radius
  _controls.minDistance = 3;
  const maxDist = Math.min(treeRadius * 3.5, 200);
  _controls.maxDistance = maxDist;

  // Far plane: must reach the wall on the opposite side from the camera.
  // Worst case = camera at maxDist in one direction + wall at 2.5×r in the other.
  _camera.far = Math.max(200, maxDist + treeRadius * 2.5 + 20);
  _camera.updateProjectionMatrix();

  // Fog: 50% fogged at ~2.4× tree radius (FogExp2: d = √ln2 / density ≈ 0.833 / density)
  _scene.fog.density = 0.35 / treeRadius;

  // Shadow volume: cover the whole tree extent
  const sb = treeRadius * 1.3;
  _sun.shadow.camera.left   = _sun.shadow.camera.bottom = -sb;
  _sun.shadow.camera.right  = _sun.shadow.camera.top    =  sb;
  _sun.shadow.camera.far    = treeRadius * 4;
  _sun.shadow.camera.updateProjectionMatrix();
}

// ── Cinematic flythrough path ────────────────────────────────────────────────

// Returns the centroid of the k nearest persons to camPos.
// Used as look-at target so the camera always faces populated space.
function _nearestCentroid(camPos, persons, k) {
  const sorted = persons.slice().sort((a, b) =>
    a.finalPos.distanceToSquared(camPos) - b.finalPos.distanceToSquared(camPos)
  );
  const take = sorted.slice(0, Math.min(k, sorted.length));
  return new THREE.Vector3(
    take.reduce((s, n) => s + n.finalPos.x, 0) / take.length,
    take.reduce((s, n) => s + n.finalPos.y, 0) / take.length,
    take.reduce((s, n) => s + n.finalPos.z, 0) / take.length
  );
}

function _buildCinematicPath(persons, treeRadius, aspect) {
  const portrait = aspect < 0.75;

  // On portrait the horizontal frustum is ~43° (even at FOV 68°) vs ~77° on landscape,
  // so the camera must orbit closer to clusters and the overview should look more top-down.
  const camR       = portrait ? Math.min(treeRadius * 0.35, 10) : Math.min(treeRadius * 0.65, 18);
  const orbitRLo   = 0.50; // inner orbit radius as fraction of camR — wide enough to avoid clipping
  const orbitRHi   = 0.40; // added on top of orbitRLo
  // Height is capped: no gen multiplier so deep ancestors don't drift off to a top-down extreme.
  const orbitHBase = portrait ? 1.5  : 1.0;  // base height above cluster centroid
  const orbitHCap  = portrait ? 4.0  : 3.0;  // maximum height added above base

  const byGen = {};
  persons.forEach(n => {
    const g = n.generation || 0;
    if (!byGen[g]) byGen[g] = [];
    byGen[g].push(n);
  });

  // Visit ancestor gens first (highest number = oldest), then down to descendants.
  // Skip singleton generations — a single node doesn't need its own cluster flyby.
  const allGenKeys = Object.keys(byGen).map(Number).sort((a, b) => b - a);
  const genKeys    = allGenKeys.filter(g => byGen[g].length >= 2);

  const camPts  = [];
  const lookPts = [];

  // Overview position — computed here, pushed after the cluster flybys so it
  // becomes a mid-loop "zoom out" beat rather than the boring opener.
  // Portrait: near-vertical top-down (exploits tall screen, avoids narrow horizontal).
  // Landscape: wide elevated side-angle to show the full horizontal spread.
  const overviewAngle = Math.random() * Math.PI * 2;
  const overviewR = portrait
    ? treeRadius * (0.2 + Math.random() * 0.2)   // close horizontally → top-down
    : treeRadius * (0.5 + Math.random() * 0.4);   // wider side angle
  const overviewH = portrait
    ? treeRadius * (1.5 + Math.random() * 0.5)    // high on portrait
    : treeRadius * (1.2 + Math.random() * 0.5);
  const ovPos = new THREE.Vector3(
    Math.cos(overviewAngle) * overviewR,
    overviewH,
    Math.sin(overviewAngle) * overviewR
  );

  // ── 1. Focal person close-up — t=0, warmup targets this position ──────────
  // Starting close makes the cinematic feel immediate; the overview zoom-out
  // comes later in the loop as a reveal rather than an opener.
  // Use the focal person's actual generation key (not hardcoded 0) so this
  // works even when the backend numbers generations differently.
  const focalNode   = persons.find(n => n.focal);
  const focalGenKey = focalNode ? (focalNode.generation || 0) : 0;
  const focalNodes  = byGen[focalGenKey] || [];
  if (focalNodes.length > 0) {
    const fx = focalNodes.reduce((s, n) => s + n.finalPos.x, 0) / focalNodes.length;
    const fy = focalNodes.reduce((s, n) => s + n.finalPos.y, 0) / focalNodes.length;
    const fz = focalNodes.reduce((s, n) => s + n.finalPos.z, 0) / focalNodes.length;
    const fAngle = Math.random() * Math.PI * 2;
    const fR     = camR * (0.45 + Math.random() * 0.25); // deliberately close for intimacy
    const fH     = orbitHBase + Math.random() * 1.5;     // low — eye-level shot
    const fcp    = new THREE.Vector3(fx + Math.cos(fAngle) * fR, fy + fH, fz + Math.sin(fAngle) * fR);
    camPts.push(fcp);
    lookPts.push(_nearestCentroid(fcp, persons, 12));
  }

  // ── 2. Per-generation cluster flybys ──────────────────────────────────────
  genKeys.forEach(gen => {
    const nodes = byGen[gen];
    const cx = nodes.reduce((s, n) => s + n.finalPos.x, 0) / nodes.length;
    const cy = nodes.reduce((s, n) => s + n.finalPos.y, 0) / nodes.length;
    const cz = nodes.reduce((s, n) => s + n.finalPos.z, 0) / nodes.length;
    const baseAngle = Math.random() * Math.PI * 2;
    for (let j = 0; j < 2; j++) {
      const angle = baseAngle + (j === 0 ? 0 : Math.PI * (0.7 + Math.random() * 0.6));
      const r = camR * (orbitRLo + Math.random() * orbitRHi);
      // Cap height — no gen multiplier prevents top-down drift on deep ancestry
      const h = orbitHBase + Math.random() * orbitHCap;
      const cp = new THREE.Vector3(cx + Math.cos(angle) * r, cy + h, cz + Math.sin(angle) * r);
      camPts.push(cp);
      // Use k=12 so look-at spans mid-ground rather than locking onto the nearest bust
      lookPts.push(_nearestCentroid(cp, persons, 12));
    }
  });

  // ── 3. Overview — mid-loop zoom out to see the whole tree ────────────────
  camPts.push(ovPos);
  lookPts.push(new THREE.Vector3(0, 0, 0));

  // CatmullRomCurve3 needs ≥ 4 points; pad tiny trees
  while (camPts.length < 4) {
    const a = Math.random() * Math.PI * 2;
    const cp = new THREE.Vector3(Math.cos(a) * camR * 0.6, 4 + Math.random() * 3, Math.sin(a) * camR * 0.6);
    camPts.push(cp);
    lookPts.push(_nearestCentroid(cp, persons, 12));
  }

  // Duration scales with waypoint count (5 s each) so large trees aren't rushed,
  // capped at 90 s. Minimum 15 s for very small trees.
  const duration = Math.min(90, Math.max(15, camPts.length * 5));
  const maxCamY  = camPts.reduce(function(m, p) { return Math.max(m, p.y); }, -Infinity);
  return {
    // 'centripetal' parameterisation avoids cusps and self-intersections on
    // unevenly-spaced control points — exactly what camera flythrough paths need.
    camCurve:  new THREE.CatmullRomCurve3(camPts,  true, 'centripetal'),
    lookCurve: new THREE.CatmullRomCurve3(lookPts, true, 'centripetal'),
    speed: 1 / duration,
    maxCamY: maxCamY
  };
}

// ── Logo background walls ────────────────────────────────────────────────────

function _buildLogoWalls(treeRadius) {
  const myGen = ++_wallTexGen;
  const loader = new THREE.TextureLoader();
  loader.load('/img/logo-simple-2500x2500-no-bg.png',
    function(tex) {
      if (myGen !== _wallTexGen || !_scene) { tex.dispose(); return; }
      tex.colorSpace = THREE.SRGBColorSpace;

      // Walls sit far enough that the orbiting camera never gets closer than ~treeRadius away
      const wallDist  = treeRadius * 2.5; // keep walls beyond the max orbit distance (~3.5×r)
      const planeSize = treeRadius * 2.0; // 80% of wallDist — logo occupies most of each panel

      const WALLS = [];
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
        WALLS.push({ pos: [wallDist * Math.sin(a), -treeRadius * 0.3, -wallDist * Math.cos(a)], rotY: -a });
      }

      // Track the shared texture on the first wall so dispose only releases it once
      // instead of calling tex.dispose() four times via the traverse-dispose loop.
      WALLS.forEach(function(w, idx) {
        const mat = new THREE.MeshBasicMaterial({
          map: tex, transparent: true, opacity: 0.25,
          depthWrite: false, side: THREE.DoubleSide
        });
        if (idx > 0) mat.userData.sharedMap = true; // later walls skip disposal of the shared map
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(planeSize, planeSize), mat);
        mesh.position.set(w.pos[0], w.pos[1], w.pos[2]);
        mesh.rotation.y = w.rotY;
        _scene.add(mesh);
      });
    },
    undefined,
    function(err) {
      // Without this handler TextureLoader only logs to console — the scene would
      // render cleanly but silently miss the branded backdrop. Surface it loudly
      // so a renamed/missing asset is obvious in dev and in production logs.
      if (myGen !== _wallTexGen) return; // stale callback after dispose
      if (window.console && console.error) {
        console.error('[3D tree] logo walls texture failed to load:', err);
      }
    }
  );
}

// ── Person card overlay ──────────────────────────────────────────────────────

function _showPersonCard(node) {
  const card = document.getElementById('ga-tree3d-person-card');
  if (!card) return;
  const relEl   = card.querySelector('.ga-tree3d-person-card-rel');
  const nameEl  = card.querySelector('.ga-tree3d-person-card-name');
  const yearsEl = card.querySelector('.ga-tree3d-person-card-years');
  if (relEl) {
    const rel = (!node.focal && node.relationship) ? node.relationship : '';
    relEl.textContent   = rel;
    relEl.style.display = rel ? '' : 'none';
  }
  if (nameEl) { nameEl.textContent = node.displayName || '?'; nameEl.title = node.displayName || ''; }
  if (yearsEl) {
    const bYear = node.yearOfBirth ? String(node.yearOfBirth) : null;
    const dYear = node.yearOfDeath ? String(node.yearOfDeath) : null;
    let years;
    if      (bYear && dYear)          years = bYear + ' – ' + dYear;
    else if (bYear && !node.isAlive)  years = bYear + ' – ?';
    else if (bYear)                   years = bYear;
    else if (dYear)                   years = '? – ' + dYear;
    else if (!node.isAlive)           years = '? – ?';
    else                              years = 'vive';
    yearsEl.textContent = years;
  }
  card.classList.remove('d-none');
}

function _hidePersonCard() {
  const card = document.getElementById('ga-tree3d-person-card');
  if (card) card.classList.add('d-none');
}

// ── PNG export ───────────────────────────────────────────────────────────────

window._ga3dExport = function() {
  if (!_renderer || !_scene || !_camera) return;
  _renderer.render(_scene, _camera);
  const src = _renderer.domElement;
  const W = src.width, H = src.height;
  const out = document.createElement('canvas');
  out.width = W; out.height = H;
  const ctx = out.getContext('2d');
  ctx.drawImage(src, 0, 0);

  const safeName = (_focalName || 'familia')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').toLowerCase();
  const margin = Math.round(W * 0.025);
  const fs = Math.max(14, Math.round(W * 0.014));

  function writeCaptionAndDownload() {
    // Caption is drawn regardless \u2014 even when the logo fails to load the
    // exported image still carries the site attribution and the personalised
    // filename, so unbranded PNGs never circulate silently.
    ctx.font = fs + 'px Georgia, serif';
    ctx.fillStyle = 'rgba(90, 56, 0, 0.65)';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText('geneaazul.com.ar', W - margin, H - margin);
    const link = document.createElement('a');
    link.download = 'arbol-' + safeName + '.png';
    link.href = out.toDataURL('image/png');
    link.click();
  }

  const img = new Image();
  img.onload = function() {
    const logoW = Math.round(W * 0.11);
    const logoH = Math.round(logoW * (img.height / img.width));
    ctx.globalAlpha = 0.60;
    ctx.drawImage(img, W - logoW - margin, H - logoH - Math.round(margin * 2.2), logoW, logoH);
    ctx.globalAlpha = 1;
    writeCaptionAndDownload();
  };
  img.onerror = function() {
    if (window.console && console.warn) console.warn('[3D tree] logo image failed to load for PNG export; exporting without watermark');
    writeCaptionAndDownload();
  };
  img.src = '/img/logo-simple-2500x2500-no-bg.png';
};

let _cinematicAutoRotate = false;

window._ga3dCinematic = function(enable) {
  if (!_renderer) return;
  _cinematic = !!enable;
  if (_cinematic) {
    _cinematicAutoRotate = _controls.autoRotate;
    _controls.enabled    = false;
    _controls.autoRotate = false;
    _ctrlV               = null; // stop any in-flight button-held movement
    _cinematicFogBase    = _scene.fog.density;
    // Fresh random path every activation so each session is different.
    // t=0 starts at the focal person; overview is a mid-loop zoom-out beat.
    _cinematicPath = _buildCinematicPath(_cinematicPersons, _cinematicTreeRadius, _camera.aspect);
    _cinematicAspectIsPortrait = _camera.aspect < 0.75;
    _cinematicT    = 0;
    _camera.up.set(0, 1, 0);
    // Record current camera state so we can glide smoothly to the path start
    _cinematicEntryPos  = _camera.position.clone();
    _cinematicEntryLook = _controls.target.clone();
    // Skip warmup only if camera is already very close to the path's first waypoint
    const pathStart    = _cinematicPath.camCurve.getPointAt(0);
    const distToStart  = _cinematicEntryPos.distanceTo(pathStart);
    if (distToStart < _cinematicTreeRadius * 0.15) {
      _cinematicInWarmup = false;
      _cinematicWarmupT  = 1;
    } else {
      _cinematicInWarmup = true;
      _cinematicWarmupT  = 0;
    }
  } else {
    _ctrlV               = null; // discard any delta accumulated while cinematic suppressed it
    _controls.enabled    = true;
    _controls.autoRotate = _cinematicAutoRotate;
    if (_scene) _scene.fog.density = _cinematicFogBase;
    _camera.up.set(0, 1, 0);
    // Return to the opening position so OrbitControls resumes from a well-defined
    // state — avoids a near-degenerate phi when the cinematic path left the camera
    // almost directly above the focal person.
    if (_initCamPos) {
      _camera.position.copy(_initCamPos);
      _camera.lookAt(0, 0, 0);
    }
    _controls.target.set(0, 0, 0);
    _controls.update();
  }
  _needsRender = true;
};

// Returns true when the scene is alive and ready to accept export/cinematic
// actions. Used by family-tree-3d.js to gate the download and cinematic buttons.
window._ga3dRendererReady = function() { return !!_renderer; };

// ── Main init / dispose ──────────────────────────────────────────────────────

window._ga3dInit = function(graphData) {
  if (!graphData || !Array.isArray(graphData.persons) || !Array.isArray(graphData.families)) {
    // Previously this just console.error'd and returned, leaving the loader
    // spinner forever. Surface it so the user isn't staring at a hung modal.
    if (window.console && console.error) console.error('_ga3dInit: invalid graphData', graphData);
    const loader = document.getElementById('ga-tree3d-loader');
    if (loader) { loader.style.opacity = '0'; loader.style.pointerEvents = 'none'; setTimeout(() => loader.style.display = 'none', 400); }
    const errEl = document.getElementById('ga-tree3d-error');
    if (errEl) { errEl.textContent = 'El árbol tiene un formato inesperado. Si persiste, contactanos.'; errEl.style.display = 'block'; }
    return;
  }

  if (_renderer) window._ga3dDispose();

  MAT = _buildMaterials();
  _buildScene('ga-tree3d-canvas-wrap');
  _clock = new THREE.Timer();
  _initTarget = new THREE.Vector3(); // focal person sits at origin after layout

  let persons  = graphData.persons.map(n => Object.assign({}, n));
  let families = graphData.families;
  persons.forEach(n => { n.focal = (n.id === graphData.focalPersonId); });

  const focalPerson = persons.find(n => n.focal);
  _focalName = focalPerson ? (focalPerson.displayName || '') : '';
  const titleEl = document.getElementById('ga-tree3d-title');
  if (titleEl && focalPerson) {
    titleEl.textContent = 'Árbol de ' + _focalName;
  }

  _runLayout(persons, families);

  // Post-layout: snap each couple to the same Y so connector bars are horizontal.
  // When one spouse was already snapped by a prior marriage, pull the new spouse
  // to that established Y. If both are already snapped, skip to avoid conflict.
  const personById = {};
  persons.forEach(n => { personById[n.id] = n; });
  const ySnapped = new Set();
  families.forEach(fam => {
    const fatherId = fam.husbandIds && fam.husbandIds.length ? fam.husbandIds[0] : null;
    const motherId = fam.wifeIds    && fam.wifeIds.length    ? fam.wifeIds[0]    : null;
    const fN = fatherId != null ? personById[fatherId] : null;
    const mN = motherId != null ? personById[motherId] : null;
    if (!fN || !mN) return;
    if ((fN.generation || 0) !== (mN.generation || 0)) return; // cross-gen: keep natural heights
    // Focal person is pinned at origin — snap the other spouse to focal's Y, never the reverse.
    if (fN.focal) { mN.finalPos.y = fN.finalPos.y; ySnapped.add(fN.id); ySnapped.add(mN.id); return; }
    if (mN.focal) { fN.finalPos.y = mN.finalPos.y; ySnapped.add(fN.id); ySnapped.add(mN.id); return; }
    const fSnapped = ySnapped.has(fN.id);
    const mSnapped = ySnapped.has(mN.id);
    if (fSnapped && mSnapped) return;
    const targetY = fSnapped ? fN.finalPos.y : mSnapped ? mN.finalPos.y : (fN.finalPos.y + mN.finalPos.y) / 2;
    fN.finalPos.y = targetY;
    mN.finalPos.y = targetY;
    ySnapped.add(fN.id);
    ySnapped.add(mN.id);
  });

  // Post-layout: enforce a target XZ separation for each couple.
  // Base separation = 2.5; remarried persons get 3.5 so their multiple
  // marriages are clearly distinguishable. Both too-close and too-far couples
  // are corrected — this normalises small trees (where the force sim leaves
  // spouses ~1 unit apart) and large trees (where repulsion pushes them 10+ apart).
  // Direction from the force-directed layout is preserved.
  // Remarriage-safe: once a person's XZ is fixed by their first family, subsequent
  // families pull only the un-fixed spouse to the required distance.
  // Focal person is pinned at origin — never moved.
  const COUPLE_D_BASE   = 2.5;
  const COUPLE_D_REMARR = 3.5;
  const famCountById = {};
  families.forEach(fam => {
    (fam.husbandIds || []).forEach(id => { famCountById[id] = (famCountById[id] || 0) + 1; });
    (fam.wifeIds    || []).forEach(id => { famCountById[id] = (famCountById[id] || 0) + 1; });
  });
  const xzSnapped = new Set();
  families.forEach(fam => {
    const fatherId = fam.husbandIds && fam.husbandIds.length ? fam.husbandIds[0] : null;
    const motherId = fam.wifeIds    && fam.wifeIds.length    ? fam.wifeIds[0]    : null;
    const fN = fatherId != null ? personById[fatherId] : null;
    const mN = motherId != null ? personById[motherId] : null;
    if (!fN || !mN) return;
    if ((fN.generation || 0) !== (mN.generation || 0)) return;
    if (fN.focal || mN.focal) return; // focal person stays at origin
    const fSnapped = xzSnapped.has(fN.id);
    const mSnapped = xzSnapped.has(mN.id);
    if (fSnapped && mSnapped) return;
    const isRemarriage = (famCountById[fN.id] || 0) > 1 || (famCountById[mN.id] || 0) > 1;
    const target = isRemarriage ? COUPLE_D_REMARR : COUPLE_D_BASE;
    const dx = fN.finalPos.x - mN.finalPos.x;
    const dz = fN.finalPos.z - mN.finalPos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    xzSnapped.add(fN.id);
    xzSnapped.add(mN.id);
    // Default direction along X when spouses are coincident
    const dirX = dist > 0.01 ? dx / dist : 1.0;
    const dirZ = dist > 0.01 ? dz / dist : 0.0;
    if (!fSnapped && !mSnapped) {
      const midX = (fN.finalPos.x + mN.finalPos.x) / 2;
      const midZ = (fN.finalPos.z + mN.finalPos.z) / 2;
      fN.finalPos.x = midX + dirX * (target / 2);
      fN.finalPos.z = midZ + dirZ * (target / 2);
      mN.finalPos.x = midX - dirX * (target / 2);
      mN.finalPos.z = midZ - dirZ * (target / 2);
    } else if (fSnapped) {
      mN.finalPos.x = fN.finalPos.x - dirX * target;
      mN.finalPos.z = fN.finalPos.z - dirZ * target;
    } else {
      fN.finalPos.x = mN.finalPos.x + dirX * target;
      fN.finalPos.z = mN.finalPos.z + dirZ * target;
    }
  });

  // Enforce generational ordering: every child must sit below its parents in Y.
  // One pass propagates the constraint one generation level; worst-case passes
  // equals the tree depth (max gen − min gen). Stop early when nothing changed.
  const GEN_GAP   = 2.0;
  const genValues = persons.map(n => n.generation || 0);
  const genDepth  = Math.max(...genValues) - Math.min(...genValues);
  for (let pass = 0; pass < genDepth; pass++) {
    let changed = false;
    families.forEach(fam => {
      const fId = fam.husbandIds && fam.husbandIds.length ? fam.husbandIds[0] : null;
      const mId = fam.wifeIds    && fam.wifeIds.length    ? fam.wifeIds[0]    : null;
      const fP = fId != null ? personById[fId] : null;
      const mP = mId != null ? personById[mId] : null;
      const parentP = fP || mP;
      if (!parentP) return;
      const parentMinY = fP && mP ? Math.min(fP.finalPos.y, mP.finalPos.y) : parentP.finalPos.y;
      (fam.childIds || []).forEach(cid => {
        const cP = personById[cid];
        if (!cP || cP.focal) return;
        if (cP.finalPos.y > parentMinY - GEN_GAP) {
          cP.finalPos.y = parentMinY - GEN_GAP;
          changed = true;
        }
      });
    });
    if (!changed) break;
  }

  // Drop connected components not containing the focal person (isolated mini-trees
  // caused by the backend person limit cutting the connecting ancestor).
  const reachableIds = new Set([graphData.focalPersonId]);
  const adjMap = {};
  families.forEach(fam => {
    const members = [].concat(fam.husbandIds || [], fam.wifeIds || [], fam.childIds || [])
                      .filter(id => personById[id]);
    members.forEach(a => {
      if (!adjMap[a]) adjMap[a] = [];
      members.forEach(b => { if (a !== b) adjMap[a].push(b); });
    });
  });
  const bfsQueue = [graphData.focalPersonId];
  while (bfsQueue.length) {
    const id = bfsQueue.shift();
    (adjMap[id] || []).forEach(nb => {
      if (!reachableIds.has(nb)) { reachableIds.add(nb); bfsQueue.push(nb); }
    });
  }
  persons  = persons.filter(n => reachableIds.has(n.id));
  families = families.filter(fam =>
    [].concat(fam.husbandIds || [], fam.wifeIds || [], fam.childIds || []).some(id => reachableIds.has(id))
  );

  // Person count banner (always shown; extended message when tree is truncated)
  const banner = document.getElementById('ga-tree3d-truncated');
  if (banner) {
    banner.textContent = graphData.truncated
      ? persons.length + ' de ' + graphData.totalPersons + ' personas · árbol parcial'
      : persons.length + ' personas en el árbol';
    banner.classList.remove('d-none');
  }

  // Compute bounding radius of the settled layout; drives all scene scaling
  let treeRadius = 12; // minimum for very small trees
  persons.forEach(function(n) {
    const r = n.finalPos.length();
    if (r > treeRadius) treeRadius = r;
  });
  _adjustSceneForTree(treeRadius);
  _cinematicPersons    = persons;
  _cinematicTreeRadius = treeRadius;
  _cinematicTreeMinY   = Infinity;
  _cinematicTreeMaxY   = -Infinity;
  persons.forEach(n => {
    if (n.finalPos.y < _cinematicTreeMinY) _cinematicTreeMinY = n.finalPos.y;
    if (n.finalPos.y > _cinematicTreeMaxY) _cinematicTreeMaxY = n.finalPos.y;
  });
  _buildLogoWalls(treeRadius);

  const nodeMap      = {};
  const avatarGroups = [];
  const pickMeshes   = [];

  persons.forEach(node => {
    const bust = _buildBust(node);
    bust.position.copy(node.pos);
    _scene.add(bust);
    bust.traverse(c => { if (c.isMesh && c.userData.node) pickMeshes.push(c); });

    const sprite = _makeSprite(node);
    sprite.position.set(node.pos.x, node.pos.y - 0.55, node.pos.z);
    _scene.add(sprite);

    nodeMap[node.id] = { bust, sprite };
    avatarGroups.push({ bust, sprite, node });
  });

  // Click-to-navigate
  const raycaster = new THREE.Raycaster();
  const mouse     = new THREE.Vector2();
  let lastTouch    = 0;
  let navTarget    = null;

  function onPick(cx, cy, isTouch) {
    if (!settled) return;
    // Skip if the pointer moved more than 5 px — user was orbiting, not clicking
    const ddx = cx - _pdX, ddy = cy - _pdY;
    if (ddx * ddx + ddy * ddy > 25) return;
    if (_cinematic) return; // clicks are ignored during cinematic; use the camera button to stop
    _navReset = null;
    const rect = _renderer.domElement.getBoundingClientRect();
    mouse.x =  ((cx - rect.left) / rect.width)  * 2 - 1;
    mouse.y = -((cy - rect.top)  / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, _camera);
    const hits = raycaster.intersectObjects(pickMeshes, false);
    if (!hits.length) { _hidePersonCard(); return; }
    const node = hits[0].object.userData.node;
    if (!node) return;
    navTarget = node.pos.clone();
    _controls.autoRotate = false;
    // Touch taps zoom in tighter than mouse clicks — on a small screen getting
    // close to the bust makes the person card feel anchored to the selection.
    const dist          = _camera.position.distanceTo(node.pos);
    const comfortRadius = isTouch
      ? THREE.MathUtils.clamp(dist * 0.25, Math.max(treeRadius * 0.12, 3), treeRadius * 0.25)
      : THREE.MathUtils.clamp(dist * 0.30, treeRadius * 0.20, treeRadius * 0.38);
    if (dist > comfortRadius)          _navRadius = comfortRadius;
    else if (dist < treeRadius * 0.15) _navRadius = comfortRadius;
    _showPersonCard(node);
  }

  _onCanvasClick = e => onPick(e.clientX, e.clientY, false);
  _onCanvasTouchEnd = e => {
    const now = Date.now();
    if (now - lastTouch < 400) return;
    lastTouch = now;
    if (e.changedTouches.length) onPick(e.changedTouches[0].clientX, e.changedTouches[0].clientY, true);
  };
  _renderer.domElement.addEventListener('click', _onCanvasClick);
  _renderer.domElement.addEventListener('touchend', _onCanvasTouchEnd, { passive: true });

  // Settle animation
  let settleT  = 0;
  let settled  = false;
  const SETTLE_DUR = 1.8;
  let elapsed  = 0;

  // Distance thresholds for visibility culling (world units).
  // At 40+ units a sprite is < 24 screen px (unreadable) and a 0.04-radius
  // particle is < 1.4 px (sub-pixel). Both use the same cutoff for consistency.
  const SPRITE_VIS_D2   = 65 * 65;
  const PARTICLE_VIS_D2 = 40 * 40;
  let connFadeT        = 1; // reset to 0 when connectors are first built; drives opacity fade-in
  const focalBustEntry = avatarGroups.find(ag => ag.node.focal) || null;

  function loop() {
    _animId = requestAnimationFrame(loop);
    _clock.update();
    const dt = _clock.getDelta();
    elapsed += dt;

    // Smooth control velocity — decay to 10% in 0.35 s (frame-rate independent)
    if (_ctrlV && !_cinematic) {
      const decay = Math.pow(0.1, dt / 0.35);
      _tmpVec3A.copy(_camera.position).sub(_controls.target);
      _tmpSph.setFromVector3(_tmpVec3A);
      _tmpSph.radius = Math.max(_controls.minDistance,
                  Math.min(_controls.maxDistance, _tmpSph.radius + _ctrlV.dRadius));
      _tmpSph.theta += _ctrlV.dTheta;
      _tmpSph.phi    = Math.max(0.05, Math.min(Math.PI - 0.05, _tmpSph.phi + _ctrlV.dPhi));
      _tmpSph.makeSafe();
      _camera.position.setFromSpherical(_tmpSph).add(_controls.target);
      _camera.lookAt(_controls.target);
      if (_ctrlV.pan.lengthSq() > 0.00001) {
        _camera.position.add(_ctrlV.pan);
        _controls.target.add(_ctrlV.pan);
        _ctrlV.pan.multiplyScalar(decay);
      }
      _ctrlV.dRadius *= decay;
      _ctrlV.dTheta  *= decay;
      _ctrlV.dPhi    *= decay;
      if (Math.abs(_ctrlV.dRadius) < 0.0001 && Math.abs(_ctrlV.dTheta) < 0.0001 &&
          Math.abs(_ctrlV.dPhi) < 0.0001 && _ctrlV.pan.lengthSq() < 0.00001) {
        _ctrlV = null;
      }
    }

    _controls.update();

    // Skip rendering when nothing has changed (idle scene with no animations)
    const _hasAnimation = !settled || _ctrlV || navTarget || _navRadius !== null || _navReset
      || _edgeParticles.length > 0 || _cinematic
      || settled; // breathing pulse, ring spin, and connector fade always run post-settlement
    if (!_hasAnimation && !_needsRender) return;
    _needsRender = false;

    if (!settled) {
      settleT += dt / SETTLE_DUR;
      const reachedEnd = settleT >= 1;
      if (reachedEnd) settleT = 1;
      const et = easeInOut(settleT);
      // Update bust positions FIRST so _buildConnectors reads finalPos, not the
      // previous frame's position. Without this, a large first-frame dt (e.g. on
      // a slow Android device where the initial RAF fires >1.8 s after init) causes
      // settlement to happen in one frame while busts are still at spherePos, making
      // all connector lines appear as a compact starburst near the origin.
      persons.forEach(node => {
        node.pos.lerpVectors(node.spherePos, node.finalPos, et);
        const entry = nodeMap[node.id];
        entry.bust.position.copy(node.pos);
        entry.sprite.position.set(node.pos.x, node.pos.y - 0.55, node.pos.z);
      });
      if (reachedEnd) {
        settled = true;
        _buildConnectors(families, nodeMap);
        // Trigger connector fade-in from transparent
        connFadeT = 0;
        if (_connMats) {
          _connMats.coupleLine.opacity   = 0;
          _connMats.childLine.opacity    = 0;
          _connMats.couplePoints.opacity = 0;
          _connMats.childPoints.opacity  = 0;
        }
      }
    }

    // Connector opacity fade-in (0.6 s after settlement)
    if (settled && connFadeT < 1) {
      connFadeT = Math.min(1, connFadeT + dt / 0.6);
      const ef = easeInOut(connFadeT);
      if (_connMats) {
        _connMats.coupleLine.opacity   = 0.65 * ef;
        _connMats.childLine.opacity    = 0.55 * ef;
        _connMats.couplePoints.opacity = 0.35 * ef;
        _connMats.childPoints.opacity  = 0.30 * ef;
      }
    }

    // Focal ring slow spin — makes the gold orbital feel alive
    if (settled && focalBustEntry && focalBustEntry.bust.userData.ring) {
      // rotation.z because ring.rotation.x = PI/2 tilts its local frame 90°:
      // after that tilt, local Z aligns with world Y and produces the flat orbital spin.
      focalBustEntry.bust.userData.ring.rotation.z += dt * 0.5;
    }

    // Breathing pulse scale
    const breatheScale = settled
      ? 1 + 0.025 * Math.sin(elapsed * (Math.PI * 2 / 4.0))
      : 1;

    avatarGroups.forEach(({ bust, sprite, node }) => {
      const dx = _camera.position.x - node.pos.x;
      const dy = _camera.position.y - node.pos.y;
      const dz = _camera.position.z - node.pos.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      bust.rotation.y = Math.atan2(dx, dz);
      // Subtle breathing: focal person pulses on its own faster rhythm
      if (settled) {
        bust.scale.setScalar(node.focal
          ? 1 + 0.04 * Math.sin(elapsed * (Math.PI * 2 / 3.0))
          : breatheScale);
      }
      // Hide labels that are too far to read; keep all visible during settle so
      // the animation looks complete even before nodes reach their final positions.
      const spriteVisible = !settled || d2 < SPRITE_VIS_D2;
      sprite.visible = spriteVisible;
      // Adaptive label scale: larger when far away (readability), smaller when close (no clutter).
      // Only active after settlement — during the settle animation nodes are spread to
      // their sphere positions far from the camera, which would clamp scale to 2.0×.
      if (spriteVisible && settled && sprite.userData.baseSW) {
        const sf = THREE.MathUtils.clamp(Math.sqrt(d2) / 14, 0.7, 2.0);
        sprite.scale.set(sprite.userData.baseSW * sf, sprite.userData.baseSH * sf, 1);
      }
    });

    if (settled) {
      const camX = _camera.position.x, camY = _camera.position.y, camZ = _camera.position.z;
      _edgeParticles.forEach(p => {
        const mx = (p.p1.x + p.p2.x) * 0.5, my = (p.p1.y + p.p2.y) * 0.5, mz = (p.p1.z + p.p2.z) * 0.5;
        const dx = camX - mx, dy = camY - my, dz = camZ - mz;
        if (dx * dx + dy * dy + dz * dz < PARTICLE_VIS_D2) {
          p.mesh.visible = true;
          p.mesh.position.lerpVectors(p.p1, p.p2, (elapsed * p.speed + p.phase) % 1);
        } else {
          p.mesh.visible = false;
        }
      });
    }

    if (_navReset) {
      _controls.target.lerp(_navReset.target, 0.08);
      _tmpVec3A.copy(_camera.position).sub(_controls.target);
      _tmpSph.setFromVector3(_tmpVec3A);
      let dTheta = _navReset.spherical.theta - _tmpSph.theta;
      while (dTheta >  Math.PI) dTheta -= 2 * Math.PI;
      while (dTheta < -Math.PI) dTheta += 2 * Math.PI;
      _tmpSph.radius = THREE.MathUtils.lerp(_tmpSph.radius, _navReset.spherical.radius, 0.08);
      _tmpSph.theta += dTheta * 0.08;
      _tmpSph.phi    = THREE.MathUtils.lerp(_tmpSph.phi, _navReset.spherical.phi, 0.08);
      _tmpSph.makeSafe();
      _camera.position.setFromSpherical(_tmpSph).add(_controls.target);
      _camera.lookAt(_controls.target);
      if (_controls.target.distanceTo(_navReset.target) < 0.08 &&
          Math.abs(_tmpSph.radius - _navReset.spherical.radius) < 0.15 &&
          Math.abs(dTheta) < 0.02 &&
          Math.abs(_tmpSph.phi - _navReset.spherical.phi) < 0.02) {
        _navReset = null;
      }
    } else {
      if (navTarget) {
        _controls.target.lerp(navTarget, 0.07);
        if (_controls.target.distanceTo(navTarget) < 0.05) navTarget = null;
      }
      if (_navRadius !== null) {
        _tmpVec3A.copy(_camera.position).sub(_controls.target);
        _tmpSph.setFromVector3(_tmpVec3A);
        _tmpSph.radius = THREE.MathUtils.lerp(_tmpSph.radius, _navRadius, 0.07);
        _tmpSph.makeSafe();
        _camera.position.setFromSpherical(_tmpSph).add(_controls.target);
        _camera.lookAt(_controls.target);
        if (Math.abs(_tmpSph.radius - _navRadius) < 0.1) _navRadius = null;
      }
    }

    if (_cinematic && _cinematicPath && settled) {
      // Cancel any pending navigation so none of them fight the cinematic camera.
      navTarget  = null;
      _navRadius = null;
      _navReset  = null;
      // Cap dt so a tab-suspend/resume doesn't teleport the camera along the path.
      const cdt = Math.min(dt, 0.1);

      if (_cinematicInWarmup) {
        // Phase 1: glide smoothly from the camera's position at activation time
        // to the path's first waypoint (the opening overview shot).
        _cinematicWarmupT += cdt / CINEMATIC_WARMUP_DUR;
        if (_cinematicWarmupT >= 1) {
          _cinematicWarmupT  = 1;
          _cinematicInWarmup = false;
        }
        const w         = easeInOut(_cinematicWarmupT);
        const pathStart = _cinematicPath.camCurve.getPointAt(0);
        const lookStart = _cinematicPath.lookCurve.getPointAt(0);
        _camera.position.lerpVectors(_cinematicEntryPos,  pathStart, w);
        _controls.target.lerpVectors(_cinematicEntryLook, lookStart, w);
        _camera.lookAt(_controls.target);
        _scene.fog.density = _cinematicFogBase;
      } else {
        // Phase 2: follow the pre-built flythrough path
        _cinematicT = (_cinematicT + cdt * _cinematicPath.speed) % 1;
        const pos    = _cinematicPath.camCurve.getPointAt(_cinematicT);
        const lookAt = _cinematicPath.lookCurve.getPointAt(_cinematicT);
        // Clamp look-at Y to tree node bounds so spline overshoot never points
        // the camera above the highest person or below the lowest one.
        if (_cinematicTreeMinY !== null) {
          lookAt.y = Math.max(_cinematicTreeMinY - 0.5, Math.min(_cinematicTreeMaxY + 0.5, lookAt.y));
        }
        _camera.position.copy(pos);
        // Banking: dt-compensated lerp so the lean rate is consistent at any frame rate.
        const bankF = 1 - Math.pow(0.94, cdt * 60);
        const tan   = _cinematicPath.camCurve.getTangentAt(_cinematicT);
        _tmpBank.set(-tan.z * 0.45, 1, tan.x * 0.45).normalize();
        _camera.up.lerp(_tmpBank, bankF);
        // Lerp the look target so the camera swings smoothly rather than snapping
        // when transitioning between widely-separated cluster centroids.
        // Slower than 2.5 so distant cluster transitions feel like a graceful swing.
        _controls.target.lerp(lookAt, Math.min(1, cdt * 1.5));
        _camera.lookAt(_controls.target);
        // Fog density driven by camera height: higher shots get more atmospheric haze,
        // low close-ups clear out — reinforces depth at dramatic moments.
        // Normalise over [lowest node Y → highest path waypoint Y] so the gradient
        // spans the full camera travel range, not just the (much narrower) node Y span.
        const fogBotY = _cinematicTreeMinY || 0;
        const fogTopY = _cinematicPath.maxCamY;
        const normH   = THREE.MathUtils.clamp((_camera.position.y - fogBotY) / Math.max(1, fogTopY - fogBotY), 0, 1);
        _scene.fog.density = _cinematicFogBase * (1 + 0.35 * normH);
      }
    }

    _renderer.render(_scene, _camera);
  }
  _clock.reset(); // snap the Timer's baseline to now so the first getDelta() is ~0
  loop();

  const loader = document.getElementById('ga-tree3d-loader');
  if (loader) {
    loader.style.opacity      = '0';
    loader.style.pointerEvents = 'none';
    if (_loaderHideTimer) clearTimeout(_loaderHideTimer);
    _loaderHideTimer = setTimeout(() => { loader.style.display = 'none'; _loaderHideTimer = null; }, 800);
  }
};

window._ga3dDispose = function() {
  if (_animId) { cancelAnimationFrame(_animId); _animId = null; }
  if (_loaderHideTimer) { clearTimeout(_loaderHideTimer); _loaderHideTimer = null; }
  _wallTexGen++; // invalidate any in-flight texture load from the previous scene
  window.removeEventListener('resize', _onResize);
  if (_scene) {
    _scene.traverse(obj => {
      // Shared geometries (_particleGeo) are disposed once below — skip per-mesh
      // traversal disposal so we don't double-dispose.
      if (obj.geometry && obj.geometry !== _particleGeo) obj.geometry.dispose();
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach(m => {
          if (MAT      && Object.values(MAT).indexOf(m)       !== -1) return;
          if (_connMats && Object.values(_connMats).indexOf(m) !== -1) return;
          // Wall materials share a single texture across 4 planes — only the
          // first wall owns the map; the rest skip to avoid double-disposing.
          if (m.map && !(m.userData && m.userData.sharedMap)) m.map.dispose();
          m.dispose();
        });
      }
    });
    _edgeParticles.forEach(p => { _scene.remove(p.mesh); }); // geometry is the shared pool; material is pooled in _connMats
  }
  if (_particleGeo) { _particleGeo.dispose(); _particleGeo = null; }
  _edgeParticles.length = 0;
  if (MAT)       { Object.values(MAT).forEach(m => m.dispose());       MAT       = null; }
  if (_connMats) { Object.values(_connMats).forEach(m => m.dispose()); _connMats = null; }
  _focalName = '';
  _hidePersonCard();
  const banner = document.getElementById('ga-tree3d-truncated');
  if (banner) banner.classList.add('d-none');
  if (_controls) { _controls.dispose(); _controls = null; }
  if (_renderer) {
    _renderer.domElement.removeEventListener('pointerdown', _onPointerDown);
    _renderer.domElement.removeEventListener('wheel', _onWheel, { capture: true });
    _renderer.domElement.removeEventListener('click', _onCanvasClick);
    _renderer.domElement.removeEventListener('touchend', _onCanvasTouchEnd);
    _renderer.dispose();
    if (_renderer.domElement.parentElement) _renderer.domElement.remove();
  }
  if (_clock) { _clock.dispose(); _clock = null; }
  _renderer = _scene = _camera = _sun = null;
  _onPointerDown = _onWheel = _onCanvasClick = _onCanvasTouchEnd = null;
  _ctrlV = _navReset = null;
  _navRadius = null;
  _pdX = 0; _pdY = 0;
  _cinematic = false;
  _cinematicPath = null;
  _cinematicPersons = null;
  _cinematicTreeRadius = 0;
  _cinematicT = 0;
  _cinematicInWarmup  = false;
  _cinematicWarmupT   = 0;
  _cinematicEntryPos  = null;
  _cinematicEntryLook = null;
  _cinematicTreeMinY  = null;
  _cinematicTreeMaxY  = null;
  _needsRender = true;
  _initCamPos = _initTarget = null;
  const titleEl = document.getElementById('ga-tree3d-title');
  if (titleEl) titleEl.textContent = '';
};

window._ga3dControl = function(action) {
  if (!_camera || !_controls) return;

  if (action === 'reset') {
    if (!_initCamPos) return;
    _navReset = {
      target:    _initTarget.clone(),
      spherical: new THREE.Spherical().setFromVector3(_initCamPos.clone().sub(_initTarget))
    };
    _ctrlV = null;
    _navRadius = null;
    _controls.autoRotate = true;
    _hidePersonCard();
    return;
  }

  _navReset = null;
  if (!_ctrlV) _ctrlV = { dTheta: 0, dPhi: 0, dRadius: 0, pan: new THREE.Vector3() };

  _tmpVec3A.subVectors(_camera.position, _controls.target);
  _tmpSph.setFromVector3(_tmpVec3A);

  switch (action) {
    case 'zoom-in':      _ctrlV.dRadius -= _tmpSph.radius * 0.003; break;
    case 'zoom-out':     _ctrlV.dRadius += _tmpSph.radius * 0.003; break;
    case 'rotate-left':  _ctrlV.dTheta -= 0.006; _controls.autoRotate = false; break;
    case 'rotate-right': _ctrlV.dTheta += 0.006; _controls.autoRotate = false; break;
    case 'rotate-up':    _ctrlV.dPhi -= 0.006; break;
    case 'rotate-down':  _ctrlV.dPhi += 0.006; break;
    case 'pan-up':
    case 'pan-down':
    case 'pan-left':
    case 'pan-right': {
      _camera.getWorldDirection(_tmpVec3A);
      _tmpBank.crossVectors(_tmpVec3A, _camera.up).normalize();
      const step = _tmpSph.radius * 0.003;
      if (action === 'pan-left')  _ctrlV.pan.addScaledVector(_tmpBank,  -step);
      if (action === 'pan-right') _ctrlV.pan.addScaledVector(_tmpBank,   step);
      if (action === 'pan-up')    _ctrlV.pan.addScaledVector(_camera.up, step);
      if (action === 'pan-down')  _ctrlV.pan.addScaledVector(_camera.up,-step);
      break;
    }
  }
};
