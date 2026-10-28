import type { Graphics } from 'pixi.js';
import { brightness, project, shade } from '../iso.js';
import type { Vec3 } from '../iso.js';

/**
 * Drawing primitives for the static diorama. Everything is drawn once at k = 1 with the world origin
 * at (0, 0): the projection is affine in the camera, so the world container's position and scale
 * apply the camera exactly (`project(p, cam) = (ox, oy) + k · project(p, unit)`).
 */

export type Pt = { x: number; y: number };

const UNIT = { k: 1, ox: 0, oy: 0 };

/** Toward the camera; a face whose normal points away from it is culled. */
const VIEW: Vec3 = { x: 0.612, y: 0.612, z: 0.5 };

/** The light term of the top face (DESIGN.md: b ≈ +0.46). */
export const B_TOP = brightness({ x: 0, y: 0, z: 1 });

/** A world point's screen position at k = 1. */
export function P(p: Vec3): [number, number] {
  const s = project(p, UNIT);
  return [s.sx, s.sy];
}

/** Projected, flattened coordinates for `Graphics.poly`. */
export function flat(pts: Vec3[]): number[] {
  const out: number[] = [];
  for (const p of pts) out.push(...P(p));
  return out;
}

export const at = (p: Pt, z = 0): Vec3 => ({ x: p.x, y: p.y, z });

export function fill(g: Graphics, pts: Vec3[], color: string, alpha = 1): void {
  g.poly(flat(pts)).fill({ color, alpha });
}

/** Newell's normal of a planar polygon, in the winding given. */
function newell(pts: Vec3[]): Vec3 {
  const n = { x: 0, y: 0, z: 0 };
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % pts.length]!;
    n.x += (a.y - b.y) * (a.z + b.z);
    n.y += (a.z - b.z) * (a.x + b.x);
    n.z += (a.x - b.x) * (a.y + b.y);
  }
  return n;
}

const centroid = (pts: Vec3[]): Vec3 => {
  const c = { x: 0, y: 0, z: 0 };
  for (const p of pts) {
    c.x += p.x / pts.length;
    c.y += p.y / pts.length;
    c.z += p.z / pts.length;
  }
  return c;
};

/**
 * One face of a solid, toned by its outward normal (the normal pointing away from `inside`) and
 * culled when it faces away from the camera. Returns whether it was drawn.
 */
export function face(g: Graphics, pts: Vec3[], base: string, inside: Vec3, bias = 0): boolean {
  let n = newell(pts);
  const c = centroid(pts);
  if (n.x * (c.x - inside.x) + n.y * (c.y - inside.y) + n.z * (c.z - inside.z) < 0) n = { x: -n.x, y: -n.y, z: -n.z };
  if (n.x * VIEW.x + n.y * VIEW.y + n.z * VIEW.z <= 1e-3) return false;
  fill(g, pts, shade(base, brightness(n) + bias));
  return true;
}

/** A convex solid from its faces: back faces culled, each face toned by the one sun. */
export function convex(g: Graphics, faces: Vec3[][], base: string | ((c: Vec3) => string)): void {
  const inside = centroid(faces.flat());
  for (const f of faces) face(g, f, typeof base === 'string' ? base : base(centroid(f)), inside);
}

/** An axis-aligned box: its three visible faces (left +y, right +x, top +z). `top` overrides the roof colour. */
export function box(g: Graphics, x: number, y: number, z: number, w: number, d: number, h: number, base: string, top?: string): void {
  const v = (dx: number, dy: number, dz: number): Vec3 => ({ x: x + dx, y: y + dy, z: z + dz });
  fill(g, [v(0, d, 0), v(w, d, 0), v(w, d, h), v(0, d, h)], shade(base, brightness({ x: 0, y: 1, z: 0 })));
  fill(g, [v(w, 0, 0), v(w, d, 0), v(w, d, h), v(w, 0, h)], shade(base, brightness({ x: 1, y: 0, z: 0 })));
  fill(g, [v(0, 0, h), v(w, 0, h), v(w, d, h), v(0, d, h)], shade(top ?? base, B_TOP));
}

/** A box turned to heading `th`: u forward, v to the left, extents in metres about (cx, cy). */
export function obox(g: Graphics, cx: number, cy: number, th: number, u0: number, u1: number, v0: number, v1: number, z0: number, z1: number, base: string): void {
  const c = Math.cos(th);
  const s = Math.sin(th);
  const w = (u: number, v: number, z: number): Vec3 => ({ x: cx + u * c - v * s, y: cy + u * s + v * c, z });
  const corners: [number, number][] = [
    [u0, v0],
    [u1, v0],
    [u1, v1],
    [u0, v1],
  ];
  const faces = corners.map(([u, v], i) => {
    const [u2, v2] = corners[(i + 1) % 4]!;
    return [w(u, v, z0), w(u2, v2, z0), w(u2, v2, z1), w(u, v, z1)];
  });
  convex(g, [...faces, corners.map(([u, v]) => w(u, v, z1))], base);
}

/** A rectangular prism along a segment (booms, galleries, conveyor decks), `w` wide and `h` deep. */
export function beam(g: Graphics, a: Vec3, b: Vec3, w: number, h: number, base: string): void {
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const nx = (-(b.y - a.y) / len) * (w / 2);
  const ny = ((b.x - a.x) / len) * (w / 2);
  const q = (p: Vec3, sx: number, dz: number): Vec3 => ({ x: p.x + nx * sx, y: p.y + ny * sx, z: p.z + dz });
  const bottom = [q(a, 1, 0), q(b, 1, 0), q(b, -1, 0), q(a, -1, 0)];
  const top = bottom.map((p) => ({ ...p, z: p.z + h }));
  const sides = bottom.map((p, i) => [p, bottom[(i + 1) % 4]!, top[(i + 1) % 4]!, top[i]!]);
  convex(g, [...sides, top], base);
}

/** A faceted vertical cylinder: 16 toned wall facets and a 24-sided top. */
export function cylinder(g: Graphics, cx: number, cy: number, z: number, r: number, h: number, base: string, top?: string): void {
  const N = 16;
  const ring = (zz: number, n: number) => Array.from({ length: n }, (_, i) => ({ x: cx + r * Math.cos((i / n) * 2 * Math.PI), y: cy + r * Math.sin((i / n) * 2 * Math.PI), z: zz }));
  const lo = ring(z, N);
  const hi = ring(z + h, N);
  const inside = { x: cx, y: cy, z: z + h / 2 };
  for (let i = 0; i < N; i++) face(g, [lo[i]!, lo[(i + 1) % N]!, hi[(i + 1) % N]!, hi[i]!], base, inside);
  fill(g, ring(z + h, 24), shade(top ?? base, B_TOP));
}

/** A ground-plane circle of radius r at height z, as the ellipse the projection makes of it. */
export function disc(g: Graphics, c: Vec3, r: number, color: string, alpha = 1): void {
  const [sx, sy] = P(c);
  g.ellipse(sx, sy, r * Math.SQRT2, (r * Math.SQRT2) / 2).fill({ color, alpha });
}

/** A round blob (canopy, tussock) of radius r metres centred on a world point: round on screen. */
export function ball(g: Graphics, c: Vec3, r: number, color: string, squash = 1): void {
  const [sx, sy] = P(c);
  g.ellipse(sx, sy, r * 1.15, r * 1.15 * squash).fill(color);
}

/** A polyline drawn as a band `width` metres wide on the ground at height z: one quad per segment, round joins. */
export function band(g: Graphics, pts: Pt[], width: number, color: string, z = 0, alpha = 1): void {
  const h = width / 2;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len === 0) continue;
    const nx = (-(b.y - a.y) / len) * h;
    const ny = ((b.x - a.x) / len) * h;
    g.poly(flat([at({ x: a.x + nx, y: a.y + ny }, z), at({ x: b.x + nx, y: b.y + ny }, z), at({ x: b.x - nx, y: b.y - ny }, z), at({ x: a.x - nx, y: a.y - ny }, z)])).fill({ color, alpha });
  }
  for (const p of pts.slice(1, -1)) disc(g, at(p, z), h, color, alpha);
}

/** A thin line along world points, `width` in k = 1 pixels. */
export function line(g: Graphics, pts: Vec3[], color: string, width: number, alpha = 1): void {
  g.poly(flat(pts), false).stroke({ color, width, alpha, join: 'round', cap: 'round' });
}

/** Chaikin corner cutting: organic forms (creek, roads, pit crests) are smoothed polylines (DESIGN.md Shapes). */
export function chaikin(pts: Pt[], iterations: number): Pt[] {
  let p = pts;
  for (let k = 0; k < iterations; k++) {
    const out: Pt[] = [p[0]!];
    for (let i = 0; i < p.length - 1; i++) {
      const a = p[i]!;
      const b = p[i + 1]!;
      out.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 }, { x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
    }
    out.push(p[p.length - 1]!);
    p = out;
  }
  return p;
}

/** The polyline moved `d` metres to its left (averaged tangents, no mitre). */
export function offsetLine(pts: Pt[], d: number): Pt[] {
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)]!;
    const b = pts[Math.min(pts.length - 1, i + 1)]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return { x: p.x - ((b.y - a.y) / len) * d, y: p.y + ((b.x - a.x) / len) * d };
  });
}

/** A small seeded PRNG (mulberry32), so the board is the same on every load. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Smooth value noise in [0, 1] on a 64 × 64 lattice (wrapping). */
export function vnoise(seed: number): (x: number, y: number) => number {
  const r = rng(seed);
  const grid = Array.from({ length: 4096 }, () => r());
  const g = (a: number, b: number) => grid[(a & 63) * 64 + (b & 63)]!;
  const s = (t: number) => t * t * (3 - 2 * t);
  return (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const u = s(x - xi);
    const v = s(y - yi);
    return (g(xi, yi) * (1 - u) + g(xi + 1, yi) * u) * (1 - v) + (g(xi, yi + 1) * (1 - u) + g(xi + 1, yi + 1) * u) * v;
  };
}

/** Painter's queue: items keyed by depth (`depthKey`), drawn far to near. */
export class DepthQueue {
  private items: { key: number; draw(g: Graphics): void }[] = [];
  add(key: number, draw: (g: Graphics) => void): void {
    this.items.push({ key, draw });
  }
  flush(g: Graphics): void {
    this.items.sort((a, b) => a.key - b.key);
    for (const item of this.items) item.draw(g);
    this.items = [];
  }
}
