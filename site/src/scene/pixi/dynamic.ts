import { Container, Graphics } from 'pixi.js';
import type { SceneState } from '../../model/sceneState.js';
import { SERVICE_GROUPS } from '../../model/serviceGroups.js';
import { BELT_DASH, DUST_LIFE, pastLoadout, RAIL_LENGTH, TRAIN_CARS } from '../animation.js';
import type { AnimState } from '../animation.js';
import { depthKey, mix, shadowHull } from '../iso.js';
import type { Vec3 } from '../iso.js';
import { LAYOUT } from '../layout.js';
import { token } from '../palette.js';
import { CONVEYOR, RAIL_LOOP } from '../paths.js';
import { dashes } from '../polyline.js';
import type { Pt } from '../polyline.js';
import { box, DepthQueue, flat, line, obox, P } from './draw.js';
import { pitLevel } from './pit.js';
import { drawLoadout, LOADOUT_KEY, queueFills, Shadows } from './plant.js';
import type { StaticWorld } from './static.js';

/**
 * The board's state-bound and moving world-space marks (Task 6), drawn at k = 1 like the static world.
 * Every state-bearing mark is read off `SceneState`; motion comes from `AnimState` (animation.ts).
 *
 * Rebuilt only when the engine state changes (`setScene`), into the static world's slots, so the
 * caller can keep those groups as snapshots: the stopped areas' hatching (also on a zoom change, to
 * keep its 7 px pitch), the stockyard windrows, ROM heaps and diesel-tank gauges at their fill levels
 * with the yard machines between the windrows, their cast shadows, and the entry posts (grey when cut).
 *
 * Drawn every frame (`frame`): one painter's queue over the static plant for the trucks above the
 * crest, light vehicles, the train (sorted against a redraw of the loadout it runs under), dust and
 * the belt's ore; and one Graphics per pit level for vehicles on the ramp and floor, masked by the crest above.
 * Screen-space marks (cables, flags, plaques, parked markers) are overlay.ts.
 */
export interface Dynamic {
  /** The engine state changed. Returns whether the snapshot groups (hatching, heaps, posts) changed. */
  setScene(scene: SceneState): boolean;
  /** Before the snapshots are drawn at zoom k. Returns whether the hatching was redrawn. */
  prepare(k: number): boolean;
  /** Draws the moving parts of `a`. */
  frame(a: AnimState): void;
}

const c = (name: string) => token(name);
const INK = c('ink');
const PAPER = c('paper');
/** DESIGN.md's cut-post grey `#8a817a`, as galvanised desaturated toward ink-2. */
const POST_CUT = mix(c('galvanised'), c('ink-2'), 0.61);
export const ENTRY_POST_H = 5;

export function buildDynamic(slots: StaticWorld['slots'], above: Container): Dynamic {
  const hatch = new Graphics({ label: 'hatch' });
  const pitHatch = new Graphics({ label: 'hatch-pit' });
  slots.ground.addChild(hatch);
  slots.firstBerm.addChild(pitHatch);
  const fillShadows = new Graphics({ label: 'fill-shadows' });
  slots.shadows.addChild(fillShadows);
  const fills = new Graphics({ label: 'fills' });
  slots.fills.addChild(fills);
  const surface = new Graphics({ label: 'surface' });
  above.addChild(surface);
  const pit = slots.pit.map((slot, i) => {
    const g = new Graphics({ label: `pit-actors-${i}` });
    slot.addChild(g);
    return g;
  });

  let stateKey = '';
  let hatched: string[] = [];
  let hatchKey = '';

  return {
    setScene(scene) {
      const ids = Object.keys(LAYOUT.areas).filter((id) => scene.processes[id]?.hatched);
      const hatchChanged = ids.join() !== hatched.join();
      hatched = ids;
      // Heaps and posts: rebuilt only when the fill levels (to 1/200) or the cables change.
      const key = JSON.stringify([quant(scene.fills.stockpile), quant(scene.fills.romPad), quant(scene.fills.diesel), scene.cables]);
      if (key === stateKey) return hatchChanged;
      stateKey = key;
      fillShadows.clear();
      fills.clear();
      const queue = new DepthQueue();
      queueFills(queue, new Shadows(fillShadows), scene.fills);
      queueGauges(queue, scene.fills.diesel);
      queueEntryPosts(queue, scene);
      queue.flush(fills);
      return true;
    },

    prepare(k) {
      // Hatching keeps a 7 px pitch on screen, so it is redrawn when the zoom changes.
      const key = `${hatched.join()}@${k.toFixed(3)}`;
      if (key === hatchKey) return false;
      hatchKey = key;
      drawHatch(hatch, pitHatch, hatched, k);
      return true;
    },

    frame(a) {
      const queue = new DepthQueue();
      const inPit: { level: number; key: number; draw: (g: Graphics) => void }[] = [];
      const put = (p: Vec3, key: number, draw: (g: Graphics) => void) => {
        if (p.z < -0.5) inPit.push({ level: pitLevel(p.z), key, draw });
        else queue.add(key, draw);
      };
      for (const t of a.trucks) if (!t.hidden) put(t.pos, depthKey(t.pos, 0.5), (g) => drawTruck(g, t.pos, t.heading, t.parked, t.loaded));
      for (const d of a.dust) put(d.pos, depthKey(d.pos), (g) => drawDust(g, d.pos, d.age));
      for (const v of a.lvs) queue.add(depthKey(v.pos, 0.3), (g) => drawLv(g, v.pos, v.heading));
      queueTrain(queue, a);
      queueBelt(queue, a.beltOffset);
      surface.clear();
      queue.flush(surface);
      for (const g of pit) g.clear();
      inPit.sort((x, y) => x.key - y.key);
      for (const item of inPit) item.draw(pit[item.level]!);
    },
  };
}

const quant = (v: number) => Math.round(v * 200);

// --- Hatching ------------------------------------------------------------------------------

/**
 * Stopped ground (DESIGN.md Survey Flags): `hatch-ink` lines at 62 % every 7 px, running with the
 * board's x axis (26.565° on screen), over an 8 % wash, with a dashed (5/3 px) outline. Drawn in world
 * space at k = 1, so pixel sizes are divided by the camera's k.
 */
function drawHatch(ground: Graphics, firstBerm: Graphics, ids: string[], k: number): void {
  ground.clear();
  firstBerm.clear();
  const ink = c('hatch-ink');
  // Lines along +x, `step` metres apart in y, are 7 px apart on screen (perpendicular distance 0.894·k per metre).
  const step = 7 / (0.894 * k);
  for (const id of ids) {
    const area = LAYOUT.areas[id]!;
    const g = area.anchor.z < -0.5 ? firstBerm : ground;
    const z = area.anchor.z;
    const pad = area.pad;
    g.poly(flat(pad.map((p) => ({ ...p, z })))).fill({ color: ink, alpha: 0.08 });
    const ys = pad.map((p) => p.y);
    for (let y = Math.ceil(Math.min(...ys) / step) * step; y < Math.max(...ys); y += step) {
      const xs: number[] = [];
      for (let i = 0; i < pad.length; i++) {
        const a = pad[i]!;
        const b = pad[(i + 1) % pad.length]!;
        if (a.y > y !== b.y > y) xs.push(a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x));
      }
      xs.sort((m, n) => m - n);
      for (let i = 0; i + 1 < xs.length; i += 2) g.moveTo(...P({ x: xs[i]!, y, z })).lineTo(...P({ x: xs[i + 1]!, y, z }));
    }
    g.stroke({ color: ink, width: 1.5 / k, alpha: 0.62 });
    const outline: Pt[] = [...pad, pad[0]!].map((p) => {
      const [x, y] = P({ ...p, z });
      return { x, y };
    });
    for (const d of dashes(outline, 5 / k, 8 / k)) g.poly(d.flatMap((p) => [p.x, p.y]), false);
    g.stroke({ color: ink, width: 1.1 / k, alpha: 0.8 });
  }
}

// --- State-bound plant -----------------------------------------------------------------------

/** A sight gauge on each diesel tank's camera-facing wall: the ink column stands at the diesel level. */
function queueGauges(qu: DepthQueue, diesel: number): void {
  const glass = mix(c('paper-2'), c('ink-3'), 0.35);
  for (const s of LAYOUT.structures) {
    if (s.kind !== 'tank') continue;
    const r = s.size.x / 2 + 0.15;
    const x = s.at.x + s.size.x / 2 + r * Math.SQRT1_2;
    const y = s.at.y + s.size.y / 2 + r * Math.SQRT1_2;
    const z0 = 2.2;
    const z1 = s.size.z - 1;
    const level = z0 + (z1 - z0) * diesel;
    qu.add(depthKey({ x, y, z: 0 }, 0.6), (g) => {
      line(g, [{ x, y, z: z0 }, { x, y, z: z1 }], glass, 1.6);
      if (diesel > 0.005) line(g, [{ x, y, z: z0 }, { x, y, z: level }], INK, 1.6);
      line(g, [{ x: x - 0.9, y: y + 0.9, z: level }, { x: x + 0.9, y: y - 0.9, z: level }], INK, 0.9);
    });
  }
}

/** The 3 × 3 × 5 m entry post each cable plugs into; a cut service's post loses its galvanised finish. */
function queueEntryPosts(qu: DepthQueue, scene: SceneState): void {
  for (const g of SERVICE_GROUPS) {
    const p = LAYOUT.entryPosts[g.id]!;
    const colour = scene.cables[g.id] === 'live' ? c('galvanised') : POST_CUT;
    qu.add(depthKey(p), (gr) => box(gr, p.x - 1.5, p.y - 1.5, 0, 3, 3, ENTRY_POST_H, colour));
  }
}

// --- Vehicles ------------------------------------------------------------------------------

type Part = [number, number, number, number, number, number, string];

/**
 * An ultra-class haul truck, 13 × 7.6 m, cab on the left, after the art-direction mock: tyres, chassis,
 * the body and cab, the tray with its canopy over the cab, and an ore heap when loaded. Working trucks are
 * hi-vis; parked ones go khaki (DESIGN.md: parked is desaturated).
 */
function drawTruck(g: Graphics, p: Vec3, th: number, parked: boolean, loaded: boolean): void {
  const Y = c(parked ? 'hivis-parked' : 'hivis');
  const Yd = mix(Y, INK, 0.13);
  const tyre = parked ? mix(c('ink-2'), c('wagon-dark'), 0.5) : mix(INK, c('wagon-dark'), 0.4);
  const chassis = mix(c('wagon-dark'), c('ink-2'), 0.5);
  const glass = mix(INK, c('roof-steel'), 0.3);
  const parts: Part[] = [
    [-5.7, -1.9, -3.8, -2.2, 0, 3.5, tyre],
    [-5.7, -1.9, 2.2, 3.8, 0, 3.5, tyre],
    [3.0, 6.0, -3.8, -2.5, 0, 3.5, tyre],
    [3.0, 6.0, 2.5, 3.8, 0, 3.5, tyre],
    [-5.4, 6.2, -2.1, 2.1, 1.0, 2.7, chassis],
    [4.2, 6.7, -1.0, 1.8, 1.6, 4.4, Yd],
    [4.1, 6.1, -3.7, -1.2, 3.0, 4.3, Y],
    [4.1, 6.1, -3.7, -1.2, 4.3, 5.4, glass],
    [-6.6, 3.9, -3.8, 3.8, 2.8, 6.1, Y],
    [3.9, 6.4, -3.8, 3.8, 5.6, 6.1, Y],
  ];
  if (loaded) parts.push([-5.9, 3.0, -3.1, 3.1, 6.1, 7.0, c('ore-load')]);
  const cs = Math.cos(th);
  const sn = Math.sin(th);
  const key = (pt: Part) => {
    const u = (pt[0] + pt[1]) / 2;
    const v = (pt[2] + pt[3]) / 2;
    return u * cs - v * sn + (u * sn + v * cs) + pt[4] * 0.05;
  };
  parts.sort((m, n) => key(m) - key(n));
  // Its own soft shadow: footprint and the footprint cast from 5.5 m, at the truck's ground level.
  const corners = [
    [-6.6, -3.8],
    [6.7, -3.8],
    [6.7, 3.8],
    [-6.6, 3.8],
  ].map(([u, v]) => ({ x: p.x + u! * cs - v! * sn, y: p.y + u! * sn + v! * cs }));
  g.poly(flat(shadowHull(corners, 5.5).map((s) => ({ ...s, z: p.z })))).fill({ color: c('cast-shadow'), alpha: 0.26 });
  for (const [u0, u1, v0, v1, z0, z1, colour] of parts) obox(g, p.x, p.y, th, u0, u1, v0, v1, p.z + z0, p.z + z1, colour);
}

/** A dust puff: it rises, drifts downwind and fades over its 2.6 s life. */
function drawDust(g: Graphics, p: Vec3, age: number): void {
  const t = age / DUST_LIFE;
  const [sx, sy] = P({ x: p.x + t * 3, y: p.y - t, z: p.z + t * 3 });
  g.ellipse(sx, sy, 2.5 + t * 6, 1.6 + t * 3.6).fill({ color: DUST, alpha: (1 - t) * 0.42 });
}
const DUST = mix(c('haul-road'), c('shade-lite'), 0.35);

/** A light vehicle: a white ute with a dark cab. */
function drawLv(g: Graphics, p: Vec3, th: number): void {
  obox(g, p.x, p.y, th, -2.7, 2.7, -1.05, 1.05, 0, 1.9, PAPER);
  obox(g, p.x, p.y, th, 0.2, 1.6, -1.0, 1.0, 1.9, 2.4, mix(c('roof-steel'), c('ink-2'), 0.45));
}

/** Three locomotives and the ore wagons around the balloon loop; wagons that took ore at the loadout carry a heap. */
function queueTrain(qu: DepthQueue, a: AnimState): void {
  const past = pastLoadout(a.train.head);
  const loco = mix(c('wagon-dark'), c('roof-steel'), 0.2);
  let wagon = 0;
  for (const car of TRAIN_CARS) {
    const s = a.train.head - car.offset;
    const { p, heading } = RAIL_LOOP.at(((s % RAIL_LENGTH) + RAIL_LENGTH) % RAIL_LENGTH);
    const filled = !car.loco && wagon < a.train.wagonsFilled && car.offset <= past;
    if (!car.loco) wagon++;
    qu.add(depthKey(p, 0.2), (g) => {
      const h = car.length / 2;
      if (car.loco) {
        obox(g, p.x, p.y, heading, -h, h - 4.5, -1.55, 1.55, 0.9, 4.4, loco);
        obox(g, p.x, p.y, heading, h - 4.5, h, -1.6, 1.6, 0.9, 4.9, c('hivis'));
      } else {
        obox(g, p.x, p.y, heading, -h + 0.1, h - 0.1, -1.5, 1.5, 0.8, 3.9, c('wagon-dark'));
        if (filled) obox(g, p.x, p.y, heading, -h + 0.7, h - 0.7, -1.35, 1.35, 3.9, 4.9, c('ore-load'));
      }
    });
  }
  // The bin straddles the track: drawn again here so the wagons under it sort against it.
  qu.add(LOADOUT_KEY, drawLoadout);
}

/** Ore on the overland belt: 2.2 m dashes every 5.6 m, shifted `offset` metres along. */
function queueBelt(qu: DepthQueue, offset: number): void {
  const ore = c('ore-load');
  for (let d = offset - BELT_DASH.period; d < CONVEYOR.length; d += BELT_DASH.period) {
    const a = Math.max(0, d);
    const b = Math.min(CONVEYOR.length - 1e-6, d + BELT_DASH.on);
    if (b <= a) continue;
    const p0 = CONVEYOR.at(a).p;
    const p1 = CONVEYOR.at(b).p;
    const lift = (p: Vec3) => ({ ...p, z: p.z + 0.25 });
    qu.add(depthKey({ x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2, z: 0 }, 1.1), (g) => line(g, [lift(p0), lift(p1)], ore, 1.2));
  }
}

