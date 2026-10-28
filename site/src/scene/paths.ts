import type { Vec3 } from './iso.js';
import { BATTER_RUN, LAYOUT, pitRing } from './layout.js';

/**
 * Where things move on the board, in world metres (display geometry, D-105). `at(s)` takes s in
 * metres along the path and wraps it into [0, length); `heading` is the direction of travel in the
 * ground plane, atan2(dy, dx) in world axes.
 */
export interface Path {
  length: number;
  at(s: number): { p: Vec3; heading: number };
}

type Pt = { x: number; y: number };

/** Haul trucks keep ±4.6 m either side of the centreline: two lanes 9.2 m apart (DESIGN.md Motion). */
export const HAUL_LANE_OFFSET = 4.6;
/** Light vehicles on the 10 m access road. */
export const LV_LANE_OFFSET = 2.2;

function polylinePath(points: Vec3[], closed: boolean): Path {
  const pts = closed ? [...points, points[0]!] : points;
  const cum = [0];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    cum.push(cum[i - 1]! + Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z));
  }
  const length = cum[cum.length - 1]!;
  return {
    length,
    at(s) {
      const w = ((s % length) + length) % length;
      let lo = 0;
      let hi = cum.length - 1;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (cum[mid]! <= w) lo = mid;
        else hi = mid;
      }
      const a = pts[lo]!;
      const b = pts[hi]!;
      const span = cum[hi]! - cum[lo]!;
      const t = span === 0 ? 0 : (w - cum[lo]!) / span;
      return {
        p: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t },
        heading: Math.atan2(b.y - a.y, b.x - a.x),
      };
    },
  };
}

/** The polyline shifted `d` metres sideways in the ground plane (left of travel for d > 0), mitred at joints. */
function offsetPolyline(points: Vec3[], d: number): Vec3[] {
  const normal = (a: Vec3, b: Vec3): Pt => {
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    return { x: -(b.y - a.y) / len, y: (b.x - a.x) / len };
  };
  return points.map((p, i) => {
    const n1 = i > 0 ? normal(points[i - 1]!, p) : null;
    const n2 = i + 1 < points.length ? normal(p, points[i + 1]!) : null;
    const a = n1 ?? n2!;
    const b = n2 ?? n1!;
    const m = { x: a.x + b.x, y: a.y + b.y };
    const len = Math.hypot(m.x, m.y);
    const cos = (m.x / len) * a.x + (m.y / len) * a.y;
    const k = d / Math.max(cos, 0.5);
    return { x: p.x + (m.x / len) * k, y: p.y + (m.y / len) * k, z: p.z };
  });
}

/** Out along one lane, back along the other: a closed two-lane circuit around `centre`. */
function twoLaneLoop(centre: Vec3[], offset: number): Vec3[] {
  return [...offsetPolyline(centre, offset), ...offsetPolyline(centre, -offset).reverse()];
}

const ground = (pts: Pt[]): Vec3[] => pts.map((p) => ({ x: p.x, y: p.y, z: 0 }));
const road = (id: string) => {
  const r = LAYOUT.roads.find((q) => q.id === id);
  if (!r) throw new Error(`layout has no road ${id}`);
  return r;
};

// --- The ramp ----------------------------------------------------------------------

const { pit } = LAYOUT;
const DEPTH = -pit.benches[pit.benches.length - 1]!.floorZ;
/** At the floor, the ramp's centreline is half a ramp width inside the toe of the bottom bench. */
const FLOOR_INSET = pit.benches[0]!.radiusX - pit.benches[pit.benches.length - 1]!.radiusX + BATTER_RUN + pit.rampWidth / 2;
const RAMP_SAMPLES = 160;

/**
 * The spiral's ground track for a given sweep at constant grade: z falls in proportion to ground run, and the
 * inset from the crest grows in proportion to depth, so the ramp follows the overall wall slope and never dips
 * below the benches. Inset and run depend on each other; a few fixed-point passes settle them.
 */
function spiral(sweep: number): { pts: Vec3[]; run: number } {
  const angle = (i: number) => pit.rampHeadAngle - (sweep * i) / RAMP_SAMPLES;
  let frac = Array.from({ length: RAMP_SAMPLES + 1 }, (_, i) => i / RAMP_SAMPLES);
  let ring: { x: number; y: number }[] = [];
  let run = 0;
  for (let pass = 0; pass < 30; pass++) {
    ring = frac.map((f, i) => pitRing(angle(i), FLOOR_INSET * f));
    const cum = [0];
    for (let i = 1; i < ring.length; i++) cum.push(cum[i - 1]! + Math.hypot(ring[i]!.x - ring[i - 1]!.x, ring[i]!.y - ring[i - 1]!.y));
    run = cum[cum.length - 1]!;
    const next = cum.map((c) => c / run);
    const moved = Math.max(...next.map((f, i) => Math.abs(f - frac[i]!)));
    frac = next;
    if (moved < 1e-12) break;
  }
  ring = frac.map((f, i) => pitRing(angle(i), FLOOR_INSET * f));
  return { pts: ring.map((p, i) => ({ ...p, z: -DEPTH * frac[i]! })), run };
}

/** The ramp centreline, crest to floor: a constant-grade spiral cut into the walls, its sweep solved for the design grade. */
export function rampCentreline(): Vec3[] {
  const target = DEPTH / pit.rampGrade;
  let lo = 0.1;
  let hi = 2 * Math.PI;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (spiral(mid).run < target) lo = mid;
    else hi = mid;
  }
  return spiral((lo + hi) / 2).pts;
}

// --- Paths ------------------------------------------------------------------------

const RAMP = rampCentreline();
const rampEnd = RAMP[RAMP.length - 1]!;
const rampExit = (() => {
  const prev = RAMP[RAMP.length - 2]!;
  const len = Math.hypot(rampEnd.x - prev.x, rampEnd.y - prev.y);
  return { x: rampEnd.x + ((rampEnd.x - prev.x) / len) * 25, y: rampEnd.y + ((rampEnd.y - prev.y) / len) * 25, z: rampEnd.z };
})();

/** Dump pocket → haul road → ramp → pit floor → shovel. Trucks run down it empty on one lane and back up loaded on the other. */
export const HAUL_CENTRELINE: Vec3[] = [
  ...ground(road('haul-rom').points.slice(0, -1)),
  ...RAMP,
  rampExit,
  pit.loadingPoint,
];

export const HAUL_CYCLE: Path = polylinePath(twoLaneLoop(HAUL_CENTRELINE, HAUL_LANE_OFFSET), true);

/** Length of the outbound lane (dump pocket to shovel): `HAUL_CYCLE` turns round at the shovel here. */
export const HAUL_OUTBOUND_LENGTH = polylinePath(offsetPolyline(HAUL_CENTRELINE, HAUL_LANE_OFFSET), false).length;

export const RAIL_LOOP: Path = (() => {
  const { centre, radius } = LAYOUT.railLoop;
  return {
    length: 2 * Math.PI * radius,
    at(s: number) {
      const a = s / radius;
      return { p: { x: centre.x + radius * Math.cos(a), y: centre.y + radius * Math.sin(a), z: 0 }, heading: a + Math.PI / 2 };
    },
  };
})();

/** The light-vehicle road's centreline, camp end first. */
export const LV_CENTRELINE: Vec3[] = ground(road('access').points);

export const LV_LOOP: Path = polylinePath(twoLaneLoop(LV_CENTRELINE, LV_LANE_OFFSET), true);

/** Length of `LV_LOOP`'s first lane: it turns round at the road's far end here. */
export const LV_OUTBOUND_LENGTH = polylinePath(offsetPolyline(LV_CENTRELINE, LV_LANE_OFFSET), false).length;

/** Belt heights off the gallery: the crusher discharge and the stockyard belt. */
const DISCHARGE_Z = 4;
const YARD_BELT_Z = 3;

/** Ore from the crusher discharge, up onto the overland gallery over the creek, down to the stockyard belt. */
export const CONVEYOR: Path = (() => {
  const s = (id: string) => LAYOUT.structures.find((t) => t.id === id)!;
  const crusher = s('crusher');
  const gallery = s('overland-gallery');
  const yard = LAYOUT.stockyard.at;
  const y = gallery.at.y + gallery.size.y / 2;
  const top = gallery.size.z;
  return polylinePath(
    [
      { x: crusher.at.x + crusher.size.x, y, z: DISCHARGE_Z },
      { x: gallery.at.x, y, z: top },
      { x: gallery.at.x + gallery.size.x, y, z: top },
      { x: yard.x + 5, y, z: YARD_BELT_Z },
      { x: yard.x + yard.w - 10, y, z: YARD_BELT_Z },
    ],
    false,
  );
})();
