/* Scroll-driven particle stage shared by the cinematic pages.
 *
 * One cloud of points is poured from shape to shape ("formations") as the
 * reader scrolls through a tall story element. A page supplies:
 *   - build(n, rand): the formations, each an exact list of n points and tones
 *   - stations: [{ p, f, cam, look, fov, drift, turb, pulse, fade }] where p is
 *     scroll progress (0..1 over the story) and f the formation shown there
 * Captions use data-cue="in full out gone" (progress values) and fade with
 * scroll. Labels pinned to the scene use data-anchor="x y z" plus data-cue.
 * Without WebGL the page gets html.static and shows everything as plain text.
 */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.min.js';

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

export function rng(seed) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const gauss = (r) => { let u = 0; while (u === 0) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); };

/* Tones every formation can use. */
export const T = { DIM: 0, DATA: 1, ACCENT: 2, AMBER: 3, BLUE: 4, GHOST: 5, EMBER: 6 };
const COLORS = ['#7c7c88', '#e4e4e7', '#ff6a3d', '#ffb347', '#5b9cf0', '#3b3b44', '#ff6a3d'];
const ALPHAS = [0.5, 0.85, 1.0, 1.0, 0.9, 0.22, 0.3];
const SIZES = [0.85, 1.0, 1.35, 1.3, 1.05, 0.8, 0.9];

/* ---------------------------------------------------------------------------
   Formations
   --------------------------------------------------------------------------- */
export class Formation {
  constructor(n) {
    this.n = n;
    this.k = 0;
    this.pos = new Float32Array(n * 3);
    this.tone = new Float32Array(n);
  }
  get full() { return this.k >= this.n; }
  get left() { return this.n - this.k; }
  put(x, y, z, tone) {
    if (this.k >= this.n) return false;
    const i = this.k++;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.tone[i] = tone;
    return true;
  }
  /* Faint far-away specks behind the scene; used for every leftover point. */
  dust(r, tone = T.GHOST) {
    while (!this.full) {
      this.put((r() * 2 - 1) * 70, (r() * 2 - 1) * 40, -25 - r() * 70, r() < 0.06 ? T.DIM : tone);
    }
  }
  /* Sort by x (plus a little noise) so a morph sweeps left to right instead of scrambling. */
  sortByX(r) {
    const n = this.n, idx = new Array(n), key = new Float32Array(n);
    for (let i = 0; i < n; i++) { idx[i] = i; key[i] = this.pos[i * 3] + gauss(r) * 1.5; }
    idx.sort((a, b) => key[a] - key[b]);
    const p = new Float32Array(n * 3), t = new Float32Array(n);
    idx.forEach((j, i) => { p[i * 3] = this.pos[j * 3]; p[i * 3 + 1] = this.pos[j * 3 + 1]; p[i * 3 + 2] = this.pos[j * 3 + 2]; t[i] = this.tone[j]; });
    this.pos = p; this.tone = t;
    return this;
  }
}

/* Raw data: uneven clusters of points in a wide volume, a few of them lit. */
export function rawCloud(n, r, { spread = 22, clusters = 46, accentAt = null } = {}) {
  const f = new Formation(n);
  const centres = Array.from({ length: clusters }, () => ({
    x: gauss(r) * spread * 0.55, y: gauss(r) * spread * 0.28, z: gauss(r) * spread * 0.45 - 4,
    s: 0.6 + r() * 2.6, w: 0.3 + r() * r() * 2,
    tone: r() < 0.1 ? T.BLUE : T.DATA,
  }));
  const wSum = centres.reduce((a, c) => a + c.w, 0);
  if (accentAt) {
    for (let i = 0; i < 260; i++) f.put(accentAt[0] + gauss(r) * 0.35, accentAt[1] + gauss(r) * 0.2, accentAt[2] + gauss(r) * 0.3, T.ACCENT);
  }
  const clustered = Math.floor(f.left * 0.72);
  for (let i = 0; i < clustered; i++) {
    let pick = r() * wSum, c = centres[0];
    for (const cc of centres) { pick -= cc.w; if (pick <= 0) { c = cc; break; } }
    const tone = r() < 0.45 ? c.tone : (r() < 0.985 ? T.DIM : (r() < 0.6 ? T.ACCENT : T.AMBER));
    f.put(c.x + gauss(r) * c.s, c.y + gauss(r) * c.s * 0.7, c.z + gauss(r) * c.s, tone);
  }
  const loose = Math.floor(f.left * 0.8);
  for (let i = 0; i < loose; i++) {
    f.put(gauss(r) * spread * 0.7, gauss(r) * spread * 0.35, gauss(r) * spread * 0.6 - 4, r() < 0.8 ? T.DIM : T.DATA);
  }
  f.dust(r);
  return f.sortByX(r);
}

/* A spreadsheet seen from the front: rows of short dashes running down and away,
   one row lit in the accent colour. cols = relative column widths. */
export function table(n, r, { cols, width = 26, top = 4.2, rowH = 0.95, lit = 2, litTone = T.ACCENT, header = true } = {}) {
  const f = new Formation(n);
  const total = cols.reduce((a, b) => a + b, 0);
  const xs = []; let acc = -width / 2;
  for (const c of cols) { const w = (c / total) * width; xs.push([acc + 0.25, acc + w - 0.35]); acc += w; }
  const dash = (x0, x1, y, z, count, tone, fill) => {
    const len = (x1 - x0) * fill;
    for (let i = 0; i < count; i++) f.put(x0 + r() * len, y + gauss(r) * 0.045, z + gauss(r) * 0.05, tone);
  };
  // the lit row first so it is never cut short
  const litY = top - lit * rowH;
  xs.forEach(([x0, x1]) => dash(x0, x1, litY, 0.25, 64, litTone, 0.55 + r() * 0.4));
  if (header) xs.forEach(([x0, x1]) => dash(x0, x1, top + rowH * 0.9, 0, 36, T.DATA, 0.8));
  let row = 0;
  while (f.left > n * 0.1) {
    if (row === lit) { row++; continue; }
    const y = top - row * rowH;
    const z = -row * 0.18;
    xs.forEach(([x0, x1], c) => {
      const fill = 0.25 + r() * 0.65;
      const count = Math.max(4, Math.round(10 * fill * (x1 - x0) / 2));
      dash(x0, x1, y, z, count, row < 14 && r() < 0.5 ? T.DATA : T.DIM, fill);
    });
    row++;
  }
  f.dust(r);
  return f.sortByX(r);
}

/* Area under a series: x spread over [x0, x1], heights scaled so max -> h.
   Points are spread evenly, so the area of ink tracks the numbers. */
export function areaPoints(count, r, values, { x0 = -13, x1 = 13, y0 = -5, h = 9, max = null } = {}) {
  const m = max ?? Math.max(...values);
  const n = values.length;
  const cdf = [0];
  for (let i = 0; i < n - 1; i++) cdf.push(cdf[i] + (values[i] + values[i + 1]) / 2);
  const total = cdf[n - 1];
  const out = [];
  for (let k = 0; k < count; k++) {
    const target = r() * total;
    let i = 0; while (i < n - 2 && cdf[i + 1] < target) i++;
    const t = r();
    const v = lerp(values[i], values[i + 1], t);
    const x = lerp(x0, x1, (i + t) / (n - 1));
    out.push([x, y0 + r() * (v / m) * h, gauss(r) * 0.25, (i + t) / (n - 1), v]);
  }
  return out;
}

/* ---------------------------------------------------------------------------
   Stage
   --------------------------------------------------------------------------- */
const VERT = /* glsl */`
attribute vec3 aTo;
attribute float aToneFrom;
attribute float aToneTo;
attribute float aSeed;
uniform float uMix, uTime, uDpr, uScale, uTurb, uDrift, uPulse, uFade;
uniform vec3 uColors[7];
uniform float uAlphas[7];
uniform float uSizes[7];
varying vec3 vColor;
varying float vAlpha;
vec3 swirl(vec3 p){ return vec3(sin(p.y * 1.3 + p.z * 0.7), sin(p.z * 1.1 + p.x * 0.9), sin(p.x * 1.2 + p.y * 0.8)); }
void main(){
  float st = aSeed * 0.4;
  float m = clamp((uMix - st) / 0.6, 0.0, 1.0);
  m = m * m * (3.0 - 2.0 * m);
  vec3 p = mix(position, aTo, m);
  p += swirl(p * 0.16 + aSeed * 12.0 + uTime * 0.12) * sin(m * 3.14159265) * uTurb;
  p += vec3(sin(uTime * 0.7 + aSeed * 61.0), cos(uTime * 0.55 + aSeed * 37.0), sin(uTime * 0.45 + aSeed * 23.0)) * uDrift;
  int tf = int(aToneFrom + 0.5);
  int tt = int(aToneTo + 0.5);
  vColor = mix(uColors[tf], uColors[tt], m);
  float a = mix(uAlphas[tf], uAlphas[tt], m);
  float s = mix(uSizes[tf], uSizes[tt], m);
  float pulse = pow(0.5 + 0.5 * sin(p.x * 0.55 - uTime * 2.2), 8.0) * uPulse;
  vColor += vColor * pulse * 0.9;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float depth = -mv.z;
  vAlpha = a * uFade * (0.8 + 0.2 * sin(uTime * 1.3 + aSeed * 80.0)) * (1.0 - smoothstep(70.0, 120.0, depth));
  gl_PointSize = clamp(uScale * s * (0.75 + 0.5 * fract(aSeed * 7.31)) / max(depth, 0.5), 0.6 * uDpr, 11.0 * uDpr);
}`;
const FRAG = /* glsl */`
varying vec3 vColor;
varying float vAlpha;
void main(){
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  float core = 1.0 - smoothstep(0.05, 0.5, d);
  gl_FragColor = vec4(vColor, vAlpha * core);
  #include <colorspace_fragment>
}`;

export function createStage({ canvas, story, build, stations, count, seed = 7, onFrame = null }) {
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'high-performance' });
  } catch (err) {
    root.classList.add('static');
    return null;
  }
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(dpr);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const small = Math.min(innerWidth, innerHeight) < 700;
  const N = count ?? (small ? 24000 : 42000);
  const rand = rng(seed);
  const formations = build(N, rand);

  const geo = new THREE.BufferGeometry();
  const aFrom = new THREE.BufferAttribute(new Float32Array(N * 3), 3).setUsage(THREE.DynamicDrawUsage);
  const aTo = new THREE.BufferAttribute(new Float32Array(N * 3), 3).setUsage(THREE.DynamicDrawUsage);
  const aToneFrom = new THREE.BufferAttribute(new Float32Array(N), 1).setUsage(THREE.DynamicDrawUsage);
  const aToneTo = new THREE.BufferAttribute(new Float32Array(N), 1).setUsage(THREE.DynamicDrawUsage);
  const seeds = new Float32Array(N);
  for (let i = 0; i < N; i++) seeds[i] = rand();
  geo.setAttribute('position', aFrom);
  geo.setAttribute('aTo', aTo);
  geo.setAttribute('aToneFrom', aToneFrom);
  geo.setAttribute('aToneTo', aToneTo);
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));

  const U = {
    uMix: { value: 0 }, uTime: { value: 0 }, uDpr: { value: dpr }, uScale: { value: 60 },
    uTurb: { value: 0 }, uDrift: { value: 0.1 }, uPulse: { value: 0 }, uFade: { value: 1 },
    uColors: { value: COLORS.map((c) => new THREE.Color(c)) },
    uAlphas: { value: ALPHAS }, uSizes: { value: SIZES },
  };
  const points = new THREE.Points(geo, new THREE.ShaderMaterial({
    uniforms: U, vertexShader: VERT, fragmentShader: FRAG,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  points.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(points);
  const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 400);

  /* ---- which two formations are on screen ---- */
  let seg = -1;
  function setSegment(i) {
    if (i === seg) return;
    seg = i;
    const a = formations[stations[i].f];
    const b = formations[stations[Math.min(i + 1, stations.length - 1)].f];
    aFrom.array.set(a.pos); aTo.array.set(b.pos);
    aToneFrom.array.set(a.tone); aToneTo.array.set(b.tone);
    aFrom.needsUpdate = aTo.needsUpdate = aToneFrom.needsUpdate = aToneTo.needsUpdate = true;
  }
  const cr = (p0, p1, p2, p3, t) => {
    const t2 = t * t, t3 = t2 * t;
    return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
  };
  function segmentAt(P) {
    let i = 0;
    while (i < stations.length - 2 && P > stations[i + 1].p) i++;
    const s0 = stations[i], s1 = stations[Math.min(i + 1, stations.length - 1)];
    const t = s1.p > s0.p ? clamp((P - s0.p) / (s1.p - s0.p)) : 0;
    return { i, t, s0, s1 };
  }
  const vecAt = (key, i, t) => {
    const k0 = stations[Math.max(i - 1, 0)][key], k1 = stations[i][key];
    const k2 = stations[Math.min(i + 1, stations.length - 1)][key], k3 = stations[Math.min(i + 2, stations.length - 1)][key];
    return [0, 1, 2].map((j) => cr(k0[j], k1[j], k2[j], k3[j], t));
  };
  const num = (s, key, dflt) => (s[key] ?? dflt);

  /* ---- captions and pinned labels ---- */
  const cues = [...document.querySelectorAll('[data-cue]')].map((el) => {
    const [a, b, c, d] = el.dataset.cue.split(/\s+/).map(Number);
    const anchor = el.dataset.anchor ? el.dataset.anchor.split(/\s+/).map(Number) : null;
    return { el, a, b, c, d, anchor, last: -1 };
  });
  const pv = new THREE.Vector3();

  /* ---- scroll ---- */
  let storyTop = 0, span = 1, target = 0, prog = 0;
  function measure() {
    storyTop = story.getBoundingClientRect().top + scrollY;
    span = Math.max(1, story.offsetHeight - innerHeight);
  }
  function onScroll() { target = clamp((scrollY - storyTop) / span); }
  const portrait = () => clamp((1.5 - innerWidth / innerHeight) / 1.05);
  function resize() {
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    measure();
    onScroll();
  }
  addEventListener('resize', resize);
  addEventListener('scroll', onScroll, { passive: true });

  /* ---- a little parallax from the pointer on desktop ---- */
  let mx = 0, my = 0, pmx = 0, pmy = 0;
  if (!reduced && matchMedia('(pointer: fine)').matches) {
    addEventListener('pointermove', (e) => { mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5; });
  }

  /* ---- frame ---- */
  let last = performance.now(), time = 0, perfN = 0, perfSum = 0, perfRounds = 0;
  const right = new THREE.Vector3(), up = new THREE.Vector3();
  function frame(now) {
    const raw = Math.max(0, (now - last) / 1000);
    last = now;
    const dt = Math.min(0.05, raw);
    time += reduced ? dt * 0.25 : dt;
    prog += (target - prog) * (1 - Math.exp(-dt * (reduced ? 40 : 3.4)));
    if (Math.abs(target - prog) < 1e-5) prog = target;
    const P = prog;

    const { i, t, s0, s1 } = segmentAt(P);
    setSegment(i);
    U.uMix.value = s0.f === s1.f ? 0 : sstep(0.15, 0.85, t);
    U.uTurb.value = reduced ? 0 : num(s1, 'turb', 1.6);
    U.uDrift.value = reduced ? 0.02 : lerp(num(s0, 'drift', 0.06), num(s1, 'drift', 0.06), t);
    U.uPulse.value = lerp(num(s0, 'pulse', 0), num(s1, 'pulse', 0), t);
    U.uFade.value = lerp(num(s0, 'fade', 1), num(s1, 'fade', 1), t);
    U.uTime.value = time;

    const pr = portrait();
    const cam = vecAt('cam', i, t), look = vecAt('look', i, t);
    const baseFov = lerp(num(s0, 'fov', 42), num(s1, 'fov', 42), t);
    // narrow screens: widen the lens so a 26-unit-wide chart still fits
    const fov = 2 * Math.atan(Math.tan(baseFov * Math.PI / 360) * Math.max(1, 1.5 / camera.aspect)) * 180 / Math.PI;
    if (Math.abs(camera.fov - fov) > 0.01) camera.fov = fov;
    camera.updateProjectionMatrix();
    look[1] -= pr * lerp(num(s0, 'lift', 3), num(s1, 'lift', 3), t);
    // wide screens: slide the view sideways so a chart sits beside its caption
    const sh = lerp(num(s0, 'shift', 0), num(s1, 'shift', 0), t) * (1 - pr);
    cam[0] += sh; look[0] += sh;
    // tall screens: a chart doesn't share the width with its caption there, so come closer
    const chart = lerp(num(s0, 'shift', 0) ? 1 : 0, num(s1, 'shift', 0) ? 1 : 0, t);
    const zoom = 1 - 0.3 * pr * chart;
    for (let j = 0; j < 3; j++) cam[j] = look[j] + (cam[j] - look[j]) * zoom;
    camera.position.set(cam[0], cam[1], cam[2]);
    camera.lookAt(look[0], look[1], look[2]);
    pmx += (mx - pmx) * (1 - Math.exp(-dt * 3));
    pmy += (my - pmy) * (1 - Math.exp(-dt * 3));
    if (pmx || pmy) {
      right.setFromMatrixColumn(camera.matrix, 0);
      up.setFromMatrixColumn(camera.matrix, 1);
      camera.position.addScaledVector(right, pmx * 1.4).addScaledVector(up, -pmy * 0.9);
      camera.lookAt(look[0], look[1], look[2]);
    }
    camera.updateMatrixWorld();
    // pixels per world unit at distance 1
    U.uScale.value = 0.075 * innerHeight / (2 * Math.tan(camera.fov * Math.PI / 360)) * dpr;
    U.uDpr.value = dpr;

    for (const c of cues) {
      let o = sstep(c.a, c.b, P) * (1 - sstep(c.c, c.d, P));
      o = Math.round(o * 100) / 100;
      if (c.anchor && o > 0) {
        pv.set(c.anchor[0], c.anchor[1], c.anchor[2]).project(camera);
        const x = (pv.x * 0.5 + 0.5) * innerWidth, y = (-pv.y * 0.5 + 0.5) * innerHeight;
        c.el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;
        if (pv.z > 1) o = 0;
      }
      if (o === c.last) continue;
      c.last = o;
      c.el.style.opacity = o;
      if (!c.anchor) {
        c.el.style.transform = `translate3d(0,${((1 - o) * 22).toFixed(1)}px,0)`;
        c.el.style.filter = o > 0.99 ? 'none' : `blur(${((1 - o) * 6).toFixed(1)}px)`;
      }
      c.el.classList.toggle('live', o > 0.02);
    }
    if (onFrame) onFrame(P, api);
    renderer.render(scene, camera);

    // lower the pixel ratio once if real frames (not throttled ones) are slow
    if (perfRounds < 2 && raw < 0.1 && document.visibilityState === 'visible') {
      perfN++;
      if (perfN > 30) perfSum += raw;
      if (perfN === 150) {
        const avg = perfSum / 120;
        if (avg > 0.024 && dpr > 1) { dpr = Math.max(1, dpr - 0.5); renderer.setPixelRatio(dpr); }
        perfN = 0; perfSum = 0; perfRounds++;
      }
    }
  }

  const api = {
    progress: () => prog,
    /* scroll so the story sits at progress p */
    jump(p) { scrollTo({ top: storyTop + clamp(p) * span, behavior: reduced ? 'auto' : 'smooth' }); },
    project(x, y, z) {
      pv.set(x, y, z).project(camera);
      return [(pv.x * 0.5 + 0.5) * innerWidth, (-pv.y * 0.5 + 0.5) * innerHeight, pv.z];
    },
    measure,
  };

  resize();
  prog = target;
  setSegment(segmentAt(prog).i);
  renderer.compile(scene, camera);
  renderer.setAnimationLoop(frame);
  root.classList.remove('static');
  root.classList.add('stage-ready');
  return api;
}
