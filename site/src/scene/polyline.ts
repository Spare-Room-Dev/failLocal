/** Planar polyline helpers in whatever units the caller uses (screen pixels for cables, metres for the belt). */

export type Pt = { x: number; y: number };

/** Cumulative length at each vertex. */
export function lengths(pts: Pt[]): number[] {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1]! + Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y));
  return cum;
}

/** The point `d` along the polyline (clamped to its ends) and the unit direction of travel there. */
export function pointAt(pts: Pt[], d: number, cum = lengths(pts)): { p: Pt; dir: Pt } {
  const total = cum[cum.length - 1]!;
  const t = Math.min(total, Math.max(0, d));
  let i = 1;
  while (i < pts.length - 1 && cum[i]! < t) i++;
  const a = pts[i - 1]!;
  const b = pts[i]!;
  const span = cum[i]! - cum[i - 1]! || 1;
  const f = (t - cum[i - 1]!) / span;
  return { p: { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f }, dir: { x: (b.x - a.x) / span, y: (b.y - a.y) / span } };
}

/** The part of the polyline from `d0` to `d1` along it. */
export function slice(pts: Pt[], d0: number, d1: number, cum = lengths(pts)): Pt[] {
  if (d1 <= d0) return [];
  const out = [pointAt(pts, d0, cum).p];
  for (let i = 1; i < pts.length - 1; i++) if (cum[i]! > d0 && cum[i]! < d1) out.push(pts[i]!);
  out.push(pointAt(pts, d1, cum).p);
  return out;
}

/** Dashes `on` long every `period`, the pattern shifted `offset` along the line: each dash as its own polyline. */
export function dashes(pts: Pt[], on: number, period: number, offset = 0): Pt[][] {
  const cum = lengths(pts);
  const total = cum[cum.length - 1]!;
  const out: Pt[][] = [];
  const start = (((offset % period) + period) % period) - period;
  for (let d = start; d < total; d += period) {
    const a = Math.max(0, d);
    const b = Math.min(total, d + on);
    if (b > a) out.push(slice(pts, a, b, cum));
  }
  return out;
}

/**
 * Octilinear corners: each interior vertex is cut back `r` along both of its legs (less on a leg too
 * short for it), so right-angle bends become 45° chamfers (DESIGN.md Cables: 9 px).
 */
export function chamfer(pts: Pt[], r: number): Pt[] {
  if (pts.length < 3) return pts;
  const out: Pt[] = [pts[0]!];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const c = pts[i + 1]!;
    const lab = Math.hypot(b.x - a.x, b.y - a.y);
    const lbc = Math.hypot(c.x - b.x, c.y - b.y);
    if (lab === 0 || lbc === 0) continue;
    const cut = Math.min(r, lab / 2, lbc / 2);
    out.push({ x: b.x - ((b.x - a.x) / lab) * cut, y: b.y - ((b.y - a.y) / lab) * cut });
    out.push({ x: b.x + ((c.x - b.x) / lbc) * cut, y: b.y + ((c.y - b.y) / lbc) * cut });
  }
  out.push(pts[pts.length - 1]!);
  return out;
}
