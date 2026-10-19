import * as THREE from 'three';

/* ---------- math helpers ---------- */

export const clamp = (n, a, b) => Math.min(b, Math.max(a, n));

export function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** deterministic PRNG */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash2(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/* ---------- canvas textures ---------- */

export function makeCanvas(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

export function canvasTexture(canvas, { repeat = [1, 1], anisotropy = 8 } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat[0], repeat[1]);
  tex.anisotropy = anisotropy;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const CJK = '"Noto Serif CJK SC", "Source Han Serif SC", "Songti SC", "Microsoft YaHei", "PingFang SC", serif';
const CJK_SANS = '"Noto Sans CJK SC", "Source Han Sans SC", "Microsoft YaHei", "PingFang SC", sans-serif';

/**
 * Render a text label into a canvas texture.
 * Works with Chinese glyphs and creates a transparent background by default.
 */
export function textTexture(text, opts = {}) {
  const {
    width = 1024,
    height = 256,
    font = `700 120px ${CJK}`,
    color = '#f4ecd8',
    background = null,
    stroke = null,
    strokeWidth = 0,
    letterSpacing = 0,
    padding = 24,
    align = 'center',
    glow = null,
  } = opts;

  const canvas = makeCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.font = font;
  ctx.textBaseline = 'middle';
  ctx.textAlign = align;

  const chars = Array.from(text);
  const widths = chars.map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + letterSpacing * Math.max(0, chars.length - 1);

  let x;
  if (align === 'center') x = width / 2 - total / 2;
  else if (align === 'right') x = width - padding - total;
  else x = padding;

  if (glow) {
    ctx.shadowColor = glow;
    ctx.shadowBlur = 28;
  }
  for (let i = 0; i < chars.length; i++) {
    const w = widths[i];
    if (stroke) {
      ctx.lineWidth = strokeWidth;
      ctx.strokeStyle = stroke;
      ctx.strokeText(chars[i], x + w / 2, height / 2);
    }
    ctx.fillStyle = color;
    ctx.fillText(chars[i], x + w / 2, height / 2);
    x += w + letterSpacing;
  }
  ctx.shadowBlur = 0;

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/** Build a plane with a text texture. Returns a Mesh. */
export function textPlane(text, opts = {}) {
  const {
    width = 10,
    height = 2.5,
    texWidth = 1024,
    texHeight = 256,
    font,
    color,
    background,
    transparent = true,
    doubleSide = false,
    emissive = 0,
  } = opts;

  const tex = textTexture(text, { width: texWidth, height: texHeight, font, color, background });
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    transparent,
    roughness: 0.55,
    metalness: 0.05,
    side: doubleSide ? THREE.DoubleSide : THREE.FrontSide,
    emissive: new THREE.Color(0xffffff),
    emissiveMap: tex,
    emissiveIntensity: emissive,
    depthWrite: !transparent,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
  return mesh;
}

/* ---------- geometry helpers ---------- */

/** Merge a list of (already transformed) geometries into one indexed-less geometry. */
export function mergeGeometries(geometries) {
  const parts = geometries.map((g) => (g.index ? g.toNonIndexed() : g));
  let total = 0;
  for (const p of parts) total += p.attributes.position.count;
  const hasColor = parts.every((p) => p.attributes.color);

  const position = new Float32Array(total * 3);
  const normal = new Float32Array(total * 3);
  const uv = new Float32Array(total * 2);
  const color = hasColor ? new Float32Array(total * 3) : null;
  let o3 = 0;
  let o2 = 0;
  for (const p of parts) {
    position.set(p.attributes.position.array, o3);
    normal.set(p.attributes.normal.array, o3);
    if (p.attributes.uv) uv.set(p.attributes.uv.array, o2);
    if (color) color.set(p.attributes.color.array, o3);
    o3 += p.attributes.position.count * 3;
    o2 += p.attributes.position.count * 2;
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(position, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  merged.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  if (color) merged.setAttribute('color', new THREE.BufferAttribute(color, 3));
  return merged;
}

/** Paint every vertex of a geometry with one colour (for merged, instanced meshes). */
export function paint(geo, hex) {
  const c = new THREE.Color(hex);
  const n = geo.attributes.position.count;
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

/**
 * Scale per-face UVs of a BoxGeometry so a shared facade texture keeps a
 * constant real-world window size on every face.
 * BoxGeometry vertex order: +X, -X, +Y, -Y, +Z, -Z (4 verts each).
 */
export function scaleBoxUVs(geo, repeats) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    const face = Math.floor(i / 4);
    const r = repeats[face] || [1, 1];
    uv.setXY(i, uv.getX(i) * r[0], uv.getY(i) * r[1]);
  }
  uv.needsUpdate = true;
  return geo;
}

export function addBox(parent, w, h, d, x, y, z, mat, { cast = true, receive = true, ry = 0 } = {}) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  mesh.rotation.y = ry;
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  parent.add(mesh);
  return mesh;
}

export function addCylinder(parent, rt, rb, h, x, y, z, mat, opts = {}) {
  const seg = opts.segments || 24;
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg, 1, !!opts.open), mat);
  mesh.position.set(x, y, z);
  if (opts.ry) mesh.rotation.y = opts.ry;
  if (opts.rx) mesh.rotation.x = opts.rx;
  mesh.castShadow = opts.cast !== false;
  mesh.receiveShadow = opts.receive !== false;
  parent.add(mesh);
  return mesh;
}

/** Flat horizontal plane (slightly above ground) used for roads, plazas, water. */
export function addGroundPlane(parent, w, d, x, z, y, mat, ry = 0) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.rotation.z = ry;
  mesh.position.set(x, y, z);
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

/** Soft radial gradient blob used for contact shadows / AO under buildings. */
export function blobTexture(size = 128) {
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(20,18,14,0.55)');
  g.addColorStop(0.55, 'rgba(20,18,14,0.22)');
  g.addColorStop(1, 'rgba(20,18,14,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

export function noiseCanvas(size, base, variance, cell = 4) {
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  const rnd = mulberry32(7);
  for (let y = 0; y < size; y += cell) {
    for (let x = 0; x < size; x += cell) {
      const v = (rnd() - 0.5) * variance;
      ctx.fillStyle = v > 0 ? `rgba(255,255,255,${v})` : `rgba(0,0,0,${-v})`;
      ctx.fillRect(x, y, cell, cell);
    }
  }
  return canvas;
}

/** Vertically stacked CJK text (used on gate plaques). */
export function verticalTextPlane(text, opts = {}) {
  const {
    width = 3,
    height = 7,
    color = '#f7dca6',
    background = null,
    font = `700 190px ${CJK}`,
    texWidth = 256,
    texHeight = 1024,
    emissive = 0,
    doubleSide = false,
  } = opts;

  const canvas = makeCanvas(texWidth, texHeight);
  const ctx = canvas.getContext('2d');
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, texWidth, texHeight);
  }
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  const chars = Array.from(text);
  const cell = texHeight / chars.length;
  chars.forEach((ch, i) => ctx.fillText(ch, texWidth / 2, cell * (i + 0.5)));

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    transparent: true,
    roughness: 0.6,
    metalness: 0.1,
    side: doubleSide ? THREE.DoubleSide : THREE.FrontSide,
    emissive: new THREE.Color(0xffffff),
    emissiveMap: tex,
    emissiveIntensity: emissive,
    depthWrite: false,
  });
  return new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
}

export { CJK, CJK_SANS };
