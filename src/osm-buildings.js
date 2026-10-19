import * as THREE from 'three';
import { CAMPUS } from './campus-data.js';
import { STYLES, MAT, facadeMaterial } from './architecture.js';
import { textPlane } from './util.js';

/**
 * Generic campus buildings extruded from OpenStreetMap footprints.
 * Walls of the same style are merged into a single mesh (a handful of draw
 * calls for the whole campus), roofs into another.
 */

export const DETAILED_SKIP = new Set([
  '主校区图书馆',
  '主校区图书馆新馆 逸夫图书馆',
  '主校区图书馆老馆',
  '东九教学楼',
  '西十二楼',
  '光谷体育馆',
  '醉晚亭',
  '修身楼',
  '新光电信息大楼',
  '南一楼',
]);

const SIGN_NAMES = new Set([
  '南一楼',
  '南三楼',
  '南四楼',
  '南五楼',
  '南六楼 计算中心',
  '东十一教学楼',
  '东十二教学楼'.replace('教', '教'),
  '东十七楼',
  '逸夫科技楼',
  '大学生活动中心',
  '集贤楼',
  '东九舍',
  '西十二舍',
  '西十教学楼附楼',
  '精密重力测量科学中心',
  '脉冲强磁场实验室',
  '工程实训中心',
]);

function triangulate(ring) {
  // ring: closed [[x,z],...]; returns flat triangle list [x,z, x,z, x,z]
  let pts = ring.slice(0, ring.length - 1).map(([x, z]) => new THREE.Vector2(x, -z));
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    area += a.x * b.y - b.x * a.y;
  }
  if (area < 0) pts = pts.reverse();
  let tris = [];
  try {
    tris = THREE.ShapeUtils.triangulateShape(pts, []);
  } catch (err) {
    return [];
  }
  const out = [];
  for (const t of tris) {
    for (const idx of t) {
      out.push(pts[idx].x, -pts[idx].y);
    }
  }
  return out;
}

function pushQuad(bucket, a, b, c, d, normal, uv) {
  // a,b,c,d: [x,y,z]; two triangles a-b-c and a-c-d
  bucket.pos.push(...a, ...b, ...c, ...a, ...c, ...d);
  bucket.nor.push(...normal, ...normal, ...normal, ...normal, ...normal, ...normal);
  bucket.uv.push(...uv[0], ...uv[1], ...uv[2], ...uv[0], ...uv[2], ...uv[3]);
}

function addPrism(b, walls, roofs, roofBucket) {
  const ring = b.p;
  const h = Math.max(2, b.h);
  let style = STYLES[b.s] ? b.s : 'concrete';
  // a little material variety, including for unnamed blocks
  const mix = (Math.abs(Math.sin((b.p[0][0] + b.p[0][1]) * 0.13)) * 997) % 1;
  if (style === 'concrete' && mix > 0.55) style = 'concrete2';
  if (style === 'brick' && mix > 0.62) style = 'brick2';
  if (!b.n && mix > 0.88) style = 'stone';
  const s = STYLES[style];
  const moduleW = s.bay * 4;
  const moduleH = s.floor * 4;
  let cx = 0;
  let cz = 0;
  const n = ring.length - 1;
  for (let i = 0; i < n; i++) {
    cx += ring[i][0];
    cz += ring[i][1];
  }
  cx /= n;
  cz /= n;

  if (!walls.has(style)) walls.set(style, { pos: [], nor: [], uv: [] });
  const bucket = walls.get(style);
  let run = 0;

  for (let i = 0; i < n; i++) {
    const [x1, z1] = ring[i];
    const [x2, z2] = ring[i + 1];
    const ex = x2 - x1;
    const ez = z2 - z1;
    const len = Math.hypot(ex, ez);
    if (len < 0.2) continue;
    // outward normal (flip if pointing at the centroid)
    let nx = ez / len;
    let nz = -ex / len;
    const mx = (x1 + x2) / 2;
    const mz = (z1 + z2) / 2;
    if (nx * (mx - cx) + nz * (mz - cz) < 0) {
      nx = -nx;
      nz = -nz;
    }
    const u0 = run / moduleW;
    const u1 = (run + len) / moduleW;
    const v0 = 0.02;
    const v1 = h / moduleH;
    // wind the quad counter-clockwise as seen from outside, otherwise the
    // exterior faces are culled and buildings look like open frames
    pushQuad(
      bucket,
      [x1, 0, z1],
      [x1, h, z1],
      [x2, h, z2],
      [x2, 0, z2],
      [nx, 0, nz],
      [
        [u0, v0],
        [u0, v1],
        [u1, v1],
        [u1, v0],
      ]
    );
    run += len;
  }

  let tris = triangulate(ring);
  if (!tris.length) {
    // fan fallback so no building is left without a roof
    tris = [];
    for (let i = 0; i < n; i++) {
      const a = ring[i];
      const b = ring[i + 1];
      tris.push(cx, cz, a[0], a[1], b[0], b[1]);
    }
  }
  for (let i = 0; i < tris.length; i += 6) {
    const ax = tris[i];
    const az = tris[i + 1];
    const bx = tris[i + 2];
    const bz = tris[i + 3];
    const tx = tris[i + 4];
    const tz = tris[i + 5];
    // ensure the roof triangle winds counter-clockwise seen from above so the
    // face normal points up (a clockwise triangle is culled and the roof vanishes)
    const cross = (bx - ax) * (tz - az) - (bz - az) * (tx - ax);
    const order = cross > 0 ? [[ax, az], [tx, tz], [bx, bz]] : [[ax, az], [bx, bz], [tx, tz]];
    for (const [px, pz] of order) {
      roofBucket.pos.push(px, h + 0.06, pz);
      roofBucket.nor.push(0, 1, 0);
      roofBucket.uv.push(px / 14, pz / 14);
    }
  }
}

function toMesh(bucket, material) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(bucket.pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(bucket.nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(bucket.uv, 2));
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function buildContextBuildings(parent) {
  const walls = new Map();
  const roofs = {
    flat: { pos: [], nor: [], uv: [] },
    dark: { pos: [], nor: [], uv: [] },
    tile: { pos: [], nor: [], uv: [] },
  };
  const byName = new Map();
  for (const b of CAMPUS.buildings) {
    if (b.n && DETAILED_SKIP.has(b.n)) continue;
    const seed = Math.abs(Math.sin(b.p[0][0] * 0.21 + b.p[0][1] * 0.37));
    const roofKey = seed > 0.8 ? 'tile' : seed > 0.52 ? 'dark' : 'flat';
    addPrism(b, walls, roofs, roofs[roofKey]);
    if (b.n) byName.set(b.n, b);
  }
  const group = new THREE.Group();
  group.name = 'context-buildings';
  for (const [style, bucket] of walls) {
    group.add(toMesh(bucket, facadeMaterial(style)));
  }
  const roofMats = { flat: MAT.roofFlat, dark: MAT.roofDark, tile: MAT.roofTile };
  for (const key of Object.keys(roofs)) {
    if (!roofs[key].pos.length) continue;
    const mesh = toMesh(roofs[key], roofMats[key]);
    mesh.name = `context-roofs-${key}`;
    group.add(mesh);
  }
  parent.add(group);

  // signage on a shortlist of large buildings
  for (const name of SIGN_NAMES) {
    const b = byName.get(name);
    if (!b) continue;
    const xs = b.p.map((p) => p[0]);
    const zs = b.p.map((p) => p[1]);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const zMax = Math.max(...zs);
    const w = Math.max(...xs) - Math.min(...xs);
    const label = name.length > 7 ? name.slice(0, 7) : name;
    const sign = textPlane(label, {
      width: Math.min(28, Math.max(8, w * 0.55)),
      height: Math.min(28, Math.max(8, w * 0.55)) / Math.max(2, Array.from(label).length),
      texWidth: Math.max(256, Array.from(label).length * 256),
      texHeight: 256,
      font: '700 190px "Noto Serif CJK SC", "Source Han Serif SC", serif',
      color: '#4c4536',
      emissive: 0.06,
    });
    sign.position.set(cx, Math.min(b.h - 1.5, 16), zMax + 0.6);
    group.add(sign);
  }
  return group;
}
