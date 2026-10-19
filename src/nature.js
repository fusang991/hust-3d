import * as THREE from 'three';
import { CAMPUS } from './campus-data.js';
import { terrainHeight, inWater, pointInPoly } from './site.js';
import { mergeGeometries, paint, mulberry32 } from './util.js';

/* ------------------------------------------------------------------ */
/* tree prototypes                                                     */
/* ------------------------------------------------------------------ */

function dawnRedwood() {
  const trunk = new THREE.CylinderGeometry(0.8, 1.4, 13, 6);
  trunk.translate(0, 6.5, 0);
  paint(trunk, 0x6a4a34);
  const layers = [
    [9.2, 18, 18],
    [7.0, 15, 27],
    [4.6, 12, 36],
  ];
  const cones = layers.map(([r, h, y]) => {
    const g = new THREE.ConeGeometry(r, h, 7);
    g.translate(0, y, 0);
    return paint(g, 0x3f6339);
  });
  return mergeGeometries([trunk, ...cones]);
}

function camphor() {
  const trunk = new THREE.CylinderGeometry(0.9, 1.7, 12, 6);
  trunk.translate(0, 6, 0);
  paint(trunk, 0x59452f);
  const blobs = [];
  const main = new THREE.IcosahedronGeometry(9.5, 1);
  main.scale(1.15, 0.86, 1.05);
  main.translate(0, 20, 0);
  blobs.push(paint(main, 0x41673a));
  const b2 = new THREE.IcosahedronGeometry(6.6, 1);
  b2.translate(-7, 17, 2.6);
  blobs.push(paint(b2, 0x3a5f34));
  const b3 = new THREE.IcosahedronGeometry(5.8, 1);
  b3.translate(6.4, 18, -2);
  blobs.push(paint(b3, 0x476f3d));
  return mergeGeometries([trunk, ...blobs]);
}

function planeTree() {
  const trunk = new THREE.CylinderGeometry(0.8, 1.5, 14, 6);
  trunk.translate(0, 7, 0);
  paint(trunk, 0x7d6c53);
  const blobs = [];
  const main = new THREE.IcosahedronGeometry(9.0, 1);
  main.scale(1.1, 0.72, 1.1);
  main.translate(0, 21, 0);
  blobs.push(paint(main, 0x5d8345));
  const b2 = new THREE.IcosahedronGeometry(5.4, 1);
  b2.translate(-5.6, 17, 3.6);
  blobs.push(paint(b2, 0x557b40));
  const b3 = new THREE.IcosahedronGeometry(5.2, 1);
  b3.translate(6.4, 17.5, -1.6);
  blobs.push(paint(b3, 0x668c4b));
  return mergeGeometries([trunk, ...blobs]);
}

function shrub() {
  const g = new THREE.IcosahedronGeometry(3.2, 1);
  g.scale(1.2, 0.8, 1.2);
  g.translate(0, 2.4, 0);
  return paint(g, 0x4e6f3c);
}

function bambooClump() {
  const parts = [];
  const rnd = mulberry32(5);
  for (let i = 0; i < 5; i++) {
    const h = 14 + rnd() * 8;
    const stalk = new THREE.CylinderGeometry(0.15, 0.2, h, 4);
    stalk.translate((rnd() - 0.5) * 3.2, h / 2, (rnd() - 0.5) * 3.2);
    parts.push(paint(stalk, 0x6c8a3f));
    const leaf = new THREE.ConeGeometry(1.3, 5.5, 4);
    leaf.translate((rnd() - 0.5) * 3.2, h + 1.2, (rnd() - 0.5) * 3.2);
    parts.push(paint(leaf, 0x5c7d36));
  }
  return mergeGeometries(parts);
}

/* ------------------------------------------------------------------ */
/* placement                                                           */
/* ------------------------------------------------------------------ */

const CELL = 10;

function buildOccupancy() {
  const grid = new Set();
  const key = (i, j) => (i + 4000) * 100000 + (j + 4000);
  const mark = (x, z) => {
    grid.add(key(Math.floor(x / CELL), Math.floor(z / CELL)));
  };

  for (const b of CAMPUS.buildings) {
    const xs = b.p.map((p) => p[0]);
    const zs = b.p.map((p) => p[1]);
    for (let x = Math.min(...xs) - 2; x <= Math.max(...xs) + 2; x += CELL * 0.7) {
      for (let z = Math.min(...zs) - 2; z <= Math.max(...zs) + 2; z += CELL * 0.7) {
        mark(x, z);
      }
    }
  }
  for (const w of CAMPUS.waters) {
    const xs = w.p.map((p) => p[0]);
    const zs = w.p.map((p) => p[1]);
    for (let x = Math.min(...xs); x <= Math.max(...xs); x += CELL) {
      for (let z = Math.min(...zs); z <= Math.max(...zs); z += CELL) {
        if (pointInPoly(x + CELL / 2, z + CELL / 2, w.p)) mark(x, z);
      }
    }
  }
  for (const g of CAMPUS.greens) {
    if (!['pitch', 'track', 'stadium', 'sports_centre'].includes(g.k)) continue;
    const xs = g.p.map((p) => p[0]);
    const zs = g.p.map((p) => p[1]);
    for (let x = Math.min(...xs); x <= Math.max(...xs); x += CELL) {
      for (let z = Math.min(...zs); z <= Math.max(...zs); z += CELL) mark(x, z);
    }
  }
  for (const r of CAMPUS.roads) {
    const hw = r.w / 2 + 3;
    for (let i = 0; i < r.p.length - 1; i++) {
      const [x1, z1] = r.p[i];
      const [x2, z2] = r.p[i + 1];
      const len = Math.hypot(x2 - x1, z2 - z1);
      const steps = Math.max(1, Math.ceil(len / 6));
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const x = x1 + (x2 - x1) * t;
        const z = z1 + (z2 - z1) * t;
        for (let ox = -hw; ox <= hw; ox += CELL) {
          for (let oz = -hw; oz <= hw; oz += CELL) mark(x + ox, z + oz);
        }
      }
    }
  }
  return (x, z) => grid.has(key(Math.floor(x / CELL), Math.floor(z / CELL)));
}

export function buildTrees(parent) {
  const rnd = mulberry32(20240519);
  const occupied = buildOccupancy();
  const species = [
    { geo: dawnRedwood(), list: [], cast: true },
    { geo: camphor(), list: [], cast: true },
    { geo: planeTree(), list: [], cast: true },
    { geo: shrub(), list: [], cast: false },
    { geo: bambooClump(), list: [], cast: false },
  ];
  const [redwood, treeCamphor, treePlane, shrubS, bamboo] = species;

  const GATES = CAMPUS.gates;
  const add = (sp, x, z, y, scale) => {
    if (inWater(x, z)) return;
    for (const g of GATES) {
      if (Math.hypot(x - g.x, z - g.z) < 40) return;
    }
    sp.list.push([x, y, z, scale]);
  };

  const HILL = CAMPUS.hillPoly;
  const hxs = HILL.map((p) => p[0]);
  const hzs = HILL.map((p) => p[1]);
  const hx0 = Math.min(...hxs);
  const hx1 = Math.max(...hxs);
  const hz0 = Math.min(...hzs);
  const hz1 = Math.max(...hzs);

  for (let i = 0; i < 2200; i++) {
    const x = hx0 + rnd() * (hx1 - hx0);
    const z = hz0 + rnd() * (hz1 - hz0);
    if (!pointInPoly(x, z, HILL)) continue;
    if (Math.hypot(x + 40, z + 588) < 120) continue;
    const y = terrainHeight(x, z);
    if (y < 2) continue;
    const pick = rnd();
    const sp = pick < 0.55 ? redwood : pick < 0.85 ? treeCamphor : treePlane;
    add(sp, x, z, y - 0.6, 0.8 + rnd() * 0.45);
  }

  for (const g of CAMPUS.greens) {
    if (!['wood', 'forest', 'park', 'grass', 'meadow'].includes(g.k)) continue;
    const xs = g.p.map((p) => p[0]);
    const zs = g.p.map((p) => p[1]);
    const area = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...zs) - Math.min(...zs));
    const n = Math.min(90, Math.max(3, Math.round(area / 1200)));
    for (let i = 0; i < n; i++) {
      const x = Math.min(...xs) + rnd() * (Math.max(...xs) - Math.min(...xs));
      const z = Math.min(...zs) + rnd() * (Math.max(...zs) - Math.min(...zs));
      if (!pointInPoly(x, z, g.p)) continue;
      if (occupied(x, z)) continue;
      const pick = rnd();
      const sp = pick < 0.4 ? treeCamphor : pick < 0.75 ? treePlane : pick < 0.92 ? redwood : bamboo;
      add(sp, x, z, terrainHeight(x, z), 0.8 + rnd() * 0.35);
    }
  }

  for (const r of CAMPUS.roads) {
    if (!['tertiary', 'residential', 'unclassified', 'footway', 'pedestrian', 'service'].includes(r.c)) continue;
    const step = 28;
    const offset = r.w / 2 + 4.5;
    for (let i = 0; i < r.p.length - 1; i++) {
      const [x1, z1] = r.p[i];
      const [x2, z2] = r.p[i + 1];
      const len = Math.hypot(x2 - x1, z2 - z1);
      const n = Math.max(1, Math.floor(len / step));
      const ang = Math.atan2(z2 - z1, x2 - x1);
      const nx = Math.sin(ang);
      const nz = -Math.cos(ang);
      for (let s = 0; s < n; s++) {
        const t = (s + 0.5) / n;
        const x = x1 + (x2 - x1) * t;
        const z = z1 + (z2 - z1) * t;
        for (const side of [-1, 1]) {
          const px = x + nx * offset * side;
          const pz = z + nz * offset * side;
          if (occupied(px, pz) || inWater(px, pz)) continue;
          if (rnd() < 0.4) continue;
          const pick = rnd();
          const sp = pick < 0.42 ? treeCamphor : pick < 0.78 ? treePlane : redwood;
          add(sp, px, pz, 0, 0.8 + rnd() * 0.3);
        }
      }
    }
  }

  for (let i = 0; i < 900; i++) {
    const x = -1750 + rnd() * 3500;
    const z = -1100 + rnd() * 2200;
    if (occupied(x, z) || inWater(x, z)) continue;
    if (terrainHeight(x, z) > 6) continue;
    const pick = rnd();
    const sp = pick < 0.5 ? treeCamphor : pick < 0.8 ? treePlane : redwood;
    add(sp, x, z, 0, 0.75 + rnd() * 0.35);
    if (rnd() < 0.12) add(shrubS, x + 5, z + 3, 0, 0.7 + rnd() * 0.5);
  }

  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0.0 });
  const group = new THREE.Group();
  group.name = 'trees';
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const v = new THREE.Vector3();
  const sv = new THREE.Vector3();
  const col = new THREE.Color();
  let total = 0;

  for (const sp of species) {
    if (!sp.list.length) continue;
    const inst = new THREE.InstancedMesh(sp.geo, mat, sp.list.length);
    inst.castShadow = sp.cast;
    inst.receiveShadow = false;
    sp.list.forEach(([x, y, z, s], i) => {
      e.set(0, rnd() * Math.PI * 2, 0);
      q.setFromEuler(e);
      v.set(x, y - 0.1, z);
      const k = s * 0.46;
      sv.set(k, k * (0.92 + rnd() * 0.2), k);
      m4.compose(v, q, sv);
      inst.setMatrixAt(i, m4);
      const tint = 0.86 + rnd() * 0.28;
      col.setRGB(tint, tint * (0.94 + rnd() * 0.12), tint * 0.95);
      inst.setColorAt(i, col);
    });
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    group.add(inst);
    total += sp.list.length;
  }

  parent.add(group);
  return { group, count: total };
}
