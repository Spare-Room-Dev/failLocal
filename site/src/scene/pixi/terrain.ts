import type { Graphics } from 'pixi.js';
import { brightness, mix, shade } from '../iso.js';
import type { Vec3 } from '../iso.js';
import { BOARD, crestValue, distToPolyline, LAYOUT } from '../layout.js';
import { token } from '../palette.js';
import { B_TOP, ball, chaikin, DepthQueue, fill, line, offsetLine, rng, vnoise } from './draw.js';
import type { Pt } from './draw.js';

/** The cut-away slab under the board: strata to 30 m down, then the plinth (DESIGN.md Cut-away slab). */
export const SLAB_DEPTH = 30;
export const PLINTH_DEPTH = 14;
const BASE_Z = -SLAB_DEPTH - PLINTH_DEPTH;

const { w: W, h: D } = BOARD;
const LEFT_FACE = brightness({ x: 0, y: 1, z: 0 });
const RIGHT_FACE = brightness({ x: 1, y: 0, z: 0 });

/** Strata bands, top down: alternating oxide reds, ochres and dark ironstone, as [top, bottom, colour]. */
function strata(): [number, number, string][] {
  const t = token;
  const ochre = mix(t('oxide-high'), t('haul-road'), 0.55);
  return [
    [0, -2.2, t('oxide-low')],
    [-2.2, -5.5, mix(t('oxide-high'), t('shade-lite'), 0.12)],
    [-5.5, -8, t('ironstone-high')],
    [-8, -10, ochre],
    [-10, -13.5, t('ironstone-low')],
    [-13.5, -15.5, mix(t('oxide-low'), t('oxide-high'), 0.5)],
    [-15.5, -17, mix(t('ironstone-low'), t('shade-dark'), 0.2)],
    [-17, -19.5, mix(t('ironstone-high'), ochre, 0.4)],
    [-19.5, -24, mix(t('ironstone-low'), t('shade-dark'), 0.12)],
    [-24, -SLAB_DEPTH, mix(t('ironstone-low'), t('shade-dark'), 0.35)],
  ];
}

/** The large blurred shadow the whole model throws on the gallery floor (drawn into its own blurred layer). */
export function drawPlinthShadow(g: Graphics): void {
  fill(g, [
    { x: 0, y: 0, z: BASE_Z },
    { x: W, y: 0, z: BASE_Z },
    { x: W + 260, y: D + 40, z: BASE_Z },
    { x: 260, y: D + 40, z: BASE_Z },
  ], mix(token('cast-shadow'), token('plinth'), 0.5), 0.42);
}

/**
 * The two visible board edges: strata bands with gently waving bedding planes, the plinth below in
 * two tones, the plinth's top arris, and the pale lit lip along the board's top edge.
 */
export function drawSlab(g: Graphics): void {
  const bands = strata();
  // The bedding planes wave a little along each face, so the strata read as rock, not stripes.
  const wave = (s: number, i: number) => (i === 0 || i === bands.length ? 0 : 0.55 * Math.sin(s / 95 + i * 1.7) + 0.35 * Math.sin(s / 37 + i));
  const STEP = 40;
  const faces: { at(s: number, z: number): Vec3; length: number; b: number }[] = [
    { at: (s, z) => ({ x: s, y: D, z }), length: W, b: LEFT_FACE },
    { at: (s, z) => ({ x: W, y: D - s, z }), length: D, b: RIGHT_FACE },
  ];
  for (const f of faces) {
    for (const [i, [top, bottom, colour]] of bands.entries()) {
      for (let s = 0; s < f.length; s += STEP) {
        const e = Math.min(f.length, s + STEP);
        fill(g, [f.at(s, top + wave(s, i)), f.at(e, top + wave(e, i)), f.at(e, bottom + wave(e, i + 1)), f.at(s, bottom + wave(s, i + 1))], shade(colour, f.b));
      }
    }
  }
  const plinth = token('plinth');
  fill(g, [{ x: 0, y: D, z: -SLAB_DEPTH }, { x: W, y: D, z: -SLAB_DEPTH }, { x: W, y: D, z: BASE_Z }, { x: 0, y: D, z: BASE_Z }], plinth);
  // DESIGN.md's lower-right plinth face, #25221f.
  fill(g, [{ x: W, y: 0, z: -SLAB_DEPTH }, { x: W, y: D, z: -SLAB_DEPTH }, { x: W, y: D, z: BASE_Z }, { x: W, y: 0, z: BASE_Z }], mix(plinth, token('hatch-ink'), 0.72));
  line(g, [{ x: 0, y: D, z: -SLAB_DEPTH }, { x: W, y: D, z: -SLAB_DEPTH }, { x: W, y: 0, z: -SLAB_DEPTH }], mix(plinth, token('plate-engraving'), 0.25), 1.2);
  line(g, [{ x: W, y: D, z: -SLAB_DEPTH }, { x: W, y: D, z: BASE_Z }], mix(plinth, token('plate-engraving'), 0.18), 1);
}

/** The pale lit lip along the board's two front edges, drawn over the ground. */
export function drawLip(g: Graphics): void {
  line(g, [{ x: 0, y: D, z: 0 }, { x: W, y: D, z: 0 }, { x: W, y: 0, z: 0 }], mix(token('haul-road'), token('shade-lite'), 0.55), 1.6, 0.8);
}

/** The creek's bed, smoothed, shared by the ground tint, the bed and the gums. */
export const CREEK = chaikin(LAYOUT.creek, 3);
const RIDGE = chaikin(LAYOUT.ridge, 2);

/** Faceted ground: a jittered triangle grid toned at b ≈ top − 0.42 ± 0.045, a noise blend of the two oxides. */
export function drawGround(g: Graphics): void {
  const R = rng(7);
  const n1 = vnoise(11);
  const n2 = vnoise(23);
  const low = token('oxide-low');
  const high = token('oxide-high');
  const darker = mix(token('oxide-low'), token('ironstone-low'), 0.45);
  const creekTint = mix(high, token('haul-road'), 0.55);
  const ridgeTint = mix(token('ironstone-low'), low, 0.4);
  const colour = (x: number, y: number) => {
    let c = mix(low, high, Math.min(1, Math.max(0, n1(x / 190, y / 190) * 1.25 - 0.1)));
    c = mix(c, darker, Math.max(0, n2(x / 55, y / 55) - 0.6) * 1.3);
    const dc = distToPolyline({ x, y }, CREEK);
    if (dc < 120) c = mix(c, creekTint, (1 - dc / 120) * 0.38);
    const dr = distToPolyline({ x, y }, RIDGE);
    if (dr < 260) c = mix(c, ridgeTint, (1 - dr / 260) * 0.42);
    return c;
  };
  const G = 25;
  const NX = W / G;
  const NY = D / G;
  const V: Pt[][] = [];
  for (let i = 0; i <= NX; i++) {
    V.push([]);
    for (let j = 0; j <= NY; j++) {
      const jx = i > 0 && i < NX ? (R() - 0.5) * G * 0.45 : 0;
      const jy = j > 0 && j < NY ? (R() - 0.5) * G * 0.45 : 0;
      V[i]!.push({ x: i * G + jx, y: j * G + jy });
    }
  }
  for (let i = 0; i < NX; i++)
    for (let j = 0; j < NY; j++) {
      const a = V[i]![j]!;
      const b = V[i + 1]![j]!;
      const c = V[i + 1]![j + 1]!;
      const d = V[i]![j + 1]!;
      for (const t of [
        [a, b, c],
        [a, c, d],
      ]) {
        const cx = (t[0]!.x + t[1]!.x + t[2]!.x) / 3;
        const cy = (t[0]!.y + t[1]!.y + t[2]!.y) / 3;
        // Inside the crest the pit draws its own ground.
        if (crestValue({ x: cx, y: cy }, -30) < 1) continue;
        fill(g, t.map((p) => ({ ...p, z: 0 })), shade(colour(cx, cy), B_TOP - 0.42 + (R() - 0.5) * 0.09));
      }
    }
}

/** A braided creek: a pale bed and three wandering channels. */
export function drawCreek(g: Graphics): void {
  const bed = mix(token('oxide-high'), token('haul-road'), 0.5);
  const sand = mix(token('haul-road'), token('shade-lite'), 0.45);
  const ribbon = (pts: Pt[], width: number, colour: string, alpha = 1) => {
    const l = offsetLine(pts, width / 2);
    const r = offsetLine(pts, -width / 2).reverse();
    fill(g, [...l, ...r].map((p) => ({ ...p, z: 0 })), colour, alpha);
  };
  ribbon(CREEK, 44, bed, 0.6);
  for (const [off, w, ph] of [
    [-9, 6, 0],
    [7, 8, 1.7],
    [0, 4, 3.1],
  ] as const) {
    const braid = CREEK.map((p, i) => ({ x: p.x + Math.sin(i * 0.33 + ph) * 7 + off * 0.6, y: p.y + Math.cos(i * 0.21 + ph) * 3 }));
    ribbon(braid, w, sand);
  }
}

/** The western ironstone ridge: faceted crest, shoulder and foot, blended by height. Returns its cast shadow, piece by piece. */
export function drawRidge(g: Graphics): Pt[][] {
  const R = rng(17);
  const pts = chaikin(LAYOUT.ridge, 3);
  const low = token('ironstone-low');
  const high = token('ironstone-high');
  const crest: Vec3[] = [];
  const shoulder: Vec3[] = [];
  const foot: Vec3[] = [];
  const back: Vec3[] = [];
  const first = pts[0]!.y;
  const span = pts[pts.length - 1]!.y - first;
  pts.forEach((p, i) => {
    const t = (p.y - first) / span;
    const h = i === 0 || i === pts.length - 1 ? 0 : (12 + 30 * Math.sin(t * Math.PI)) * (0.88 + 0.14 * Math.sin(i * 1.7));
    crest.push({ x: p.x, y: p.y, z: h });
    shoulder.push({ x: p.x + 26 + Math.sin(i * 1.3) * 5, y: p.y + 4, z: h * 0.78 });
    foot.push({ x: p.x + 75 + Math.sin(i * 0.7) * 10, y: p.y + 8, z: 0 });
    back.push({ x: Math.max(0, p.x - 40), y: p.y, z: 0 });
  });
  const colour = (z: number) => mix(low, high, Math.min(1, Math.max(0, z / 40)));
  const tri = (t: Vec3[]) => {
    // Upward normal of the triangle (the ridge is a height field).
    const [a, b, c] = t as [Vec3, Vec3, Vec3];
    const u = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
    const v = { x: c.x - a.x, y: c.y - a.y, z: c.z - a.z };
    let n = { x: u.y * v.z - u.z * v.y, y: u.z * v.x - u.x * v.z, z: u.x * v.y - u.y * v.x };
    if (n.z < 0) n = { x: -n.x, y: -n.y, z: -n.z };
    fill(g, t, shade(colour((a.z + b.z + c.z) / 3), brightness(n) + (R() - 0.5) * 0.06));
  };
  for (const [from, to] of [
    [back, crest],
    [crest, shoulder],
    [shoulder, foot],
  ] as const) {
    for (let i = 0; i < pts.length - 1; i++) {
      const q = [from[i]!, from[i + 1]!, to[i + 1]!, to[i]!];
      tri([q[0]!, q[1]!, q[2]!]);
      tri([q[0]!, q[2]!, q[3]!]);
    }
  }
  const cast = crest.map((p) => ({ x: p.x + 1.5 * p.z, y: p.y - 0.15 * p.z }));
  return pts.slice(1).map((_, i) => [foot[i]!, foot[i + 1]!, cast[i + 1]!, cast[i]!]);
}

/** River red gums along the creek: placed off roads and pads, queued for depth sorting. Returns their shadow discs. */
export function plantGums(q: DepthQueue): { c: Pt; r: number }[] {
  const R = rng(31);
  const trunk = mix(token('paper-2'), token('roof-steel'), 0.25);
  const greens = [mix(token('spinifex-low'), token('shade-dark'), 0.55), mix(token('spinifex-low'), token('shade-dark'), 0.32), shade(token('spinifex-low'), 0.05)];
  const clear = (p: Pt) =>
    p.x > 6 && p.y > 6 && p.x < W - 6 && p.y < D - 6 &&
    LAYOUT.roads.every((r) => distToPolyline(p, r.points) > r.width / 2 + 8) &&
    LAYOUT.structures.every((s) => p.x < s.at.x - 8 || p.x > s.at.x + s.size.x + 8 || p.y < s.at.y - 8 || p.y > s.at.y + s.size.y + 8);
  const shadows: { c: Pt; r: number }[] = [];
  CREEK.forEach((p, i) => {
    if (i % 2 !== 0 || R() > 0.8) return;
    const side = R() < 0.5 ? -1 : 1;
    const t: Pt = { x: p.x + side * (22 + R() * 14), y: p.y + (R() - 0.5) * 10 };
    if (!clear(t)) return;
    const r = 5 + R() * 3.5;
    shadows.push({ c: { x: t.x + 1.5 * r * 1.3, y: t.y - 0.15 * r * 1.3 }, r });
    q.add(t.x + t.y, (g) => {
      line(g, [{ ...t, z: 0 }, { ...t, z: r * 1.15 }], trunk, Math.max(1, r * 0.22));
      const top = { ...t, z: r * 1.45 };
      ball(g, { x: top.x + r * 0.2, y: top.y + r * 0.15, z: top.z }, r, greens[0]!);
      ball(g, { x: top.x - r * 0.1, y: top.y, z: top.z + r * 0.2 }, r * 0.8, greens[1]!);
      ball(g, { x: top.x - r * 0.3, y: top.y - r * 0.2, z: top.z + r * 0.42 }, r * 0.45, greens[2]!);
    });
  });
  return shadows;
}
