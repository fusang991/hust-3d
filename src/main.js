import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CAMPUS } from './campus-data.js';
import { LANDMARKS, LANDMARKS_BY_ID, CONTACT_SHADOWS } from './data.js';
import { buildTerrain, buildWater, buildGreens, buildRoads, buildPlazas, siteMaterials } from './site.js';
import { buildContextBuildings } from './osm-buildings.js';
import {
  buildMainGate,
  buildLibrary,
  buildEast9,
  buildWest12,
  buildNan1,
  buildGym,
  buildPavilion,
  buildWutongyu,
  buildOpto,
  buildOtherGates,
  buildLandscape,
  buildLamps,
  buildCenterStadium,
} from './buildings.js';
import { buildTrees } from './nature.js';
import {
  FACILITIES,
  FACILITY_BY_ID,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  facilityView,
  facilityDescription,
} from './facilities.js';
import { createSky, createStars, createClouds, LightingRig } from './environment.js';
import { LabelManager } from './labels.js';
import { allFacadeMaterials, MAT } from './architecture.js';
import { blobTexture } from './util.js';

const canvas = document.getElementById('scene');
const loader = document.getElementById('loader');
const loaderSub = document.getElementById('loader-sub');
const card = document.getElementById('card');
const cardTitle = document.getElementById('card-title');
const cardEn = document.getElementById('card-en');
const cardDesc = document.getElementById('card-desc');
const panelList = document.getElementById('landmarks');
const statsEl = document.getElementById('stats');

let renderer;
let scene;
let camera;
let controls;
let rig;
let labels;
let trees;
let clock;
let clouds;
const cars = [];
let tween = null;
let elapsed = 0;

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function init() {
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
    logarithmicDepthBuffer: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xd3e2ee);

  camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 2, 26000);
  const overview = LANDMARKS_BY_ID.overview.view;
  camera.position.fromArray(overview.pos);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.fromArray(overview.target);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minDistance = 30;
  controls.maxDistance = 9000;
  controls.maxPolarAngle = Math.PI * 0.495;
  controls.autoRotateSpeed = 0.28;
  controls.update();

  const sky = createSky(scene);
  const stars = createStars(scene);
  clouds = createClouds(scene);

  const campus = new THREE.Group();
  campus.name = 'campus';
  scene.add(campus);

  buildTerrain(scene);
  buildRoads(scene);
  buildGreens(scene);
  buildWater(scene);
  buildPlazas(scene);

  buildContextBuildings(campus);
  buildMainGate(campus);
  buildLibrary(campus);
  buildEast9(campus);
  buildWest12(campus);
  buildNan1(campus);
  buildGym(campus);
  buildPavilion(campus);
  buildWutongyu(campus);
  buildOpto(campus);
  buildOtherGates(campus);
  buildLandscape(campus);
  buildLamps(campus);
  buildCenterStadium(campus);
  addContactShadows(scene);
  trees = buildTrees(campus);
  buildTraffic(scene);

  rig = new LightingRig(scene, renderer, {
    sky,
    skyMesh: sky.sky,
    stars,
    clouds,
    lampMaterials: [MAT.lamp],
    facadeMaterials: allFacadeMaterials(),
    waterMaterials: [siteMaterials().water],
  });

  labels = new LabelManager(document.getElementById('labels'), camera);
  for (const lm of LANDMARKS) {
    if (lm.list === false) continue;
    labels.add({
      id: lm.id,
      name: lm.name,
      en: lm.en,
      position: lm.labelPos,
      onClick: (id) => focusLandmark(id),
    });
  }

  const landmarkNames = new Set(LANDMARKS.map((l) => l.name));
  const blockLabel = /单元|^[A-D]\d|^\d+栋$|^C\d|^喻园\d|^北区\d|^学生公寓西区/;
  for (const f of FACILITIES) {
    if (landmarkNames.has(f.name)) continue;
    if (blockLabel.test(f.name)) continue;
    if (f.category === 'other' && f.area < 900) continue;
    labels.add({
      id: f.id,
      name: f.name,
      en: '',
      position: [f.x, (f.h || 6) + 5, f.z],
      kind: 'building',
      category: f.category,
      maxDistance: 720,
      onClick: (id) => focusFacility(id),
    });
  }

  buildDirectoryUi();
  wireUi();

  const applyLabelSafeArea = () => {
    const collapsed = document.body.classList.contains('panel-collapsed');
    labels.safe.left = window.innerWidth > 820 && !collapsed ? 318 : 16;
  };
  applyLabelSafeArea();
  window.addEventListener('resize', applyLabelSafeArea);
  document.getElementById('panel-toggle')?.addEventListener('click', () => {
    requestAnimationFrame(applyLabelSafeArea);
  });

  if (statsEl) {
    statsEl.textContent = `${LANDMARKS.length - 1} 处地标 · ${CAMPUS.buildings.length} 栋建筑 · ${trees.count} 株树木`;
  }

  clock = new THREE.Clock();
  window.addEventListener('resize', onResize);
  window.addEventListener('keydown', onKey);

  window.__HUST = { THREE, scene, camera, renderer, controls, rig, labels, trees, clouds, CAMPUS, LANDMARKS };

  renderer.compile(scene, camera);
  requestAnimationFrame(frame);
  setTimeout(() => loader.classList.add('done'), 260);
}

/* ------------------------------------------------------------------ */
/* camera fly-through                                                  */
/* ------------------------------------------------------------------ */
function flyTo(view, duration = 1.6) {
  tween = {
    start: performance.now(),
    durMs: duration * 1000,
    fromPos: camera.position.clone(),
    toPos: new THREE.Vector3().fromArray(view.pos),
    fromTgt: controls.target.clone(),
    toTgt: new THREE.Vector3().fromArray(view.target),
  };
  if (controls.autoRotate) {
    controls.autoRotate = false;
    document.getElementById('btn-rotate')?.classList.remove('active');
  }
}

function focusFacility(id) {
  const f = FACILITY_BY_ID[id];
  if (!f) return;
  flyTo(facilityView(f));
  labels.setActive(id);
  showCard({
    name: f.name,
    en: `${CATEGORY_LABELS[f.category] || ''}${f.alias && f.alias !== f.name ? ' · ' + f.alias : ''}`,
    desc: facilityDescription(f),
  });
}

function focusLandmark(id) {
  const lm = LANDMARKS_BY_ID[id];
  if (!lm) return;
  flyTo(lm.view);
  labels.setActive(id);
  highlightPanel(id);
  if (lm.desc) showCard(lm);
}

/* ------------------------------------------------------------------ */
/* UI                                                                  */
/* ------------------------------------------------------------------ */
let directoryMode = 'landmark';

function buildDirectoryUi() {
  if (!panelList) return;
  const chips = document.getElementById('cat-chips');
  const search = document.getElementById('building-search');
  const modes = ['all', 'landmark', 'college', 'canteen', 'sport', 'teaching', 'research', 'dorm', 'service', 'other'];
  if (chips) {
    chips.innerHTML = '';
    for (const mode of modes) {
      const count =
        mode === 'all'
          ? allDirectoryItems().length
          : mode === 'landmark'
          ? LANDMARKS.filter((l) => l.list !== false).length
          : FACILITIES.filter((f) => f.category === mode).length;
      if (!count) continue;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.mode = mode;
      btn.textContent = `${mode === 'all' ? '全部' : CATEGORY_LABELS[mode] || mode} ${count}`;
      btn.classList.toggle('active', mode === directoryMode);
      btn.addEventListener('click', () => {
        directoryMode = mode;
        if (search) search.value = '';
        for (const b of chips.querySelectorAll('button')) b.classList.toggle('active', b.dataset.mode === mode);
        renderDirectory();
      });
      chips.appendChild(btn);
    }
  }
  if (search) {
    search.addEventListener('input', () => renderDirectory());
  }
  renderDirectory();
}

function allDirectoryItems() {
  const landmarkNames = new Set(LANDMARKS.map((l) => l.name));
  const items = [];
  for (const lm of LANDMARKS) {
    if (lm.list === false) continue;
    items.push({ name: lm.name, meta: lm.en, onClick: () => focusLandmark(lm.id), kind: 'landmark' });
  }
  for (const f of FACILITIES) {
    if (landmarkNames.has(f.name)) continue;
    items.push({ name: f.name, meta: metaFor(f), onClick: () => focusFacility(f.id), kind: 'building' });
  }
  return items;
}

function metaFor(f) {
  if (f.alias && f.alias !== f.name) return f.alias;
  if (f.kind === 'ground') return '运动场地';
  return `约 ${f.area.toLocaleString()} m²`;
}

function directoryItem(name, meta, onClick) {
  const li = document.createElement('li');
  const btn = document.createElement('button');
  btn.type = 'button';
  const nameEl = document.createElement('span');
  nameEl.className = 'li-name';
  nameEl.textContent = name;
  const metaEl = document.createElement('span');
  metaEl.className = 'li-meta';
  metaEl.textContent = meta;
  btn.append(nameEl, metaEl);
  btn.addEventListener('click', onClick);
  li.appendChild(btn);
  return li;
}

function renderDirectory() {
  if (!panelList) return;
  const search = document.getElementById('building-search');
  const q = (search?.value || '').trim();
  panelList.innerHTML = '';
  let shown = 0;
  if (q) {
    const landmarkHits = LANDMARKS.filter(
      (l) => l.list !== false && (l.name.includes(q) || l.en.toLowerCase().includes(q.toLowerCase()))
    );
    for (const lm of landmarkHits) {
      panelList.appendChild(directoryItem(lm.name, lm.en, () => focusLandmark(lm.id)));
      shown++;
    }
    const hits = FACILITIES.filter(
      (f) =>
        f.name.includes(q) ||
        (f.alias && f.alias.includes(q)) ||
        (CATEGORY_LABELS[f.category] || '').includes(q)
    );
    for (const f of hits.slice(0, 140)) {
      panelList.appendChild(directoryItem(f.name, metaFor(f), () => focusFacility(f.id)));
      shown++;
    }
    if (!shown) {
      const li = document.createElement('li');
      li.className = 'li-empty';
      li.textContent = `没有找到“${q}”`;
      panelList.appendChild(li);
    }
    return;
  }
  if (directoryMode === 'all') {
    for (const item of allDirectoryItems().slice(0, 500)) {
      panelList.appendChild(directoryItem(item.name, item.meta, item.onClick));
    }
    return;
  }
  if (directoryMode === 'landmark') {
    for (const lm of LANDMARKS) {
      if (lm.list === false) continue;
      panelList.appendChild(directoryItem(lm.name, lm.en, () => focusLandmark(lm.id)));
    }
    return;
  }
  const items = FACILITIES.filter((f) => f.category === directoryMode);
  for (const f of items.slice(0, 160)) {
    panelList.appendChild(
      directoryItem(
        f.name,
        metaFor(f),
        () => focusFacility(f.id)
      )
    );
  }
}

function highlightPanel(id) {
  for (const btn of panelList?.querySelectorAll('button') || []) {
    btn.parentElement.classList.toggle('active', btn.dataset.id === id);
  }
}

function showCard(lm) {
  cardTitle.textContent = lm.name;
  cardEn.textContent = lm.en;
  cardDesc.textContent = lm.desc;
  card.classList.remove('hidden');
}

function hideCard() {
  card.classList.add('hidden');
}

function setMode(mode) {
  rig.setMode(mode);
  for (const m of ['day', 'dusk', 'night']) {
    document.getElementById(`btn-${m}`)?.classList.toggle('active', m === mode);
  }
  document.body.dataset.mode = mode;
}

function wireUi() {
  document.getElementById('btn-day')?.addEventListener('click', () => setMode('day'));
  document.getElementById('btn-dusk')?.addEventListener('click', () => setMode('dusk'));
  document.getElementById('btn-night')?.addEventListener('click', () => setMode('night'));

  const btnLabels = document.getElementById('btn-labels');
  btnLabels?.addEventListener('click', () => {
    labels.setVisible(!labels.visible);
    btnLabels.classList.toggle('active', labels.visible);
  });
  btnLabels?.classList.add('active');

  const btnNames = document.getElementById('btn-names');
  btnNames?.addEventListener('click', () => {
    const on = !btnNames.classList.contains('active');
    btnNames.classList.toggle('active', on);
    labels.setKindVisible('building', on);
  });

  const btnRotate = document.getElementById('btn-rotate');
  btnRotate?.addEventListener('click', () => {
    controls.autoRotate = !controls.autoRotate;
    btnRotate.classList.toggle('active', controls.autoRotate);
  });

  document.getElementById('btn-reset')?.addEventListener('click', () => {
    focusLandmark('overview');
    labels.setActive('overview');
    hideCard();
  });

  document.getElementById('card-close')?.addEventListener('click', hideCard);
  document.getElementById('panel-toggle')?.addEventListener('click', () => {
    document.body.classList.toggle('panel-collapsed');
  });
}

function onKey(e) {
  if (e.target instanceof HTMLInputElement) return;
  const key = e.key.toLowerCase();
  if (key === '1') setMode('day');
  else if (key === '2') setMode('dusk');
  else if (key === '3') setMode('night');
  else if (key === 'l') document.getElementById('btn-labels')?.click();
  else if (key === 'n') document.getElementById('btn-names')?.click();
  else if (key === 'r') document.getElementById('btn-reset')?.click();
  else if (key === 'escape') hideCard();
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
}

/* ------------------------------------------------------------------ */
/* contact darkening                                                   */
/* ------------------------------------------------------------------ */
function addContactShadows(parent) {
  const tex = blobTexture(128);
  for (const [x, z, w, d, op] of CONTACT_SHADOWS) {
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: op, depthWrite: false });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, 0.42, z);
    mesh.renderOrder = 1;
    parent.add(mesh);
  }
}

/* ------------------------------------------------------------------ */
/* traffic on 珞喻路                                                    */
/* ------------------------------------------------------------------ */
function trafficPath() {
  const bins = new Map();
  for (const [x, z] of CAMPUS.traffic) {
    const b = Math.round(x / 100);
    if (!bins.has(b)) bins.set(b, []);
    bins.get(b).push(z);
  }
  const keys = [...bins.keys()].sort((a, b) => a - b);
  const pts = [];
  for (const b of keys) {
    const zs = bins.get(b).sort((a, b) => a - b);
    pts.push(new THREE.Vector3(b * 100, 0.4, zs[Math.floor(zs.length / 2)]));
  }
  let total = 0;
  const segs = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const len = pts[i].distanceTo(pts[i + 1]);
    segs.push({ a: pts[i], b: pts[i + 1], len, start: total });
    total += len;
  }
  return { pts, segs, total };
}

function sampleTraffic(path, dist) {
  const d = ((dist % path.total) + path.total) % path.total;
  let seg = path.segs[0];
  for (const s of path.segs) {
    if (d >= s.start && d <= s.start + s.len) {
      seg = s;
      break;
    }
  }
  const t = Math.min(1, (d - seg.start) / Math.max(1, seg.len));
  const pos = new THREE.Vector3().lerpVectors(seg.a, seg.b, t);
  const dir = new THREE.Vector3().subVectors(seg.b, seg.a).normalize();
  return { pos, dir };
}

function buildTraffic(parent) {
  const path = trafficPath();
  if (!path.segs.length) return;
  const palette = [0xdad6cc, 0x2f3a46, 0x8c2f2a, 0x2b4d6b, 0xd8c9a4, 0x3c3d3a, 0x7a7f84];
  const rand = mulberry32(99);
  const headMat = new THREE.MeshStandardMaterial({
    color: 0xfff6d8,
    emissive: new THREE.Color(0xffe9b0),
    emissiveIntensity: 1.2,
  });
  const tailMat = new THREE.MeshStandardMaterial({
    color: 0x8f1f18,
    emissive: new THREE.Color(0xd03425),
    emissiveIntensity: 0.8,
  });
  for (let i = 0; i < 18; i++) {
    const car = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({
      color: palette[Math.floor(rand() * palette.length)],
      roughness: 0.35,
      metalness: 0.4,
    });
    const body = new THREE.Mesh(new THREE.BoxGeometry(4.6, 1.0, 1.9), bodyMat);
    body.position.y = 0.85;
    body.castShadow = true;
    car.add(body);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.8, 1.7), MAT.glassDark);
    cabin.position.set(-0.2, 1.65, 0);
    cabin.castShadow = true;
    car.add(cabin);
    for (const s of [-1, 1]) {
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.3, 0.5), headMat);
      head.position.set(2.3, 0.85, s * 0.6);
      car.add(head);
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.24, 0.45), tailMat);
      tail.position.set(-2.3, 0.85, s * 0.6);
      car.add(tail);
    }
    const lane = i % 2 === 0 ? 1 : -1;
    car.userData = { dist: rand() * path.total, speed: (10 + rand() * 8) * lane, lane };
    parent.add(car);
    cars.push({ car, lane, dist: rand() * path.total, speed: 10 + rand() * 8, dirSign: lane });
  }
  cars.path = path;
}

function updateTraffic(dt) {
  const path = cars.path;
  if (!path) return;
  for (const c of cars) {
    c.dist += c.speed * c.dirSign * dt;
    const { pos, dir } = sampleTraffic(path, c.dist);
    const sideways = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(6 * c.lane);
    c.car.position.copy(pos).add(sideways);
    c.car.position.y = 0.15;
    c.car.rotation.y = c.dirSign > 0 ? 0 : Math.PI;
  }
}

/* ------------------------------------------------------------------ */
/* animation                                                           */
/* ------------------------------------------------------------------ */
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.08);
  elapsed += dt;

  rig.update(dt);

  if (tween) {
    const t = Math.min(1, (performance.now() - tween.start) / tween.durMs);
    const e = easeInOut(t);
    camera.position.lerpVectors(tween.fromPos, tween.toPos, e);
    controls.target.lerpVectors(tween.fromTgt, tween.toTgt, e);
    if (t >= 1) tween = null;
  }

  controls.update();
  updateTraffic(dt);

  const water = siteMaterials().water;
  if (water.bumpMap) {
    water.bumpMap.offset.x += dt * 0.012;
    water.bumpMap.offset.y += dt * 0.005;
  }
  if (clouds) clouds.rotation.y += dt * 0.0012;

  labels.update(window.innerWidth, window.innerHeight);
  renderer.render(scene, camera);
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

try {
  init();
} catch (err) {
  console.error(err);
  if (loaderSub) {
    loaderSub.textContent = '渲染初始化失败：' + err.message;
    loaderSub.style.color = '#ff9b8a';
  }
}
