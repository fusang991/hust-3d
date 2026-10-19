import * as THREE from 'three';

/**
 * Procedural sky dome, stars and the day / dusk / night lighting rig.
 * All values are interpolated, so switching presets fades smoothly.
 */

const PRESETS = {
  day: {
    sunDir: [0.55, 0.72, 0.42],
    sunColor: 0xfff2dc,
    sunIntensity: 2.9,
    hemiSky: 0xc3dcf3,
    hemiGround: 0x6c7654,
    hemiIntensity: 0.85,
    skyTop: 0x3f86d8,
    skyBottom: 0xdcebf6,
    sunTint: 0xfff4e2,
    fogColor: 0xd3e2ee,
    fogNear: 2400,
    fogFar: 9000,
    exposure: 1.0,
    night: 0,
    starOpacity: 0,
    waterColor: 0x255464,
  },
  dusk: {
    sunDir: [-0.72, 0.27, 0.34],
    sunColor: 0xffa15e,
    sunIntensity: 2.3,
    hemiSky: 0xa89cc0,
    hemiGround: 0x6b5b49,
    hemiIntensity: 1.15,
    skyTop: 0x2a3c6b,
    skyBottom: 0xf3a86b,
    sunTint: 0xffb271,
    fogColor: 0xd7a585,
    fogNear: 2000,
    fogFar: 8500,
    exposure: 1.16,
    night: 0.5,
    starOpacity: 0.05,
    waterColor: 0x2f4b58,
  },
  night: {
    sunDir: [0.46, 0.64, 0.36],
    sunColor: 0x9db6e2,
    sunIntensity: 1.25,
    hemiSky: 0x44608a,
    hemiGround: 0x303d30,
    hemiIntensity: 1.15,
    skyTop: 0x02060f,
    skyBottom: 0x152238,
    sunTint: 0x8ea6cf,
    fogColor: 0x0b1420,
    fogNear: 1800,
    fogFar: 8000,
    exposure: 1.55,
    night: 1,
    starOpacity: 0.95,
    waterColor: 0x0d1f2b,
  },
};

const SKY_VERT = /* glsl */ `
  varying vec3 vWorldPosition;
  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAG = /* glsl */ `
  uniform vec3 topColor;
  uniform vec3 bottomColor;
  uniform vec3 sunColor;
  uniform vec3 sunDir;
  uniform float nightMix;
  varying vec3 vWorldPosition;

  void main() {
    vec3 dir = normalize(vWorldPosition);
    float h = clamp(dir.y, -0.25, 1.0);
    float t = pow(max(h, 0.0), 0.52);
    vec3 col = mix(bottomColor, topColor, t);

    // horizon haze
    col = mix(col, mix(bottomColor, vec3(0.72, 0.76, 0.8), 0.25), pow(1.0 - max(h, 0.0), 6.0) * 0.35);

    vec3 sd = normalize(sunDir);
    float d = max(dot(dir, sd), 0.0);
    float glow = pow(d, 6.0);
    float disc = pow(d, 900.0);
    col += sunColor * (glow * 0.22 + disc * 2.2);

    // moon/stars are handled by a separate points cloud; keep the night sky deep
    col = mix(col, col * 0.85, nightMix * 0.2);
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function createSky(scene) {
  const uniforms = {
    topColor: { value: new THREE.Color(PRESETS.day.skyTop) },
    bottomColor: { value: new THREE.Color(PRESETS.day.skyBottom) },
    sunColor: { value: new THREE.Color(PRESETS.day.sunTint) },
    sunDir: { value: new THREE.Vector3().fromArray(PRESETS.day.sunDir).normalize() },
    nightMix: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(14000, 48, 24), material);
  sky.name = 'sky';
  sky.frustumCulled = false;
  scene.add(sky);
  return { sky, uniforms };
}

export function createStars(scene) {
  const count = 2200;
  const positions = new Float32Array(count * 3);
  let seed = 1;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < count; i++) {
    const u = rand();
    const v = rand() * 0.95 + 0.03; // keep above the horizon
    const theta = u * Math.PI * 2;
    const phi = Math.acos(v);
    const r = 13000;
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.cos(phi);
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xdfe9ff,
    size: 2.0,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    fog: false,
  });
  const stars = new THREE.Points(geo, mat);
  stars.name = 'stars';
  stars.frustumCulled = false;
  scene.add(stars);
  return stars;
}


function cloudTexture() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  let seed = 17;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < 26; i++) {
    const cx = size * (0.15 + rand() * 0.7);
    const cy = size * (0.3 + rand() * 0.4);
    const r = size * (0.06 + rand() * 0.16);
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    const a = 0.16 + rand() * 0.2;
    g.addColorStop(0, `rgba(255,255,255,${a})`);
    g.addColorStop(0.55, `rgba(250,250,252,${a * 0.6})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createClouds(scene) {
  const tex = cloudTexture();
  const group = new THREE.Group();
  group.name = 'clouds';
  let seed = 5;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < 16; i++) {
    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: false,
      color: 0xffffff,
    });
    const sprite = new THREE.Sprite(mat);
    const a = rand() * Math.PI * 2;
    const r = 2800 + rand() * 3800;
    sprite.position.set(Math.cos(a) * r, 900 + rand() * 900, Math.sin(a) * r);
    const s = 1300 + rand() * 1500;
    sprite.scale.set(s, s * 0.55, 1);
    group.add(sprite);
  }
  scene.add(group);
  return group;
}


/** Render the procedural sky into a small PMREM cube for image-based lighting. */
function buildEnvironment(renderer, skyMesh) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tempScene = new THREE.Scene();
  const clone = new THREE.Mesh(skyMesh.geometry, skyMesh.material);
  clone.frustumCulled = false;
  tempScene.add(clone);
  const target = pmrem.fromScene(tempScene, 0.02, 1, 20000);
  pmrem.dispose();
  return target;
}

export class LightingRig {
  constructor(scene, renderer, { sky, skyMesh, stars, clouds = null, lampMaterials = [], facadeMaterials = [], waterMaterials = [] }) {
    this.scene = scene;
    this.renderer = renderer;
    this.uniforms = sky.uniforms;
    this.skyMesh = skyMesh;
    this.stars = stars;
    this.clouds = clouds;
    this.lampMaterials = lampMaterials;
    this.facadeMaterials = facadeMaterials;
    this.waterMaterials = waterMaterials;
    this.mode = 'day';

    this.sun = new THREE.DirectionalLight(0xffffff, 2.9);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(4096, 4096);
    this.sun.shadow.camera.left = -1900;
    this.sun.shadow.camera.right = 1900;
    this.sun.shadow.camera.top = 1900;
    this.sun.shadow.camera.bottom = -1900;
    this.sun.shadow.camera.near = 10;
    this.sun.shadow.camera.far = 7000;
    this.sun.shadow.bias = -0.0003;
    this.sun.shadow.normalBias = 0.8;
    scene.add(this.sun);
    scene.add(this.sun.target);

    // soft bounce from the opposite side, keeps shaded facades readable
    this.fill = new THREE.DirectionalLight(0xbfd4e8, 0.35);
    this.fill.position.set(-2000, 900, -1500);
    scene.add(this.fill);

    this.hemi = new THREE.HemisphereLight(0xc3dcf3, 0x6c7654, 0.85);
    scene.add(this.hemi);

    this.ambient = new THREE.AmbientLight(0x9db4d4, 0.1);
    scene.add(this.ambient);

    // a handful of warm pools of light along the busiest paths (night only)
    this.pools = [
      [0, 8, 34],
      [0, 8, 150],
      [0, 8, -88],
      [-200, 8, 20],
      [210, 8, 20],
    ].map(([x, y, z]) => {
      const light = new THREE.PointLight(0xffd9a0, 0, 130, 2);
      light.position.set(x, y, z);
      scene.add(light);
      return light;
    });

    this.fog = new THREE.Fog(0xd3e2ee, 950, 3200);
    scene.fog = this.fog;

    this.cur = clonePreset(PRESETS.day);
    this.tgt = clonePreset(PRESETS.day);
    this.start = clonePreset(PRESETS.day);
    this.progress = 1;
    this.transitionStart = 0;
    this.duration = 1.5;
    this.apply();

    // image based light from the sky; rebuilt when the time of day changes
    this.envTarget = null;
    this.envDirty = false;
    if (this.skyMesh) this.refreshEnvironment();
  }

  setMode(name, instant = false) {
    if (!PRESETS[name]) return;
    this.mode = name;
    this.tgt = clonePreset(PRESETS[name]);
    if (instant) {
      this.cur = clonePreset(PRESETS[name]);
      this.start = clonePreset(PRESETS[name]);
      this.progress = 1;
      this.envDirty = false;
      this.apply();
      this.refreshEnvironment();
    } else {
      this.start = clonePreset(this.cur);
      this.progress = 0;
      this.transitionStart = performance.now();
      this.envDirty = true;
    }
  }

  refreshEnvironment() {
    if (!this.skyMesh) return;
    try {
      const old = this.envTarget;
      this.envTarget = buildEnvironment(this.renderer, this.skyMesh);
      this.scene.environment = this.envTarget.texture;
      this.envDirty = false;
      if (old) old.dispose();
    } catch (err) {
      console.warn('environment map failed', err);
    }
  }

  update() {
    if (this.progress < 1) {
      // wall-clock based so the fade lasts the same time at any frame rate
      const elapsed = performance.now() - this.transitionStart;
      const t = Math.min(1, elapsed / (this.duration * 1000));
      this.progress = t;
      const a = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      this.cur.sunDir.lerpVectors(this.start.sunDir, this.tgt.sunDir, a);
      for (const key of [
        'sunIntensity',
        'hemiIntensity',
        'fogNear',
        'fogFar',
        'exposure',
        'night',
        'starOpacity',
      ]) {
        this.cur[key] = this.start[key] + (this.tgt[key] - this.start[key]) * a;
      }
      for (const key of ['sunColor', 'hemiSky', 'hemiGround', 'skyTop', 'skyBottom', 'sunTint', 'fogColor', 'waterColor']) {
        this.cur[key].copy(this.start[key]).lerp(this.tgt[key], a);
      }
    }

    this.apply();

    if (this.envDirty && this.progress >= 1) {
      this.refreshEnvironment();
    }
  }

  apply() {
    const c = this.cur;
    const dir = c.sunDir.clone().normalize();
    this.sun.position.copy(dir).multiplyScalar(2600);
    this.sun.target.position.set(-200, 0, 100);
    this.sun.color.copy(c.sunColor);
    this.sun.intensity = c.sunIntensity;
    this.fill.intensity = 0.12 + c.hemiIntensity * 0.3;
    this.fill.color.copy(c.hemiSky);
    this.hemi.color.copy(c.hemiSky);
    this.hemi.groundColor.copy(c.hemiGround);
    this.hemi.intensity = c.hemiIntensity;
    this.ambient.intensity = 0.1 + c.night * 0.4;

    this.fog.color.copy(c.fogColor);
    this.fog.near = c.fogNear;
    this.fog.far = c.fogFar;

    this.uniforms.topColor.value.copy(c.skyTop);
    this.uniforms.bottomColor.value.copy(c.skyBottom);
    this.uniforms.sunColor.value.copy(c.sunTint);
    this.uniforms.sunDir.value.copy(dir);
    this.uniforms.nightMix.value = c.night;

    this.stars.material.opacity = c.starOpacity;
    if (this.clouds) {
      const cloudOpacity = this.mode === 'day' ? 0.62 : this.mode === 'dusk' ? 0.5 : 0.08;
      for (const sprite of this.clouds.children) {
        sprite.material.opacity = cloudOpacity;
        sprite.material.color.copy(c.skyTop).lerp(new THREE.Color(0xffffff), 0.85);
      }
    }

    for (const m of this.facadeMaterials) {
      m.emissiveIntensity = c.night * 1.1;
    }
    for (const m of this.lampMaterials) {
      m.emissiveIntensity = c.night * 4.2;
    }
    for (const light of this.pools) {
      light.intensity = c.night * 2600;
    }
    for (const m of this.waterMaterials) {
      m.color.copy(c.waterColor);
      if (m.emissive) {
        m.emissive.setHex(0x14303f);
        m.emissiveIntensity = c.night * 0.55;
      }
    }
    this.renderer.toneMappingExposure = c.exposure;
  }
}

function clonePreset(p) {
  return {
    ...p,
    sunDir: new THREE.Vector3().fromArray(p.sunDir).normalize(),
    sunColor: new THREE.Color(p.sunColor),
    hemiSky: new THREE.Color(p.hemiSky),
    hemiGround: new THREE.Color(p.hemiGround),
    skyTop: new THREE.Color(p.skyTop),
    skyBottom: new THREE.Color(p.skyBottom),
    sunTint: new THREE.Color(p.sunTint),
    fogColor: new THREE.Color(p.fogColor),
    waterColor: new THREE.Color(p.waterColor),
  };
}
