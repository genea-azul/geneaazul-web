import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let _renderer, _scene, _camera, _controls, _animId, _clock, _sun;
let _ctrlV    = null; // { dTheta, dPhi, dRadius, pan: Vector3 }
let _navRadius = null; // target orbit radius after click-to-navigate
let _navReset  = null; // { target, spherical } for reset-to-home animation
let _initCamPos, _initTarget; // stored at scene build time
// Stored listener refs so they can be removed on dispose
let _onPointerDown, _onWheel, _onCanvasClick, _onCanvasTouchEnd;
// Flag to cancel in-flight logo texture load on dispose
let _wallTexDisposed = false;
// Render-on-demand: only draw when something changed
let _needsRender = true;
// Shared connector materials (pooled across all edges to avoid per-edge allocations)
let _connMats = null;
// Focal person name used for PNG export filename
let _focalName = '';

function _buildMaterials() {
  return {
    maleLive:   new THREE.MeshStandardMaterial({ color: 0x2c6fa0, roughness: 0.50, metalness: 0.20 }),
    femaleLive: new THREE.MeshStandardMaterial({ color: 0x9b4c6e, roughness: 0.50, metalness: 0.15 }),
    focal:      new THREE.MeshStandardMaterial({ color: 0xc89020, roughness: 0.35, metalness: 0.45,
                  emissive: new THREE.Color(0x3a2000), emissiveIntensity: 0.3 }),
    maleDead:   new THREE.MeshStandardMaterial({ color: 0x5a7890, roughness: 0.80, metalness: 0.05, transparent: true, opacity: 0.72 }),
    femaleDead: new THREE.MeshStandardMaterial({ color: 0x806070, roughness: 0.80, metalness: 0.05, transparent: true, opacity: 0.70 }),
    deadCross:  new THREE.MeshStandardMaterial({ color: 0x7a7870, roughness: 0.9 }),
  };
}

function _buildConnectorMats() {
  const COUPLE = 0x8b6010, CHILD = 0x7a5828;
  return {
    coupleLine:   new THREE.LineBasicMaterial({ color: COUPLE, transparent: true, opacity: 0.65, depthWrite: false }),
    childLine:    new THREE.LineBasicMaterial({ color: CHILD,  transparent: true, opacity: 0.55, depthWrite: false }),
    couplePoints: new THREE.PointsMaterial({ color: COUPLE, size: 0.04, transparent: true, opacity: 0.29, depthWrite: false, sizeAttenuation: true }),
    childPoints:  new THREE.PointsMaterial({ color: CHILD,  size: 0.04, transparent: true, opacity: 0.25, depthWrite: false, sizeAttenuation: true }),
    coupleFlow:   new THREE.MeshBasicMaterial({ color: COUPLE, depthWrite: false }),
    childFlow:    new THREE.MeshBasicMaterial({ color: CHILD,  depthWrite: false }),
    orbMat:       new THREE.MeshStandardMaterial({ color: 0xb08020, roughness: 0.4, metalness: 0.3 }),
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
  _controls.enablePan = true;
  _controls.minDistance = 5;
  _controls.maxDistance = 55;
  _controls.autoRotate = true;
  _controls.autoRotateSpeed = 0.2;
  _controls.zoomSpeed = 3;
  _onPointerDown = () => { _controls.autoRotate = false; };
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
    const fwd = new THREE.Vector3();
    _camera.getWorldDirection(fwd);
    const right = new THREE.Vector3().crossVectors(fwd, _camera.up).normalize();
    _ctrlV.pan.addScaledVector(right,  e.deltaX * scale);
    _ctrlV.pan.addScaledVector(_camera.up, -e.deltaY * scale);
  };
  _renderer.domElement.addEventListener('wheel', _onWheel, { passive: false, capture: true });

  _scene.add(new THREE.AmbientLight(0xfff8f0, 0.9));
  _sun = new THREE.DirectionalLight(0xffe8b0, 1.6);
  _sun.position.set(6, 12, 8);
  _sun.castShadow = true;
  _sun.shadow.mapSize.set(1024, 1024);
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
  _camera.aspect = W / H;
  _camera.updateProjectionMatrix();
  _renderer.setSize(W, H);
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

  const F = persons.map(() => new THREE.Vector3());
  const maxIter = Math.min(350, Math.max(100, persons.length * 5));
  for (let iter = 0; iter < maxIter; iter++) {
    F.forEach(f => f.set(0, 0, 0));

    for (let i = 0; i < persons.length; i++) {
      for (let j = i + 1; j < persons.length; j++) {
        const d = persons[i].pos.clone().sub(persons[j].pos);
        const l = Math.max(d.length(), 0.4);
        const f = 16 / (l * l);
        d.normalize().multiplyScalar(f);
        F[i].add(d); F[j].sub(d);
      }
    }

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

    persons.forEach((n, i) => {
      if (n.focal) return;
      F[i].y  += 0.07 * ((n.generation || 0) * GY - n.pos.y);
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
  persons.forEach(n => { n.pos.copy(n.spherePos); });

  return edges;
}

// ── Bust builder + sprite ───────────────────────────────────────────────────

function yearFrom(d) {
  if (!d) return null;
  const m = String(d).match(/\b(\d{4})\b/);
  return m ? m[1] : null;
}

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

  part(new THREE.SphereGeometry(0.22 * s, 18, 18),             0, 0.52 * s, 0);
  part(new THREE.CylinderGeometry(0.08*s, 0.10*s, 0.16*s, 12), 0, 0.30 * s, 0);
  part(new THREE.CylinderGeometry(0.19*s, 0.26*s, 0.34*s, 14), 0, 0.10 * s, 0);
  part(new THREE.CylinderGeometry(0.28*s, 0.28*s, 0.05*s, 14), 0, 0.28 * s, 0);

  if (node.focal) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.38, 0.025, 8, 40),
      new THREE.MeshBasicMaterial({ color: 0xd4a020, transparent: true, opacity: 0.55 })
    );
    ring.rotation.x = Math.PI / 2; ring.position.y = -0.08;
    g.add(ring);
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
  const label = rawName.split(' ').slice(0, 2).join(' ') || '?';

  const bYear = yearFrom(node.dateOfBirth);
  const dYear = yearFrom(node.dateOfDeath);
  let years = '';
  if (bYear && dYear)       years = bYear + ' – ' + dYear;
  else if (bYear && !node.isAlive) years = bYear + ' – ?';
  else if (bYear)           years = bYear;
  else if (dYear)           years = '† ' + dYear;

  const hasYears = years.length > 0;
  const S = 2; // supersample: 2× canvas resolution → sharper text at same sprite size
  const CW_B = 300, CH_B = hasYears ? 78 : 52;
  const CW = CW_B * S, CH = CH_B * S;
  const cv  = document.createElement('canvas');
  cv.width = CW; cv.height = CH;
  const ctx = cv.getContext('2d');
  const fontSize = (node.focal ? 25 : 19) * S;
  const nameY = (hasYears ? Math.round(CH_B * 0.38) : CH_B / 2) * S;

  ctx.font = `bold ${fontSize}px Georgia, serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

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
    const ySize = (node.focal ? 16 : 12) * S;
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
  sprite.scale.set(1.9, 1.9 * (CH_B / CW_B), 1);
  return sprite;
}

// ── Family connectors ────────────────────────────────────────────────────────

const _edgeParticles = [];

function _seg(p1, p2, lineMat, ptsMat) {
  _scene.add(new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([p1.clone(), p2.clone()]),
    lineMat
  ));
  const n = Math.max(3, Math.ceil(p1.distanceTo(p2) * 5));
  const pts = [];
  for (let i = 0; i <= n; i++) pts.push(p1.clone().lerp(p2, i / n));
  _scene.add(new THREE.Points(
    new THREE.BufferGeometry().setFromPoints(pts),
    ptsMat
  ));
}

function _flowPart(p1, p2, mat, speed, phase) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.04, 7, 7), mat);
  _scene.add(m);
  _edgeParticles.push({ mesh: m, p1: p1.clone(), p2: p2.clone(), speed, phase });
}

function _buildConnectors(families, nodeMap) {
  if (!_connMats) _connMats = _buildConnectorMats();
  const { coupleLine, childLine, couplePoints, childPoints, coupleFlow, childFlow, orbMat } = _connMats;

  families.forEach(fam => {
    const fatherId = (fam.husbandIds && fam.husbandIds.length) ? fam.husbandIds[0] : null;
    const motherId = (fam.wifeIds    && fam.wifeIds.length)    ? fam.wifeIds[0]    : null;
    const fN = fatherId != null ? nodeMap[fatherId] : null;
    const mN = motherId != null ? nodeMap[motherId] : null;
    if (!fN || !mN) return;

    const fp = fN.bust.position, mp = mN.bust.position;
    const barY   = Math.max(fp.y, mp.y) + 0.28;
    const fTop   = new THREE.Vector3(fp.x, fp.y + 0.28, fp.z);
    const mTop   = new THREE.Vector3(mp.x, mp.y + 0.28, mp.z);
    const fBar   = new THREE.Vector3(fp.x, barY, fp.z);
    const mBar   = new THREE.Vector3(mp.x, barY, mp.z);
    const midBar = fBar.clone().lerp(mBar, 0.5);

    // Vertical legs from each spouse up to the couple bar
    if (fTop.y < barY - 0.05) _seg(fTop, fBar, coupleLine, couplePoints);
    if (mTop.y < barY - 0.05) _seg(mTop, mBar, coupleLine, couplePoints);
    // Horizontal couple bar
    _seg(fBar, mBar, coupleLine, couplePoints);
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 12), orbMat);
    orb.position.copy(midBar); orb.castShadow = true; _scene.add(orb);
    _flowPart(fBar, midBar, coupleFlow, 0.35, Math.random());
    _flowPart(mBar, midBar, coupleFlow, 0.35, Math.random() * 0.5);

    if (!fam.childIds || !fam.childIds.length) return;

    const cNodes = fam.childIds.map(id => nodeMap[id]).filter(Boolean);
    if (!cNodes.length) return;

    // Junction point: halfway between couple bar and the highest (closest) child
    const maxChildY = Math.max(...cNodes.map(n => n.bust.position.y));
    const juncY = maxChildY + (barY - maxChildY) * 0.4;
    const junc  = new THREE.Vector3(midBar.x, juncY, midBar.z);

    _seg(midBar, junc, coupleLine, couplePoints);
    _flowPart(midBar, junc, coupleFlow, 0.32, Math.random());

    // Draw from junction straight to each child's top
    cNodes.forEach(cn => {
      const cp = cn.bust.position;
      const cTop = new THREE.Vector3(cp.x, cp.y + 0.28, cp.z);
      _seg(junc, cTop, childLine, childPoints);
      _flowPart(junc, cTop, childFlow, 0.25 + Math.random() * 0.12, Math.random());
    });
  });
}

// ── Tree-size-dependent scene tuning ─────────────────────────────────────────

function _adjustSceneForTree(treeRadius) {
  // Camera: start focused on the focal person (origin); cap at 15 so large
  // trees don't open zoomed way out — users can zoom out to explore.
  const initZ = Math.min(treeRadius * 1.35, 15);
  _camera.position.set(0, 3, initZ);
  _camera.lookAt(0, 0, 0);
  _initCamPos = _camera.position.clone();

  // Controls: let users zoom out 3.5× the tree radius
  _controls.minDistance = 3;
  _controls.maxDistance = Math.min(treeRadius * 3.5, 200);

  // Fog: 50% fogged at ~2× tree radius (density scales inversely with size)
  _scene.fog.density = 0.35 / treeRadius;

  // Shadow volume: cover the whole tree extent
  const sb = treeRadius * 1.3;
  _sun.shadow.camera.left   = _sun.shadow.camera.bottom = -sb;
  _sun.shadow.camera.right  = _sun.shadow.camera.top    =  sb;
  _sun.shadow.camera.far    = treeRadius * 4;
  _sun.shadow.camera.updateProjectionMatrix();
}

// ── Logo background walls ────────────────────────────────────────────────────

function _buildLogoWalls(treeRadius) {
  _wallTexDisposed = false;
  const loader = new THREE.TextureLoader();
  loader.load('/img/logo-simple-2500x2500-no-bg.png', function(tex) {
    if (_wallTexDisposed || !_scene) { tex.dispose(); return; }
    tex.colorSpace = THREE.SRGBColorSpace;

    // Walls sit far enough that the orbiting camera never gets closer than ~treeRadius away
    const wallDist  = treeRadius * 2.5;
    const planeSize = treeRadius * 3;

    const WALLS = [
      { pos: [        0, 0, -wallDist], rotY:  0           },
      { pos: [-wallDist, 0,         0], rotY:  Math.PI / 2 },
      { pos: [ wallDist, 0,         0], rotY: -Math.PI / 2 },
      { pos: [        0, 0,  wallDist], rotY:  Math.PI     },
    ];

    WALLS.forEach(function(w) {
      const mat = new THREE.MeshBasicMaterial({
        map: tex, transparent: true, opacity: 0.25,
        depthWrite: false, side: THREE.DoubleSide
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(planeSize, planeSize), mat);
      mesh.position.set(w.pos[0], w.pos[1], w.pos[2]);
      mesh.rotation.y = w.rotY;
      _scene.add(mesh);
    });
  });
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
    const bYear = yearFrom(node.dateOfBirth);
    const dYear = yearFrom(node.dateOfDeath);
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
  const img = new Image();
  img.onload = function() {
    const margin = Math.round(W * 0.025);
    const logoW  = Math.round(W * 0.11);
    const logoH  = Math.round(logoW * (img.height / img.width));
    ctx.globalAlpha = 0.60;
    ctx.drawImage(img, W - logoW - margin, H - logoH - Math.round(margin * 2.2), logoW, logoH);
    ctx.globalAlpha = 1;
    const fs = Math.max(14, Math.round(W * 0.014));
    ctx.font = fs + 'px Georgia, serif';
    ctx.fillStyle = 'rgba(90, 56, 0, 0.65)';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText('geneaazul.com.ar', W - margin, H - margin);
    const safeName = (_focalName || 'familia')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').toLowerCase();
    const link = document.createElement('a');
    link.download = 'arbol-' + safeName + '.png';
    link.href = out.toDataURL('image/png');
    link.click();
  };
  img.onerror = function() {
    const link = document.createElement('a');
    link.download = 'arbol.png';
    link.href = src.toDataURL('image/png');
    link.click();
  };
  img.src = '/img/logo-simple-2500x2500-no-bg.png';
};

// ── Main init / dispose ──────────────────────────────────────────────────────

window._ga3dInit = function(graphData) {
  if (!graphData || !Array.isArray(graphData.persons) || !Array.isArray(graphData.families)) {
    console.error('_ga3dInit: invalid graphData', graphData);
    return;
  }

  if (_renderer) window._ga3dDispose();

  MAT = _buildMaterials();
  _buildScene('ga-tree3d-canvas-wrap');
  _clock = new THREE.Clock();
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
  // Each person is only snapped once (first family wins) to avoid a second marriage
  // re-averaging an already-aligned Y.
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
    if (ySnapped.has(fN.id) || ySnapped.has(mN.id)) return;
    const avgY = (fN.finalPos.y + mN.finalPos.y) / 2;
    fN.finalPos.y = avgY;
    mN.finalPos.y = avgY;
    ySnapped.add(fN.id);
    ySnapped.add(mN.id);
  });

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
    avatarGroups.push({ bust, node });
  });

  // Click-to-navigate
  const raycaster = new THREE.Raycaster();
  const mouse     = new THREE.Vector2();
  let lastTouch   = 0;
  let navTarget   = null;

  function onPick(cx, cy) {
    if (!settled) return;
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
    // Zoom to a comfortable viewing distance (thresholds scale with tree size)
    const dist = _camera.position.distanceTo(node.pos);
    if (dist > treeRadius * 0.9)      _navRadius = treeRadius * 0.50;
    else if (dist < treeRadius * 0.25) _navRadius = treeRadius * 0.45;
    else                               _navRadius = null;
    _showPersonCard(node);
  }

  _onCanvasClick = e => onPick(e.clientX, e.clientY);
  _onCanvasTouchEnd = e => {
    const now = Date.now();
    if (now - lastTouch < 400) return;
    lastTouch = now;
    if (e.changedTouches.length) onPick(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
  };
  _renderer.domElement.addEventListener('click', _onCanvasClick);
  _renderer.domElement.addEventListener('touchend', _onCanvasTouchEnd, { passive: true });

  // Settle animation
  let settleT  = 0;
  let settled  = false;
  const SETTLE_DUR = 1.8;
  let elapsed  = 0;

  function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  function loop() {
    _animId = requestAnimationFrame(loop);
    const dt = _clock.getDelta();
    elapsed += dt;

    // Smooth control velocity — decay to 10% in 0.35 s (frame-rate independent)
    if (_ctrlV) {
      const decay = Math.pow(0.1, dt / 0.35);
      const sv = new THREE.Spherical().setFromVector3(
        _camera.position.clone().sub(_controls.target)
      );
      sv.radius = Math.max(_controls.minDistance,
                  Math.min(_controls.maxDistance, sv.radius + _ctrlV.dRadius));
      sv.theta += _ctrlV.dTheta;
      sv.phi    = Math.max(0.05, Math.min(Math.PI - 0.05, sv.phi + _ctrlV.dPhi));
      sv.makeSafe();
      _camera.position.setFromSpherical(sv).add(_controls.target);
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
    const _hasAnimation = !settled || _ctrlV || navTarget || _navRadius !== null || _navReset || _edgeParticles.length > 0;
    if (!_hasAnimation && !_needsRender) return;
    _needsRender = false;

    if (!settled) {
      settleT += dt / SETTLE_DUR;
      if (settleT >= 1) {
        settleT = 1; settled = true;
        _buildConnectors(families, nodeMap);
      }
      const et = easeInOut(settleT);
      persons.forEach(node => {
        node.pos.lerpVectors(node.spherePos, node.finalPos, et);
        const entry = nodeMap[node.id];
        entry.bust.position.copy(node.pos);
        entry.sprite.position.set(node.pos.x, node.pos.y - 0.55, node.pos.z);
      });
    }

    avatarGroups.forEach(({ bust, node }) => {
      bust.rotation.y = Math.atan2(
        _camera.position.x - node.pos.x,
        _camera.position.z - node.pos.z
      );
    });

    if (settled) {
      _edgeParticles.forEach(p => {
        p.mesh.position.lerpVectors(p.p1, p.p2, (elapsed * p.speed + p.phase) % 1);
      });
    }

    if (_navReset) {
      _controls.target.lerp(_navReset.target, 0.08);
      const rs = new THREE.Spherical().setFromVector3(
        _camera.position.clone().sub(_controls.target)
      );
      let dTheta = _navReset.spherical.theta - rs.theta;
      while (dTheta >  Math.PI) dTheta -= 2 * Math.PI;
      while (dTheta < -Math.PI) dTheta += 2 * Math.PI;
      rs.radius = THREE.MathUtils.lerp(rs.radius, _navReset.spherical.radius, 0.08);
      rs.theta += dTheta * 0.08;
      rs.phi    = THREE.MathUtils.lerp(rs.phi, _navReset.spherical.phi, 0.08);
      rs.makeSafe();
      _camera.position.setFromSpherical(rs).add(_controls.target);
      _camera.lookAt(_controls.target);
      if (_controls.target.distanceTo(_navReset.target) < 0.08 &&
          Math.abs(rs.radius - _navReset.spherical.radius) < 0.15 &&
          Math.abs(dTheta) < 0.02 &&
          Math.abs(rs.phi - _navReset.spherical.phi) < 0.02) {
        _navReset = null;
      }
    } else {
      if (navTarget) {
        _controls.target.lerp(navTarget, 0.07);
        if (_controls.target.distanceTo(navTarget) < 0.05) navTarget = null;
      }
      if (_navRadius !== null) {
        const ns = new THREE.Spherical().setFromVector3(
          _camera.position.clone().sub(_controls.target)
        );
        ns.radius = THREE.MathUtils.lerp(ns.radius, _navRadius, 0.07);
        ns.makeSafe();
        _camera.position.setFromSpherical(ns).add(_controls.target);
        _camera.lookAt(_controls.target);
        if (Math.abs(ns.radius - _navRadius) < 0.1) _navRadius = null;
      }
    }

    _renderer.render(_scene, _camera);
  }
  loop();

  const loader = document.getElementById('ga-tree3d-loader');
  if (loader) {
    loader.style.opacity      = '0';
    loader.style.pointerEvents = 'none';
    setTimeout(() => loader.style.display = 'none', 800);
  }
};

window._ga3dDispose = function() {
  if (_animId) { cancelAnimationFrame(_animId); _animId = null; }
  _wallTexDisposed = true;
  window.removeEventListener('resize', _onResize);
  if (_scene) {
    _scene.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach(m => {
          if (MAT      && Object.values(MAT).indexOf(m)       !== -1) return;
          if (_connMats && Object.values(_connMats).indexOf(m) !== -1) return;
          if (m.map) m.map.dispose();
          m.dispose();
        });
      }
    });
    _edgeParticles.forEach(p => _scene.remove(p.mesh));
  }
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
  _renderer = _scene = _camera = _clock = _sun = null;
  _onPointerDown = _onWheel = _onCanvasClick = _onCanvasTouchEnd = null;
  _ctrlV = _navReset = null;
  _navRadius = null;
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

  const s = new THREE.Spherical().setFromVector3(
    _camera.position.clone().sub(_controls.target)
  );

  switch (action) {
    case 'zoom-in':      _ctrlV.dRadius -= s.radius * 0.003; break;
    case 'zoom-out':     _ctrlV.dRadius += s.radius * 0.003; break;
    case 'rotate-left':  _ctrlV.dTheta -= 0.006; _controls.autoRotate = false; break;
    case 'rotate-right': _ctrlV.dTheta += 0.006; _controls.autoRotate = false; break;
    case 'rotate-up':    _ctrlV.dPhi -= 0.006; break;
    case 'rotate-down':  _ctrlV.dPhi += 0.006; break;
    case 'pan-up':
    case 'pan-down':
    case 'pan-left':
    case 'pan-right': {
      const right = new THREE.Vector3().crossVectors(
        _camera.getWorldDirection(new THREE.Vector3()), _camera.up
      ).normalize();
      const up   = _camera.up.clone().normalize();
      const step = s.radius * 0.003;
      if (action === 'pan-left')  _ctrlV.pan.addScaledVector(right, -step);
      if (action === 'pan-right') _ctrlV.pan.addScaledVector(right,  step);
      if (action === 'pan-up')    _ctrlV.pan.addScaledVector(up,     step);
      if (action === 'pan-down')  _ctrlV.pan.addScaledVector(up,    -step);
      break;
    }
  }
};
