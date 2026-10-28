import { token } from './palette.js';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** `ox, oy`: screen pixels of world (0, 0, 0). `k`: pixels per metre. */
export interface Camera {
  k: number;
  ox: number;
  oy: number;
}

/** A world-metre rectangle on the ground plane. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

type Size = { w: number; h: number };
type Point = { x: number; y: number };

export const K_MIN = 0.35;
export const K_MAX = 2.4;

/** Vertical factor for a 30° camera (DESIGN.md Projection). */
const Z_FACTOR = 1.2247;

/** True 2:1 dimetric projection: +x to screen lower right, +y to lower left, z up. */
export function project(p: Vec3, cam: Camera): { sx: number; sy: number } {
  return {
    sx: cam.ox + (p.x - p.y) * cam.k,
    sy: cam.oy + ((p.x + p.y) * cam.k) / 2 - p.z * cam.k * Z_FACTOR,
  };
}

// --- One sun -----------------------------------------------------------------

const SUN = normalize({ x: -1, y: 0.1, z: 1.05 });
const SHADE_DARK = token('shade-dark');
const SHADE_LITE = token('shade-lite');

function normalize(v: Vec3): Vec3 {
  const len = Math.hypot(v.x, v.y, v.z);
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Linear mix in sRGB, each channel rounded to the nearest integer. */
function mix(from: string, to: string, t: number): string {
  const a = rgb(from);
  const b = rgb(to);
  return `#${a.map((c, i) => Math.round(c + (b[i]! - c) * t).toString(16).padStart(2, '0')).join('')}`;
}

/** The facet tone of `baseHex` for a face with outward normal `normal` (DESIGN.md Light). */
export function tone(baseHex: string, normal: Vec3): string {
  const n = normalize(normal);
  const b = (n.x * SUN.x + n.y * SUN.y + n.z * SUN.z) * 0.8 - 0.12;
  return b < 0 ? mix(baseHex, SHADE_DARK, 0.6 * -b) : mix(baseHex, SHADE_LITE, 0.5 * b);
}

/** The three visible faces of an axis-aligned box: top (+z), left (+y), right (+x). */
export function boxFaces(base: string): { top: string; left: string; right: string } {
  return {
    top: tone(base, { x: 0, y: 0, z: 1 }),
    left: tone(base, { x: 0, y: 1, z: 0 }),
    right: tone(base, { x: 1, y: 0, z: 0 }),
  };
}

// --- Shadows and depth -------------------------------------------------------

/** Ground offset per metre of height (DESIGN.md Cast shadows). */
const SHADOW_PER_M = { x: 1.5, y: -0.15 };

/** Convex hull of the footprint and the footprint cast by `height` metres, counter-clockwise, no repeated vertex. */
export function shadowHull(footprint: Point[], height: number): Point[] {
  const cast = footprint.map((p) => ({ x: p.x + SHADOW_PER_M.x * height, y: p.y + SHADOW_PER_M.y * height }));
  return convexHull([...footprint, ...cast]);
}

/** Andrew's monotone chain; drops collinear and duplicate points. */
function convexHull(points: Point[]): Point[] {
  const pts = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  if (pts.length < 3) return pts;
  const cross = (o: Point, a: Point, b: Point) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const half = (list: Point[]) => {
    const out: Point[] = [];
    for (const p of list) {
      while (out.length >= 2 && cross(out[out.length - 2]!, out[out.length - 1]!, p) <= 0) out.pop();
      out.push(p);
    }
    out.pop();
    return out;
  };
  return [...half(pts), ...half([...pts].reverse())];
}

/** Painter's order: smaller keys are farther away and draw first. */
export function depthKey(p: Vec3, bias = 0): number {
  return p.x + p.y + bias;
}

// --- Camera ------------------------------------------------------------------

const FIT_MARGIN = 0.92;

const clampK = (k: number) => Math.min(K_MAX, Math.max(K_MIN, k));

/** k at which a w × h ground rectangle's projected box fits the view (box is (w+h)·k by (w+h)·k/2). */
const fitK = (rect: Size, view: Size) => (FIT_MARGIN * Math.min(view.w, 2 * view.h)) / (rect.w + rect.h);

/**
 * Fit the whole board, or with `focus`, zoom to that rectangle and centre it.
 * k is clamped to [K_MIN, K_MAX]. A focused camera is not passed through `clampCamera`; callers clamp.
 */
export function fitCamera(board: Size, view: Size, focus?: Rect): Camera {
  const r = focus ?? { x: 0, y: 0, w: board.w, h: board.h };
  const k = clampK(fitK(r, view));
  return centreOn({ x: r.x + r.w / 2, y: r.y + r.h / 2 }, k, view);
}

/** The ground point (z = 0) under screen pixel (sx, sy). */
export function unproject(sx: number, sy: number, cam: Camera): Point {
  const diff = (sx - cam.ox) / cam.k; // x − y
  const sum = (2 * (sy - cam.oy)) / cam.k; // x + y
  return { x: (sum + diff) / 2, y: (sum - diff) / 2 };
}

/**
 * Keep k in [K_MIN, K_MAX] and keep the board under the centre of the view: the ground point at
 * the view centre is clamped into the board [0, w] × [0, h] and the camera re-centred on it.
 * A camera already in bounds is returned unchanged.
 */
export function clampCamera(cam: Camera, board: Size, view: Size): Camera {
  const k = clampK(cam.k);
  const g = unproject(view.w / 2, view.h / 2, cam);
  const x = Math.min(board.w, Math.max(0, g.x));
  const y = Math.min(board.h, Math.max(0, g.y));
  if (k === cam.k && x === g.x && y === g.y) return cam;
  return centreOn({ x, y }, k, view);
}

/** The camera at scale k that puts ground point `g` at the centre of the view. */
function centreOn(g: Point, k: number, view: Size): Camera {
  const p = project({ ...g, z: 0 }, { k, ox: 0, oy: 0 });
  return { k, ox: view.w / 2 - p.sx, oy: view.h / 2 - p.sy };
}
