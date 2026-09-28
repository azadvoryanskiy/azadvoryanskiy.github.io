/* Particle charts built from the real project numbers in data.js.
 * World layout shared by every chart: x from -13 to 13, baseline y = -5,
 * about 10 units of height. Each builder returns formations plus the scene
 * coordinates of the things a label should point at. */
import { Formation, T, gauss, lerp, sstep, areaPoints, rawCloud, table } from './engine.js';
import { KK_MANUAL, GH_EVENTS, GH_CLIFF } from './data.js';

export const X0 = -13, X1 = 13, Y0 = -5;

/* Sort several formations of the same points by the first one's x, keeping the
   pairing, so a morph between them only moves what really changes. */
function sortTogether(forms, r) {
  const a = forms[0], n = a.n, idx = new Array(n), key = new Float32Array(n);
  for (let i = 0; i < n; i++) { idx[i] = i; key[i] = a.pos[i * 3] + gauss(r) * 1.5; }
  idx.sort((p, q) => key[p] - key[q]);
  for (const f of forms) {
    const p = new Float32Array(n * 3), t = new Float32Array(n);
    idx.forEach((j, i) => { p[i * 3] = f.pos[j * 3]; p[i * 3 + 1] = f.pos[j * 3 + 1]; p[i * 3 + 2] = f.pos[j * 3 + 2]; t[i] = f.tone[j]; });
    f.pos = p; f.tone = t;
  }
  return forms;
}
/* Same dust for every formation in a set, so the dust stays put during their morphs. */
function sharedDust(forms, r) {
  const need = forms[0].left;
  const d = new Formation(need);
  d.dust(r);
  for (const f of forms) for (let i = 0; i < need; i++) f.put(d.pos[i * 3], d.pos[i * 3 + 1], d.pos[i * 3 + 2], d.tone[i]);
}

export const heroCloud = (n, r) => rawCloud(n, r, { accentAt: [5.5, 1.2, 5] });

/* A spreadsheet with one lit row (the row shown in the caption). */
export const rowTable = (n, r) => table(n, r, { cols: [3.4, 1.4, 1.6, 1.4, 1.6, 1.3, 1.7, 2.1, 1.0], lit: 2 });

/* GitHub events per day, first at the level the feed ran at before 24 May 2025,
   then as it arrived: the missing third drops out of the chart. */
export function githubCliff(n, r) {
  const ev = GH_EVENTS, c = GH_CLIFF, last = ev.length - 1;
  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  const k = mean(ev.slice(0, c)) / mean(ev.slice(c));
  const expected = ev.map((v, i) => (i >= c ? v * k : v));
  const max = Math.max(...expected), h = 9;
  const A = new Formation(n), B = new Formation(n);
  for (const [x, y, z, u] of areaPoints(Math.floor(n * 0.58), r, expected, { x0: X0, x1: X1, y0: Y0, h, max })) {
    const fi = u * last, i = Math.floor(fi), t = fi - i;
    const actual = lerp(ev[i], ev[Math.min(i + 1, last)], t);
    const lost = fi >= c - 0.5 && (y - Y0) > (actual / max) * h;
    const tone = r() < 0.2 ? T.BLUE : T.DATA;
    A.put(x, y, z, tone);
    if (lost) B.put(x + gauss(r) * 0.25, Y0 - 0.7 - Math.pow(r(), 1.7) * 3.4, z + gauss(r) * 0.8, T.EMBER);
    else B.put(x, y, z, tone);
  }
  sharedDust([A, B], r);
  sortTogether([A, B], r);
  const cliffX = lerp(X0, X1, c / last);
  return { expected: A, actual: B, anchors: { cliff: [cliffX, Y0 + h + 0.6, 0], lost: [lerp(cliffX, X1, 0.55), Y0 - 2.6, 0] } };
}

/* KKBox: manual renewals are 13.3% of renewal decisions and 57.1% of churn. */
export function renewalBars(n, r) {
  const f = new Formation(n);
  const per = Math.floor(n * 0.27), w = 4.6, hgt = 10, cx = [-5, 5];
  const shares = [KK_MANUAL.decisions / 100, KK_MANUAL.churn / 100];
  cx.forEach((x, j) => {
    for (let k = 0; k < per; k++) {
      const y = r();
      f.put(x + (r() - 0.5) * w, Y0 + y * hgt, gauss(r) * 0.35, y < shares[j] ? T.ACCENT : T.DIM);
    }
  });
  f.dust(r);
  return {
    form: f.sortByX(r),
    anchors: {
      decisions: [cx[0] + w / 2 + 0.5, Y0 + shares[0] * hgt, 0],
      churn: [cx[1] + w / 2 + 0.5, Y0 + shares[1] * hgt, 0],
      left: [cx[0], Y0 - 0.9, 0], right: [cx[1], Y0 - 0.9, 0],
    },
  };
}

/* The test: one stream of sign-ups split at random into two lanes. */
export function testLanes(n, r) {
  const f = new Formation(n);
  const count = Math.floor(n * 0.5), spread = 3.8;
  for (let k = 0; k < count; k++) {
    const x = lerp(X0, X1, r());
    if (x < -3) {
      f.put(x, gauss(r) * 0.5, gauss(r) * 0.4, r() < 0.5 ? T.DATA : T.DIM);
    } else {
      const b = r() < 0.5, t = (x + 3) / 16;
      const y = (b ? -1 : 1) * spread * sstep(0, 0.55, t) + gauss(r) * 0.42;
      f.put(x, y, gauss(r) * 0.4, b ? T.ACCENT : T.DATA);
    }
  }
  f.dust(r);
  return { form: f.sortByX(r), anchors: { a: [X1 - 0.5, spread + 1.6, 0], b: [X1 - 0.5, -spread - 1.8, 0], split: [-3.2, 1.3, 0] } };
}
