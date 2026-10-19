import { CAMPUS } from './campus-data.js';

/**
 * Searchable directory of named buildings and sports grounds taken from OSM.
 * Also provides a camera framing for each entry.
 */

export const CATEGORY_LABELS = {
  landmark: '地标',
  college: '学院',
  canteen: '食堂',
  sport: '体育',
  teaching: '教学',
  research: '科研',
  dorm: '宿舍',
  service: '服务',
  other: '其他',
};

export const CATEGORY_ORDER = ['landmark', 'college', 'canteen', 'sport', 'teaching', 'research', 'dorm', 'service', 'other'];

// common department names for buildings whose OSM name is just a building number
const ALIASES = {
  先进制造大楼东楼: '机械科学与工程学院',
  先进制造大楼西楼: '机械科学与工程学院',
  计算机与人工智能大楼: '计算机科学与技术学院',
  光电信息大楼: '光学与电子信息学院',
  电气楼: '电气与电子工程学院',
  化学楼: '化学与化工学院',
  材料学院: '材料科学与工程学院',
  环境学院: '环境科学与工程学院',
  环境学院用房: '环境科学与工程学院',
  管理学院: '管理学院',
  经济学院: '经济学院',
  公共管理学院: '公共管理学院',
  清洁能源学科大楼: '能源与动力工程学院',
  南四楼: '建筑与城市规划学院',
  西六楼: '土木工程与力学学院',
  东六楼: '新闻与信息传播学院',
};

const CANTEEN = /食堂|餐厅|超市|市场|咖啡|茶餐厅/;
const SPORT = /体育馆|体育场|操场|田径|球场|游泳|体育|健身|操场/;
const COLLEGE = /学院|学部|系$/;
const DORM = /宿舍|舍$|公寓|苑|小区/;
const TEACHING = /教学楼|楼$|馆$|教室/;
const RESEARCH = /实验|研究|重点|国家|工程|科技|中心/;
const SERVICE = /处$|服务|营业厅|邮政|银行|驿站|物业|管理处|派出所|警务/;

function classify(name, alias) {
  if (alias) return 'college';
  if (SPORT.test(name)) return 'sport';
  if (CANTEEN.test(name)) return 'canteen';
  if (COLLEGE.test(name)) return 'college';
  if (RESEARCH.test(name)) return 'research';
  if (SERVICE.test(name)) return 'service';
  if (DORM.test(name)) return 'dorm';
  if (TEACHING.test(name)) return 'teaching';
  return 'other';
}

function centroidOf(ring) {
  let sx = 0;
  let sz = 0;
  for (const [x, z] of ring) {
    sx += x;
    sz += z;
  }
  return [sx / ring.length, sz / ring.length];
}

export function buildingDirectory() {
  const map = new Map();
  for (const b of CAMPUS.buildings) {
    const name = b.n;
    if (!name) continue;
    const xs = b.p.map((p) => p[0]);
    const zs = b.p.map((p) => p[1]);
    const w = Math.max(...xs) - Math.min(...xs);
    const d = Math.max(...zs) - Math.min(...zs);
    const c = centroidOf(b.p);
    if (map.has(name)) {
      const e = map.get(name);
      e.w = Math.max(e.w, w);
      e.d = Math.max(e.d, d);
      e.h = Math.max(e.h, b.h);
      e.count += 1;
    } else {
      map.set(name, {
        id: `b:${name}`,
        name,
        x: c[0],
        z: c[1],
        w,
        d,
        h: b.h,
        count: 1,
        kind: 'building',
      });
    }
  }

  // named sports grounds / greens
  for (const g of CAMPUS.greens) {
    const name = g.n;
    if (!name || !SPORT.test(name) || name.length < 3) continue;
    if (name.includes('中国地质大学')) continue;
    const xs = g.p.map((p) => p[0]);
    const zs = g.p.map((p) => p[1]);
    const w = Math.max(...xs) - Math.min(...xs);
    const d = Math.max(...zs) - Math.min(...zs);
    if (w * d < 2000) continue;
    const c = centroidOf(g.p);
    if (map.has(name)) continue;
    map.set(name, {
      id: `g:${name}`,
      name,
      x: c[0],
      z: c[1],
      w,
      d,
      h: 4,
      count: 1,
      kind: 'ground',
    });
  }

  const facilities = [...map.values()].map((f) => {
    const alias = ALIASES[f.name] || '';
    return {
      ...f,
      alias,
      category: classify(f.name, alias),
      area: Math.round(f.w * f.d),
    };
  });
  facilities.sort((a, b) => a.name.localeCompare(b.name, 'zh'));
  return facilities;
}

export const FACILITIES = buildingDirectory();

export const FACILITY_BY_ID = Object.fromEntries(FACILITIES.map((f) => [f.id, f]));

export function facilityView(f) {
  const size = Math.max(f.w || 20, f.d || 20);
  const dist = Math.max(90, Math.min(420, size * 1.8));
  const top = Math.max(30, Math.min(90, f.h * 1.6 + 20));
  return {
    pos: [f.x + dist * 0.5, top, f.z + dist * 0.95],
    target: [f.x, Math.min(22, 6 + f.h * 0.35), f.z],
  };
}

export function facilityDescription(f) {
  const bits = [];
  if (f.alias && f.alias !== f.name) bits.push(`常用名：${f.alias}`);
  if (f.kind === 'ground') bits.push('校园运动场地');
  else bits.push(`建筑基底约 ${f.area.toLocaleString()} m²`);
  bits.push(`坐标 x ${f.x.toFixed(0)} / z ${f.z.toFixed(0)}（米，原点 30.5175°N, 114.4130°E）`);
  return bits.join(' · ');
}
