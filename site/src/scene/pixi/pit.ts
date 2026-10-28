import { Container, Graphics } from 'pixi.js';
import { mix, shade } from '../iso.js';
import type { Vec3 } from '../iso.js';
import { BATTER_RUN, LAYOUT, pitRing } from '../layout.js';
import { token } from '../palette.js';
import { rampCentreline } from '../paths.js';
import { B_TOP, beam, disc, face, fill, flat, line, obox, rng } from './draw.js';
import type { Pt } from './draw.js';

/**
 * The open pit: five 12 m benches (5 m batter, 11 m berm), the spiral ramp cut into the walls, a
 * sump and a face shovel on the floor, and the drill with its blast pattern on the first bench.
 *
 * Painter's order inside a hole: level i is a container masked by bench i's crest, holding bench i's
 * wall and berm, then level i + 1, then the ramp stretch that runs through level i + 1. A deeper
 * level never paints outside the crest above it, so the near rim hides what it should; the ramp is
 * drawn after the benches under it, so its body sits over the rock it was cut from.
 */

const { pit } = LAYOUT;
const N = 96;
const BENCHES = pit.benches.length;
const BENCH_H = -pit.benches[0]!.floorZ;
const STEP = pit.benches[0]!.radiusX - pit.benches[1]!.radiusX;
const DEPTH = BENCHES * BENCH_H;

const angle = (j: number) => (j / N) * 2 * Math.PI;
const ring = (inset: number, z: number, n = N): Vec3[] => Array.from({ length: n }, (_, j) => ({ ...pitRing((j / n) * 2 * Math.PI, inset), z }));

/** How far inside the crest ellipse `p` sits, in the layout's inset metres (negative outside). */
export function insetOf(p: Pt): number {
  let lo = -200;
  let hi = Math.min(pit.benches[0]!.radiusX, pit.benches[0]!.radiusY) - 1;
  const inside = (d: number) => {
    const rx = pit.benches[0]!.radiusX - d;
    const ry = pit.benches[0]!.radiusY - d;
    return ((p.x - pit.centre.x) / rx) ** 2 + ((p.y - pit.centre.y) / ry) ** 2 <= 1;
  };
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (inside(mid)) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** The pit surface's height at inset d: each bench is a batter from its crest to its toe, then its berm. */
export function surfaceZ(d: number): number {
  if (d <= 0) return 0;
  const i = Math.floor(d / STEP);
  if (i >= BENCHES) return -DEPTH;
  const into = d - i * STEP;
  return into < BATTER_RUN ? -BENCH_H * (i + into / BATTER_RUN) : -BENCH_H * (i + 1);
}

/** Bench wall colours, crest down: oxide, ochre and ironstone strata. */
function benchColours(): string[] {
  const t = token;
  return [
    mix(t('oxide-low'), t('ironstone-low'), 0.25),
    mix(t('oxide-low'), t('oxide-high'), 0.55),
    mix(t('ironstone-high'), t('ironstone-low'), 0.35),
    mix(t('oxide-high'), t('ore-load'), 0.4),
    mix(t('ironstone-low'), t('ironstone-high'), 0.3),
  ];
}

export interface Pit {
  /** The pit's rock, ramp and floor: it never changes. */
  root: Container;
  /**
   * Where vehicles in the pit draw, one container per level, drawn after the pit's rock (`actorRoot`).
   * Level L is masked by every crest from the rim down to crest L − 1, nested as the rock's levels are,
   * so the near rim hides a vehicle exactly as it hides the benches; deeper levels draw first. A vehicle
   * at height z belongs to level floor(−z / 12), clamped to the bottom level.
   */
  actors: Container[];
  actorRoot: Container;
  /** Ground marks on the first berm (the drill pad's hatching), under everything deeper. */
  firstBerm: Container;
}

/** The pit level a point at height z (below the surface) draws in. */
export function pitLevel(z: number): number {
  return Math.min(BENCHES - 1, Math.max(0, Math.floor(-z / BENCH_H + 1e-9)));
}

export function buildPit(): Pit {
  const colours = benchColours();
  const bermBase = mix(token('oxide-high'), token('haul-road'), 0.45);
  const floorBase = mix(token('oxide-low'), token('ironstone-high'), 0.35);
  const ramps = rampPieces(colours);

  const levels: Container[] = [];
  const firstBerm = new Container({ label: 'pit-first-berm' });
  const actors = Array.from({ length: BENCHES }, (_, i) => new Container({ label: `pit-actors-${i}` }));
  for (let i = 0; i < BENCHES; i++) {
    const level = new Container({ label: `pit-level-${i}` });
    const crest = ring(i * STEP, -i * BENCH_H);
    const mask = new Graphics().poly(flat(crest)).fill(0xffffff);
    level.addChild(mask);
    level.mask = mask;

    const g = new Graphics();
    fill(g, crest, shade(colours[i]!, -0.5));
    const toe = ring(i * STEP + BATTER_RUN, -(i + 1) * BENCH_H);
    for (let j = 0; j < N; j++) {
      const k = (j + 1) % N;
      const rock = { ...pitRing(angle(j + 0.5), i * STEP - 40), z: -i * BENCH_H - BENCH_H / 2 };
      // A faint band every few facets, so the batter reads as blasted rock rather than a smooth cone.
      face(g, [crest[j]!, crest[k]!, toe[k]!, toe[j]!], colours[i]!, rock, j % 7 === 0 ? 0.05 : j % 5 === 0 ? -0.04 : 0);
    }
    if (i < BENCHES - 1) {
      const next = ring((i + 1) * STEP, -(i + 1) * BENCH_H);
      const berm = shade(bermBase, B_TOP - 0.34 - i * 0.03);
      for (let j = 0; j < N; j++) {
        const k = (j + 1) % N;
        fill(g, [toe[j]!, toe[k]!, next[k]!, next[j]!], berm);
      }
    } else {
      fill(g, toe, shade(floorBase, B_TOP - 0.3));
      facetFloor(g, floorBase, i * STEP + BATTER_RUN);
      drawFloor(g);
    }
    // The crest catches the low sun along the far side.
    const lit = crest.filter((_, j) => Math.cos(angle(j)) + Math.sin(angle(j)) < 0.1);
    line(g, lit, shade(colours[i]!, 0.5), 0.9, 0.8);
    if (i === 0) drawDrill(g);
    level.addChild(g);
    if (i === 0) level.addChild(firstBerm);
    levels.push(level);
  }
  // Nest: level i holds level i + 1, then the ramp stretch through level i + 1.
  for (let i = BENCHES - 2; i >= 0; i--) {
    levels[i]!.addChild(levels[i + 1]!);
    levels[i]!.addChild(ramps[i + 1]!);
  }
  const root = new Container({ label: 'pit' });
  root.addChild(rimBund(), levels[0]!, ramps[0]!);

  // The vehicles' own copy of the crest masks: masked[i] is clipped to crest i (and, nested, every crest above).
  const masked = Array.from({ length: BENCHES - 1 }, (_, i) => {
    const level = new Container({ label: `pit-actors-mask-${i}` });
    const mask = new Graphics().poly(flat(ring(i * STEP, -i * BENCH_H))).fill(0xffffff);
    level.addChild(mask);
    level.mask = mask;
    return level;
  });
  for (let i = BENCHES - 2; i >= 0; i--) {
    if (i + 1 < BENCHES - 1) masked[i]!.addChild(masked[i + 1]!);
    masked[i]!.addChild(actors[i + 1]!);
  }
  const actorRoot = new Container({ label: 'pit-actors' });
  actorRoot.addChild(masked[0]!, actors[0]!);
  return { root, actors, actorRoot, firstBerm };
}

/** The safety bund just outside the crest, open where the haul road meets the ramp. */
function rimBund(): Graphics {
  const g = new Graphics();
  const colour = shade(mix(token('oxide-high'), token('haul-road'), 0.35), B_TOP - 0.25);
  const open = (a: number) => Math.abs(Math.atan2(Math.sin(a - pit.rampHeadAngle), Math.cos(a - pit.rampHeadAngle))) < 0.16;
  let run: Vec3[] = [];
  for (let j = 0; j <= N * 2; j++) {
    const a = (j / (N * 2)) * 2 * Math.PI;
    if (open(a)) {
      if (run.length > 1) line(g, run, colour, 3, 0.85);
      run = [];
      continue;
    }
    run.push({ ...pitRing(a, -7), z: 0 });
  }
  if (run.length > 1) line(g, run, colour, 3, 0.85);
  return g;
}

/**
 * The ramp, one Graphics per level: each stretch's uphill cut face, its haul-road deck with a windrow
 * on the open edge, and the rock body under its open edge down to the bench surface below.
 */
function rampPieces(colours: string[]): Graphics[] {
  const centre = rampCentreline();
  const half = pit.rampWidth / 2;
  const pieces = Array.from({ length: BENCHES }, () => new Graphics());
  const deck = shade(token('haul-road'), B_TOP - 0.22);
  const windrow = shade(mix(token('haul-road'), token('oxide-low'), 0.45), B_TOP - 0.3);
  const edges = centre.map((p, i) => {
    const a = centre[Math.max(0, i - 1)]!;
    const b = centre[Math.min(centre.length - 1, i + 1)]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const n = { x: -(b.y - a.y) / len, y: (b.x - a.x) / len };
    const l = { x: p.x + n.x * half, y: p.y + n.y * half };
    const r = { x: p.x - n.x * half, y: p.y - n.y * half };
    // The open (downhill) edge is the one deeper into the pit.
    return insetOf(l) > insetOf(r) ? { open: l, cut: r, z: p.z } : { open: r, cut: l, z: p.z };
  });
  for (let j = 0; j < edges.length - 1; j++) {
    const a = edges[j]!;
    const b = edges[j + 1]!;
    const top = Math.max(a.z, b.z);
    const level = Math.min(BENCHES - 1, Math.max(0, Math.floor(-top / BENCH_H + 1e-9)));
    const g = pieces[level]!;
    const colour = colours[level]!;
    // Uphill: the wall the ramp was cut into, from the deck up to the bench surface at its back edge.
    const cutA = Math.max(a.z, surfaceZ(insetOf(a.cut)));
    const cutB = Math.max(b.z, surfaceZ(insetOf(b.cut)));
    if (cutA > a.z + 0.2 || cutB > b.z + 0.2) {
      const outward = { ...pitRing(Math.atan2((a.cut.y - pit.centre.y) / pit.benches[0]!.radiusY, (a.cut.x - pit.centre.x) / pit.benches[0]!.radiusX), insetOf(a.cut) - 30), z: a.z };
      face(g, [{ ...a.cut, z: a.z }, { ...b.cut, z: b.z }, { ...b.cut, z: cutB }, { ...a.cut, z: cutA }], colour, outward);
    }
    fill(g, [{ ...a.cut, z: a.z }, { ...b.cut, z: b.z }, { ...b.open, z: b.z }, { ...a.open, z: a.z }], deck);
    // The windrow along the open edge, 3 m of the deck's width.
    const w = (e: typeof a, t: number) => ({ x: e.open.x + (e.cut.x - e.open.x) * t, y: e.open.y + (e.cut.y - e.open.y) * t, z: e.z });
    fill(g, [w(a, 0), w(b, 0), w(b, 3 / pit.rampWidth), w(a, 3 / pit.rampWidth)], windrow);
    // Downhill: the ramp's body, rock left under its open edge down to the surface below.
    const downA = Math.min(a.z, surfaceZ(insetOf(a.open)));
    const downB = Math.min(b.z, surfaceZ(insetOf(b.open)));
    if (a.z > downA + 0.2 || b.z > downB + 0.2) {
      face(g, [{ ...a.open, z: a.z }, { ...b.open, z: b.z }, { ...b.open, z: downB }, { ...a.open, z: downA }], colour, { ...a.cut, z: a.z - 2 }, 0.04);
    }
  }
  return pieces;
}

/** The floor as jittered facets, toned like the ground above but darker in the pit, inside its toe. */
function facetFloor(g: Graphics, base: string, toeInset: number): void {
  const R = rng(41);
  const G = 22;
  const { x: cx, y: cy } = pit.centre;
  const rx = pit.benches[0]!.radiusX - toeInset;
  const ry = pit.benches[0]!.radiusY - toeInset;
  const nx = Math.ceil((2 * rx) / G);
  const ny = Math.ceil((2 * ry) / G);
  const V: Pt[][] = [];
  for (let i = 0; i <= nx; i++) {
    V.push([]);
    for (let j = 0; j <= ny; j++) V[i]!.push({ x: cx - rx + i * G + (R() - 0.5) * G * 0.45, y: cy - ry + j * G + (R() - 0.5) * G * 0.45 });
  }
  const inside = (p: Pt) => ((p.x - cx) / rx) ** 2 + ((p.y - cy) / ry) ** 2 < 0.97;
  for (let i = 0; i < nx; i++)
    for (let j = 0; j < ny; j++) {
      const q = [V[i]![j]!, V[i + 1]![j]!, V[i + 1]![j + 1]!, V[i]![j + 1]!];
      for (const t of [
        [q[0]!, q[1]!, q[2]!],
        [q[0]!, q[2]!, q[3]!],
      ]) {
        if (!t.every(inside)) continue;
        fill(g, t.map((p) => ({ ...p, z: -DEPTH })), shade(base, B_TOP - 0.3 + (R() - 0.5) * 0.08));
      }
    }
}

/** The sump (standing water) and the face shovel on the pit floor. */
function drawFloor(g: Graphics): void {
  const z = -DEPTH;
  const end = rampCentreline().at(-1)!;
  // The sump sits across the floor from the ramp's foot, on the far side where it can be seen.
  const c = { x: pit.centre.x + 0.35 * (pit.centre.x - end.x) + 40, y: pit.centre.y + 0.35 * (pit.centre.y - end.y) - 50 };
  const water = mix(token('roof-steel'), token('wagon-dark'), 0.45);
  const sump: Vec3[] = Array.from({ length: 20 }, (_, j) => {
    const a = (j / 20) * 2 * Math.PI;
    return { x: c.x + 24 * Math.cos(a) * (1 + 0.12 * Math.sin(3 * a)), y: c.y + 13 * Math.sin(a), z };
  });
  fill(g, sump, mix(water, token('ironstone-low'), 0.2));
  fill(g, sump.map((p) => ({ x: c.x + (p.x - c.x) * 0.8 - 1.5, y: c.y + (p.y - c.y) * 0.78 - 1, z })), water);
  line(g, [...sump, sump[0]!], mix(water, token('shade-lite'), 0.55), 0.6, 0.8);

  // Face shovel at the loading point, facing the toe it digs.
  const { x, y } = pit.loadingPoint;
  const th = Math.PI / 2;
  const body = token('hivis');
  obox(g, x, y, th, -4.5, 4.5, -4, 4, z, z + 2.4, token('wagon-dark'));
  obox(g, x, y, th, -4, 3.2, -3.4, 3.4, z + 2.4, z + 7, body);
  obox(g, x, y, th, -4.6, -2.6, -3.2, 3.2, z + 2.4, z + 5.6, mix(token('wagon-dark'), token('roof-steel'), 0.3));
  beam(g, { x, y: y + 2, z: z + 6 }, { x, y: y + 11, z: z + 3.2 }, 1.6, 1.4, mix(body, token('hivis-pressed'), 0.5));
  obox(g, x, y + 12, th, -1.6, 1.6, -2.2, 2.2, z + 0.6, z + 3.6, token('wagon-dark'));
}

/** The drill rig and its blast-hole pattern on the first bench. */
function drawDrill(g: Graphics): void {
  const anchor = LAYOUT.areas['drill-and-blast']!.anchor;
  const z = anchor.z;
  const a = Math.atan2((anchor.y - pit.centre.y) / pit.benches[0]!.radiusY, (anchor.x - pit.centre.x) / pit.benches[0]!.radiusX);
  const along = { x: -Math.sin(a), y: Math.cos(a) };
  const out = { x: Math.cos(a), y: Math.sin(a) };
  const hole = mix(token('ironstone-low'), token('shade-dark'), 0.4);
  for (let i = 0; i < 6; i++)
    for (let r = 0; r < 2; r++) disc(g, { x: anchor.x + along.x * (8 + i * 3.5) + out.x * (r * 3.5 - 1.75), y: anchor.y + along.y * (8 + i * 3.5) + out.y * (r * 3.5 - 1.75), z }, 0.55, hole, 0.85);
  const th = Math.atan2(along.y, along.x);
  obox(g, anchor.x, anchor.y, th, -4, 4, -1.9, 1.9, z, z + 2.6, token('galvanised'));
  beam(g, { x: anchor.x + along.x * 2.6, y: anchor.y + along.y * 2.6, z: z + 2.6 }, { x: anchor.x + along.x * 2.8, y: anchor.y + along.y * 2.8, z: z + 16 }, 1.2, 0.8, token('hivis-pressed'));
}
