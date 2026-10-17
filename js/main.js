// Scroll drives one number, u, measured in "units" of scroll. The 3D panels, the
// giant word, the light and the text of each project are all functions of u.

import { SCREENS } from "./projects.js";

const root = document.documentElement;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// ---------- things that work with or without motion ----------
const clock = $("[data-clock]");
const fmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "America/Edmonton" });
const tick = () => { clock.textContent = fmt.format(new Date()); };
tick();
setInterval(tick, 20_000);

const bar = $(".bar");
const lights = $$("[data-light]");
function barColour() {
  const y = bar.offsetHeight / 2;
  const under = lights.find((s) => { const r = s.getBoundingClientRect(); return r.top <= y && r.bottom >= y; });
  if (under) bar.dataset.on = under.dataset.light; else delete bar.dataset.on;
}
addEventListener("scroll", barColour, { passive: true });
barColour();

// ---------- the theatre ----------
const N = SCREENS.length;
const T = {
  heroEnd: 0.6,
  hold: 1.0,
  swap: 1.0,
  sceneStart(i) { return 1.6 + i * (this.hold + this.swap); },
};
T.outroStart = T.sceneStart(N - 1) + T.hold;
T.end = T.outroStart + 1.0;

async function theatre() {
  const { Stage } = await import("./stage.js");
  const el = $("#theatre");
  const canvas = $(".gl");
  const light = $(".light");
  const heroUi = $(".hero");
  const heroSay = $$(".hero-say, .hero-note, .corner", heroUi);
  const heroSkills = $(".hero-skills");
  const scenes = $$(".scene");
  const words = $$(".monument span");
  const rail = $(".rail");
  const railLinks = $$("a", rail);

  const stage = new Stage(canvas, SCREENS, T);
  await stage.build();

  let unit = 1;
  function measure() {
    const vh = innerHeight;
    unit = vh * (innerWidth < 768 ? 0.55 : 0.7);
    root.style.setProperty("--theatre-h", `${Math.round(T.end * unit + vh)}px`);
    stage.resize();
    fitWords();
  }

  // Each giant word is sized to run edge to edge, but never taller than 62% of the screen.
  const probe = document.createElement("canvas").getContext("2d");
  function fitWords() {
    probe.font = "900 100px Unbounded";
    words.forEach((w) => {
      const width = probe.measureText(w.textContent.toUpperCase()).width / 100;
      const size = Math.min((innerWidth * 1.04) / width, innerHeight * 0.62 / 0.82);
      w.style.setProperty("--size", `${size.toFixed(1)}px`);
    });
  }

  const scrollToUnit = (u) => scrollTo({ top: el.offsetTop + u * unit, behavior: "smooth" });
  railLinks.forEach((a, i) => a.addEventListener("click", (e) => { e.preventDefault(); scrollToUnit(T.sceneStart(i) + 0.3); }));
  $$('a[href="#work"]').forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); scrollToUnit(T.sceneStart(0) + 0.3); }));

  addEventListener("pointermove", (e) => stage.setPointer((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1), { passive: true });
  addEventListener("resize", measure);
  await document.fonts.ready;
  measure();

  // Visible share of scene i's text at u: in just before its panel lands, out as it leaves.
  function sceneIn(i, u) {
    const s = T.sceneStart(i);
    const out = i === N - 1 ? T.outroStart : s + T.hold;
    return smooth(s - 0.45, s - 0.05, u) * (1 - smooth(out - 0.05, out + 0.22, u));
  }

  let u = 0;
  let last = performance.now();
  let running = true;
  new IntersectionObserver(([e]) => { running = e.isIntersecting; if (running) requestAnimationFrame(frame); }).observe(el);

  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const target = clamp((scrollY - el.offsetTop) / unit, 0, T.end);
    u += (target - u) * (1 - Math.pow(0.88, dt * 60));      // heavy smoothing, about 0.12 a frame
    if (Math.abs(target - u) < 0.0005) u = target;

    const current = clamp(Math.floor((u - T.sceneStart(0) + 1) / 2), 0, N - 1);
    const inScenes = u > T.heroEnd + 0.4 && u < T.outroStart + 0.4;

    // Hero: the words leave as the first panel comes forward; the skills row comes back at the end.
    const heroA = 1 - smooth(T.heroEnd, T.heroEnd + 0.4, u);
    heroSay.forEach((n) => { n.style.opacity = heroA; n.style.transform = `translateY(${(1 - heroA) * -24}px)`; });
    const skillsA = Math.max(heroA, smooth(T.end - 0.5, T.end, u));
    heroSkills.style.opacity = skillsA;

    // Giant words: the hero word, then one per project, each sliding up and out.
    const wordA = [heroA * (1 - smooth(T.heroEnd, T.heroEnd + 0.5, u)) + smooth(T.end - 0.4, T.end, u)];
    for (let i = 0; i < N; i++) wordA.push(sceneIn(i, u));
    words.forEach((w, k) => {
      const a = wordA[k];
      const s = k === 0 ? T.heroEnd : T.sceneStart(k - 1);
      const dir = u < s ? 1 : -1;
      w.style.opacity = a;
      w.style.transform = `translate(calc(-50% + ${-stage.pointer.sx * 1.2}vw), calc(-50% + ${(1 - a) * dir * 14}%))`;
    });

    scenes.forEach((sc, i) => {
      const a = sceneIn(i, u);
      const s = T.sceneStart(i);
      sc.style.opacity = a;
      sc.style.transform = innerWidth < 768 ? `translateY(${(1 - a) * (u < s ? 24 : -24)}px)` : `translateY(calc(-50% + ${(1 - a) * (u < s ? 28 : -28)}px))`;
      sc.classList.toggle("is-on", a > 0.02);
    });

    rail.classList.toggle("is-on", inScenes);
    railLinks.forEach((a, i) => a.classList.toggle("is-on", i === current));

    stage.render(u, now / 1000, inScenes ? current : -1);

    // The light sits behind the centre of the row on the first screen and behind the
    // landing spot during the projects, and brightens while a panel is close.
    const toScenes = smooth(T.heroEnd, T.sceneStart(0), u) * (1 - smooth(T.outroStart, T.end, u));
    const hero = stage.screenOf({ x: 0, y: stage.half().hh * 0.2, z: 0 });
    const spot = stage.screenOf(stage.focusPose);
    let near = 0;
    stage.panels.forEach((g) => { near = Math.max(near, smooth(-3, 2.4, g.position.z)); });
    light.style.setProperty("--gx", `${(hero.x + (spot.x - hero.x) * toScenes) * 100}%`);
    light.style.setProperty("--gy", `${(hero.y + (spot.y - hero.y) * toScenes) * 100}%`);
    light.style.setProperty("--light", (0.5 + 0.5 * near).toFixed(3));

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

if (root.classList.contains("motion")) {
  theatre().catch((err) => {
    console.error(err);
    root.classList.remove("motion");      // fall back to the plain page
  });
}
