import type { Rect, Vec3 } from './iso.js';

/**
 * The model site's world geometry in metres (D-100, D-105). Display geometry only: nothing here feeds
 * the engine. World (0, 0) is the back corner; with the screen compass, north is up the screen, so
 * screen east is +x − y and screen south is +x + y. Every value is assumed, chosen to be credible
 * against DESIGN.md "Mining Accuracy", not to match a particular mine.
 */

type Pt = { x: number; y: number };

export const BOARD = { w: 1600, h: 1000 } as const;

/** Ultra-class haul truck (CAT 793 / Komatsu 930E), metres. */
export const TRUCK = { length: 13, width: 7.6 } as const;

/** Horizontal run of each bench face; the berm is the rest of the bench step. */
export const BATTER_RUN = 5;
const BERM = 11;
const BENCH_HEIGHT = 12;

/** `at` is the footprint's minimum corner (smallest x and y) at ground level; `size` is its extent. */
export interface Structure {
  id: string;
  kind: 'box' | 'tank' | 'cone' | 'gallery' | 'shed' | 'magazine' | 'camp';
  at: Vec3;
  size: Vec3;
  /** A colour token name from tokens.css. */
  base: string;
}

export interface Layout {
  pit: {
    centre: Vec3;
    /** Bench i's crest radii and the height of its toe (the next level down). Index 0 is the pit crest. */
    benches: { radiusX: number; radiusY: number; floorZ: number }[];
    rampWidth: number;
    /** A fraction: 0.11 is 11 %. */
    rampGrade: number;
    /** Crest angle (radians, ellipse parameter) where the ramp leaves the surface; it descends with decreasing angle. */
    rampHeadAngle: number;
    /** Where the face shovel loads trucks on the pit floor. */
    loadingPoint: Vec3;
  };
  roads: { id: string; points: Pt[]; width: number }[];
  structures: Structure[];
  /** Keyed by register process id: the flag pole and the hatched pad. */
  areas: Record<string, { anchor: Vec3; pad: Pt[] }>;
  /** Keyed by service group id, in SERVICE_GROUPS order, along the back edge. */
  entryPosts: Record<string, Vec3>;
  railLoop: { centre: Vec3; radius: number };
  stockyard: { windrows: number; at: Rect };
  /** Where trucks tip into the primary crusher. */
  dumpPocket: Vec3;
  creek: Pt[];
  ridge: Pt[];
  /** Default framing: the pit, ROM pad and crusher. */
  defaultFocus: Rect;
}

const PIT_CENTRE: Vec3 = { x: 500, y: 560, z: 0 };
const CREST = { x: 270, y: 210 };
const STEP = BATTER_RUN + BERM;
const RAMP_HEAD = -0.9;
/** Where trucks tip into the primary crusher, 14 m off its west face. */
const DUMP_POCKET: Vec3 = { x: 976, y: 380, z: 0 };

const box = (id: string, kind: Structure['kind'], x: number, y: number, w: number, d: number, h: number, base: string): Structure => ({
  id,
  kind,
  at: { x, y, z: 0 },
  size: { x: w, y: d, z: h },
  base,
});
const quad = (x: number, y: number, w: number, h: number): Pt[] => [
  { x, y },
  { x: x + w, y },
  { x: x + w, y: y + h },
  { x, y: y + h },
];

/** A point on the ellipse `inset` metres inside the crest, at ellipse parameter `a`. */
export function pitRing(a: number, inset: number): Pt {
  return { x: PIT_CENTRE.x + (CREST.x - inset) * Math.cos(a), y: PIT_CENTRE.y + (CREST.y - inset) * Math.sin(a) };
}

/** `d` metres back along the ramp's tangent from its head, so the haul road joins the ramp without a kink. */
function rampApproach(d: number): Pt {
  const head = pitRing(RAMP_HEAD, 0);
  const tx = -CREST.x * Math.sin(RAMP_HEAD); // −d/da: the ramp descends with decreasing angle
  const ty = CREST.y * Math.cos(RAMP_HEAD);
  const len = Math.hypot(tx, ty);
  return { x: head.x + (tx / len) * d, y: head.y + (ty / len) * d };
}

/** The drill pattern sits on the first berm, away from the ramp. */
const DRILL_ANGLE = 1.0;
const drillPad = [pitRing(DRILL_ANGLE - 0.08, 6), pitRing(DRILL_ANGLE + 0.08, 6), pitRing(DRILL_ANGLE + 0.08, 15), pitRing(DRILL_ANGLE - 0.08, 15)];

export const LAYOUT: Layout = {
  pit: {
    centre: PIT_CENTRE,
    benches: [0, 1, 2, 3, 4].map((i) => ({
      radiusX: CREST.x - i * STEP,
      radiusY: CREST.y - i * STEP,
      floorZ: -BENCH_HEIGHT * (i + 1),
    })),
    rampWidth: 25,
    rampGrade: 0.11,
    rampHeadAngle: RAMP_HEAD,
    loadingPoint: { x: 460, y: 640, z: -60 },
  },
  roads: [
    // Dump pocket to the ramp head, arriving along the ramp's tangent.
    { id: 'haul-rom', width: 26, points: [{ x: DUMP_POCKET.x, y: DUMP_POCKET.y }, { x: 880, y: 400 }, { x: 790, y: 420 }, rampApproach(45), pitRing(RAMP_HEAD, 0)] },
    // Branch from the ROM road to the workshop hardstand and fuel bay.
    { id: 'haul-workshop', width: 26, points: [{ x: 790, y: 420 }, { x: 760, y: 330 }, { x: 660, y: 240 }, { x: 560, y: 205 }] },
    // Spur from the ramp head round the pit's east side to the waste dump.
    { id: 'haul-dump', width: 26, points: [rampApproach(45), { x: 790, y: 500 }, { x: 820, y: 650 }, { x: 800, y: 805 }] },
    // Light-vehicle road: camp, admin block, between the fuel bund and bay, to the haul road's end at the
    // workshop hardstand (the one controlled crossing to the haul network), then on to the magazine track.
    {
      id: 'access',
      width: 10,
      points: [
        { x: 1260, y: 150 },
        { x: 1100, y: 150 },
        { x: 900, y: 140 },
        { x: 860, y: 120 },
        { x: 680, y: 115 },
        { x: 560, y: 115 },
        { x: 560, y: 205 },
        { x: 400, y: 195 },
      ],
    },
    // Magazine track from the end of the access road down the west side, under the ridge.
    { id: 'magazine-track', width: 7, points: [{ x: 400, y: 195 }, { x: 280, y: 260 }, { x: 170, y: 450 }, { x: 140, y: 700 }, { x: 150, y: 860 }] },
  ],
  structures: [
    box('workshop', 'shed', 420, 100, 90, 45, 17, 'galvanised'), // four 14 m roller doors on the south-west face
    box('fuel-bund', 'box', 580, 45, 44, 44, 1.8, 'line-2'),
    box('fuel-tank-1', 'tank', 584, 49, 13, 13, 10, 'paper-2'),
    box('fuel-tank-2', 'tank', 607, 49, 13, 13, 10, 'paper-2'),
    box('fuel-tank-3', 'tank', 584, 72, 13, 13, 10, 'paper-2'),
    box('fuel-tank-4', 'tank', 607, 72, 13, 13, 10, 'paper-2'),
    box('fuel-bay', 'box', 575, 140, 36, 26, 9, 'roof-steel'), // canopy
    box('admin', 'box', 700, 40, 40, 14, 4, 'paper-2'),
    box('control-room', 'box', 760, 38, 26, 16, 5, 'paper-2'),
    box('mast', 'box', 815, 50, 3, 3, 45, 'galvanised'),
    box('camp', 'camp', 1250, 20, 300, 100, 3.2, 'paper'),
    box('magazine-1', 'magazine', 100, 900, 22, 20, 3.4, 'oxide-high'),
    box('magazine-2', 'magazine', 160, 940, 22, 20, 3.4, 'oxide-high'),
    box('crusher', 'box', 990, 360, 35, 40, 26, 'galvanised'), // primary gyratory; dump pocket on the west face
    box('overland-gallery', 'gallery', 1045, 378, 165, 4, 10, 'roof-steel'), // belt level on top; inclines at each end
    box('windrow-1', 'cone', 1250, 320, 300, 40, 14, 'ore-load'),
    box('windrow-2', 'cone', 1250, 410, 300, 40, 14, 'ore-load'),
    box('stacker', 'box', 1300, 377, 12, 10, 20, 'galvanised'),
    box('reclaimer', 'box', 1460, 377, 12, 10, 12, 'galvanised'),
    box('reclaim-gallery', 'gallery', 1338, 470, 4, 78, 20, 'roof-steel'),
    box('loadout', 'box', 1325, 548, 30, 24, 26, 'galvanised'), // bin straddling the loop track
    box('waste-dump', 'cone', 700, 820, 200, 150, 24, 'oxide-low'),
  ],
  areas: {
    'diesel-ordering': { anchor: { x: 650, y: 175, z: 0 }, pad: quad(565, 35, 95, 150) },
    'explosives-ordering': { anchor: { x: 230, y: 980, z: 0 }, pad: quad(60, 875, 180, 115) },
    'work-orders': { anchor: { x: 530, y: 170, z: 0 }, pad: quad(400, 85, 140, 95) },
    payroll: { anchor: { x: 745, y: 65, z: 0 }, pad: quad(690, 30, 60, 40) },
    'control-room': { anchor: { x: 795, y: 65, z: 0 }, pad: quad(752, 30, 48, 40) },
    'remote-operations': { anchor: { x: 855, y: 80, z: 0 }, pad: quad(805, 30, 55, 55) },
    'drill-and-blast': { anchor: { ...pitRing(DRILL_ANGLE, 10.5), z: -BENCH_HEIGHT }, pad: drillPad },
    haulage: { anchor: { x: 800, y: 400, z: 0 }, pad: quad(745, 395, 70, 55) },
    crushing: { anchor: { x: 1020, y: 450, z: 0 }, pad: quad(820, 300, 210, 160) },
    rail: { anchor: { x: 1300, y: 590, z: 0 }, pad: quad(1290, 520, 100, 80) },
  },
  entryPosts: {
    'hosted-erp': { x: 120, y: 12, z: 0 },
    'cloud-identity': { x: 240, y: 12, z: 0 },
    'iroc-link': { x: 360, y: 12, z: 0 },
    'corporate-network': { x: 480, y: 12, z: 0 },
    'vendor-access': { x: 600, y: 12, z: 0 },
  },
  railLoop: { centre: { x: 1340, y: 770, z: 0 }, radius: 210 },
  stockyard: { windrows: 2, at: { x: 1230, y: 290, w: 340, h: 190 } },
  dumpPocket: DUMP_POCKET,
  creek: [
    { x: 1065, y: 0 },
    { x: 1090, y: 150 },
    { x: 1110, y: 320 },
    { x: 1095, y: 450 },
    { x: 1060, y: 600 },
    { x: 1020, y: 750 },
    { x: 990, y: 880 },
    { x: 975, y: 1000 },
  ],
  ridge: [
    { x: 40, y: 200 },
    { x: 55, y: 350 },
    { x: 45, y: 500 },
    { x: 60, y: 650 },
    { x: 50, y: 820 },
  ],
  defaultFocus: { x: 220, y: 300, w: 830, h: 490 },
};

// --- Small helpers --------------------------------------------------------------

/** ≤ 1 inside the pit crest grown by `margin` metres (negative shrinks it), > 1 outside. */
export function crestValue(p: Pt, margin: number): number {
  return ((p.x - PIT_CENTRE.x) / (CREST.x + margin)) ** 2 + ((p.y - PIT_CENTRE.y) / (CREST.y + margin)) ** 2;
}

/** Ground-plane distance from `p` to a polyline. */
export function distToPolyline(p: Pt, line: Pt[]): number {
  let best = Infinity;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1]!;
    const b = line[i]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
    best = Math.min(best, Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy)));
  }
  return best;
}

/** Even-odd point-in-polygon test on the ground plane. */
export function insidePolygon(p: Pt, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Gap between two axis-aligned rectangles; 0 when they touch or overlap. */
export function rectDistance(a: Rect, b: Rect): number {
  const dx = Math.max(0, a.x - (b.x + b.w), b.x - (a.x + a.w));
  const dy = Math.max(0, a.y - (b.y + b.h), b.y - (a.y + a.h));
  return Math.hypot(dx, dy);
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Spinifex tussock positions on open ground only: off roads, pads, structures, the pit, the creek bed and the rail. */
export function spinifexPoints(seed: number, count = 1100): Pt[] {
  const rand = mulberry32(seed);
  const { roads, areas, structures, railLoop, creek, stockyard } = LAYOUT;
  const open = (p: Pt) =>
    crestValue(p, 8) > 1 &&
    roads.every((r) => distToPolyline(p, r.points) > r.width / 2 + 3) &&
    Object.values(areas).every((a) => !insidePolygon(p, a.pad)) &&
    structures.every((s) => rectDistance({ x: p.x, y: p.y, w: 0, h: 0 }, { x: s.at.x, y: s.at.y, w: s.size.x, h: s.size.y }) > 3) &&
    rectDistance({ x: p.x, y: p.y, w: 0, h: 0 }, stockyard.at) > 3 &&
    distToPolyline(p, creek) > 20 &&
    Math.abs(Math.hypot(p.x - railLoop.centre.x, p.y - railLoop.centre.y) - railLoop.radius) > 8;
  const out: Pt[] = [];
  for (let i = 0; i < count * 4 && out.length < count; i++) {
    const p = { x: 4 + rand() * (BOARD.w - 8), y: 4 + rand() * (BOARD.h - 8) };
    if (open(p)) out.push(p);
  }
  return out;
}
