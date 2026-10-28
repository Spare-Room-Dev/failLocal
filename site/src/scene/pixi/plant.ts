import type { Graphics } from 'pixi.js';
import { depthKey, mix, shade, shadowHull } from '../iso.js';
import type { Vec3 } from '../iso.js';
import { BOARD, distToPolyline, LAYOUT, spinifexPoints } from '../layout.js';
import type { Structure } from '../layout.js';
import { token } from '../palette.js';
import { CONVEYOR } from '../paths.js';
import { B_TOP, ball, band, beam, box, chaikin, convex, cylinder, DepthQueue, face, fill, flat, line, P, rng, vnoise } from './draw.js';
import type { Pt } from './draw.js';

/**
 * The site on the ground: roads and rail, pads, plant and buildings, their cast shadows, and the
 * spinifex. Structures, gums and tussocks share one painter's queue so nearer things cover farther ones.
 */

/** Cast shadows go into one Graphics, opaque; the layer is blurred and set to 34 % as a whole. */
export class Shadows {
  constructor(readonly g: Graphics) {}
  private readonly colour = token('cast-shadow');
  /** The shadow of a footprint `height` metres tall (DESIGN.md Cast shadows). */
  cast(footprint: Pt[], height: number): void {
    this.poly(shadowHull(footprint, height));
  }
  poly(pts: Pt[]): void {
    this.g.poly(flat(pts.map((p) => ({ ...p, z: 0 })))).fill(this.colour);
  }
  disc(c: Pt, rx: number, ry: number): void {
    const [sx, sy] = P({ ...c, z: 0 });
    this.g.ellipse(sx, sy, rx, ry).fill(this.colour);
  }
}

const rect = (x: number, y: number, w: number, d: number): Pt[] => [
  { x, y },
  { x: x + w, y },
  { x: x + w, y: y + d },
  { x, y: y + d },
];
const footprint = (s: Structure) => rect(s.at.x, s.at.y, s.size.x, s.size.y);
const structure = (id: string) => {
  const s = LAYOUT.structures.find((t) => t.id === id);
  if (!s) throw new Error(`layout has no structure ${id}`);
  return s;
};

// --- Roads and rail ------------------------------------------------------------------

const roadLine = (id: string) => chaikin(LAYOUT.roads.find((r) => r.id === id)!.points, 2);
const ROAD_IDS = LAYOUT.roads.map((r) => r.id);
const HAUL = ROAD_IDS.filter((id) => id.startsWith('haul-'));

/** Haul roads with darker windrow edges, the sealed access and site roads, the magazine track, the rail. */
export function drawRoads(g: Graphics): void {
  const haul = shade(token('haul-road'), B_TOP - 0.3);
  const windrow = shade(mix(token('haul-road'), token('oxide-low'), 0.5), B_TOP - 0.36);
  for (const id of HAUL) band(g, roadLine(id), 26 + 6, windrow);
  for (const id of HAUL) band(g, roadLine(id), 26, haul);

  const sealed = mix(token('plinth'), token('haul-road'), 0.22);
  const gravel = shade(mix(token('haul-road'), token('oxide-high'), 0.3), B_TOP - 0.34);
  for (const r of LAYOUT.roads) {
    if (r.id.startsWith('haul-')) continue;
    band(g, roadLine(r.id), r.width, r.id === 'magazine-track' ? gravel : sealed);
  }
  const marking = mix(token('paper-2'), token('haul-road'), 0.3);
  for (const id of ['access', 'site-road']) dashes(g, roadLine(id), 4, 6, marking, 0.7);

  drawRail(g);
}

/** Centre-line dashes `on` metres long every `on + off` metres. */
function dashes(g: Graphics, pts: Pt[], on: number, off: number, colour: string, width: number): void {
  let carry = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    for (let s = carry; s < len; s += on + off) {
      const e = Math.min(len, s + on);
      const p = (t: number): Vec3 => ({ x: a.x + ((b.x - a.x) * t) / len, y: a.y + ((b.y - a.y) * t) / len, z: 0 });
      line(g, [p(s), p(e)], colour, width);
    }
    carry = (((carry - len) % (on + off)) + (on + off)) % (on + off);
  }
}

/** The balloon loop's track and the main line leaving the board's front-right edge for the port. */
export const MAIN_LINE: Pt[] = (() => {
  const { centre, radius } = LAYOUT.railLoop;
  const x0 = centre.x + radius;
  return chaikin(
    [
      { x: x0, y: centre.y },
      { x: x0, y: centre.y + 40 },
      { x: x0 + 12, y: centre.y + 85 },
      { x: x0 + 38, y: centre.y + 120 },
      { x: BOARD.w, y: centre.y + 140 },
    ],
    3,
  );
})();

function drawRail(g: Graphics): void {
  const { centre, radius } = LAYOUT.railLoop;
  const loop: Pt[] = Array.from({ length: 181 }, (_, i) => ({ x: centre.x + radius * Math.cos((i / 180) * 2 * Math.PI), y: centre.y + radius * Math.sin((i / 180) * 2 * Math.PI) }));
  const ballast = shade(mix(token('galvanised'), token('haul-road'), 0.55), B_TOP - 0.3);
  const sleepers = shade(mix(token('galvanised'), token('haul-road'), 0.3), B_TOP - 0.28);
  const steel = mix(token('wagon-dark'), token('roof-steel'), 0.2);
  for (const track of [loop, MAIN_LINE]) band(g, track, 9, ballast);
  for (const track of [loop, MAIN_LINE]) {
    band(g, track, 5, sleepers);
    for (const d of [-0.9, 0.9]) {
      const rail = track.map((p, i) => {
        const a = track[Math.max(0, i - 1)]!;
        const b = track[Math.min(track.length - 1, i + 1)]!;
        const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        return { x: p.x - ((b.y - a.y) / len) * d, y: p.y + ((b.x - a.x) / len) * d, z: 0 };
      });
      line(g, rail, steel, 0.7);
    }
  }
}

// --- Pads ---------------------------------------------------------------------------

/** Hardstands and pads: workshop, fuel bay, offices, ROM pad, stockyard, loadout, camp, magazine compound. */
export function drawPads(g: Graphics): void {
  const { areas, stockyard } = LAYOUT;
  const hard = shade(mix(token('haul-road'), token('oxide-high'), 0.18), B_TOP - 0.3);
  const rom = shade(mix(token('ore-load'), token('oxide-low'), 0.4), B_TOP - 0.3);
  const yard = shade(mix(token('oxide-high'), token('ore-load'), 0.45), B_TOP - 0.32);
  const camp = shade(mix(token('haul-road'), token('shade-lite'), 0.2), B_TOP - 0.3);
  const pad = (pts: Pt[], colour: string) => fill(g, pts.map((p) => ({ ...p, z: 0 })), colour);
  for (const id of ['work-orders', 'diesel-ordering', 'payroll', 'control-room', 'remote-operations', 'rail', 'explosives-ordering']) pad(areas[id]!.pad, hard);
  pad(areas.crushing!.pad, rom);
  pad(rect(stockyard.at.x, stockyard.at.y, stockyard.at.w, stockyard.at.h), yard);
  const c = structure('camp');
  pad(rect(c.at.x - 10, c.at.y - 8, c.size.x + 20, c.size.y + 16), camp);
}

// --- Structures ------------------------------------------------------------------------

/** Every structure in the layout, queued at its depth, with its cast shadow. */
export function queueStructures(q: DepthQueue, shadows: Shadows): void {
  for (const s of LAYOUT.structures) {
    const draw = DRAW[s.id] ?? DRAW_KIND[s.kind];
    draw(s, q, shadows);
  }
  queueRomStocks(q, shadows);
}

type Draw = (s: Structure, q: DepthQueue, shadows: Shadows) => void;
const centreKey = (s: Structure, bias = 0) => depthKey({ x: s.at.x + s.size.x / 2, y: s.at.y + s.size.y / 2, z: 0 }, bias);
const c = (name: string) => token(name);

const plainBox: Draw = (s, q, shadows) => {
  q.add(centreKey(s), (g) => box(g, s.at.x, s.at.y, 0, s.size.x, s.size.y, s.size.z, c(s.base)));
  shadows.cast(footprint(s), s.size.z);
};

/** Offices: pale walls, a roof-steel roof, a band of windows along the front. */
const office: Draw = (s, q, shadows) => {
  const { x, y } = s.at;
  const { x: w, y: d, z: h } = s.size;
  q.add(centreKey(s), (g) => {
    box(g, x, y, 0, w, d, h, c(s.base), c('roof-steel'));
    line(g, [{ x: x + 1.5, y: y + d, z: h * 0.55 }, { x: x + w - 1.5, y: y + d, z: h * 0.55 }], mix(c('ink-2'), c('roof-steel'), 0.3), 1.1, 0.8);
  });
  shadows.cast(footprint(s), h);
};

/** The workshop: a gable shed with four roller doors sized for ultra-class trucks on its south-west (+y) face. */
const workshop: Draw = (s, q, shadows) => {
  const { x, y } = s.at;
  const { x: w, y: d, z: h } = s.size;
  const ridge = h + 6;
  const wall = c(s.base);
  const roof = c('roof-steel');
  q.add(centreKey(s), (g) => {
    const inside = { x: x + w / 2, y: y + d / 2, z: h / 2 };
    face(g, [{ x, y: y + d, z: 0 }, { x: x + w, y: y + d, z: 0 }, { x: x + w, y: y + d, z: h }, { x, y: y + d, z: h }], wall, inside);
    face(g, [{ x: x + w, y, z: 0 }, { x: x + w, y: y + d, z: 0 }, { x: x + w, y: y + d, z: h }, { x: x + w, y: y + d / 2, z: ridge }, { x: x + w, y, z: h }], wall, inside);
    face(g, [{ x, y, z: h }, { x: x + w, y, z: h }, { x: x + w, y: y + d / 2, z: ridge }, { x, y: y + d / 2, z: ridge }], roof, { ...inside, y: y + d });
    face(g, [{ x, y: y + d / 2, z: ridge }, { x: x + w, y: y + d / 2, z: ridge }, { x: x + w, y: y + d, z: h }, { x, y: y + d, z: h }], roof, { ...inside, y });
    const door = shade(mix(c('roof-steel'), c('ink-3'), 0.25), -0.05);
    const rib = mix(door, c('ink-3'), 0.35);
    for (let i = 0; i < 4; i++) {
      const dx = x + 5 + i * 21.5;
      const open = i === 1;
      fill(g, [{ x: dx, y: y + d, z: 0 }, { x: dx + 14, y: y + d, z: 0 }, { x: dx + 14, y: y + d, z: 12 }, { x: dx, y: y + d, z: 12 }], open ? mix(c('wagon-dark'), c('ink'), 0.4) : door);
      if (!open) for (let zz = 1.5; zz < 12; zz += 1.5) line(g, [{ x: dx + 0.3, y: y + d, z: zz }, { x: dx + 13.7, y: y + d, z: zz }], rib, 0.35);
    }
    for (let i = 1; i < 10; i++) line(g, [{ x: x + (i * w) / 10, y: y + d / 2, z: ridge }, { x: x + (i * w) / 10, y: y + d, z: h }], shade(roof, -0.1), 0.35, 0.7);
  });
  shadows.cast(footprint(s), ridge);
};

/** The diesel bund: a floor and low walls; the back walls draw before the tanks, the front walls after. */
const fuelBund: Draw = (s, q) => {
  const { x, y } = s.at;
  const { x: w, y: d, z: h } = s.size;
  const t = 1.2;
  const base = c(s.base);
  q.add(depthKey({ x, y, z: 0 }), (g) => {
    fill(g, rect(x, y, w, d).map((p) => ({ ...p, z: 0 })), shade(base, B_TOP - 0.1));
    box(g, x, y, 0, w, t, h, base);
    box(g, x, y, 0, t, d, h, base);
  });
  q.add(depthKey({ x: x + w, y: y + d, z: 0 }), (g) => {
    box(g, x, y + d - t, 0, w, t, h, base);
    box(g, x + w - t, y, 0, t, d, h, base);
  });
};

const tank: Draw = (s, q, shadows) => {
  const r = s.size.x / 2;
  const cx = s.at.x + r;
  const cy = s.at.y + s.size.y / 2;
  q.add(centreKey(s, 0.5), (g) => cylinder(g, cx, cy, 0, r, s.size.z, c(s.base), c('galvanised')));
  shadows.cast(Array.from({ length: 12 }, (_, i) => ({ x: cx + r * Math.cos((i / 12) * 2 * Math.PI), y: cy + r * Math.sin((i / 12) * 2 * Math.PI) })), s.size.z);
};

/** The fuel bay: a canopy on four posts over two bowsers. */
const fuelBay: Draw = (s, q, shadows) => {
  const { x, y } = s.at;
  const { x: w, y: d, z: h } = s.size;
  q.add(centreKey(s), (g) => {
    for (const [px, py] of [[x + 2, y + 2], [x + w - 3, y + 2], [x + 2, y + d - 3], [x + w - 3, y + d - 3]] as const) box(g, px, py, 0, 0.8, 0.8, h - 1, c('roof-steel'));
    for (const py of [y + 8, y + 16]) box(g, x + w / 2 - 1, py, 0, 2, 2, 2.2, c('galvanised'));
    box(g, x, y, h - 1, w, d, 1, c('galvanised'), c(s.base));
  });
  shadows.poly(rect(x, y, w, d).map((p) => ({ x: p.x + 1.5 * h, y: p.y - 0.15 * h })));
};

/** The 45 m communications mast: a three-legged lattice with a dish. */
const mast: Draw = (s, q, shadows) => {
  const mx = s.at.x + 1.5;
  const my = s.at.y + 1.5;
  const H = s.size.z;
  const steel = c(s.base);
  q.add(centreKey(s), (g) => {
    const legs = [
      [-1.6, 1.6],
      [1.6, -1.6],
      [1.6, 1.6],
    ] as const;
    for (const [dx, dy] of legs) line(g, [{ x: mx + dx, y: my + dy, z: 0 }, { x: mx + dx * 0.2, y: my + dy * 0.2, z: H }], shade(steel, dx + dy > 0 ? -0.2 : 0.1), 0.9);
    for (let z = 4; z < H - 2; z += 5) {
      const f = 1 - (z / H) * 0.8;
      line(g, [{ x: mx - 1.6 * f, y: my + 1.6 * f, z }, { x: mx + 1.6 * f, y: my + 1.6 * f, z: z + 2.5 }], shade(steel, 0), 0.4);
    }
    const [sx, sy] = P({ x: mx - 1, y: my + 1, z: H - 7 });
    g.ellipse(sx - 2, sy, 1.6, 2.6).fill(c('paper')).stroke({ color: c('roof-steel'), width: 0.4 });
  });
  shadows.poly([{ x: mx - 2, y: my }, { x: mx + 2, y: my }, { x: mx + 1.5 * H + 0.6, y: my - 0.15 * H }, { x: mx + 1.5 * H - 0.6, y: my - 0.15 * H + 0.5 }]);
};

/** The camp: rows of single-storey accommodation blocks and a mess hall, with shade trees. */
const camp: Draw = (s, q, shadows) => {
  const { x, y } = s.at;
  const wall = c(s.base);
  const roof = c('roof-steel');
  for (let col = 0; col < 7; col++)
    for (let row = 0; row < 8; row++) {
      const bx = x + 8 + col * 37;
      const by = y + 6 + row * 11.5;
      q.add(depthKey({ x: bx + 14, y: by + 2, z: 0 }), (g) => {
        box(g, bx, by, 0, 28, 4, s.size.z, wall, roof);
        line(g, [{ x: bx + 1, y: by + 4, z: 1.8 }, { x: bx + 27, y: by + 4, z: 1.8 }], mix(c('ink-3'), roof, 0.3), 0.6, 0.7);
      });
      shadows.cast(rect(bx, by, 28, 4), s.size.z);
    }
  const hall = { x: x + 8 + 7 * 37, y: y + 10, w: 30, d: 44, h: 5.5 };
  q.add(depthKey({ x: hall.x + hall.w / 2, y: hall.y + hall.d / 2, z: 0 }), (g) => box(g, hall.x, hall.y, 0, hall.w, hall.d, hall.h, wall, roof));
  shadows.cast(rect(hall.x, hall.y, hall.w, hall.d), hall.h);
  const R = rng(5);
  const green = mix(c('spinifex-low'), c('shade-dark'), 0.4);
  for (let i = 0; i < 14; i++) {
    const t = { x: x + 4 + R() * (s.size.x - 8), y: y + 5 + Math.floor(R() * 7) * 11.5 + 5.6 };
    const r = 2.6 + R() * 1.2;
    q.add(t.x + t.y + 0.5, (g) => {
      ball(g, { ...t, z: r * 1.3 }, r, green);
      ball(g, { x: t.x - r * 0.25, y: t.y - r * 0.2, z: r * 1.6 }, r * 0.5, shade(c('spinifex-low'), 0));
    });
    shadows.disc({ x: t.x + 1.5 * r * 1.3, y: t.y - 0.15 * r * 1.3 }, r * 1.6, r * 0.8);
  }
};

/** A pyramid frustum's faces from base rectangle to inset top. */
function frustum(x0: number, y0: number, x1: number, y1: number, z0: number, z1: number, inset: number): Vec3[][] {
  const b = [{ x: x0, y: y0, z: z0 }, { x: x1, y: y0, z: z0 }, { x: x1, y: y1, z: z0 }, { x: x0, y: y1, z: z0 }];
  const t = [{ x: x0 + inset, y: y0 + inset, z: z1 }, { x: x1 - inset, y: y0 + inset, z: z1 }, { x: x1 - inset, y: y1 - inset, z: z1 }, { x: x0 + inset, y: y1 - inset, z: z1 }];
  return [...b.map((p, i) => [p, b[(i + 1) % 4]!, t[(i + 1) % 4]!, t[i]!]), t];
}

/** An explosives magazine: a small store inside an earth bund. */
const magazine: Draw = (s, q, shadows) => {
  const { x, y } = s.at;
  const { x: w, y: d, z: h } = s.size;
  const earth = mix(c(s.base), c('haul-road'), 0.35);
  q.add(centreKey(s), (g) => {
    convex(g, frustum(x - 7, y - 7, x + w + 7, y + d + 7, 0, h + 1.2, 4.5), earth);
    fill(g, rect(x - 2.5, y - 2.5, w + 5, d + 5).map((p) => ({ ...p, z: h + 1.2 })), shade(earth, B_TOP - 0.25));
    box(g, x + 4, y + 4, h + 1.2, w - 8, d - 8, 2.6, c('paper-2'), c('roof-steel'));
  });
  shadows.cast(rect(x - 7, y - 7, w + 14, d + 14), h);
};

/** The magazine compound's fence, along the explosives pad. */
function queueFence(q: DepthQueue): void {
  const pad = LAYOUT.areas['explosives-ordering']!.pad;
  const post = mix(c('ink-3'), c('roof-steel'), 0.3);
  for (let i = 0; i < pad.length; i++) {
    const a = pad[i]!;
    const b = pad[(i + 1) % pad.length]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    q.add(depthKey({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: 0 }, 2), (g) => {
      for (let t = 0; t <= len; t += 6) {
        const p = { x: a.x + ((b.x - a.x) * t) / len, y: a.y + ((b.y - a.y) * t) / len };
        line(g, [{ ...p, z: 0 }, { ...p, z: 2.4 }], post, 0.5);
      }
      line(g, [{ ...a, z: 2.2 }, { ...b, z: 2.2 }], post, 0.35, 0.8);
    });
  }
}

/** The primary gyratory crusher: the crusher building, its upper house, and the dump pocket on its west face. */
const crusher: Draw = (s, q, shadows) => {
  const { x, y } = s.at;
  const { x: w, y: d, z: h } = s.size;
  const steel = c(s.base);
  q.add(centreKey(s), (g) => {
    const pocket = LAYOUT.dumpPocket;
    convex(g, frustum(pocket.x - 4, pocket.y - 12, x, pocket.y + 12, 0, 7, 1.5), mix(steel, c('haul-road'), 0.35));
    box(g, x, y, 0, w, d, h - 8, steel);
    box(g, x + 5, y + 6, h - 8, w - 12, d - 14, 8, mix(steel, c('paper'), 0.4), c('roof-steel'));
    line(g, [{ x: x + 0.4, y: y + d, z: h - 11 }, { x: x + w - 0.4, y: y + d, z: h - 11 }], mix(c('ink-3'), steel, 0.3), 1, 0.7);
  });
  shadows.cast(footprint(s), h);
};

/** The overland conveyor along its path: the crusher discharge, up on its gallery over the creek, down to the stockyard belt. */
const overland: Draw = (_s, q, shadows) => queueConveyor(CONVEYOR_POINTS, q, shadows, 4);

const CONVEYOR_POINTS: Vec3[] = (() => {
  const pts: Vec3[] = [];
  let s = 0;
  while (s < CONVEYOR.length) {
    pts.push(CONVEYOR.at(s).p);
    s += 6;
  }
  pts.push(CONVEYOR.at(CONVEYOR.length - 1e-6).p);
  return pts;
})();

/** A conveyor gallery along `pts` (belt heights), on trestles every 16 m, with its dark belt on top. */
function queueConveyor(pts: Vec3[], q: DepthQueue, shadows: Shadows, width: number): void {
  const deck = c('roof-steel');
  const trestle = mix(c('roof-steel'), c('ink-3'), 0.3);
  const belt = mix(c('wagon-dark'), c('ink'), 0.3);
  let since = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    since += Math.hypot(b.x - a.x, b.y - a.y);
    const post = since >= 16 && b.z > 3;
    if (post) since = 0;
    q.add(depthKey({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: 0 }, 1), (g) => {
      if (post) {
        box(g, b.x - 0.4, b.y - width / 2 - 0.2, 0, 0.8, 0.8, b.z - 1.2, trestle);
        box(g, b.x - 0.4, b.y + width / 2 - 0.6, 0, 0.8, 0.8, b.z - 1.2, trestle);
      }
      beam(g, { ...a, z: a.z - 1.2 }, { ...b, z: b.z - 1.2 }, width, 1.2, deck);
      line(g, [{ ...a, z: a.z + 0.05 }, { ...b, z: b.z + 0.05 }], belt, Math.max(1, width * 0.4));
    });
    shadows.poly([
      { x: a.x + 1.5 * a.z, y: a.y - 0.15 * a.z - width / 2 },
      { x: b.x + 1.5 * b.z, y: b.y - 0.15 * b.z - width / 2 },
      { x: b.x + 1.5 * b.z, y: b.y - 0.15 * b.z + width / 2 },
      { x: a.x + 1.5 * a.z, y: a.y - 0.15 * a.z + width / 2 },
    ]);
  }
}

/** The reclaim conveyor: from the stockyard up to the loadout bin over the loop. */
const reclaimGallery: Draw = (s, q, shadows) => {
  const x = s.at.x + s.size.x / 2;
  const loadout = structure('loadout');
  const pts: Vec3[] = [];
  for (let t = 0; t <= 1.0001; t += 0.1) pts.push({ x, y: s.at.y + s.size.y * t, z: 3 + (loadout.size.z - 3) * t });
  queueConveyor(pts, q, shadows, s.size.x);
};

/** The train loadout: a bin on four legs straddling the loop track. */
const loadout: Draw = (s, q, shadows) => {
  const { x, y } = s.at;
  const { x: w, y: d, z: h } = s.size;
  q.add(centreKey(s, 3), (g) => {
    for (const [px, py] of [[x + 2, y + 2], [x + w - 4, y + 2], [x + 2, y + d - 4], [x + w - 4, y + d - 4]] as const) box(g, px, py, 0, 2, 2, h - 11, mix(c('roof-steel'), c('ink-3'), 0.2));
    convex(g, frustum(x + 6, y + 5, x + w - 6, y + d - 5, h - 13, h - 10, -3), c(s.base));
    box(g, x + 3, y + 2, h - 10, w - 6, d - 4, 10, c(s.base), c('roof-steel'));
  });
  shadows.cast(footprint(s), h);
};

/** A stockpile windrow: a long ridge of ore, faceted. */
function windrowFaces(x0: number, x1: number, cy: number, hw: number, H: number): Vec3[][] {
  const e = hw * 0.55;
  const r = hw * 0.95;
  const B = [
    { x: x0, y: cy - e, z: 0 },
    { x: x0 + e, y: cy - hw, z: 0 },
    { x: x1 - e, y: cy - hw, z: 0 },
    { x: x1, y: cy - e, z: 0 },
    { x: x1, y: cy + e, z: 0 },
    { x: x1 - e, y: cy + hw, z: 0 },
    { x: x0 + e, y: cy + hw, z: 0 },
    { x: x0, y: cy + e, z: 0 },
  ] as const;
  const R0 = { x: x0 + r, y: cy - 1, z: H };
  const R1 = { x: x1 - r, y: cy - 1, z: H };
  const R0b = { x: x0 + r, y: cy + 1, z: H };
  const R1b = { x: x1 - r, y: cy + 1, z: H };
  return [
    [B[1], B[2], R1, R0],
    [B[0], B[1], R0],
    [B[2], B[3], R1],
    [B[3], B[4], R1b, R1],
    [B[4], B[5], R1b],
    [B[5], B[6], R0b, R1b],
    [B[6], B[7], R0b],
    [B[7], B[0], R0, R0b],
    [R0, R1, R1b, R0b],
  ];
}

const windrow: Draw = (s, q, shadows) => {
  const cy = s.at.y + s.size.y / 2;
  q.add(centreKey(s), (g) => convex(g, windrowFaces(s.at.x, s.at.x + s.size.x, cy, s.size.y / 2, s.size.z), c(s.base)));
  shadows.cast(footprint(s), s.size.z * 0.7);
};

/** The waste dump: two lifts of paler waste rock. */
const wasteDump: Draw = (s, q, shadows) => {
  const { x, y } = s.at;
  const { x: w, y: d, z: h } = s.size;
  const rock = mix(c(s.base), c('haul-road'), 0.4);
  q.add(centreKey(s), (g) => {
    convex(g, frustum(x, y, x + w, y + d, 0, h / 2, 16), rock);
    convex(g, frustum(x + 22, y + 22, x + w - 22, y + d - 22, h / 2, h, 14), mix(rock, c('haul-road'), 0.2));
  });
  shadows.cast(footprint(s), h * 0.8);
};

/** The stacker and the bucket-wheel reclaimer on the yard rails between the windrows. */
const yardMachine: Draw = (s, q, shadows) => {
  const { x, y } = s.at;
  const { x: w, y: d, z: h } = s.size;
  const stacker = s.id === 'stacker';
  const frame = mix(c(s.base), c('paper'), 0.35);
  const cx = x + w / 2;
  const cy = y + d / 2;
  q.add(centreKey(s, 2), (g) => {
    box(g, x, y, 0, w, d, 4, c(s.base));
    box(g, cx - 2.5, cy - 2.5, 4, 5, 5, h - 6, frame);
    if (stacker) {
      // Boom luffed out over the north windrow, counterweight behind.
      beam(g, { x: cx, y: cy - 2, z: h - 2 }, { x: cx - 4, y: cy - 34, z: h + 4 }, 2.2, 1.6, frame);
      beam(g, { x: cx, y: cy + 2, z: h - 2 }, { x: cx + 1, y: cy + 14, z: h - 3 }, 2, 1.4, frame);
      box(g, cx - 1.5, cy + 12, h - 6, 4, 5, 4, c('wagon-dark'));
    } else {
      beam(g, { x: cx, y: cy + 2, z: h - 2 }, { x: cx - 2, y: cy + 30, z: h - 6 }, 2.2, 1.4, frame);
      beam(g, { x: cx, y: cy - 2, z: h - 2 }, { x: cx + 1, y: cy - 13, z: h - 1 }, 2, 1.4, frame);
      box(g, cx - 1.5, cy - 17, h - 4, 4, 5, 4, c('wagon-dark'));
      const wheel: Vec3[] = Array.from({ length: 20 }, (_, i) => {
        const a = (i / 20) * 2 * Math.PI;
        return { x: cx - 4, y: cy + 31 + 4.6 * Math.cos(a), z: h - 6 + 4.6 * Math.sin(a) };
      });
      fill(g, wheel, shade(c('hivis'), -0.15));
    }
  });
  shadows.cast(footprint(s), h);
};

/** Yard rails under the stacker and reclaimer, and the stockyard belt. */
function queueYardRails(q: DepthQueue): void {
  const { at } = LAYOUT.stockyard;
  const y = structure('stacker').at.y;
  const rail = mix(c('wagon-dark'), c('roof-steel'), 0.3);
  q.add(depthKey({ x: at.x, y, z: 0 }), (g) => {
    for (const dy of [0.5, 9.5]) line(g, [{ x: at.x + 10, y: y + dy, z: 0 }, { x: at.x + at.w - 10, y: y + dy, z: 0 }], rail, 0.6);
  });
}

/** ROM stocks on the ROM pad, between the haul road's dump pocket and the pad's east edge (derived from the crushing pad). */
function queueRomStocks(q: DepthQueue, shadows: Shadows): void {
  const pad = LAYOUT.areas.crushing!.pad;
  const x0 = Math.min(...pad.map((p) => p.x));
  const y0 = Math.min(...pad.map((p) => p.y));
  const y1 = Math.max(...pad.map((p) => p.y));
  const ore = c('ore-load');
  for (const [fx, fy, r, h] of [
    [0.22, 0.2, 24, 11],
    [0.5, 0.15, 18, 8],
    [0.28, 0.85, 20, 9],
  ] as const) {
    const cx = x0 + (Math.max(...pad.map((p) => p.x)) - x0) * fx;
    const cy = y0 + (y1 - y0) * fy;
    const n = 12;
    const base = Array.from({ length: n }, (_, i) => ({ x: cx + r * Math.cos(0.3 + (i / n) * 2 * Math.PI), y: cy + r * 0.85 * Math.sin(0.3 + (i / n) * 2 * Math.PI), z: 0 }));
    const apex = { x: cx, y: cy, z: h };
    q.add(depthKey(apex), (g) => convex(g, base.map((p, i) => [p, base[(i + 1) % n]!, apex]), ore));
    shadows.cast(base, h * 0.75);
  }
}

const DRAW: Record<string, Draw> = {
  workshop,
  'fuel-bund': fuelBund,
  'fuel-bay': fuelBay,
  admin: office,
  'control-room': office,
  mast,
  crusher,
  'overland-gallery': overland,
  'reclaim-gallery': reclaimGallery,
  loadout,
  'waste-dump': wasteDump,
  stacker: yardMachine,
  reclaimer: yardMachine,
};

const DRAW_KIND: Record<Structure['kind'], Draw> = {
  box: plainBox,
  tank,
  cone: windrow,
  gallery: overland,
  shed: workshop,
  magazine,
  camp,
};

/** Fixtures that are not structures: the compound fence and the yard rails. */
export function queueFixtures(q: DepthQueue): void {
  queueFence(q);
  queueYardRails(q);
}

// --- Spinifex ---------------------------------------------------------------------------

/** Grey-green tussocks over open ground, clumped by noise, each with a low ground shadow. */
export function queueSpinifex(q: DepthQueue, shadows: Shadows): void {
  const R = rng(99);
  const clump = vnoise(5);
  const low = c('spinifex-low');
  const high = c('spinifex-high');
  const ridge = LAYOUT.ridge;
  const onRidge = (p: Pt) => p.y > ridge[0]!.y - 10 && p.y < ridge[ridge.length - 1]!.y + 10 && p.x < distRidgeFoot(p.y);
  for (const p of spinifexPoints(99, 3600)) {
    if (R() > clump(p.x / 60, p.y / 60) * 1.45 || onRidge(p) || distToPolyline(p, MAIN_LINE) < 9) continue;
    const r = 1.8 + R() * 1.8;
    const tint = mix(low, high, R());
    shadows.disc({ x: p.x + r * 0.9, y: p.y - r * 0.2 }, r * 1.6, r * 0.55);
    q.add(p.x + p.y, (g) => {
      const [sx, sy] = P({ ...p, z: 0 });
      const rr = r * 1.25;
      g.ellipse(sx, sy - rr * 0.25, rr, rr * 0.62).fill(shade(tint, -0.25));
      g.ellipse(sx - rr * 0.2, sy - rr * 0.42, rr * 0.62, rr * 0.38).fill(shade(tint, 0.18));
    });
  }
}

/** The ridge's eastern foot at height y (where the ridge meets the plain). */
function distRidgeFoot(y: number): number {
  const ridge = LAYOUT.ridge;
  let x = ridge[0]!.x;
  for (const p of ridge) if (Math.abs(p.y - y) < 120) x = Math.max(x, p.x);
  return x + 85;
}
