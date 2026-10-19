import * as THREE from 'three';
import { makeCanvas, canvasTexture, mulberry32, scaleBoxUVs } from './util.js';

/*
 * Stylised facade system.
 *
 * Every style is a seamless tiling texture that covers 4 window bays x
 * 4 floors.  A building box maps that texture per-face with UVs scaled by
 * the face dimensions, so windows keep a constant physical size no matter
 * how large the building is.  A matching emissive map turns a random subset
 * of windows on after dark.
 */

export const STYLES = {
  stone: { base: '#e8e1d2', trim: '#f4efe4', glass: '#5b7185', lit: '#ffd28a', bay: 6.4, floor: 4.5, rough: 0.82, metal: 0.04, punch: true },
  brick: { base: '#b9744f', trim: '#d8b393', glass: '#3f5566', lit: '#ffcf8a', bay: 5.6, floor: 4.2, rough: 0.9, metal: 0.02, punch: true },
  brickDark: { base: '#8f563f', trim: '#c19a7c', glass: '#364a5b', lit: '#ffc98a', bay: 5.6, floor: 4.2, rough: 0.9, metal: 0.02, punch: true },
  concrete: { base: '#cfcabf', trim: '#e2ded5', glass: '#466074', lit: '#ffe0a3', bay: 6.0, floor: 4.4, rough: 0.88, metal: 0.03, punch: true },
  glass: { base: '#8aa9b8', trim: '#5c7788', glass: '#a8c6d4', lit: '#ecf3ff', bay: 3.4, floor: 4.2, rough: 0.18, metal: 0.65, punch: false },
  dorm: { base: '#e6d6bd', trim: '#f6ecd9', glass: '#4b6070', lit: '#ffd9a0', bay: 4.4, floor: 3.3, rough: 0.9, metal: 0.02, punch: true },
  lab: { base: '#eef0ee', trim: '#ffffff', glass: '#7fa7b8', lit: '#eaf6ff', bay: 5.2, floor: 4.4, rough: 0.6, metal: 0.12, punch: true },
  concrete2: { base: '#ddd6c8', trim: '#eee8db', glass: '#54707f', lit: '#ffe2a8', bay: 5.0, floor: 3.9, rough: 0.9, metal: 0.02, punch: true },
  brick2: { base: '#a86a4a', trim: '#cfa987', glass: '#44596a', lit: '#ffd29a', bay: 6.2, floor: 3.8, rough: 0.9, metal: 0.02, punch: true },
  wood: { base: '#9b6a45', trim: '#c9a074', glass: '#3d4f52', lit: '#ffc57a', bay: 4.0, floor: 3.6, rough: 0.78, metal: 0.02, punch: true },
};

const facadeCache = new Map();

function drawFacade(styleName) {
  const s = STYLES[styleName];
  const S = 512;
  const canvas = makeCanvas(S, S);
  const ctx = canvas.getContext('2d');
  const rnd = mulberry32(styleName.length * 977 + 13);
  const cells = 4;
  const cw = S / cells;
  const ch = S / cells;

  // wall base with a subtle vertical gradient
  const grad = ctx.createLinearGradient(0, 0, 0, S);
  grad.addColorStop(0, s.base);
  grad.addColorStop(1, shade(s.base, -0.09));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, S, S);

  // fine grain
  for (let i = 0; i < 5200; i++) {
    const a = rnd() * 0.06;
    ctx.fillStyle = rnd() > 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
    ctx.fillRect(rnd() * S, rnd() * S, 2, 2);
  }

  if (!s.punch) {
    // curtain wall: mullion grid over reflective panels
    for (let r = 0; r < cells; r++) {
      for (let c = 0; c < cells; c++) {
        const x = c * cw;
        const y = r * ch;
        const g = ctx.createLinearGradient(x, y, x + cw, y + ch);
        g.addColorStop(0, shade(s.glass, 0.18));
        g.addColorStop(0.45, s.glass);
        g.addColorStop(1, shade(s.glass, -0.16));
        ctx.fillStyle = g;
        ctx.fillRect(x + 2, y + 2, cw - 4, ch - 4);
        // spandrel band at the floor line
        ctx.fillStyle = 'rgba(28,44,54,0.55)';
        ctx.fillRect(x, y + ch - 12, cw, 12);
        // highlight streak
        ctx.fillStyle = 'rgba(255,255,255,0.10)';
        ctx.fillRect(x + cw * 0.12, y, cw * 0.1, ch);
      }
    }
    ctx.strokeStyle = shade(s.trim, -0.25);
    ctx.lineWidth = 3;
    for (let i = 0; i <= cells; i++) {
      ctx.beginPath();
      ctx.moveTo(i * cw, 0);
      ctx.lineTo(i * cw, S);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * ch);
      ctx.lineTo(S, i * ch);
      ctx.stroke();
    }
    return { canvas, base: s.base };
  }

  // punched windows in a solid wall
  for (let r = 0; r < cells; r++) {
    for (let c = 0; c < cells; c++) {
      const x = c * cw;
      const y = r * ch;

      // floor band / lintel shadow
      ctx.fillStyle = 'rgba(0,0,0,0.10)';
      ctx.fillRect(x, y + ch - 7, cw, 7);

      const wInset = cw * 0.16;
      const topInset = ch * 0.2;
      const botInset = ch * 0.26;
      const wx = x + wInset;
      const wy = y + topInset;
      const ww = cw - wInset * 2;
      const wh = ch - topInset - botInset;

      // reveal / frame
      ctx.fillStyle = shade(s.trim, -0.06);
      ctx.fillRect(wx - 7, wy - 7, ww + 14, wh + 14);
      ctx.fillStyle = 'rgba(0,0,0,0.30)';
      ctx.fillRect(wx - 2, wy - 2, ww + 4, wh + 4);

      // glass
      const g = ctx.createLinearGradient(wx, wy, wx + ww * 0.4, wy + wh);
      g.addColorStop(0, shade(s.glass, 0.34));
      g.addColorStop(0.42, shade(s.glass, 0.12));
      g.addColorStop(1, shade(s.glass, -0.24));
      ctx.fillStyle = g;
      ctx.fillRect(wx, wy, ww, wh);

      // diagonal reflection
      ctx.fillStyle = 'rgba(255,255,255,0.13)';
      ctx.beginPath();
      ctx.moveTo(wx, wy + wh);
      ctx.lineTo(wx + ww * 0.55, wy);
      ctx.lineTo(wx + ww, wy);
      ctx.lineTo(wx + ww, wy + wh * 0.2);
      ctx.closePath();
      ctx.fill();

      // mullions
      ctx.strokeStyle = shade(s.trim, -0.18);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(wx + ww / 2, wy);
      ctx.lineTo(wx + ww / 2, wy + wh);
      ctx.moveTo(wx, wy + wh * 0.52);
      ctx.lineTo(wx + ww, wy + wh * 0.52);
      ctx.stroke();

      // sill
      ctx.fillStyle = shade(s.trim, 0.05);
      ctx.fillRect(wx - 9, wy + wh + 2, ww + 18, 6);

      // occasional blinds
      if (rnd() < 0.3) {
        ctx.fillStyle = 'rgba(236,232,220,0.5)';
        ctx.fillRect(wx + 3, wy + 3, ww - 6, wh * (0.2 + rnd() * 0.5));
      }
    }
  }

  // vertical pilasters on some styles
  if (styleName === 'stone' || styleName === 'concrete') {
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    for (let i = 0; i <= cells; i++) ctx.fillRect(i * cw - 4, 0, 8, S);
  }

  return { canvas, base: s.base };
}

function drawEmissive(styleName) {
  const S = 512;
  const canvas = makeCanvas(S, S);
  const ctx = canvas.getContext('2d');
  const s = STYLES[styleName];
  const cells = 4;
  const cw = S / cells;
  const ch = S / cells;
  const rnd = mulberry32(styleName.length * 631 + 77);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, S, S);

  if (!s.punch) {
    for (let r = 0; r < cells; r++) {
      for (let c = 0; c < cells; c++) {
        if (rnd() < 0.42) {
          ctx.fillStyle = 'rgba(220,236,255,0.55)';
          ctx.fillRect(c * cw + 3, r * ch + 3, cw - 6, ch - 15);
        } else {
          ctx.fillStyle = 'rgba(120,160,200,0.10)';
          ctx.fillRect(c * cw + 3, r * ch + 3, cw - 6, ch - 15);
        }
      }
    }
    return canvas;
  }

  for (let r = 0; r < cells; r++) {
    for (let c = 0; c < cells; c++) {
      const x = c * cw;
      const y = r * ch;
      if (rnd() > 0.42) continue;
      const wx = x + cw * 0.16;
      const wy = y + ch * 0.2;
      const ww = cw * 0.68;
      const wh = ch * 0.54;
      const g = ctx.createRadialGradient(wx + ww / 2, wy + wh / 2, 2, wx + ww / 2, wy + wh / 2, ww * 0.8);
      g.addColorStop(0, s.lit);
      g.addColorStop(0.75, s.lit);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(wx - 4, wy - 4, ww + 8, wh + 8);
      // curtain behind the glass
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(wx, wy + wh * 0.62, ww, wh * 0.38);
    }
  }
  return canvas;
}

function shade(hex, amount) {
  const c = new THREE.Color(hex);
  const hsl = {};
  c.getHSL(hsl);
  hsl.l = Math.min(1, Math.max(0, hsl.l + amount));
  c.setHSL(hsl.h, hsl.s, hsl.l);
  return '#' + c.getHexString();
}

function getFacade(styleName) {
  if (facadeCache.has(styleName)) return facadeCache.get(styleName);
  const { canvas } = drawFacade(styleName);
  const emissive = drawEmissive(styleName);
  const map = canvasTexture(canvas);
  const emissiveMap = canvasTexture(emissive);
  const s = STYLES[styleName];
  const material = new THREE.MeshStandardMaterial({
    map,
    emissiveMap,
    emissive: new THREE.Color(0xfff0d0),
    emissiveIntensity: 0,
    roughness: s.rough,
    metalness: s.metal,
    envMapIntensity: 0.4,
  });
  const entry = { material, ...s, emissiveMap };
  facadeCache.set(styleName, entry);
  return entry;
}

export function facadeMaterial(styleName) {
  return getFacade(styleName).material;
}

export function allFacadeMaterials() {
  return [...facadeCache.values()].map((e) => e.material);
}

/* ---------- materials ---------- */

const roofNoise = (() => {
  const canvas = makeCanvas(256, 256);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#a5a29a';
  ctx.fillRect(0, 0, 256, 256);
  const rnd = mulberry32(41);
  for (let i = 0; i < 6000; i++) {
    const a = rnd() * 0.14;
    ctx.fillStyle = rnd() > 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
    ctx.fillRect(rnd() * 256, rnd() * 256, 3, 3);
  }
  // gravel joints
  ctx.strokeStyle = 'rgba(70,68,62,0.25)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 8; i++) {
    ctx.beginPath();
    ctx.moveTo((i * 256) / 8, 0);
    ctx.lineTo((i * 256) / 8, 256);
    ctx.stroke();
  }
  return canvasTexture(canvas);
})();

export const MAT = {
  roofFlat: new THREE.MeshStandardMaterial({ map: roofNoise, color: 0xb4b1a8, roughness: 0.94, metalness: 0.04 }),
  roofDark: new THREE.MeshStandardMaterial({ map: roofNoise, color: 0x7f827e, roughness: 0.88, metalness: 0.08 }),
  roofCopper: new THREE.MeshStandardMaterial({ color: 0x4e7f6d, roughness: 0.55, metalness: 0.45 }),
  roofTile: new THREE.MeshStandardMaterial({ color: 0x8f4a3c, roughness: 0.75, metalness: 0.05 }),
  roofSlate: new THREE.MeshStandardMaterial({ color: 0x4a4f55, roughness: 0.7, metalness: 0.15 }),
  stone: new THREE.MeshStandardMaterial({ color: 0xd8d2c4, roughness: 0.9 }),
  stoneLight: new THREE.MeshStandardMaterial({ color: 0xece6d8, roughness: 0.85 }),
  stoneDark: new THREE.MeshStandardMaterial({ color: 0x9a958a, roughness: 0.92 }),
  white: new THREE.MeshStandardMaterial({ color: 0xf2f1ec, roughness: 0.7 }),
  concrete: new THREE.MeshStandardMaterial({ color: 0xc4c0b6, roughness: 0.95 }),
  metal: new THREE.MeshStandardMaterial({ color: 0xb9c1c6, roughness: 0.35, metalness: 0.7, envMapIntensity: 1.1 }),
  darkMetal: new THREE.MeshStandardMaterial({ color: 0x646c72, roughness: 0.5, metalness: 0.5 }),
  gold: new THREE.MeshStandardMaterial({ color: 0xc9a253, roughness: 0.3, metalness: 0.85 }),
  wood: new THREE.MeshStandardMaterial({ color: 0x8a5a38, roughness: 0.75 }),
  woodLight: new THREE.MeshStandardMaterial({ color: 0xc09263, roughness: 0.8 }),
  red: new THREE.MeshStandardMaterial({ color: 0xa63b32, roughness: 0.7 }),
  glass: new THREE.MeshPhysicalMaterial({
    color: 0x9fc2cf,
    roughness: 0.06,
    metalness: 0.1,
    transparent: true,
    opacity: 0.55,
    side: THREE.DoubleSide,
    envMapIntensity: 1.4,
  }),
  glassDark: new THREE.MeshStandardMaterial({ color: 0x4f6b7d, roughness: 0.12, metalness: 0.5, envMapIntensity: 1.2 }),
  lamp: new THREE.MeshStandardMaterial({ color: 0xfff4d6, emissive: new THREE.Color(0xffd58a), emissiveIntensity: 0 }),
  asphalt: null,
  track: null,
  grass: null,
};

export const ROOF_MATS = {
  flat: MAT.roofFlat,
  dark: MAT.roofDark,
  copper: MAT.roofCopper,
  tile: MAT.roofTile,
  slate: MAT.roofSlate,
};

/**
 * Main building block: an extruded massing with correctly-scaled facade
 * textures, a roof material on the top face, and a parapet detail.
 */
export function massing({
  w,
  h,
  d,
  style = 'stone',
  roof = 'flat',
  x = 0,
  z = 0,
  y = 0,
  ry = 0,
  parapet = true,
  parapetH = 1.1,
  parent,
}) {
  const facade = facadeMaterial(style);
  const roofMat = ROOF_MATS[roof] || MAT.roofFlat;
  const s = STYLES[style];
  const moduleW = s.bay * 4;
  const moduleH = s.floor * 4;
  const geo = new THREE.BoxGeometry(w, h, d);
  scaleBoxUVs(geo, [
    [d / moduleW, h / moduleH],
    [d / moduleW, h / moduleH],
    [w / 12, d / 12],
    [w / 12, d / 12],
    [w / moduleW, h / moduleH],
    [w / moduleW, h / moduleH],
  ]);

  const mats = [facade, facade, roofMat, roofMat, facade, facade];
  const mesh = new THREE.Mesh(geo, mats);
  mesh.position.set(x, y + h / 2, z);
  mesh.rotation.y = ry;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const group = new THREE.Group();
  group.position.set(0, 0, 0);
  group.add(mesh);
  if (parent) parent.add(group);

  if (parapet) {
    const t = 0.6;
    const p = parapetH;
    const pg = new THREE.Group();
    pg.position.copy(mesh.position);
    pg.rotation.y = ry;
    const add = (bw, bh, bd, px, py, pz) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), roofMat);
      m.position.set(px, py, pz);
      m.castShadow = true;
      m.receiveShadow = true;
      pg.add(m);
    };
    add(w + t, p, t, 0, h / 2 + p / 2, d / 2);
    add(w + t, p, t, 0, h / 2 + p / 2, -d / 2);
    add(t, p, d - t, w / 2, h / 2 + p / 2, 0);
    add(t, p, d - t, -w / 2, h / 2 + p / 2, 0);
    group.add(pg);
  }
  return group;
}

/** Hip / pyramid roof (4 sides or n sides), scaled to a rectangular footprint. */
export function pyramidRoof(parent, w, h, d, x, y, z, mat, sides = 4, ry = 0) {
  const geo = new THREE.ConeGeometry(1, 1, sides);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.scale.set(w * 0.72, h, d * 0.72);
  mesh.position.set(x, y + h / 2, z);
  mesh.rotation.y = ry + (sides === 4 ? Math.PI / 4 : 0);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

/** Gabled roof prism: ridge runs along Z. */
export function gableRoof(parent, w, h, d, x, y, z, mat, overhang = 0.8, ry = 0) {
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2 - overhang, 0);
  shape.lineTo(w / 2 + overhang, 0);
  shape.lineTo(0, h);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false });
  geo.translate(0, 0, -d / 2);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  mesh.rotation.y = ry;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

export function addStairs(parent, { w, steps, rise, run, x, y = 0, z, mat, ry = 0, noseMat = null, cheekMat = null }) {
  const g = new THREE.Group();
  for (let i = 0; i < steps; i++) {
    const h = rise * (i + 1);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, run), mat);
    m.position.set(0, y + h / 2, -(run / 2 + i * run));
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
  }
  // cheek walls
  for (const side of [-1, 1]) {
    const cheek = new THREE.Mesh(new THREE.BoxGeometry(0.35, rise * steps, run * steps), cheekMat || mat);
    cheek.position.set(side * (w / 2 + 0.17), y + (rise * steps) / 2, -(run * steps) / 2);
    cheek.castShadow = true;
    cheek.receiveShadow = true;
    g.add(cheek);
  }
  g.position.set(x, 0, z);
  g.rotation.y = ry;
  parent.add(g);
  return g;
}

export function addColumns(parent, { count, span, x, y, z, radius = 0.7, height, mat, axis = 'x' }) {
  const g = new THREE.Group();
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : (i / (count - 1) - 0.5) * span;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 1.08, height, 14), mat);
    const px = axis === 'x' ? t : 0;
    const pz = axis === 'x' ? 0 : t;
    m.position.set(px, height / 2, pz);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
    // capital
    const cap = new THREE.Mesh(new THREE.BoxGeometry(radius * 2.4, radius * 0.55, radius * 2.4), mat);
    cap.position.set(px, height - radius * 0.25, pz);
    cap.castShadow = true;
    g.add(cap);
  }
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

/** Thin vertical fins / brise-soleil along a facade. */
export function addFins(parent, { w, h, depth, x, y, z, count, mat, axis = 'x', spacing }) {
  const g = new THREE.Group();
  const step = spacing || w / count;
  const geo = new THREE.BoxGeometry(0.35, h, depth);
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < count; i++) {
    const t = axis === 'x' ? -w / 2 + step * (i + 0.5) : -w / 2 + step * (i + 0.5);
    m4.makeTranslation(axis === 'x' ? t : 0, 0, axis === 'x' ? 0 : t);
    mesh.setMatrixAt(i, m4);
  }
  g.position.set(x, y + h / 2, z);
  g.add(mesh);
  parent.add(g);
  return g;
}

/** Vertical banner flags on poles (used at the gate and plaza). */
export function addFlagpoles(parent, { x, z, count = 3, spacing = 9, height = 16, direction = 'x', y = 0 }) {
  const g = new THREE.Group();
  for (let i = 0; i < count; i++) {
    const off = (i - (count - 1) / 2) * spacing;
    const px = direction === 'x' ? x + off : x;
    const pz = direction === 'x' ? z : z + off;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, height, 8), MAT.metal);
    pole.position.set(px, y + height / 2, pz);
    pole.castShadow = true;
    g.add(pole);
    const flag = new THREE.Mesh(
      new THREE.PlaneGeometry(3.2, 2.2),
      new THREE.MeshStandardMaterial({ color: 0xb4322b, roughness: 0.8, side: THREE.DoubleSide })
    );
    flag.position.set(px + 1.7, y + height - 1.6, pz);
    flag.castShadow = true;
    g.add(flag);
  }
  parent.add(g);
  return g;
}
