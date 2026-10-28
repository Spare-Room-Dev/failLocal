import { Container, Graphics, Text } from 'pixi.js';
import type { SceneState } from '../../model/sceneState.js';
import { cableFraction, SERVICE_GROUPS } from '../../model/serviceGroups.js';
import { BELT_DASH, DUST_LIFE, pastLoadout, RAIL_LENGTH, TRAIN_CARS } from '../animation.js';
import type { AnimState } from '../animation.js';
import { CABLE, cableRoutes } from '../cables.js';
import { depthKey, mix, project, shadowHull } from '../iso.js';
import type { Camera, Vec3 } from '../iso.js';
import { LAYOUT } from '../layout.js';
import { token } from '../palette.js';
import { CONVEYOR, RAIL_LOOP } from '../paths.js';
import { dashes, pointAt, slice } from '../polyline.js';
import type { Pt } from '../polyline.js';
import { box, DepthQueue, flat, line, obox, P } from './draw.js';
import { pitLevel } from './pit.js';
import { drawLoadout, LOADOUT_KEY, queueFills, Shadows } from './plant.js';
import type { StaticWorld } from './static.js';

/**
 * Everything on the board that shows engine state or moves (Task 6). Every state-bearing mark is read
 * off `SceneState`; motion comes from `AnimState` (animation.ts), which is itself driven by it.
 *
 * World space (drawn at k = 1 like the static world, in the static world's slots):
 * - the stopped areas' hatching, on the ground under the plant (and on the pit's first berm);
 * - the stockyard windrows, ROM heaps and diesel-tank gauges at their fill levels, the yard machines
 *   between the windrows, and the entry posts (grey when their service is cut): rebuilt when the state changes;
 * - every frame, one painter's queue over the static plant with those, the trucks above the crest,
 *   light vehicles, the train (sorted against the loadout it runs under), dust and the belt's ore;
 *   and one Graphics per pit level for trucks on the ramp and floor, masked by the crest above.
 * Screen space (stage pixels, over the board): the cables, the parked trucks' pause markers, and the
 * survey flags and plaques. Their sizes are pixel sizes, so they are laid out again whenever the camera moves.
 */
export interface Dynamic {
  /** The engine state (and the selected area) changed: rebuild what is drawn from it. */
  setScene(scene: SceneState, selected: string | null): void;
  /** Draw one frame of `a` under camera `cam` in a `view`-sized stage. `clock` (s) drives the cut-link pulse. */
  frame(a: AnimState, scene: SceneState, cam: Camera, view: { w: number; h: number }, clock: number, reduced: boolean): void;
}

export interface DynamicOptions {
  /** Cables and plaques: off for the decorative welcome scene, which has no cards to cable to. */
  labels: boolean;
  /** Pixel density for overlay text. */
  resolution: number;
}

const c = (name: string) => token(name);
const INK = c('ink');
const PAPER = c('paper');
const STOP_RED = c('stop-red');
const FONT = '"Archivo Variable", system-ui, sans-serif';
/** DESIGN.md's cut-post grey `#8a817a`, as galvanised desaturated toward ink-2. */
const POST_CUT = mix(c('galvanised'), c('ink-2'), 0.61);
/** Phones hide the cables (DESIGN.md Layout, Phone). */
const PHONE = '(max-width: 760px)';

export function buildDynamic(slots: StaticWorld['slots'], screen: Container, options: DynamicOptions): Dynamic {
  const hatch = new Graphics({ label: 'hatch' });
  const pitHatch = new Graphics({ label: 'hatch-pit' });
  slots.ground.addChild(hatch);
  slots.firstBerm.addChild(pitHatch);
  const fillShadows = new Graphics({ label: 'fill-shadows' });
  slots.shadows.addChild(fillShadows);
  const surface = new Graphics({ label: 'surface' });
  slots.above.addChild(surface);
  const pit = slots.pit.map((slot, i) => {
    const g = new Graphics({ label: `pit-actors-${i}` });
    slot.addChild(g);
    return g;
  });

  const cables = new Graphics({ label: 'cables' });
  const cableLabels = SERVICE_GROUPS.map(() => label(options.resolution));
  const markers = new Graphics({ label: 'parked-markers' });
  const flags = Object.keys(LAYOUT.areas).map((id) => new Plaque(id, options.resolution));
  screen.addChild(cables, ...cableLabels.map((l) => l.root), markers, ...flags.map((f) => f.root));

  const phone = typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(PHONE) : null;

  let fills = new DepthQueue();
  let stateKey = '';
  let hatchKey = '';
  let hatched: string[] = [];

  return {
    setScene(scene, selected) {
      // Heaps and posts: rebuilt only when the fill levels (to 1/200) or the cables change.
      const key = JSON.stringify([quant(scene.fills.stockpile), quant(scene.fills.romPad), quant(scene.fills.diesel), scene.cables]);
      if (key !== stateKey) {
        stateKey = key;
        fillShadows.clear();
        fills = new DepthQueue();
        queueFills(fills, new Shadows(fillShadows), scene.fills);
        queueGauges(fills, scene.fills.diesel);
        queueEntryPosts(fills, scene);
      }
      hatched = Object.keys(LAYOUT.areas).filter((id) => scene.processes[id]?.hatched);
      for (const f of flags) f.set(scene, selected, options.labels);
    },

    frame(a, scene, cam, view, clock, reduced) {
      // Hatching keeps a 7 px pitch on screen, so it is redrawn when the zoom changes.
      const hk = `${hatched.join()}@${cam.k.toFixed(3)}`;
      if (hk !== hatchKey) {
        hatchKey = hk;
        drawHatch(hatch, pitHatch, hatched, cam.k);
      }

      const queue = new DepthQueue();
      queue.merge(fills);
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

      drawMarkers(markers, a, cam);
      for (const f of flags) f.place(cam);
      const showCables = options.labels && !phone?.matches;
      cables.visible = showCables;
      for (const l of cableLabels) l.root.visible = false;
      if (showCables) drawCables(cables, cableLabels, a, scene, cam, view, clock, reduced);
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
const ENTRY_POST_H = 5;

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

// --- Screen-space marks ------------------------------------------------------------------------

/** The boxed pause glyph on a short post over each parked truck (DESIGN.md Survey Flags: Parked). */
function drawMarkers(g: Graphics, a: AnimState, cam: Camera): void {
  g.clear();
  // Every other post is taller, so neighbours' glyphs stay apart where the bay is small on screen.
  let n = 0;
  for (const t of a.trucks) {
    if (!t.parked) continue;
    const { sx, sy } = project({ ...t.pos, z: t.pos.z + 9 }, cam);
    const post = n++ % 2 ? 23 : 11;
    g.moveTo(sx, sy).lineTo(sx, sy - post).stroke({ color: INK, width: 1 });
    g.roundRect(sx - 5.5, sy - post - 11, 11, 11, 1.5).fill(PAPER).stroke({ color: INK, width: 1 });
    g.rect(sx - 2.6, sy - post - 8.6, 1.7, 6.2).fill(INK);
    g.rect(sx + 0.9, sy - post - 8.6, 1.7, 6.2).fill(INK);
  }
}

interface Label {
  root: Container;
  box: Graphics;
  text: Text;
}

function label(resolution: number): Label {
  const root = new Container({ label: 'cable-label' });
  const box = new Graphics();
  const text = new Text({ text: '', resolution, style: { fontFamily: FONT, fontSize: 10.5, fontWeight: '700', fill: STOP_RED } });
  root.addChild(box, text);
  return { root, box, text };
}

/** Ink, 1.5 px, octilinear (cables.ts); a live cable carries a travelling dot, a severed one breaks, a revoked one is dashed. */
function drawCables(g: Graphics, labels: Label[], a: AnimState, scene: SceneState, cam: Camera, view: { w: number; h: number }, clock: number, reduced: boolean): void {
  g.clear();
  const anchors = SERVICE_GROUPS.map((_, i) => cableFraction(i) * view.w);
  const posts = SERVICE_GROUPS.map((grp) => {
    const { sx, sy } = project({ ...LAYOUT.entryPosts[grp.id]!, z: ENTRY_POST_H }, cam);
    return { x: sx, y: sy };
  });
  const routes = cableRoutes(anchors, posts);
  const stroke = (pts: Pt[], width: number, alpha = 1) => g.poly(pts.flatMap((p) => [p.x, p.y]), false).stroke({ color: INK, width, alpha, join: 'miter', cap: 'butt' });
  SERVICE_GROUPS.forEach((grp, i) => {
    const r = routes[i]!;
    const state = scene.cables[grp.id];
    if (state === 'live') {
      stroke(r.points, 1.5);
      const dot = reduced ? r.corner : pointAt(r.points, (a.cableDots[grp.id] ?? 0) * r.length).p;
      g.circle(dot.x, dot.y, 2.4).fill(PAPER).stroke({ color: INK, width: 1.2 });
      return;
    }
    const at = pointAt(r.points, r.breakAt);
    const lbl = labels[i]!;
    if (state === 'severed') {
      stroke(slice(r.points, 0, r.breakAt), 1.5);
      const after = r.breakAt + CABLE.breakGap;
      for (const d of dashes(slice(r.points, after, r.length), 3, 6)) stroke(d, 1.3, 0.55);
      const second = pointAt(r.points, after);
      for (const b of [at, second]) {
        const n = { x: -b.dir.y, y: b.dir.x };
        g.moveTo(b.p.x - n.x * 5, b.p.y - n.y * 5).lineTo(b.p.x + n.x * 5, b.p.y + n.y * 5).stroke({ color: INK, width: 1.5, cap: 'round' });
      }
      const ring = pointAt(r.points, r.breakAt + CABLE.breakGap / 2).p;
      // The cut-link ring blinks on a 2.4 s ease-in-out (held lit under reduced motion).
      const pulse = reduced ? 1 : 0.4 + 0.6 * (0.5 - 0.5 * Math.cos((2 * Math.PI * clock) / 2.4));
      g.circle(ring.x, ring.y, 3.2).stroke({ color: STOP_RED, width: 1.4, alpha: pulse });
      placeLabel(lbl, 'Link cut', STOP_RED, ring, view.w);
    } else {
      for (const d of dashes(r.points, 4, 7)) stroke(d, 1.5, 0.9);
      placeLabel(lbl, 'Access revoked', INK, at.p, view.w);
    }
  });
}

/** A boxed label beside the cable at `at`: to its left, or to its right where the left would leave the stage. */
function placeLabel(l: Label, text: string, colour: string, at: Pt, width: number): void {
  if (l.text.text !== text) l.text.text = text;
  l.text.style.fill = colour;
  const w = Math.ceil(l.text.width) + 12;
  const left = at.x - 14 - w >= 0;
  const x = left ? at.x - 14 - w : at.x + 14;
  l.box.clear();
  l.box.roundRect(0, 0, w, 16, 3).fill(PAPER).stroke({ color: INK, width: 1 });
  l.text.position.set(6, (16 - l.text.height) / 2);
  l.root.position.set(Math.min(width - w, x), at.y - 8);
  l.root.visible = true;
}

// --- Survey flags and plaques ------------------------------------------------------------------

/** Pole length (px) and plaque side per area, chosen so plaques do not collide at the default framing. */
const POLE: Record<string, { len: number; side: 1 | -1 }> = {
  'diesel-ordering': { len: 22, side: -1 },
  'explosives-ordering': { len: 34, side: 1 },
  'work-orders': { len: 46, side: -1 },
  payroll: { len: 50, side: -1 },
  'control-room': { len: 100, side: -1 },
  'remote-operations': { len: 150, side: -1 },
  'drill-and-blast': { len: 46, side: -1 },
  haulage: { len: 40, side: 1 },
  crushing: { len: 34, side: 1 },
  rail: { len: 46, side: -1 },
};

const STATE_WORD = { normal: 'Normal', degraded: 'Degraded', stopped: 'Stopped' } as const;

/**
 * One process area's survey flag and plaque (DESIGN.md Survey Flags and Plaques): a pole with a ground
 * ellipse at its foot and a flag at the top — full Stop Red with a white X when stopped, white with an
 * amber lower-left triangle when degraded, an open white pennant when normal — and a paper plaque with the
 * area name over the state word and note. The selected area's plaque inverts to ink and its pole thickens.
 */
class Plaque {
  readonly root: Container;
  private readonly g = new Graphics();
  private readonly name: Text;
  private readonly word: Text;
  private readonly note: Text;
  private readonly anchor: Vec3;

  constructor(readonly id: string, resolution: number) {
    this.root = new Container({ label: `flag-${id}` });
    this.anchor = LAYOUT.areas[id]!.anchor;
    const style = (size: number, weight: '600' | '700') => ({ fontFamily: FONT, fontSize: size, fontWeight: weight, fill: INK });
    this.name = new Text({ text: '', resolution, style: style(11, '700') });
    this.word = new Text({ text: '', resolution, style: style(10.5, '700') });
    this.note = new Text({ text: '', resolution, style: style(10.5, '600') });
    this.root.addChild(this.g, this.name, this.word, this.note);
  }

  set(scene: SceneState, selected: string | null, labels: boolean): void {
    const p = scene.processes[this.id];
    if (!p) throw new Error(`scene has no process ${this.id}`);
    const { len, side } = POLE[this.id] ?? { len: 36, side: 1 };
    const sel = selected === this.id;
    const g = this.g;
    g.clear();
    g.ellipse(0, 0, 3.4, 1.6).fill({ color: INK, alpha: 0.45 });
    g.moveTo(0, 0).lineTo(0, -len).stroke({ color: INK, width: sel ? 1.6 : 1.1 });
    flagCloth(g, p.flag, side * 0.6, -len, side);

    this.name.visible = this.word.visible = this.note.visible = labels;
    if (!labels) return;
    this.name.text = p.label;
    this.word.text = STATE_WORD[p.state];
    this.note.text = p.note ? ` · ${p.note}` : '';
    this.name.style.fill = sel ? PAPER : INK;
    this.word.style.fill = sel ? PAPER : p.state === 'stopped' ? c('stop-red-text') : INK;
    this.note.style.fill = sel ? mix(PAPER, INK, 0.12) : c('ink-2');
    const w = Math.ceil(Math.max(this.name.width, this.word.width + this.note.width)) + 14;
    const x0 = side > 0 ? 13 : -13 - w;
    const top = -len - 5;
    g.roundRect(x0, top, w, 31, 3)
      .fill({ color: sel ? INK : PAPER, alpha: sel ? 1 : 0.96 })
      .stroke({ color: INK, width: sel ? 1.2 : 0.8, alpha: sel ? 1 : 0.96 });
    this.name.position.set(x0 + 7, top + 2.5);
    this.word.position.set(x0 + 7, top + 15.5);
    this.note.position.set(x0 + 7 + this.word.width, top + 15.5);
  }

  place(cam: Camera): void {
    const { sx, sy } = project(this.anchor, cam);
    this.root.position.set(Math.round(sx), Math.round(sy));
  }
}

function flagCloth(g: Graphics, flag: SceneState['processes'][string]['flag'], x: number, y: number, dir: number): void {
  const w = 12 * dir;
  const h = 8.5;
  const left = dir > 0 ? x : x + w;
  if (flag === 'full') {
    g.rect(left, y, 12, h).fill(STOP_RED).stroke({ color: INK, width: 1 });
    g.moveTo(x + w * 0.22, y + 2)
      .lineTo(x + w * 0.78, y + h - 2)
      .moveTo(x + w * 0.78, y + 2)
      .lineTo(x + w * 0.22, y + h - 2)
      .stroke({ color: PAPER, width: 1.3 });
  } else if (flag === 'half') {
    g.rect(left, y, 12, h).fill(PAPER).stroke({ color: INK, width: 1 });
    g.poly([x, y + h, x, y, x + w, y + h]).fill(c('degraded-amber')).stroke({ color: INK, width: 1, join: 'round' });
  } else {
    g.poly([x, y, x + w, y + h / 2, x, y + h]).fill(PAPER).stroke({ color: INK, width: 1, join: 'round' });
  }
}
