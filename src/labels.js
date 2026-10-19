import * as THREE from 'three';

const clamp = (n, a, b) => Math.min(b, Math.max(a, n));

/**
 * HTML landmark labels projected onto the 3D scene.
 * Labels are de-cluttered (nearest wins), clamped to the viewport and can be
 * clicked to fly the camera to a landmark.
 */
export class LabelManager {
  constructor(container, camera) {
    this.container = container;
    this.camera = camera;
    this.items = [];
    this.visible = true;
    this.activeId = null;
    this._v = new THREE.Vector3();
    this.safe = { left: 16, right: 16, top: 96, bottom: 74 };
    this.hiddenKinds = new Set();
  }

  add({ id, name, en, position, onClick, kind = 'landmark', maxDistance = 9000, category = '' }) {
    const el = document.createElement('button');
    el.className = kind === 'building' ? 'label label-mini' : 'label';
    if (category) el.classList.add(`cat-${category}`);
    el.type = 'button';
    el.innerHTML = `
      <span class="label-dot"></span>
      <span class="label-body">
        <span class="label-name">${name}</span>
        <span class="label-en">${en}</span>
      </span>`;
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick?.(id);
    });
    this.container.appendChild(el);
    const item = {
      id,
      el,
      kind,
      maxDistance,
      category,
      world: new THREE.Vector3().fromArray(position),
      baseWidth: el.offsetWidth || (kind === 'building' ? 84 : 110),
      baseHeight: el.offsetHeight || (kind === 'building' ? 26 : 34),
    };
    this.items.push(item);
    return item;
  }

  setKindVisible(kind, visible) {
    if (visible) this.hiddenKinds.delete(kind);
    else this.hiddenKinds.add(kind);
  }

  setVisible(v) {
    this.visible = v;
    this.container.classList.toggle('hidden', !v);
  }

  setActive(id) {
    this.activeId = id;
    for (const it of this.items) it.el.classList.toggle('active', it.id === id);
  }

  update(width, height) {
    if (!this.visible) return;
    const camPos = this.camera.position;
    const entries = [];

    for (const it of this.items) {
      if (this.hiddenKinds.has(it.kind)) continue;
      this._v.copy(it.world).project(this.camera);
      const dist = camPos.distanceTo(it.world);
      entries.push({
        it,
        inFront: this._v.z < 1,
        x: (this._v.x * 0.5 + 0.5) * width,
        y: (-this._v.y * 0.5 + 0.5) * height,
        dist,
        fade: clamp((7000 - dist) / 2200, 0, 1),
      });
    }

    // priority: active > landmarks > buildings, then distance
    const kindRank = (it) => (it.kind === 'landmark' ? 2 : 1);
    entries.sort((a, b) => {
      const aa = a.it.id === this.activeId ? 3 : kindRank(a.it);
      const bb = b.it.id === this.activeId ? 3 : kindRank(b.it);
      if (aa !== bb) return bb - aa;
      return a.dist - b.dist;
    });

    const placed = [];
    let buildingCount = 0;

    for (const e of entries) {
      const it = e.it;
      if (!e.inFront || e.fade <= 0.03 || e.dist > it.maxDistance) {
        it.el.style.opacity = '0';
        it.el.style.pointerEvents = 'none';
        continue;
      }

      // keep labels attached to what they name: off-screen anchors are hidden
      // rather than dragged into view
      if (e.x < -width * 0.08 || e.x > width * 1.08 || e.y < -height * 0.05 || e.y > height * 1.12) {
        it.el.style.opacity = '0';
        it.el.style.pointerEvents = 'none';
        continue;
      }

      const scale = clamp(1.2 - e.dist / 5200, 0.7, 1.06);
      const bw = it.baseWidth * scale;
      const bh = it.baseHeight * scale;
      const x = clamp(e.x, this.safe.left + bw / 2, width - this.safe.right - bw / 2);
      const y = clamp(e.y, this.safe.top + bh, height - this.safe.bottom);
      const rect = { l: x - bw / 2, r: x + bw / 2, t: y - bh, b: y };

      const collides = placed.some(
        (p) => !(rect.r < p.l - 6 || rect.l > p.r + 6 || rect.b < p.t - 4 || rect.t > p.b + 4)
      );
      if (collides && it.id !== this.activeId) {
        it.el.style.opacity = '0';
        it.el.style.pointerEvents = 'none';
        continue;
      }

      placed.push(rect);
      if (it.kind === 'building') {
        buildingCount++;
        if (buildingCount > 26) {
          it.el.style.opacity = '0';
          it.el.style.pointerEvents = 'none';
          continue;
        }
      }
      it.el.style.opacity = String(0.45 + e.fade * 0.55);
      it.el.style.pointerEvents = e.fade > 0.3 ? 'auto' : 'none';
      it.el.style.transform = `translate(-50%, -100%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${scale.toFixed(3)})`;
      it.el.style.zIndex = String(2000 - Math.round(e.dist));
    }
  }
}
