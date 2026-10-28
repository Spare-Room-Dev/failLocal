/**
 * Collision-aware placement of the survey-flag plaques (DESIGN.md Survey Flags and Plaques; ruling R-q),
 * in stage pixels. Each plaque sits beside the top of its flag pole; the pole is its leader. For each
 * plaque, in priority order, the candidates are every pole length from short to long, beside the pole's
 * top on its preferred side and then the other, then sitting over the pole's top; the first that fits is taken:
 * inside the stage, clear of plaques already placed and of hard obstacles (the Fit button), and clear of soft
 * ones (cables, then other flags' poles and cloths) where any candidate can be. The layout is redone round the
 * poles it gave, so no flag stands its pole across another area's plaque where that can be avoided. A flag out
 * of frame, or one whose plaque fits nowhere, gets no plaque. Deterministic.
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
export const POLE_LENGTHS = [22, 26, 30, 34, 38, 42, 46, 51, 56, 61, 66, 72, 78, 84, 90, 97, 104, 112, 120, 129, 138, 148, 158];
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

/** How far down from the top of its pole a flag's cloth reaches, px (overlay.ts draws it 8.5 px deep). */
export const CLOTH_DEPTH = 11;

/** A flag's pole and cloth: the cloth flies up to 12 px either side of the pole's top. `len` 0 gives the cloth alone. */
export function flagBox(foot: Pt, len: number): Box {
  return { x: foot.x - 14, y: foot.y - len - 1, w: 28, h: Math.max(len, CLOTH_DEPTH) + 3 };
}

/**
 * What a flag draws: its pole's line from the foot up `len` px, and its cloth at the top, on `side` of the pole
 * (0 while its side is not yet known: both). Tighter than `flagBox`, which also covers where the cloth could fly.
 */
export function flagMarks(foot: Pt, len: number, side: 1 | -1 | 0): { pole: Box; cloth: Box[] } {
  const cloth = (s: 1 | -1) => ({ x: s > 0 ? foot.x : foot.x - 13, y: foot.y - len - 1, w: 13, h: CLOTH_DEPTH });
  return { pole: { x: foot.x - 1.5, y: foot.y - len, w: 3, h: len }, cloth: side === 0 ? [cloth(1), cloth(-1)] : [cloth(side)] };
}

const hits = (a: Box, b: Box, gap = 0) => a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap;

/** A flag with no plaque stands on a pole this long, px (overlay.ts). */
export const BARE_POLE = 26;

/** How many times the layout is redone round the poles the previous layout gave the flags. */
const ROUNDS = 4;

export function placePlaques(requests: PlaqueRequest[], view: { w: number; h: number }, hard: Box[], soft: Box[] = []): Record<string, PlaquePlacement | null> {
  // Each round lays the plaques out (`layOut`). A flag's pole is only known once its plaque is placed, so one
  // flag's cloth or pole can end up on another's plaque. When that happens the layout is redone: the plaques
  // that were covered go first, so they take their place before the flags round them are fixed, and every
  // flag's pole is reserved at the longest length it has had so far, which the plaques then keep clear of where
  // they can. The round leaving the fewest plaques out wins, then the fewest cloths on plaques (a cloth carries
  // its area's state, and every plaque is drawn over every flag, overlay.ts), then the fewest poles behind
  // plaques (the earliest, on a tie).
  const reserved = new Map<string, { len: number; side: 1 | -1 }>();
  let order = requests;
  let best: Record<string, PlaquePlacement | null> = {};
  let bestScore = [Infinity, Infinity, Infinity];
  for (let round = 0; round < ROUNDS; round++) {
    const out = layOut(order, view, hard, soft, reserved);
    const { cloths, poles } = flagsOnPlaques(requests, out);
    const score = [requests.filter((r) => out[r.id] === null && inFrame(r.foot, view)).length, cloths.length, poles.length];
    const better = score.findIndex((v, i) => v !== bestScore[i]);
    if (better >= 0 && score[better]! < bestScore[better]!) {
      best = out;
      bestScore = score;
    }
    if (cloths.length + poles.length === 0) break;
    const covered = new Set([...cloths, ...poles].map((pair) => pair.split('/')[1]!));
    order = [...order.filter((r) => covered.has(r.id)), ...order.filter((r) => !covered.has(r.id))];
    for (const r of requests) {
      const p = out[r.id];
      reserved.set(r.id, { len: Math.max(reserved.get(r.id)?.len ?? 0, p?.len ?? BARE_POLE), side: p?.side ?? r.side });
    }
  }
  return best;
}

/** Each flag whose cloth, or else whose pole, lies on another flag's plaque, as "flag/plaque". */
export function flagsOnPlaques(requests: PlaqueRequest[], out: Record<string, PlaquePlacement | null>): { cloths: string[]; poles: string[] } {
  const cloths: string[] = [];
  const poles: string[] = [];
  for (const b of requests) {
    const m = flagMarks(b.foot, out[b.id]?.len ?? BARE_POLE, out[b.id]?.side ?? b.side);
    for (const a of requests) {
      const r = a.id !== b.id ? out[a.id]?.rect : undefined;
      if (!r) continue;
      if (m.cloth.some((c) => hits(c, r))) cloths.push(`${b.id}/${a.id}`);
      else if (hits(m.pole, r)) poles.push(`${b.id}/${a.id}`);
    }
  }
  return { cloths, poles };
}

/**
 * Greedy placement in priority order; when a plaque in frame finds no spot, it goes first and the rest are
 * placed again round it. The pass that leaves the fewest plaques out wins (the earliest, on a tie).
 */
function layOut(requests: PlaqueRequest[], view: { w: number; h: number }, hard: Box[], soft: Box[], reserved: Map<string, { len: number; side: 1 | -1 }>): Record<string, PlaquePlacement | null> {
  let order = requests;
  let best: Record<string, PlaquePlacement | null> | null = null;
  let bestMissing = Infinity;
  for (let pass = 0; pass <= requests.length; pass++) {
    const out = greedy(order, view, hard, soft, reserved);
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

function greedy(requests: PlaqueRequest[], view: { w: number; h: number }, hard: Box[], soft: Box[], reserved: Map<string, { len: number; side: 1 | -1 }>): Record<string, PlaquePlacement | null> {
  const out: Record<string, PlaquePlacement | null> = {};
  const placed: Box[] = [];
  // Every flag keeps its own pole and cloth clear where it can: a bare pole, or the pole reserved for it, and
  // once placed the pole it got (or the longer of the two).
  const flags = new Map(requests.map((r) => {
    const held = reserved.get(r.id);
    return [r.id, held ? flagMarks(r.foot, held.len, held.side) : flagMarks(r.foot, BARE_POLE, 0)];
  }));
  const others = (id: string, part: 'pole' | 'cloth') => [...flags].flatMap(([other, m]) => (other === id ? [] : part === 'pole' ? [m.pole] : m.cloth));
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
    // Clear of cables and of other flags' poles and cloths; failing that, of the flags; failing that, of their
    // cloths (a cloth carries its area's state; a pole may pass behind a plaque); failing that, anywhere that fits.
    const poles = others(req.id, 'pole');
    const cloths = others(req.id, 'cloth');
    const tiers = [[...soft, ...poles, ...cloths], [...poles, ...cloths], cloths, []];
    let pick: (typeof candidates)[number] | undefined;
    for (const avoid of tiers) if ((pick = candidates.find((c) => fits(c.rect, avoid)))) break;
    if (!pick) continue;
    out[req.id] = pick;
    placed.push(pick.rect);
    flags.set(req.id, flagMarks(req.foot, Math.max(pick.len, reserved.get(req.id)?.len ?? 0), pick.side));
  }
  return out;
}
