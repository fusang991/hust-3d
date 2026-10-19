import * as THREE from 'three';
import { CAMPUS } from './campus-data.js';
import { makeCanvas, canvasTexture, noiseCanvas, smoothstep, mulberry32, addGroundPlane } from './util.js';

/**
 * Site layer built from real map data: Yujia Mountain terrain, the campus
 * road network, lakes and sports grounds.
 * Map data (c) OpenStreetMap contributors, ODbL.
 */

const GROUND_SIZE = 8000;
const GROUND_SEG = 170;

/* ---------------------------------------------------------------- geometry */

export function pointInPoly(x, z, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const zi = ring[i][1];
    const xj = ring[j][0];
    const zj = ring[j][1];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

function polygonDistance(x, z, ring) {
  let best = Infinity;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const x1 = ring[j][0];
    const z1 = ring[j][1];
    const x2 = ring[i][0];
    const z2 = ring[i][1];
    const dx = x2 - x1;
    const dz = z2 - z1;
    const l2 = dx * dx + dz * dz;
    let t = 0;
    if (l2 > 0) t = Math.max(0, Math.min(1, ((x - x1) * dx + (z - z1) * dz) / l2));
    const d = Math.hypot(x - (x1 + t * dx), z - (z1 + t * dz));
    if (d < best) best = d;
  }
  return best;
}

const HILL = CAMPUS.hillPoly;
const PEAK_ELE = 149.5;
const hillBox = (() => {
  if (!HILL.length) return null;
  const xs = HILL.map((p) => p[0]);
  const zs = HILL.map((p) => p[1]);
  return { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) };
})();

const PEAK_DEPTH = (() => {
  if (!HILL.length) return 1;
  return Math.max(1, polygonDistance(-40, -588, HILL));
})();

export function terrainHeight(x, z) {
  if (!hillBox) return 0;
  if (x < hillBox.x0 - 40 || x > hillBox.x1 + 40 || z < hillBox.z0 - 40 || z > hillBox.z1 + 40) return 0;
  if (!pointInPoly(x, z, HILL)) return 0;
  const d = polygonDistance(x, z, HILL);
  const norm = 1 - Math.exp(-d / (PEAK_DEPTH * 0.75));
  const peakNorm = 1 - Math.exp(-1 / 0.75);
  const h = PEAK_ELE * Math.min(1.05, norm / peakNorm);
  const ridge = 1 + 0.05 * Math.sin(x * 0.012) * Math.cos(z * 0.01) + 0.03 * Math.sin(x * 0.03 + z * 0.02);
  let out = h * ridge;
  // flattened crown so the summit pavilion has a real plateau
  const peakD = Math.hypot(x + 40, z + 588);
  const plateau = 1 - smoothstep(40, 120, peakD);
  out = out * (1 - plateau) + PEAK_ELE * plateau;
  return Math.max(0, out);
}

export function inWater(x, z) {
  for (const w of CAMPUS.waters) {
    if (pointInPoly(x, z, w.p)) return true;
  }
  return false;
}

/* ---------------------------------------------------------------- materials */

function groundTexture() {
  const canvas = noiseCanvas(256, '#c6d0b4', 0.2, 2);
  const ctx = canvas.getContext('2d');
  const rnd = mulberry32(11);
  for (let i = 0; i < 1200; i++) {
    ctx.fillStyle = rnd() > 0.5 ? 'rgba(150,175,110,0.18)' : 'rgba(90,110,70,0.16)';
    ctx.beginPath();
    ctx.arc(rnd() * 256, rnd() * 256, 1 + rnd() * 2.4, 0, Math.PI * 2);
    ctx.fill();
  }
  return canvasTexture(canvas, { repeat: [260, 260] });
}

function pavingTexture(base = '#b3aca0', line = 'rgba(66,62,55,0.5)') {
  const canvas = makeCanvas(256, 256);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);
  const rnd = mulberry32(23);
  for (let i = 0; i < 2200; i++) {
    const a = rnd() * 0.09;
    ctx.fillStyle = rnd() > 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
    ctx.fillRect(rnd() * 256, rnd() * 256, 2, 2);
  }
  ctx.strokeStyle = line;
  ctx.lineWidth = 2;
  for (let i = 0; i <= 4; i++) {
    ctx.beginPath();
    ctx.moveTo((i * 256) / 4, 0);
    ctx.lineTo((i * 256) / 4, 256);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, (i * 256) / 4);
    ctx.lineTo(256, (i * 256) / 4);
    ctx.stroke();
  }
  return canvasTexture(canvas);
}

function asphaltTexture() {
  const canvas = noiseCanvas(256, '#8a877f', 0.16, 2);
  return canvasTexture(canvas);
}

const MATS = {};

export function siteMaterials() {
  if (MATS.grass) return MATS;
  MATS.grass = new THREE.MeshStandardMaterial({ map: groundTexture(), roughness: 0.98, metalness: 0 });
  MATS.road = new THREE.MeshStandardMaterial({
    map: asphaltTexture(),
    roughness: 0.97,
    metalness: 0,
    envMapIntensity: 0.15,
  });
  MATS.path = new THREE.MeshStandardMaterial({
    map: pavingTexture('#bcb5a8', 'rgba(80,75,66,0.35)'),
    roughness: 0.95,
    metalness: 0.02,
  });
  MATS.pave = new THREE.MeshStandardMaterial({
    map: pavingTexture('#b3aca0', 'rgba(66,62,55,0.5)'),
    roughness: 0.9,
    metalness: 0.02,
  });
  MATS.paveWarm = new THREE.MeshStandardMaterial({
    map: pavingTexture('#c0b096', 'rgba(96,78,58,0.45)'),
    roughness: 0.92,
  });
  const waterBump = noiseCanvas(256, '#808080', 0.5, 2);
  MATS.water = new THREE.MeshStandardMaterial({
    color: 0x24505f,
    roughness: 0.46,
    metalness: 0.0,
    transparent: false,
    opacity: 1,
    bumpMap: canvasTexture(waterBump, { repeat: [18, 18] }),
    bumpScale: 0.32,
    envMapIntensity: 0.12,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });
  MATS.pitch = new THREE.MeshStandardMaterial({ color: 0x5d7f45, roughness: 1 });
  MATS.track = new THREE.MeshStandardMaterial({ color: 0x7d3f34, roughness: 0.95 });
  MATS.lawn = new THREE.MeshStandardMaterial({ color: 0x7c9a58, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1 });
  MATS.wood = new THREE.MeshStandardMaterial({ color: 0x5a7b48, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1 });
  MATS.sand = new THREE.MeshStandardMaterial({ color: 0xc8bda2, roughness: 1 });
  return MATS;
}

/* ---------------------------------------------------------------- terrain */

export function buildTerrain(scene) {
  const m = siteMaterials();
  const group = new THREE.Group();
  group.name = 'terrain';

  const geo = new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE, GROUND_SEG, GROUND_SEG);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const grass = new THREE.Color(0x9db56f);
  const grassDark = new THREE.Color(0x7f9a58);
  const forest = new THREE.Color(0x5f7d4a);
  const tmp = new THREE.Color();
  const rnd = mulberry32(3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = terrainHeight(x, z);
    pos.setY(i, h);
    const forestMix = smoothstep(4, 45, h);
    tmp.copy(grass).lerp(grassDark, rnd() * 0.35).lerp(forest, forestMix * 0.9);
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ map: m.grass.map, vertexColors: true, roughness: 0.97, metalness: 0 })
  );
  ground.receiveShadow = true;
  ground.name = 'ground';
  group.add(ground);

  // a much larger, untextured plain hides the edge of the detailed terrain
  const far = new THREE.Mesh(
    new THREE.CircleGeometry(14000, 64).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x7e9a58, roughness: 1, metalness: 0 })
  );
  far.position.y = -1.5;
  far.name = 'distant-ground';
  far.receiveShadow = false;
  group.add(far);

  scene.add(group);
  return group;
}

/* ---------------------------------------------------------------- water */

function polygonGeometry(ring, y) {
  const pts = ring.slice(0, ring.length - 1).map(([x, z]) => new THREE.Vector2(x, -z));
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    area += a.x * b.y - b.x * a.y;
  }
  if (area < 0) pts.reverse();
  let tris;
  try {
    tris = THREE.ShapeUtils.triangulateShape(pts, []);
  } catch (err) {
    return null;
  }
  if (!tris || !tris.length) return null;
  const positions = [];
  const normals = [];
  const uvs = [];
  for (const t of tris) {
    for (const idx of t) {
      const p = pts[idx];
      positions.push(p.x, y, -p.y);
      normals.push(0, 1, 0);
      uvs.push(p.x / 40, -p.y / 40);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  return geo;
}

export function buildWater(parent) {
  const m = siteMaterials();
  const group = new THREE.Group();
  group.name = 'water';
  const positions = [];
  const normals = [];
  const uvs = [];
  const outlinePts = [];
  for (const w of CAMPUS.waters) {
    if (w.p.length < 4) continue;
    const geo = polygonGeometry(w.p, 0.3);
    if (!geo) continue;
    const p = geo.attributes.position.array;
    for (let i = 0; i < p.length; i++) positions.push(p[i]);
    for (let i = 0; i < p.length / 3; i++) {
      normals.push(0, 1, 0);
      uvs.push(0, 0);
    }
    for (let i = 0; i < w.p.length; i++) outlinePts.push(w.p[i][0], 0.36, w.p[i][1]);
  }
  if (positions.length) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    const mesh = new THREE.Mesh(geo, m.water);
    mesh.name = 'water';
    mesh.receiveShadow = false;
    group.add(mesh);
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(outlinePts, 3));
    const outline = new THREE.LineSegments(
      lineGeo,
      new THREE.LineBasicMaterial({ color: 0x3c5a48, transparent: true, opacity: 0.4 })
    );
    group.add(outline);
  }
  parent.add(group);
  return group;
}

/* ---------------------------------------------------------------- green areas */

function mostlyInWater(ring) {
  let inside = 0;
  let total = 0;
  const step = Math.max(1, Math.floor(ring.length / 12));
  for (let i = 0; i < ring.length; i += step) {
    total++;
    if (inWater(ring[i][0], ring[i][1])) inside++;
  }
  return total > 0 && inside / total > 0.4;
}

export function buildGreens(parent) {
  const m = siteMaterials();
  const buckets = { pitch: [], track: [], lawn: [], wood: [], park: [] };
  for (const g of CAMPUS.greens) {
    if (g.p.length < 4) continue;
    if (mostlyInWater(g.p)) continue;
    const key =
      g.k === 'pitch' || g.k === 'stadium' || g.k === 'sports_centre'
        ? 'pitch'
        : g.k === 'track'
        ? 'track'
        : g.k === 'wood' || g.k === 'forest'
        ? 'wood'
        : g.k === 'grass' || g.k === 'meadow' || g.k === 'recreation_ground'
        ? 'lawn'
        : g.k === 'park'
        ? 'park'
        : null;
    if (!key) continue;
    buckets[key].push(g.p);
  }
  const group = new THREE.Group();
  group.name = 'greens';
  const mats = { pitch: m.pitch, track: m.track, lawn: m.lawn, wood: m.wood, park: m.lawn };
  const levels = { pitch: 0.34, track: 0.36, lawn: 0.12, wood: 0.14, park: 0.13 };
  for (const key of Object.keys(buckets)) {
    if (!buckets[key].length) continue;
    const positions = [];
    const normals = [];
    const uvs = [];
    for (const ring of buckets[key]) {
      const geo = polygonGeometry(ring, levels[key]);
      if (!geo) continue;
      const p = geo.attributes.position.array;
      for (let i = 0; i < p.length; i++) positions.push(p[i]);
      for (let i = 0; i < p.length / 3; i++) {
        normals.push(0, 1, 0);
        uvs.push(0, 0);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    const mesh = new THREE.Mesh(geo, mats[key]);
    mesh.receiveShadow = true;
    mesh.name = `greens-${key}`;
    group.add(mesh);
  }
  parent.add(group);
  return group;
}

/* ---------------------------------------------------------------- roads */

function addRibbon(target, pts, width, y) {
  const hw = width / 2;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, z1] = pts[i];
    const [x2, z2] = pts[i + 1];
    const dx = x2 - x1;
    const dz = z2 - z1;
    const len = Math.hypot(dx, dz);
    if (len < 0.4) continue;
    const nx = (-dz / len) * hw;
    const nz = (dx / len) * hw;
    const quad = [
      [x1 + nx, z1 + nz],
      [x2 + nx, z2 + nz],
      [x2 - nx, z2 - nz],
      [x1 - nx, z1 - nz],
    ];
    for (const k of [0, 1, 2, 0, 2, 3]) {
      target.pos.push(quad[k][0], y, quad[k][1]);
      target.nor.push(0, 1, 0);
      target.uv.push(quad[k][0] / 9, quad[k][1] / 9);
    }
    // filler at the joint so tight corners stay closed
    const joint = [
      [x2 + nx, z2 + nz],
      [x2 - nz, z2 + nx],
      [x2 - nx, z2 - nz],
      [x2 + nz, z2 - nx],
    ];
    for (const k of [0, 1, 2, 0, 2, 3]) {
      target.pos.push(joint[k][0], y - 0.001, joint[k][1]);
      target.nor.push(0, 1, 0);
      target.uv.push(joint[k][0] / 9, joint[k][1] / 9);
    }
  }
}

export function buildRoads(parent) {
  const m = siteMaterials();
  const road = { pos: [], nor: [], uv: [] };
  const path = { pos: [], nor: [], uv: [] };
  for (const r of CAMPUS.roads) {
    const isPath = r.c === 'footway' || r.c === 'cycleway' || r.c === 'pedestrian';
    addRibbon(isPath ? path : road, r.p, r.w, isPath ? 0.18 : 0.22);
  }
  const group = new THREE.Group();
  group.name = 'roads';
  const make = (bucket, mat, name) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(bucket.pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(bucket.nor, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(bucket.uv, 2));
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.name = name;
    return mesh;
  };
  if (road.pos.length) group.add(make(road, m.road, 'asphalt'));
  if (path.pos.length) group.add(make(path, m.path, 'footpaths'));
  parent.add(group);
  return group;
}

/* ---------------------------------------------------------------- plazas */

export function buildPlazas(parent) {
  const m = siteMaterials();
  const group = new THREE.Group();
  group.name = 'plazas';
  // 南大门广场: the approach plaza between the gate and 南一楼
  addGroundPlane(group, 52, 140, -488, 732, 0.32, m.paveWarm);
  parent.add(group);
  return group;
}
