/**
 * Collision-aware placement of the survey-flag plaques (DESIGN.md Survey Flags and Plaques; ruling R-q),
 * in stage pixels. Each plaque sits beside the top of its flag pole; the pole is its leader. For each
 * plaque, in priority order, the candidates are every pole length from short to long, beside the pole's
 * top on its preferred side and then the other, then sitting over the pole's top; the first that fits is taken: inside the stage, clear of plaques already
 * placed and of hard obstacles (the Fit button), and clear of soft ones (cables, other flags) where any
 * candidate can be. A flag out of frame, or one whose plaque fits nowhere, gets no plaque. Deterministic.
 */

type Pt = { x: number; y: number };
export type Box = { x: number; y: number; w: number; h: number };

export interface PlaqueRequest {
  id: string;
  /** The pole's foot on screen. */
  foot: Pt;
  /** The plaque's width, px. */
  w: number;
  /** The side the plaque prefers: 1 to the right of the pole, −1 to the left. */
  side: 1 | -1;
}

export interface PlaquePlacement {
  /** Pole length, px. */
  len: number;
  side: 1 | -1;
  /** The plaque box. */
  rect: Box;
}

/** Plaque height (DESIGN.md: 31 px). */
export const PLAQUE_H = 31;
/** Pole lengths tried, shortest first, px. */
export const POLE_LENGTHS = [22, 30, 38, 46, 56, 66, 78, 90, 104, 120, 138, 158];
/** Gap between the pole and the plaque, px. */
const POLE_GAP = 13;
/** The plaque's top sits this far above the top of its pole, px. */
const ABOVE_POLE = 5;
/** Kept between plaques, and between a plaque and the stage's edges, px. */
const GAP = 3;

/** The plaque box for a pole of length `len` on `side` of the flag at `foot`. */
export function plaqueRect(foot: Pt, w: number, len: number, side: 1 | -1): Box {
  return { x: side > 0 ? foot.x + POLE_GAP : foot.x - POLE_GAP - w, y: foot.y - len - ABOVE_POLE, w, h: PLAQUE_H };
}

/** The plaque box sitting over the top of a pole `len` px long, its near end just past the pole on the side away from `side`. */
export function plaqueOver(foot: Pt, w: number, len: number, side: 1 | -1): Box {
  const y = foot.y - len - 2 - PLAQUE_H;
  return { x: side > 0 ? foot.x - POLE_GAP : foot.x + POLE_GAP - w, y, w, h: PLAQUE_H };
}

/** A flag's pole and cloth (the cloth flies up to 12 px either side of the pole's top). */
const flagBox = (foot: Pt, len: number): Box => ({ x: foot.x - 14, y: foot.y - len - 1, w: 28, h: len + 3 });

const hits = (a: Box, b: Box, gap = 0) => a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap;

export function placePlaques(requests: PlaqueRequest[], view: { w: number; h: number }, hard: Box[], soft: Box[] = []): Record<string, PlaquePlacement | null> {
  // Greedy placement in priority order; when a plaque in frame finds no spot, it goes first and the rest are
  // placed again round it. The pass that leaves the fewest plaques out wins (the earliest, on a tie).
  let order = requests;
  let best: Record<string, PlaquePlacement | null> | null = null;
  let bestMissing = Infinity;
  for (let pass = 0; pass <= requests.length; pass++) {
    const out = greedy(order, view, hard, soft);
    const missing = order.filter((r) => out[r.id] === null && inFrame(r.foot, view));
    if (missing.length < bestMissing) {
      best = out;
      bestMissing = missing.length;
    }
    if (missing.length === 0) break;
    const first = new Set(missing.map((r) => r.id));
    order = [...missing, ...order.filter((r) => !first.has(r.id))];
  }
  return best ?? {};
}

const inFrame = (p: Pt, view: { w: number; h: number }) => p.x >= 0 && p.x <= view.w && p.y >= 0 && p.y <= view.h;

function greedy(requests: PlaqueRequest[], view: { w: number; h: number }, hard: Box[], soft: Box[] = []): Record<string, PlaquePlacement | null> {
  const out: Record<string, PlaquePlacement | null> = {};
  const placed: Box[] = [];
  // Every flag keeps its own pole and cloth clear where it can: at least a short pole's worth, then the pole it got.
  const flags = new Map(requests.map((r) => [r.id, flagBox(r.foot, POLE_LENGTHS[0]! + 4)]));
  const softFor = (id: string) => [...soft, ...[...flags].flatMap(([other, box]) => (other === id ? [] : [box]))];
  const fits = (r: Box, avoid: Box[]) =>
    r.x >= GAP &&
    r.y >= GAP &&
    r.x + r.w <= view.w - GAP &&
    r.y + r.h <= view.h - GAP &&
    !placed.some((p) => hits(r, p, GAP)) &&
    !hard.some((o) => hits(r, o)) &&
    !avoid.some((o) => hits(r, o));
  for (const req of requests) {
    out[req.id] = null;
    if (!inFrame(req.foot, view)) continue;
    const other = -req.side as 1 | -1;
    const candidates = POLE_LENGTHS.flatMap((len) => [
      { len, side: req.side, rect: plaqueRect(req.foot, req.w, len, req.side) },
      { len, side: other, rect: plaqueRect(req.foot, req.w, len, other) },
      // Over the top of the pole, run out to either side, when neither side has room.
      { len, side: req.side, rect: plaqueOver(req.foot, req.w, len, req.side) },
      { len, side: other, rect: plaqueOver(req.foot, req.w, len, other) },
    ]);
    const avoid = softFor(req.id);
    const pick = candidates.find((c) => fits(c.rect, avoid)) ?? candidates.find((c) => fits(c.rect, []));
    if (!pick) continue;
    out[req.id] = pick;
    placed.push(pick.rect);
    flags.set(req.id, flagBox(req.foot, pick.len));
  }
  return out;
}
