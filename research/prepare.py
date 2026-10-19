"""Build src/campus-data.js from the OpenStreetMap extract in research/*.json.

Map data (c) OpenStreetMap contributors, ODbL. Local frame: metres east (x)
and metres south (z) of (LAT0, LON0). North is -z.
"""
import json, math
from pathlib import Path

R = Path('research')
OUT = Path('src/campus-data.js')
LAT0, LON0 = 30.5175, 114.4130
KX = 111320 * math.cos(math.radians(LAT0))
KZ = 110574


def loc(lon, lat):
    return ((lon - LON0) * KX, -(lat - LAT0) * KZ)


def ring_area(ring):
    a = 0.0
    for i in range(len(ring) - 1):
        a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1]
    return abs(a) / 2


def ring_centroid(ring):
    n = len(ring) - 1 if ring[0] == ring[-1] else len(ring)
    return (sum(p[0] for p in ring[:n]) / n, sum(p[1] for p in ring[:n]) / n)


def rdp(points, tol):
    if len(points) < 3:
        return points

    def rec(pts):
        if len(pts) < 3:
            return pts
        x1, z1 = pts[0]
        x2, z2 = pts[-1]
        dx, dz = x2 - x1, z2 - z1
        ln = math.hypot(dx, dz) or 1e-9
        dmax, idx = -1.0, 0
        for i in range(1, len(pts) - 1):
            d = abs(dz * (pts[i][0] - x1) - dx * (pts[i][1] - z1)) / ln
            if d > dmax:
                dmax, idx = d, i
        if dmax > tol:
            return rec(pts[: idx + 1])[:-1] + rec(pts[idx:])
        return [pts[0], pts[-1]]

    out = rec(points)
    return out if len(out) >= 3 else points


def clean_ring(points, tol=1.2):
    pts = [(round(x, 1), round(z, 1)) for x, z in points]
    dedup = [pts[0]]
    for p in pts[1:]:
        if p != dedup[-1]:
            dedup.append(p)
    if dedup[0] != dedup[-1]:
        dedup.append(dedup[0])
    if len(dedup) < 4:
        return None
    simp = [tuple(p) for p in rdp(dedup[:-1], tol)]
    if len(simp) < 3:
        return None
    simp.append(simp[0])
    return simp


def chain_rings(ways, tol=1.2):
    """Join relation member ways that share endpoints into closed rings."""
    segs = [[(p[0], p[1]) for p in w] for w in ways if len(w) >= 2]
    used = [False] * len(segs)
    rings = []
    for i, seg in enumerate(segs):
        if used[i]:
            continue
        ring = list(seg)
        used[i] = True
        changed = True
        while changed:
            changed = False
            for j, t in enumerate(segs):
                if used[j]:
                    continue
                if ring[-1] == t[0]:
                    ring += t[1:]
                    used[j] = True
                    changed = True
                elif ring[-1] == t[-1]:
                    ring += list(reversed(t))[1:]
                    used[j] = True
                    changed = True
        rings.append(ring)
    return [r for r in (clean_ring(r, tol) for r in rings) if r]


# --------------------------------------------------------------- building metadata
DORM = ('宿舍', '舍', '公寓', '苑', '小区', '宅')
TEACH = ('教学楼', '楼', '学院', '学校', '附中', '小学', '幼儿园')
LAB = ('实验', '研究', '中心', '科技', '国家', '工程', '计算', '光谷')
SERVICE = ('食堂', '餐厅', '超市', '商店', '营业厅', '快递', '驿站', '银行', '邮政', '市场')

# names that get their own detailed model instead of a generic prism
DETAILED = {
    '主校区图书馆', '主校区图书馆新馆 逸夫图书馆', '主校区图书馆老馆',
    '东九教学楼', '西十二楼', '光谷体育馆', '醉晚亭', '修身楼',
    '新光电信息大楼', '南一楼',
}


def height_for(name, btype, levels, height, area):
    if height:
        try:
            return float(str(height).replace('m', '').strip())
        except ValueError:
            pass
    if levels:
        try:
            return float(str(levels).split(';')[0]) * 3.4
        except ValueError:
            pass
    if '图书馆' in name:
        return 28
    if '高层' in name or btype == 'apartments':
        return 34
    if any(w in name for w in ('食堂', '餐厅')):
        return 11
    if any(w in name for w in ('亭', '门卫', '警卫', '警务', '公厕')):
        return 5
    if any(w in name for w in DORM) or btype in ('dormitory', 'residential'):
        return 20
    if btype in ('school', 'university', 'college'):
        return 21
    if btype in ('commercial', 'retail', 'office', 'hotel'):
        return 26
    if btype == 'hospital':
        return 24
    if area < 120:
        return 5
    if area < 400:
        return 8
    if area < 1200:
        return 12
    if area < 3000:
        return 17
    if area < 8000:
        return 21
    return 26


def style_for(name, btype, area):
    if any(w in name for w in ('实验', '研究', '国家', '光电', '工程', '科技')):
        return 'lab'
    if any(w in name for w in DORM) or btype in ('dormitory', 'residential', 'apartments'):
        return 'dorm'
    if any(w in name for w in SERVICE):
        return 'brick'
    if any(w in name for w in ('教学楼', '楼')) or btype in ('school', 'university', 'college'):
        return 'concrete'
    if btype in ('commercial', 'retail', 'office', 'hotel'):
        return 'glass'
    if area > 5000:
        return 'concrete'
    return 'brick' if area < 900 else 'stone'


# campus extents used as a soft filter (the OSM boundary polygon is unreliable)
CAMPUS_BOX = (-1820, 1850, -1180, 1160)  # xmin, xmax, zmin, zmax
CUG_BOX = (-2400, -1200, -1400, -120)    # 中国地质大学 is not part of HUST


def in_box(x, z, box):
    return box[0] <= x <= box[1] and box[2] <= z <= box[3]


def in_cug(x, z):
    return in_box(x, z, CUG_BOX)


# --------------------------------------------------------------- buildings
raw = json.load(open(R / 'buildings_all.json'))['elements']
rel_geom = {e['id']: e for e in json.load(open(R / 'relations_geom.json'))['elements']}

buildings = []
seen = set()
landmarks = {}


def add_building(name, btype, ring, levels=None, height=None):
    c = ring_centroid(ring)
    area = ring_area(ring)
    if area < 25:
        return
    if not in_box(c[0], c[1], CAMPUS_BOX) or in_cug(c[0], c[1]):
        return
    key = (name, round(c[0] / 3), round(c[1] / 3))
    if key in seen:
        return
    seen.add(key)
    h = height_for(name, btype, levels, height, area)
    # deterministic variation so long rows are not identical
    hv = (math.sin(c[0] * 0.017 + c[1] * 0.031) + 1) / 2
    if name not in DETAILED and not levels and not height:
        h *= 0.72 + hv * 0.55
    s = style_for(name, btype, area)
    if name == '' and hv > 0.72:
        s = 'stone' if hv > 0.86 else 'brick'
    buildings.append({'n': name, 's': s, 'h': round(h, 1),
                      'p': [[round(x, 1), round(z, 1)] for x, z in ring]})
    if name in DETAILED:
        xs = [p[0] for p in ring]
        zs = [p[1] for p in ring]
        landmarks[name] = {'x': round(c[0], 1), 'z': round(c[1], 1),
                           'w': round(max(xs) - min(xs), 1), 'd': round(max(zs) - min(zs), 1),
                           'height': round(h, 1)}


for el in raw:
    t = el.get('tags', {})
    name = t.get('name', '')
    btype = t.get('building', 'yes')
    if el['type'] == 'way':
        geom = el.get('geometry') or []
        if len(geom) < 3:
            continue
        ring = clean_ring([loc(p['lon'], p['lat']) for p in geom])
        if ring:
            add_building(name, btype, ring, t.get('building:levels'), t.get('height'))
    elif el['type'] == 'relation' and not el.get('members'):
        rel = rel_geom.get(el['id'])
        if not rel:
            continue
        ways = []
        for m in rel.get('members', []):
            if m.get('geometry'):
                ways.append([loc(p['lon'], p['lat']) for p in m['geometry']])
        for ring in chain_rings(ways):
            add_building(name, btype, ring, t.get('building:levels'), t.get('height'))

print('buildings:', len(buildings), 'detailed landmarks found:', list(landmarks))

# --------------------------------------------------------------- roads
raw = json.load(open(R / 'roads.json'))['elements']
WIDTH = {'trunk': 26, 'primary': 24, 'secondary': 18, 'tertiary': 14, 'unclassified': 9,
         'residential': 9, 'living_street': 6, 'pedestrian': 8, 'service': 5,
         'footway': 2.6, 'cycleway': 2.6}
SKIP_NAMES = ('隧道', '高架', '通道', '天桥', '电梯', '步行街', '转盘')
MAIN_ROADS = ('珞喻路', '珞喻东路', '珞瑜路', '喻家湖路', '喻家湖东路', '喻园大道', '醉晚路',
              '华中路', '紫荆路', '启明路', '北一路', '南一路', '东一路', '东二路', '东三路',
              '南三路', '喻家路', '文园路', '木香路', '湖溪路')

roads = []
traffic_pts = []
for el in raw:
    t = el.get('tags', {})
    cls = t.get('highway')
    name = t.get('name', '')
    if cls not in WIDTH or any(k in name for k in SKIP_NAMES):
        continue
    geom = el.get('geometry') or []
    if len(geom) < 2:
        continue
    pts = [loc(p['lon'], p['lat']) for p in geom]
    xs = [p[0] for p in pts]
    zs = [p[1] for p in pts]
    if not (max(xs) > CAMPUS_BOX[0] - 120 and min(xs) < CAMPUS_BOX[1] + 120
            and max(zs) > CAMPUS_BOX[2] - 120 and min(zs) < CAMPUS_BOX[3] + 220):
        continue
    if name not in MAIN_ROADS and cls in ('trunk', 'primary'):
        continue
    simp = [(round(x, 1), round(z, 1)) for x, z in rdp(pts, 2.5)]
    if len(simp) < 2:
        continue
    w = WIDTH[cls]
    if t.get('lanes'):
        try:
            w = max(w, float(t['lanes']) * 3.4 + 4)
        except ValueError:
            pass
    roads.append({'n': name, 'c': cls, 'w': round(w, 1), 'p': [list(p) for p in simp]})
    if name in ('珞喻路', '珞喻东路', '珞瑜路'):
        for x, z in pts:
            if 820 < z < 1120 and -1700 < x < 1750:
                traffic_pts.append((x, z))
print('roads:', len(roads), 'traffic points:', len(traffic_pts))

# --------------------------------------------------------------- water
raw = json.load(open(R / 'water.json'))['elements']
waters = []
for el in raw:
    name = el.get('tags', {}).get('name', '')
    geom = el.get('geometry') or []
    if len(geom) < 3:
        continue
    pts = [loc(p['lon'], p['lat']) for p in geom]
    xs = [p[0] for p in pts]
    zs = [p[1] for p in pts]
    if max(xs) < -2400 or min(xs) > 2600 or max(zs) < -2400 or min(zs) > 1800:
        continue
    if (max(xs) - min(xs)) > 5000 or (max(zs) - min(zs)) > 5000:
        continue  # skip the whole East Lake polygon, too large to model meaningfully
    ring = clean_ring(pts, 1.8)
    if ring:
        waters.append({'n': name, 'p': [[round(x, 1), round(z, 1)] for x, z in ring]})
# large lakes mapped as relations
try:
    relw = json.load(open(R / 'water_rel2.json'))['elements']
except Exception:
    relw = []
for el in relw:
    name = el.get('tags', {}).get('name', '')
    ways = []
    for m in el.get('members', []):
        if m.get('geometry'):
            ways.append([loc(p['lon'], p['lat']) for p in m['geometry']])
    for ring in chain_rings(ways, 2.0):
        waters.append({'n': name, 'p': [[round(x, 1), round(z, 1)] for x, z in ring]})

# drop duplicate / nested water rings (same lake mapped as way and relation)
def w_centroid(ring):
    n = len(ring) - 1 if ring[0] == ring[-1] else len(ring)
    return (sum(p[0] for p in ring[:n]) / n, sum(p[1] for p in ring[:n]) / n)

unis = []
for w in waters:
    c = w_centroid(w['p'])
    dup = False
    for u in unis:
        uc = w_centroid(u['p'])
        if math.hypot(c[0] - uc[0], c[1] - uc[1]) < 6 and abs(ring_area(w['p']) - ring_area(u['p'])) / max(1, ring_area(u['p'])) < 1.5:
            dup = True
            break
    if not dup:
        unis.append(w)
waters = unis
print('waters:', len(waters), [w['n'] for w in waters if w['n']][:12])

# --------------------------------------------------------------- green / sport
raw = json.load(open(R / 'green_geom.json'))['elements']
greens = []
peaks = []
hill = None
for el in raw:
    t = el.get('tags', {})
    if el['type'] == 'node':
        if t.get('natural') == 'peak':
            x, z = loc(el['lon'], el['lat'])
            peaks.append({'n': t.get('name', ''), 'x': round(x, 1), 'z': round(z, 1), 'ele': t.get('ele')})
        continue
    geom = el.get('geometry') or []
    if len(geom) < 3:
        continue
    pts = [loc(p['lon'], p['lat']) for p in geom]
    xs = [p[0] for p in pts]
    zs = [p[1] for p in pts]
    if max(xs) < -2400 or min(xs) > 2600 or max(zs) < -2200 or min(zs) > 1600:
        continue
    kind = t.get('leisure') or t.get('natural') or t.get('landuse')
    ring = clean_ring(pts, 2.0)
    if not ring:
        continue
    if t.get('natural') == 'hill' and t.get('name') == '喻家山':
        hill = ring
        continue
    greens.append({'k': kind, 'n': t.get('name', ''), 'p': [[round(x, 1), round(z, 1)] for x, z in ring]})
print('greens:', len(greens), 'hill pts:', len(hill or []))

# --------------------------------------------------------------- gates
raw = json.load(open(R / 'gates_all.json'))['elements']
gates = []
for el in raw:
    t = el.get('tags', {})
    name = t.get('name', '')
    if not name or any(k in name for k in ('地大', '中国地质', '喻家山庄', '南望山', '驿站', '东门')):
        continue
    lat = el.get('lat') or (el.get('center') or {}).get('lat')
    lon = el.get('lon') or (el.get('center') or {}).get('lon')
    if lat is None or lon is None:
        continue
    x, z = loc(lon, lat)
    if not in_box(x, z, CAMPUS_BOX) or in_cug(x, z):
        continue
    gates.append({'n': name, 'x': round(x, 1), 'z': round(z, 1)})
# de-duplicate gates that share a name/location
uniq = []
for g in gates:
    if not any(abs(g['x'] - u['x']) < 60 and abs(g['z'] - u['z']) < 60 and g['n'] == u['n'] for u in uniq):
        uniq.append(g)
gates = uniq
# manual additions from the campus guide where OSM has no named node
for extra in [
    {'n': '南四门', 'x': -154.0, 'z': 855.0},
    {'n': '东北门', 'x': 860.0, 'z': -344.0},
]:
    if not any(abs(extra['x'] - g['x']) < 80 and abs(extra['z'] - g['z']) < 80 for g in gates):
        gates.append(extra)
print('gates:', [(g['n'], round(g['x']), round(g['z'])) for g in gates])

data = {
    'origin': {'lat': LAT0, 'lon': LON0},
    'box': CAMPUS_BOX,
    'buildings': buildings,
    'roads': roads,
    'traffic': [[round(x, 1), round(z, 1)] for x, z in sorted(traffic_pts)],
    'waters': waters,
    'greens': greens,
    'peaks': peaks,
    'hillPoly': [list(p) for p in (hill or [])],
    'gates': gates,
    'landmarks': landmarks,
}
OUT.write_text('// Generated by research/prepare.py from OpenStreetMap data.\n'
               '// Map data (c) OpenStreetMap contributors, ODbL.\n'
               'export const CAMPUS = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n')
print('wrote', OUT, OUT.stat().st_size, 'bytes')
