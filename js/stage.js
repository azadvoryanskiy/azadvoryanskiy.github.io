// The 3D stage: five glass panels, one per project, lit from behind in volt.
// Everything here is a pure function of one number, the scroll position in
// "units" (see main.js), so scrolling back and forth always lands on the same frame.

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/addons/RoomEnvironment.js";
import { drawFront, drawBack } from "./screens.js";

const PANEL_W = 3;
const PANEL_H = 4;
const PANEL_D = 0.14;
const FOV = 30;
const CAM_Z = 20;

// Heavy, symmetric ease from DESIGN.md: cubic-bezier(0.65, 0, 0.35, 1) is close to this.
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const lerp = (a, b, t) => a + (b - a) * t;
const KEYS = ["x", "y", "z", "rx", "ry", "rz", "s"];

function mix(a, b, t) {
  const out = {};
  for (const k of KEYS) out[k] = lerp(a[k], b[k], t);
  return out;
}

// A track is a list of [unit, pose]; between two keys the pose eases from one to the next.
function sample(track, u) {
  if (u <= track[0][0]) return track[0][1];
  for (let i = 1; i < track.length; i++) {
    const [u1, p1] = track[i];
    if (u <= u1) {
      const [u0, p0] = track[i - 1];
      return mix(p0, p1, ease((u - u0) / (u1 - u0)));
    }
  }
  return track[track.length - 1][1];
}

export class Stage {
  constructor(canvas, screens, timing) {
    this.canvas = canvas;
    this.screens = screens;
    this.T = timing;
    this.pointer = { x: 0, y: 0, sx: 0, sy: 0 };

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.setClearColor(0x000000, 0);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x0a0a0a, 20, 40);
    this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
    this.camera.position.set(0, 0, CAM_Z);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    // Volt light from behind and to the left catches the rounded edges, like the
    // coloured light behind each can; a soft white key keeps the glass readable.
    const rim = new THREE.DirectionalLight(0xd6fa50, 5);
    rim.position.set(-5, 3, -6);
    const rim2 = new THREE.DirectionalLight(0xd6fa50, 2.5);
    rim2.position.set(6, -2, -5);
    const key = new THREE.DirectionalLight(0xffffff, 0.5);
    key.position.set(4, 6, 10);
    this.scene.add(rim, rim2, key);

    this.body = new RoundedBoxGeometry(PANEL_W, PANEL_H, PANEL_D, 6, 0.16);
    this.glass = new THREE.MeshPhysicalMaterial({
      color: 0x0b0b0b, metalness: 0.35, roughness: 0.18,
      clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 0.55,
    });
    this.panels = [];
    this.resize();
  }

  async build() {
    await Promise.all([
      document.fonts.load("900 100px Unbounded"),
      document.fonts.load("600 30px Onest"),
      document.fonts.load("400 24px Onest"),
    ]);
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    const texture = (canvas) => {
      const t = new THREE.CanvasTexture(canvas);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = Math.min(8, maxAniso);
      return t;
    };
    const faceGeo = new THREE.PlaneGeometry(PANEL_W - 0.08, PANEL_H - 0.08);
    const fronts = await Promise.all(this.screens.map(drawFront));
    this.screens.forEach((screen, i) => {
      const group = new THREE.Group();
      group.add(new THREE.Mesh(this.body, this.glass));
      const front = new THREE.Mesh(faceGeo, new THREE.MeshBasicMaterial({ map: texture(fronts[i]), transparent: true, toneMapped: false }));
      front.position.z = PANEL_D / 2 + 0.003;
      const back = new THREE.Mesh(faceGeo, new THREE.MeshBasicMaterial({ map: texture(drawBack(screen)), transparent: true, toneMapped: false }));
      back.position.z = -PANEL_D / 2 - 0.003;
      back.rotation.y = Math.PI;
      group.add(front, back);
      group.userData.phase = i * 1.37;
      this.scene.add(group);
      this.panels.push(group);
    });
    this.layout();
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.w = w;
    this.h = h;
    if (this.panels.length) this.layout();
  }

  // Half the visible height and width of the world at depth z.
  half(z = 0) {
    const hh = (CAM_Z - z) * Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    return { hh, hw: hh * this.camera.aspect };
  }

  // Poses depend on the screen shape, so they are rebuilt on every resize.
  layout() {
    const { hh, hw } = this.half(0);
    const phone = this.camera.aspect < 0.8;
    const n = this.panels.length;
    const T = this.T;
    const tilt = [0.07, -0.05, 0.02, 0.06, -0.08];

    const row = (i) => {
      const k = i - (n - 1) / 2;
      if (phone) {
        return { x: k * 0.95, y: hh * 0.2, z: -Math.abs(k) * 1.4 + (k === 0 ? 0.6 : 0), rx: 0.02, ry: -k * 0.42, rz: tilt[i] * 0.6, s: 0.62 };
      }
      // Five columns to match the row of skills under them.
      const col = (hw * 2 * 0.88) / n;
      return { x: k * col, y: hh * 0.2, z: -Math.abs(k) * 0.9 + (k === 0 ? 0.9 : 0), rx: 0.03, ry: -k * 0.13, rz: tilt[i], s: Math.min(0.64, col / PANEL_W * 0.8) };
    };
    const focus = phone
      ? { x: 0, y: hh * 0.33, z: 1.5, rx: 0.05, ry: -0.3, rz: -0.03, s: 0.86 }
      : { x: hw * 0.36, y: -0.1, z: 2.6, rx: 0.04, ry: -0.34, rz: -0.03, s: 1.48 };
    const settled = { ...focus, ry: focus.ry + 0.16, rz: focus.rz + 0.02, y: focus.y + 0.12 };
    const shelf = (i) => ({ x: (phone ? 0 : hw * 0.55) + (i - 2) * 2.4, y: phone ? 4 : -0.6, z: phone ? -20 : -17, rx: 0, ry: 0.35, rz: tilt[i], s: 1 });
    // Leaving: a half turn to show the back, out to the left. Arriving: from the dark at
    // the back right, still turned away, landing as the last one clears.
    const gone = { x: -hw * 1.9, y: focus.y + 0.6, z: -3, rx: 0.1, ry: focus.ry - Math.PI * 1.15, rz: 0.12, s: focus.s };
    const coming = phone
      ? { x: hw * 0.9, y: focus.y, z: -4, rx: -0.04, ry: focus.ry + 1.2, rz: -0.08, s: focus.s }
      : { x: hw * 0.85, y: focus.y - 0.3, z: -3.5, rx: -0.04, ry: focus.ry + 1.0, rz: -0.08, s: focus.s };
    this.focusPose = focus;

    this.tracks = this.panels.map((_, i) => {
      const t = [[0, row(i)], [T.heroEnd, row(i)]];
      const start = T.sceneStart(i);
      if (i === 0) {
        t.push([start, focus]);
      } else {
        t.push([T.heroEnd + 0.7, shelf(i)]);
        t.push([start - T.swap * 0.85, shelf(i)]);
        t.push([start - T.swap * 0.4, coming]);
        t.push([start, focus]);
      }
      t.push([start + T.hold, settled]);
      if (i < n - 1) {
        t.push([start + T.hold + T.swap * 0.65, gone]);
        t.push([T.outroStart, gone]);
      }
      t.push([T.end, row(i)]);
      return t;
    });
  }

  // Where on screen (0..1) a pose's centre lands.
  screenOf(pose) {
    const v = new THREE.Vector3(pose.x, pose.y, pose.z).project(this.camera);
    return { x: (v.x + 1) / 2, y: (1 - v.y) / 2 };
  }

  setPointer(x, y) { this.pointer.x = x; this.pointer.y = y; }

  render(u, time, focusIndex) {
    const p = this.pointer;
    p.sx += (p.x - p.sx) * 0.06;
    p.sy += (p.y - p.sy) * 0.06;
    this.panels.forEach((g, i) => {
      const pose = sample(this.tracks[i], u);
      const ph = g.userData.phase;
      const bob = Math.sin(time * (Math.PI * 2 / 6) + ph) * 0.07;
      const sway = Math.sin(time * 0.45 + ph) * 0.035;
      const lean = i === focusIndex ? 1 : 0.3;          // the object leans towards the cursor, up to ~6°
      g.position.set(pose.x, pose.y + bob, pose.z);
      g.rotation.set(pose.rx + p.sy * 0.1 * lean, pose.ry + sway + p.sx * 0.1 * lean, pose.rz);
      g.scale.setScalar(pose.s);
    });
    this.renderer.render(this.scene, this.camera);
  }
}
