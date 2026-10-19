import * as THREE from 'three';
import {
  massing,
  MAT,
  pyramidRoof,
  gableRoof,
  addStairs,
  addColumns,
  addFlagpoles,
} from './architecture.js';
import { addBox, addCylinder, addGroundPlane, textPlane, verticalTextPlane, CJK } from './util.js';
import { CAMPUS } from './campus-data.js';
import { siteMaterials, terrainHeight, inWater } from './site.js';

const serifFont = (size) => `700 ${size}px ${CJK}`;

function addSign(parent, text, opts = {}) {
  const {
    w = 10,
    x = 0,
    y = 6,
    z = 0,
    ry = 0,
    color = '#f6efdc',
    background = null,
    latin = false,
    texHeight = 256,
    emissive = 0.35,
  } = opts;
  const chars = Math.max(1, Array.from(text).length);
  const h = latin ? opts.h ?? (w / chars) * 2 : w / chars;
  const texWidth = latin ? 1024 : Math.min(4096, Math.max(256, chars * texHeight));
  const font = latin ? `600 96px "Times New Roman", serif` : `700 190px ${CJK}`;
  const mesh = textPlane(text, {
    width: w,
    height: h,
    texWidth,
    texHeight,
    font,
    color,
    background,
    emissive,
  });
  mesh.position.set(x, y, z);
  mesh.rotation.y = ry;
  parent.add(mesh);
  return mesh;
}

function addLampPost(parent, x, z, ry = 0) {
  addCylinder(parent, 0.12, 0.18, 5.4, x, 2.7, z, MAT.darkMetal, { segments: 8 });
  const head = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.32, 0.65), MAT.lamp);
  head.position.set(x, 5.45, z);
  head.rotation.y = ry;
  parent.add(head);
}

/* ------------------------------------------------------------------ */
/* 南大门                                                              */
/* ------------------------------------------------------------------ */
export function buildMainGate(parent) {
  const g = new THREE.Group();
  g.position.set(-475, 0, 802);
  g.name = 'main-gate';
  const stone = MAT.stoneLight;
  const stoneDim = new THREE.MeshStandardMaterial({ color: 0xd4cdbd, roughness: 0.9 });

  for (const s of [-1, 1]) {
    addBox(g, 19, 1.0, 19, s * 25, 0.5, 0, MAT.stone);
    addBox(g, 19.6, 0.25, 19.6, s * 25, 1.12, 0, MAT.stoneDark);
    addBox(g, 15, 17, 15, s * 25, 9.85, 0, stone);
    addBox(g, 16.4, 1.2, 16.4, s * 25, 18.8, 0, stoneDim);
    addBox(g, 17.2, 0.6, 17.2, s * 25, 19.7, 0, stone);
    for (let i = -1; i <= 1; i++) {
      if (i === 0) continue;
      addBox(g, 0.5, 14, 0.5, s * 25 + i * 4.4, 9.4, 7.6, stoneDim, { cast: false });
      addBox(g, 0.5, 14, 0.5, s * 25 + i * 4.4, 9.4, -7.6, stoneDim, { cast: false });
    }
    addBox(g, 3.4, 7.2, 0.4, s * 25, 10, 7.62, MAT.gold);
    addBox(g, 2.7, 6.5, 0.24, s * 25, 10, 7.86, new THREE.MeshStandardMaterial({ color: 0x6e3b26, roughness: 0.5 }));
    const plaque = verticalTextPlane(s < 0 ? '华中' : '科大', {
      width: 3.0,
      height: 6.0,
      texWidth: 256,
      texHeight: 512,
      color: '#f7dca6',
    });
    plaque.position.set(s * 25, 10, 8.03);
    g.add(plaque);
    addBox(g, 1.2, 1.6, 1.2, s * 33, 5.2, 7.2, MAT.lamp);
  }

  addBox(g, 66, 4.6, 16, 0, 22.6, 0, stone);
  addBox(g, 68, 1.0, 17, 0, 25.3, 0, stoneDim);
  addBox(g, 66, 0.6, 16, 0, 20.1, 0, stoneDim);
  addBox(g, 28, 0.14, 0.2, 0, 24.55, 8.2, MAT.lamp);
  addBox(g, 28, 0.14, 0.2, 0, 20.85, 8.2, MAT.lamp);
  addSign(g, '华中科技大学', { w: 27, y: 22.7, z: 8.15, color: '#4a3620' });
  addSign(g, '华中科技大学', { w: 27, y: 22.7, z: -8.15, ry: Math.PI, color: '#4a3620' });

  for (const s of [-1, 1]) {
    addBox(g, 22, 0.6, 8, s * 50, 0.3, 0, MAT.stone);
    addBox(g, 20, 5.2, 6, s * 50, 3.1, 0, stone);
    addBox(g, 20.6, 0.6, 6.6, s * 50, 5.9, 0, stoneDim);
    addSign(g, s < 0 ? '求是创新' : '明德厚学', {
      w: 14,
      x: s * 50,
      y: 3.5,
      z: 3.15,
      color: '#6d542f',
      emissive: 0,
    });
  }

  addBox(g, 8, 3.2, 6, 26, 1.6, 16, MAT.stoneLight);
  addBox(g, 9, 0.5, 7, 26, 3.5, 16, MAT.roofDark);
  addBox(g, 6, 1.5, 0.2, 26, 2.1, 13.2, MAT.glassDark);

  parent.add(g);
  return g;
}

/* ------------------------------------------------------------------ */
/* 图书馆（逸夫图书馆 + 老馆）                                          */
/* ------------------------------------------------------------------ */
export function buildLibrary(parent) {
  const g = new THREE.Group();
  g.position.set(-665, 0, 300);
  g.name = 'library';

  addBox(g, 128, 2.2, 128, 0, 1.1, -8, MAT.stone);
  addGroundPlane(g, 120, 118, 0, -8, 2.26, siteMaterials().paveWarm);

  massing({ w: 82, h: 26, d: 62, style: 'stone', roof: 'flat', x: 6, y: 2.3, z: -22, parent: g, parapetH: 1.2 });
  massing({ w: 24, h: 18, d: 24, style: 'stone', roof: 'flat', x: 6, y: 28.3, z: -22, parent: g, parapet: false });
  addBox(g, 27, 1.2, 27, 6, 46.9, -22, MAT.stoneDark);
  pyramidRoof(g, 28, 12, 28, 6, 47.5, -22, MAT.roofCopper, 4);
  addCylinder(g, 0.1, 0.3, 3.6, 6, 61, -22, MAT.gold, { segments: 10 });

  massing({ w: 100, h: 16, d: 22, style: 'stone', roof: 'flat', x: -4, y: 2.3, z: 56, parent: g, parapetH: 1.0 });
  gableRoof(g, 24, 6, 98, -4, 18.3, 56, MAT.roofTile, 1.4, Math.PI / 2);
  addSign(g, '图书馆', { w: 8, y: 13.4, z: 67.4, color: '#4a3620', emissive: 0.08 });

  addBox(g, 22, 14, 30, -4, 9.3, 30, MAT.glass);
  addBox(g, 23, 0.8, 31, -4, 16.7, 30, MAT.stoneLight);
  for (let i = -1; i <= 1; i++) addBox(g, 0.4, 14, 30, -4 + i * 7, 9.3, 30, MAT.stoneLight);

  addBox(g, 62, 3.6, 12, -4, 4.1, 71, MAT.stoneLight);
  addColumns(g, { count: 8, span: 50, x: -4, y: 4.2, z: 70, radius: 0.85, height: 15, mat: MAT.stoneLight });
  addBox(g, 60, 2.2, 10, -4, 20.4, 70, MAT.stoneLight);
  addStairs(g, { w: 50, steps: 6, rise: 0.62, run: 1.4, x: -4, z: 88, mat: MAT.stoneLight, cheekMat: MAT.stoneDark });

  addGroundPlane(g, 150, 54, -4, 100, 2.3, siteMaterials().pave);
  addSign(g, '逸夫图书馆', { w: 16, y: 21.8, z: 76, color: '#4a3620', emissive: 0.08 });
  addFlagpoles(g, { x: -4, z: 108, count: 3, spacing: 12, height: 18, direction: 'x' });

  parent.add(g);
  return g;
}

/* ------------------------------------------------------------------ */
/* 东九楼                                                              */
/* ------------------------------------------------------------------ */
export function buildEast9(parent) {
  const g = new THREE.Group();
  g.position.set(790, 0, 193);
  g.name = 'east9';
  const w = 174;
  const d = 172;
  const wing = 22;
  const h = 17;
  const sm = siteMaterials();

  addBox(g, w + 6, 1.0, wing + 6, 0, 0.5, -d / 2 + wing / 2, MAT.stoneLight);
  for (const s of [-1, 1]) {
    addBox(g, wing + 6, 1.0, d - 2, (s * (w - wing)) / 2, 0.5, 10, MAT.stoneLight);
  }

  massing({ w, h, d: wing, style: 'brick', roof: 'flat', x: 0, y: 1.0, z: -d / 2 + wing / 2, parent: g, parapetH: 1.1 });
  for (const s of [-1, 1]) {
    massing({ w: wing, h, d: d - wing, style: 'brick', roof: 'flat', x: (s * (w - wing)) / 2, y: 1.0, z: 10, parent: g, parapetH: 1.1 });
  }

  const cw = w - 2 * wing;
  const cd = d - wing;
  addGroundPlane(g, 14, cd - 20, 0, 10, 0.24, sm.paveWarm);
  addGroundPlane(g, cw - 20, 14, 0, 10, 0.24, sm.paveWarm);
  for (const [px, pz] of [
    [-cw / 4, -10],
    [cw / 4, -10],
    [-cw / 4, 40],
    [cw / 4, 40],
  ]) {
    addGroundPlane(g, cw / 2 - 12, cd / 2 - 20, px, pz, 0.25, sm.pitch);
  }
  const bushMat = new THREE.MeshStandardMaterial({ color: 0x4f6f3d, roughness: 1 });
  for (const [bx, bz] of [
    [-cw / 4, -8],
    [cw / 4, -8],
    [-cw / 4, 36],
    [cw / 4, 36],
  ]) {
    addBox(g, 4, 0.8, 4, bx, 0.4, bz, MAT.stoneDark);
    const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(1.8, 1), bushMat);
    bush.scale.set(1.2, 0.8, 1.2);
    bush.position.set(bx, 1.5, bz);
    bush.castShadow = true;
    g.add(bush);
  }

  addBox(g, 54, 15, 14, 0, 8.5, d / 2 - 4, MAT.glass);
  addBox(g, 56, 1.1, 16, 0, 16.6, d / 2 - 4, MAT.roofDark);
  for (let i = -3; i <= 3; i++) addBox(g, 0.35, 15, 14.4, i * 8, 8.5, d / 2 - 4, MAT.stoneLight);
  addBox(g, 54, 8, 2.5, 0, 5, d / 2 + 2.6, new THREE.MeshStandardMaterial({
    color: 0xc9a978,
    roughness: 0.8,
    emissive: new THREE.Color(0xffcf8a),
    emissiveIntensity: 0.25,
  }));
  addBox(g, 34, 0.8, 9, 0, 6.6, d / 2 + 8, MAT.stoneLight);
  for (const s of [-1, 1]) addCylinder(g, 0.4, 0.4, 6.2, s * 14, 3.5, d / 2 + 11, MAT.stoneLight, { segments: 12 });
  addStairs(g, { w: 26, steps: 3, rise: 0.4, run: 1.2, x: 0, z: d / 2 + 15, mat: MAT.stoneLight });

  addSign(g, '东九楼', { w: 9, y: 13.8, z: d / 2 + 3.05, color: '#f7efd9' });

  parent.add(g);
  return g;
}

/* ------------------------------------------------------------------ */
/* 西十二楼                                                            */
/* ------------------------------------------------------------------ */
export function buildWest12(parent) {
  const g = new THREE.Group();
  g.position.set(-1095, 0, 697);
  g.name = 'west12';
  const h = 18;

  addBox(g, 190, 1.0, 88, 0, 0.5, 0, MAT.stoneDark);
  massing({ w: 180, h, d: 30, style: 'concrete', roof: 'flat', x: 0, y: 1, z: -22, parent: g, parapetH: 1.2 });
  massing({ w: 160, h: h - 2, d: 24, style: 'concrete', roof: 'flat', x: 0, y: 1, z: 20, parent: g, parapetH: 1.0 });
  addBox(g, 26, 14, 40, 0, 8, 0, MAT.glassDark);

  const finH = h - 3;
  const count = 40;
  const geo = new THREE.BoxGeometry(1.5, finH, 0.5);
  const inst = new THREE.InstancedMesh(geo, MAT.stoneLight, count);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < count; i++) {
    m4.makeTranslation(-87 + (i * 174) / (count - 1), 1 + finH / 2, 5.4);
    inst.setMatrixAt(i, m4);
  }
  inst.castShadow = true;
  g.add(inst);

  addBox(g, 12, 10, 2.2, 0, 6, 33.2, MAT.glassDark);
  for (let i = -2; i <= 2; i++) addBox(g, 0.4, 10, 2.4, i * 2.4, 6, 33.3, MAT.stoneLight);
  addBox(g, 22, 0.6, 8, 0, 11.6, 36, MAT.stoneLight);
  for (const s of [-1, 1]) addCylinder(g, 0.35, 0.35, 11.2, s * 9, 5.6, 38, MAT.stoneLight, { segments: 10 });
  addStairs(g, { w: 18, steps: 4, rise: 0.45, run: 1.1, x: 0, z: 42, mat: MAT.stoneLight });

  addSign(g, '西十二楼', { w: 11, y: 15.5, z: 34.6, color: '#f2ead8' });

  parent.add(g);
  return g;
}

/* ------------------------------------------------------------------ */
/* 南一楼                                                              */
/* ------------------------------------------------------------------ */
export function buildNan1(parent) {
  const g = new THREE.Group();
  g.position.set(-474, 0, 607);
  g.name = 'nan1';
  const h = 24;
  addBox(g, 240, 1.2, 106, 0, 0.6, 0, MAT.stoneDark);
  massing({ w: 232, h, d: 34, style: 'concrete', roof: 'flat', x: 0, y: 1.2, z: -30, parent: g, parapetH: 1.3 });
  massing({ w: 232, h: h - 2, d: 30, style: 'concrete', roof: 'flat', x: 0, y: 1.2, z: 32, parent: g, parapetH: 1.2 });
  massing({ w: 54, h: h + 4, d: 34, style: 'stone', roof: 'flat', x: 0, y: 1.2, z: 0, parent: g, parapetH: 1.2 });
  addBox(g, 58, 2.6, 38, 0, h + 6.2, 0, MAT.stoneDark);
  addSign(g, '南一楼', { w: 10, y: 15, z: 47.4, color: '#5a4626' });
  addBox(g, 22, 10, 2.4, 0, 6.4, 47.2, MAT.glassDark);
  addStairs(g, { w: 26, steps: 3, rise: 0.42, run: 1.2, x: 0, z: 53, mat: MAT.stoneLight });
  parent.add(g);
  return g;
}

/* ------------------------------------------------------------------ */
/* 光谷体育馆                                                          */
/* ------------------------------------------------------------------ */
export function buildGym(parent) {
  const g = new THREE.Group();
  g.position.set(-29, 0, 788);
  g.name = 'gym';
  const R = 42;

  addCylinder(g, R + 8, R + 10, 1.2, 0, 0.6, 0, MAT.stone, { segments: 64 });
  addCylinder(g, R + 2, R + 4, 1.0, 0, 1.7, 0, MAT.stoneDark, { segments: 64 });
  const arenaMat = new THREE.MeshStandardMaterial({ color: 0xd9d6cd, roughness: 0.7, metalness: 0.15 });
  addCylinder(g, R, R + 2, 12, 0, 8.2, 0, arenaMat, { segments: 64 });

  const ribGeo = new THREE.BoxGeometry(1.4, 12, 2.2);
  const ribs = new THREE.InstancedMesh(ribGeo, MAT.metal, 48);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    e.set(0, -a, 0);
    q.setFromEuler(e);
    m4.compose(new THREE.Vector3(Math.cos(a) * (R + 2.6), 8.2, Math.sin(a) * (R + 2.6)), q, new THREE.Vector3(1, 1, 1));
    ribs.setMatrixAt(i, m4);
  }
  ribs.castShadow = true;
  g.add(ribs);

  const domeMat = new THREE.MeshStandardMaterial({ color: 0xc4cad0, roughness: 0.55, metalness: 0.3 });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 28, 0, Math.PI * 2, 0, Math.PI / 2), domeMat);
  dome.scale.set(R + 2, 16, R + 2);
  dome.position.set(0, 14.2, 0);
  dome.castShadow = true;
  dome.receiveShadow = true;
  g.add(dome);
  addCylinder(g, R + 2.4, R + 2.4, 0.8, 0, 14.4, 0, MAT.metal, { segments: 64 });
  addCylinder(g, 1.4, 2.6, 1.1, 0, 30.6, 0, MAT.metal, { segments: 32 });
  addCylinder(g, 0.06, 0.16, 1.6, 0, 31.7, 0, MAT.gold, { segments: 8 });

  addBox(g, 2.0, 10, 20, -(R - 0.4), 6.6, 0, MAT.glassDark);
  for (let i = -2; i <= 2; i++) addBox(g, 0.3, 10, 0.35, -(R - 1.6), 6.6, i * 4.8, MAT.metal);
  addBox(g, 9, 0.65, 22, -(R + 6), 10.2, 0, MAT.white);
  addBox(g, 9.4, 0.4, 22.6, -(R + 6), 10.6, 0, MAT.metal);
  for (const s of [-1, 1]) addCylinder(g, 0.5, 0.5, 9, -(R + 8.5), 5, s * 8, MAT.metal, { segments: 12 });

  addSign(g, '光谷体育馆', { w: 16, x: -(R + 0.2), y: 13.2, z: 0, ry: -Math.PI / 2, color: '#f2f5f7' });

  parent.add(g);
  return g;
}

/* ------------------------------------------------------------------ */
/* 醉晚亭                                                              */
/* ------------------------------------------------------------------ */
export function buildPavilion(parent) {
  const g = new THREE.Group();
  g.position.set(-102, 0, 545);
  g.name = 'pavilion';
  const woodRed = new THREE.MeshStandardMaterial({ color: 0x9c3b31, roughness: 0.65 });
  const stone = MAT.stoneLight;

  addCylinder(g, 8, 8.4, 1.0, 0, 0.8, 0, MAT.stoneDark, { segments: 12 });
  addCylinder(g, 6.6, 7.0, 0.6, 0, 1.6, 0, stone, { segments: 6, ry: Math.PI / 6 });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    addCylinder(g, 0.3, 0.36, 2.2, Math.cos(a) * 6.8, 0.1, Math.sin(a) * 6.8, MAT.wood, { segments: 8 });
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    addCylinder(g, 0.28, 0.32, 4.4, Math.cos(a) * 4.6, 1.9 + 2.2, Math.sin(a) * 4.6, woodRed, { segments: 10 });
  }
  addCylinder(g, 6.1, 6.1, 0.5, 0, 6.4, 0, MAT.wood, { segments: 6, ry: Math.PI / 6 });
  addCylinder(g, 7.0, 7.0, 0.4, 0, 6.8, 0, MAT.roofSlate, { segments: 6, ry: Math.PI / 6 });
  addCylinder(g, 0.4, 7.2, 2.4, 0, 8.2, 0, MAT.roofTile, { segments: 6, ry: Math.PI / 6 });
  addCylinder(g, 2.2, 2.4, 1.2, 0, 9.9, 0, woodRed, { segments: 6, ry: Math.PI / 6 });
  addCylinder(g, 0.2, 4.4, 1.8, 0, 11.4, 0, MAT.roofTile, { segments: 6, ry: Math.PI / 6 });
  addCylinder(g, 0.14, 0.3, 1.5, 0, 12.8, 0, MAT.gold, { segments: 8 });
  for (const s of [-1, 1]) {
    const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 10), MAT.lamp);
    lantern.position.set(s * 2.2, 5.5, 0);
    g.add(lantern);
  }
  addSign(g, '醉晚亭', { w: 4.0, y: 6.1, z: 6.35, color: '#f4e2b6' });

  const shore = findShore(-102, 545);
  if (shore) {
    const dx = shore[0] + 102;
    const dz = shore[1] - 545;
    const len = Math.hypot(dx, dz);
    const ang = Math.atan2(dz, dx);
    const steps = Math.max(2, Math.round(len / 10));
    for (let i = 0; i < steps; i++) {
      const t = (i + 0.5) / steps;
      const px = Math.cos(ang) * (6.4 + t * (len - 6.4));
      const pz = Math.sin(ang) * (6.4 + t * (len - 6.4));
      const deck = new THREE.Mesh(new THREE.BoxGeometry(len / steps + 0.8, 0.3, 3.2), stone);
      deck.position.set(px, 1.25, pz);
      deck.rotation.y = -ang;
      deck.castShadow = true;
      deck.receiveShadow = true;
      g.add(deck);
      for (const side of [-1, 1]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(len / steps + 0.8, 0.14, 0.2), MAT.wood);
        rail.position.set(px + Math.sin(ang) * side * 1.5, 2.15, pz - Math.cos(ang) * side * 1.5);
        rail.rotation.y = -ang;
        g.add(rail);
      }
    }
  }
  parent.add(g);
  return g;
}

function findShore(x, z) {
  for (let r = 9; r < 140; r += 1.5) {
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const px = x + Math.cos(a) * r;
      const pz = z + Math.sin(a) * r;
      if (!inWater(px, pz) && inWater(px + Math.cos(a) * 2, pz + Math.sin(a) * 2)) {
        return [px, pz];
      }
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* 梧桐语问学中心（修身楼）                                            */
/* ------------------------------------------------------------------ */
export function buildWutongyu(parent) {
  const g = new THREE.Group();
  g.position.set(-248, 0, 120);
  g.name = 'wutongyu';
  const w = 36;
  const d = 28;
  const h = 8.4;
  const sm = siteMaterials();

  addBox(g, w + 6, 0.8, d + 6, 0, 0.4, 0, MAT.stoneDark);
  addGroundPlane(g, w + 16, d + 14, 0, 3, 0.3, sm.paveWarm);
  massing({ w, h, d, style: 'wood', roof: 'flat', x: 0, y: 0.8, z: 0, parent: g, parapet: false });
  gableRoof(g, d + 1.6, 4.0, w + 1.4, 0, 0.8 + h, 0, MAT.roofTile, 1.0, Math.PI / 2);

  const screenH = h * 0.62;
  const slatGeo = new THREE.BoxGeometry(0.18, screenH, 0.35);
  const n = Math.floor((w - 2) / 1.05);
  const inst = new THREE.InstancedMesh(slatGeo, MAT.wood, n);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < n; i++) {
    m4.makeTranslation(-(n - 1) * 1.05 / 2 + i * 1.05, 0.8 + 0.7 + screenH / 2, d / 2 + 0.3);
    inst.setMatrixAt(i, m4);
  }
  inst.castShadow = true;
  g.add(inst);
  addBox(g, w - 1.6, 0.5, 0.6, 0, 0.8 + 0.55, d / 2 + 0.3, MAT.wood);
  addBox(g, w - 1.6, 0.5, 0.6, 0, 0.8 + 0.85 + screenH, d / 2 + 0.3, MAT.wood);
  addBox(g, 3.0, 3.0, 0.4, 0, 2.3, d / 2 + 0.4, MAT.glassDark);
  addBox(g, 4.2, 0.25, 1.4, 0, 4.1, d / 2 + 0.9, MAT.roofSlate);

  addBox(g, 1.0, 2.4, 34, -w / 2 - 8, 1.2, 4, MAT.stoneLight);
  addBox(g, 30, 2.4, 1.0, 0, 1.2, d / 2 + 8, MAT.stoneLight);
  const marker = new THREE.Mesh(new THREE.BoxGeometry(9, 2.6, 1.6), MAT.stoneDark);
  marker.position.set(8, 1.9, d / 2 + 12);
  marker.castShadow = true;
  g.add(marker);
  addSign(g, '梧桐语问学中心', { w: 11, x: 8, y: 2.4, z: d / 2 + 12.9, color: '#f1e7d2' });

  parent.add(g);
  return g;
}

/* ------------------------------------------------------------------ */
/* 光电信息大楼                                                        */
/* ------------------------------------------------------------------ */
export function buildOpto(parent) {
  const g = new THREE.Group();
  g.position.set(1482, 0, 873);
  g.name = 'opto';
  const h = 23;
  addBox(g, 150, 1.0, 292, 0, 0.5, 0, MAT.stoneLight);
  for (const dz of [-92, 0, 92]) {
    massing({ w: 124, h, d: 66, style: 'glass', roof: 'flat', x: 0, y: 1, z: dz, parent: g, parapetH: 1.2 });
    addBox(g, 126, 0.8, 68, 0, h + 1.4, dz, MAT.white);
  }
  addBox(g, 128, 12, 30, 0, 7, -46, MAT.white);
  addBox(g, 128, 12, 30, 0, 7, 46, MAT.white);
  addSign(g, '光电信息大楼', { w: 26, x: 0, y: 16.4, z: -125.5, ry: Math.PI, color: '#1d3f5c', emissive: 0 });
  parent.add(g);
  return g;
}

/* ------------------------------------------------------------------ */
/* 其他校门                                                            */
/* ------------------------------------------------------------------ */
const SIMPLE_GATES = [
  ['南二门', -804, 795, 0],
  ['南三门', -947, 822, 0],
  ['南四门', -154, 855, 0],
  ['西小门（紫菘门）', -1639, 554, -Math.PI / 2],
  ['东北门', 860, -344, Math.PI / 2],
  ['西北门', -952, -497, Math.PI],
];

export function buildOtherGates(parent) {
  for (const [name, x, z, ry] of SIMPLE_GATES) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    g.name = `gate-${name}`;
    addBox(g, 34, 0.5, 9, 0, 0.25, 0, MAT.stoneDark);
    for (const s of [-1, 1]) {
      addBox(g, 4.6, 7.4, 4.6, s * 10.5, 3.7, 0, MAT.stoneLight);
      addBox(g, 5.2, 0.5, 5.2, s * 10.5, 7.6, 0, MAT.stoneDark);
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), MAT.lamp);
      lamp.position.set(s * 10.5, 5.2, 2.6);
      g.add(lamp);
    }
    addBox(g, 26, 2.2, 2.6, 0, 8.4, 0, MAT.stoneLight);
    addBox(g, 27, 0.5, 3.2, 0, 9.8, 0, MAT.stoneDark);
    addSign(g, name, { w: 14, y: 8.4, z: 1.45, color: '#4a3620', emissive: 0.15 });
    addBox(g, 6, 2.6, 4, 14, 1.3, 7, MAT.stoneLight);
    addBox(g, 6.8, 0.4, 4.8, 14, 2.8, 7, MAT.roofDark);
    parent.add(g);
  }
}

/* ------------------------------------------------------------------ */
/* 生活区标识、青年园、喻家山                                          */
/* ------------------------------------------------------------------ */
export function buildLandscape(parent) {
  const g = new THREE.Group();
  g.name = 'landscape';
  const signs = [
    ['韵苑学生公寓', 1250, 250, -Math.PI / 2, 16],
    ['紫菘学生公寓', -1382, 430, Math.PI / 2, 15],
    ['沁苑学生公寓', 300, 392, 0, 14],
    ['青年园', -847, 62, 0, 8],
  ];
  for (const [text, x, z, ry, w] of signs) {
    const stone = new THREE.Mesh(new THREE.BoxGeometry(w + 2, 3.2, 1.6), MAT.stoneDark);
    stone.position.set(x, 1.9, z);
    stone.rotation.y = ry;
    stone.castShadow = true;
    g.add(stone);
    addSign(g, text, { w, x: x + Math.sin(ry) * 1.0, y: 2.5, z: z + Math.cos(ry) * 1.0, ry, color: '#f1e6cb' });
  }

  const peakX = -40;
  const peakZ = -588;
  const peakY = terrainHeight(peakX, peakZ);
  const summit = new THREE.Group();
  summit.position.set(peakX, peakY, peakZ);
  summit.scale.set(2.2, 1.8, 2.2);
  summit.name = 'hill-pavilion';
  addBox(summit, 18, 5, 18, 0, -1.4, 0, MAT.stoneDark);
  addBox(summit, 15, 1.0, 15, 0, 1.6, 0, MAT.stone);
  addCylinder(summit, 6.4, 6.8, 1.0, 0, 1.1, 0, MAT.stoneDark, { segments: 6, ry: Math.PI / 6 });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    addCylinder(summit, 0.24, 0.28, 4.6, Math.cos(a) * 4.2, 1.6 + 2.3, Math.sin(a) * 4.2, MAT.wood, { segments: 8 });
  }
  addCylinder(summit, 7.0, 7.0, 0.4, 0, 6.3, 0, MAT.roofSlate, { segments: 6, ry: Math.PI / 6 });
  addCylinder(summit, 0.25, 7.6, 3.0, 0, 8.1, 0, MAT.roofTile, { segments: 6, ry: Math.PI / 6 });
  addCylinder(summit, 0.1, 0.26, 1.2, 0, 10.2, 0, MAT.gold, { segments: 8 });
  addSign(summit, '喻家山', { w: 4.0, y: 5.9, z: 5.4, color: '#f4e2b6' });
  addBox(summit, 10, 0.3, 14, 0, 0.4, -12, MAT.woodLight);
  addBox(summit, 14, 0.3, 8, 0, 0.2, -9, MAT.woodLight);
  g.add(summit);

  addBox(g, 6, 3, 1.4, -160, 1.9, -310, MAT.stoneDark);
  addSign(g, '喻家山', { w: 3.2, x: -154, y: 2.4, z: -310, ry: Math.PI / 2, color: '#f1e6cb' });

  // continuous switchback trail from the south foot to the summit
  const trailPts = [];
  for (let i = 0; i <= 70; i++) {
    const t = i / 70;
    trailPts.push([-160 + t * 132 + Math.sin(t * Math.PI * 3) * 12, -310 - t * 268]);
  }
  const trailMat = new THREE.MeshStandardMaterial({ color: 0xc9c0ab, roughness: 1 });
  for (let i = 0; i < trailPts.length - 1; i++) {
    const [x1, z1] = trailPts[i];
    const [x2, z2] = trailPts[i + 1];
    const y1 = terrainHeight(x1, z1);
    const y2 = terrainHeight(x2, z2);
    const len = Math.hypot(x2 - x1, z2 - z1);
    const seg = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.25, len + 1.2), trailMat);
    seg.position.set((x1 + x2) / 2, (y1 + y2) / 2 + 0.25, (z1 + z2) / 2);
    seg.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
    seg.rotation.x = Math.atan2(y2 - y1, len);
    seg.receiveShadow = true;
    g.add(seg);
  }

  parent.add(g);
  return g;
}

/* ------------------------------------------------------------------ */
/* 中心操场                                                            */
/* ------------------------------------------------------------------ */
export function buildCenterStadium(parent) {
  const g = new THREE.Group();
  g.position.set(55, 0, 628);
  g.name = 'center-stadium';
  const rx = 92;
  const rz = 58;

  // track annulus
  const shape = new THREE.Shape();
  shape.absellipse(0, 0, rx, rz, 0, Math.PI * 2, false, 0);
  const hole = new THREE.Path();
  hole.absellipse(0, 0, rx - 12, rz - 12, 0, Math.PI * 2, true, 0);
  shape.holes.push(hole);
  const trackGeo = new THREE.ShapeGeometry(shape, 96);
  trackGeo.rotateX(-Math.PI / 2);
  const track = new THREE.Mesh(trackGeo, MAT.track || new THREE.MeshStandardMaterial({ color: 0x8a4438 }));
  track.position.y = 0.36;
  track.receiveShadow = true;
  g.add(track);

  const infield = new THREE.Mesh(new THREE.CircleGeometry(1, 64).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x5d7f45, roughness: 1 }));
  infield.scale.set(rx - 12.4, 1, rz - 12.4);
  infield.position.y = 0.34;
  infield.receiveShadow = true;
  g.add(infield);

  const laneMat = new THREE.LineBasicMaterial({ color: 0xf3eee2, transparent: true, opacity: 0.85 });
  for (let i = 0; i <= 8; i++) {
    const lrx = rx - 12 + (i * 12) / 8;
    const lrz = rz - 12 + (i * 12) / 8;
    const pts = [];
    for (let a = 0; a <= 120; a++) {
      const t = (a / 120) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(t) * lrx, 0.4, Math.sin(t) * lrz));
    }
    g.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), laneMat));
  }

  // grandstands on the two long sides
  const standMat = new THREE.MeshStandardMaterial({ color: 0xb7b2a6, roughness: 0.9 });
  const seatMat = new THREE.MeshStandardMaterial({ color: 0x3f6b8a, roughness: 0.75 });
  for (const side of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      const depth = 3.2;
      const step = new THREE.Mesh(new THREE.BoxGeometry(depth, (i + 1) * 1.1, 96 - i * 3), standMat);
      step.position.set(side * (rx + 3 + i * depth), ((i + 1) * 1.1) / 2, 0);
      step.castShadow = true;
      step.receiveShadow = true;
      g.add(step);
      const seats = new THREE.Mesh(new THREE.BoxGeometry(depth * 0.8, 0.3, 90 - i * 3), seatMat);
      seats.position.set(side * (rx + 3 + i * depth), (i + 1) * 1.1 + 0.15, 0);
      g.add(seats);
    }
  }

  for (const [sx, sz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
    const mx = sx * (rx + 18);
    const mz = sz * (rz + 14);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.7, 22, 8), MAT.concrete);
    pole.position.set(mx, 11, mz);
    pole.castShadow = true;
    g.add(pole);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(5, 3, 1), MAT.lamp);
    panel.position.set(mx, 23, mz);
    g.add(panel);
  }

  addSign(g, '中心操场', { w: 9, y: 6, z: rz + 22, color: '#f4ecd8' });
  parent.add(g);
  return g;
}

/* ------------------------------------------------------------------ */
/* 路灯                                                                */
/* ------------------------------------------------------------------ */
export function buildLamps(parent) {
  const positions = [];
  for (let z = 690; z <= 850; z += 22) {
    positions.push([-500, z, 0.3], [-470, z, -0.3]);
  }
  const seen = new Set();
  for (const r of CAMPUS.roads) {
    if (!['primary', 'secondary', 'tertiary'].includes(r.c)) continue;
    const step = 70;
    for (let i = 0; i < r.p.length - 1; i++) {
      const [x1, z1] = r.p[i];
      const [x2, z2] = r.p[i + 1];
      const len = Math.hypot(x2 - x1, z2 - z1);
      const n = Math.max(1, Math.floor(len / step));
      const ang = Math.atan2(z2 - z1, x2 - x1);
      const nx = Math.sin(ang);
      const nz = -Math.cos(ang);
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) / n;
        for (const side of [-1, 1]) {
          const px = x1 + (x2 - x1) * t + nx * (r.w / 2 + 2) * side;
          const pz = z1 + (z2 - z1) * t + nz * (r.w / 2 + 2) * side;
          if (Math.abs(px) > 1900 || Math.abs(pz) > 1500) continue;
          const key = Math.round(px / 34) + ':' + Math.round(pz / 34);
          if (seen.has(key)) continue;
          seen.add(key);
          positions.push([px, pz, ang]);
        }
      }
    }
  }
  const g = new THREE.Group();
  g.name = 'lamps';
  const poleGeo = new THREE.CylinderGeometry(0.12, 0.18, 5.4, 6);
  const poles = new THREE.InstancedMesh(poleGeo, MAT.darkMetal, positions.length);
  const headGeo = new THREE.BoxGeometry(1.3, 0.3, 0.6);
  const heads = new THREE.InstancedMesh(headGeo, MAT.lamp, positions.length);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  positions.forEach(([x, z, ry], i) => {
    m4.makeTranslation(x, 2.7, z);
    poles.setMatrixAt(i, m4);
    e.set(0, ry, 0);
    q.setFromEuler(e);
    m4.compose(new THREE.Vector3(x, 5.45, z), q, new THREE.Vector3(1, 1, 1));
    heads.setMatrixAt(i, m4);
  });
  poles.instanceMatrix.needsUpdate = true;
  heads.instanceMatrix.needsUpdate = true;
  poles.castShadow = false;
  g.add(poles, heads);
  parent.add(g);
  return g;
}
