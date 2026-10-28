import type { SceneState } from '../model/sceneState.js';
import { SERVICE_GROUPS } from '../model/serviceGroups.js';
import type { Vec3 } from './iso.js';
import { LAYOUT } from './layout.js';
import { HAUL_CENTRELINE, HAUL_CYCLE, HAUL_LANE_OFFSET, HAUL_OUTBOUND_LENGTH, LV_CENTRELINE, LV_LANE_OFFSET, LV_LOOP, LV_OUTBOUND_LENGTH, RAIL_LOOP } from './paths.js';
import type { Path } from './paths.js';

/**
 * The scene's moving parts as a pure function of engine state and time (DESIGN.md Motion). Which
 * things move, and how many, comes from `SceneState` alone (D-099): `fleet.moving` trucks run the
 * haul cycle and the rest park at the fuel bay, the train runs at `train.speed`, the belt and the
 * loadout run while `motion.conveyor` is true, and a cable's dot travels only while the cable is
 * live. Light vehicles and dust are ambient: light vehicles have no engine binding and always
 * circulate, dust follows moving trucks. The speeds below are display values (assumed).
 */
export interface Truck {
  pos: Vec3;
  heading: number;
  /** Carrying ore: on the way up out of the pit, from the shovel to the dump pocket. */
  loaded: boolean;
  parked: boolean;
  /** Tipping at the dump pocket, behind the crusher's pocket wall: not drawn for that moment. */
  hidden: boolean;
}

export interface AnimState {
  /** Always eight (the illustrative fleet, D-099): the first `fleet.moving` run the haul cycle, the rest are parked. */
  trucks: Truck[];
  dust: { pos: Vec3; age: number }[];
  /** `head`: metres along `RAIL_LOOP`; `wagonsFilled`: wagons loaded this lap, counted from the front. */
  train: { head: number; wagonsFilled: number };
  /** Metres the belt's ore dashes have run, modulo the dash period. */
  beltOffset: number;
  /** Per service group: how far its travelling dot is along the cable, 0..1. */
  cableDots: Record<string, number>;
  lvs: { pos: Vec3; heading: number }[];
  /** Metres the moving haul fleet has run (truck i is i/moving of a cycle ahead of truck 0). */
  haul: number;
  /** Metres the light vehicles have run. */
  lv: number;
}

/** dt is capped at 0.25 s so a background tab never jumps the scene (DESIGN.md Motion). */
export const MAX_DT = 0.25;
const TRUCK_SPEED = 12;
const LV_SPEED = 13;
/** At `train.speed` 1; degraded rail halves it. */
const TRAIN_SPEED = 8;
/** Conveyor ore dashes: 2.2 m of ore every 5.6 m, moving one 56 m cycle in 9 s. */
export const BELT_DASH = { on: 2.2, period: 5.6 } as const;
const BELT_SPEED = 56 / 9;
const PUFF_EVERY = 0.22;
export const DUST_LIFE = 2.6;
/** Seconds for a live cable's dot to run its cable, by group: 5 to 7 s, staggered. */
const CABLE_RUN = SERVICE_GROUPS.map((_, i) => 5 + (2 * i) / Math.max(1, SERVICE_GROUPS.length - 1));
/** Trucks vanish into the dump pocket this far either side of turning round there. */
const POCKET_HIDE = 10;
/** Dust leaves the back of the tray. */
const TRUCK_REAR = 7;

/** Fuel-bay parking: eight bays in a row on the hardstand south of the canopy, trucks nosed in toward it. */
export const PARK_SLOTS: Vec3[] = Array.from({ length: 8 }, (_, i) => ({ x: 571 + i * 9, y: 180, z: 0 }));
const PARK_HEADING = -Math.PI / 2;

// --- Paths with their turns ------------------------------------------------------------

type At = { p: Vec3; heading: number; end: 'far' | 'home' | null };

/**
 * A two-lane loop whose lane changes at each end are U-turns. The loop path jumps straight across the
 * road (2 × offset) at each end; here that stretch becomes a half circle about the centreline's end,
 * so the vehicle's heading follows the turn instead of crabbing sideways. `end` says which turn it is in.
 */
function withTurns(path: Path, centre: Vec3[], offset: number, outbound: number): (s: number) => At {
  const jump = 2 * offset;
  const turn = (c: Vec3, prev: Vec3, from: Vec3) => {
    const len = Math.hypot(c.x - prev.x, c.y - prev.y);
    const f = { x: (c.x - prev.x) / len, y: (c.y - prev.y) / len };
    const v = { x: from.x - c.x, y: from.y - c.y };
    // Rotate from the incoming lane, through straight ahead, to the outgoing lane.
    const sign = v.x * f.y - v.y * f.x > 0 ? 1 : -1;
    const a0 = Math.atan2(v.y, v.x);
    return (t: number) => {
      const a = a0 + sign * Math.PI * t;
      return { p: { x: c.x + offset * Math.cos(a), y: c.y + offset * Math.sin(a), z: c.z }, heading: a + (sign * Math.PI) / 2 };
    };
  };
  const n = centre.length;
  const far = turn(centre[n - 1]!, centre[n - 2]!, path.at(outbound).p);
  const home = turn(centre[0]!, centre[1]!, path.at(path.length - jump).p);
  return (s) => {
    const w = ((s % path.length) + path.length) % path.length;
    if (w >= outbound && w < outbound + jump) return { ...far((w - outbound) / jump), end: 'far' };
    if (w >= path.length - jump) return { ...home((w - (path.length - jump)) / jump), end: 'home' };
    return { ...path.at(w), end: null };
  };
}

const haulAt = withTurns(HAUL_CYCLE, HAUL_CENTRELINE, HAUL_LANE_OFFSET, HAUL_OUTBOUND_LENGTH);
const lvAt = withTurns(LV_LOOP, LV_CENTRELINE, LV_LANE_OFFSET, LV_OUTBOUND_LENGTH);
const HAUL_LENGTH = HAUL_CYCLE.length;
/** Past the middle of the shovel turn, the tray is full. */
const LOADED_FROM = HAUL_OUTBOUND_LENGTH + HAUL_LANE_OFFSET;

// --- The train ---------------------------------------------------------------------------

export interface Car {
  /** Metres from the head of the train to this car's centre. */
  offset: number;
  length: number;
  loco: boolean;
}

/** Three locomotives and 34 ore wagons, 0.7 m apart. */
export const TRAIN_CARS: Car[] = (() => {
  const cars: Car[] = [];
  let at = 0;
  for (let i = 0; i < 37; i++) {
    const loco = i < 3;
    const length = loco ? 22 : 10.6;
    cars.push({ offset: at + length / 2, length, loco });
    at += length + 0.7;
  }
  return cars;
})();
const WAGONS = TRAIN_CARS.filter((c) => !c.loco);
export const RAIL_LENGTH = RAIL_LOOP.length;

/** Where the loadout bin straddles the loop, in metres along `RAIL_LOOP`. */
export const LOADOUT_S: number = (() => {
  const s = LAYOUT.structures.find((t) => t.id === 'loadout')!;
  const { centre, radius } = LAYOUT.railLoop;
  const a = Math.atan2(s.at.y + s.size.y / 2 - centre.y, s.at.x + s.size.x / 2 - centre.x);
  return (((a * radius) % RAIL_LENGTH) + RAIL_LENGTH) % RAIL_LENGTH;
})();

const mod = (v: number, m: number) => ((v % m) + m) % m;
/** Metres the head is past the loadout on this lap. */
export const pastLoadout = (head: number) => mod(head - LOADOUT_S, RAIL_LENGTH);
/** Wagons that have passed under the loadout when the head is `d` metres past it. */
const passed = (d: number) => WAGONS.filter((w) => w.offset <= d).length;

// --- Frames ------------------------------------------------------------------------------

function trucks(scene: SceneState, haul: number): Truck[] {
  const moving = scene.fleet.moving;
  return Array.from({ length: 8 }, (_, i): Truck => {
    if (i >= moving) return { pos: { ...PARK_SLOTS[i - moving]! }, heading: PARK_HEADING, loaded: false, parked: true, hidden: false };
    const s = mod(haul + (i * HAUL_LENGTH) / moving, HAUL_LENGTH);
    const { p, heading } = haulAt(s);
    const hidden = s < POCKET_HIDE || s >= HAUL_LENGTH - 2 * HAUL_LANE_OFFSET - POCKET_HIDE;
    return { pos: p, heading, loaded: s >= LOADED_FROM, parked: false, hidden };
  });
}

function lvs(lv: number): AnimState['lvs'] {
  return [0, 0.55].map((f) => {
    const { p, heading } = lvAt(lv + f * LV_LOOP.length);
    return { pos: p, heading };
  });
}

/** The pose every frame starts from: trucks spread along the cycle, the train half under the loadout. */
const START = { haul: 0.15 * HAUL_LENGTH, lv: 0, head: mod(LOADOUT_S + WAGONS[16]!.offset + 1, RAIL_LENGTH) };

/** One still frame of `scene` (reduced motion): the same engine state, nothing in flight. */
export function stillFrame(scene: SceneState): AnimState {
  return {
    trucks: trucks(scene, START.haul),
    dust: [],
    train: { head: START.head, wagonsFilled: scene.motion.conveyor ? passed(pastLoadout(START.head)) : 0 },
    beltOffset: 0,
    cableDots: Object.fromEntries(SERVICE_GROUPS.map((g, i) => [g.id, (i * 0.37) % 1])),
    lvs: lvs(START.lv),
    haul: START.haul,
    lv: START.lv,
  };
}

/** The first frame of a moving scene: the still pose. */
export function initAnim(scene: SceneState): AnimState {
  return stillFrame(scene);
}

/** The frame `dtSeconds` later (capped at `MAX_DT`). Pure: the same inputs give the same frame. */
export function stepAnim(a: AnimState, scene: SceneState, dtSeconds: number): AnimState {
  const dt = Math.min(MAX_DT, Math.max(0, dtSeconds));
  const moving = scene.fleet.moving;
  const haul = moving > 0 ? a.haul + TRUCK_SPEED * dt : a.haul;
  const next = trucks(scene, haul);

  // A puff each time the fleet has run another 0.22 s of road, from every visible moving truck.
  const dust = a.dust.map((d) => ({ pos: d.pos, age: d.age + dt })).filter((d) => d.age < DUST_LIFE);
  const spacing = TRUCK_SPEED * PUFF_EVERY;
  if (moving > 0 && Math.floor(haul / spacing) > Math.floor(a.haul / spacing)) {
    for (const t of next) {
      if (t.parked || t.hidden) continue;
      dust.push({ pos: { x: t.pos.x - Math.cos(t.heading) * TRUCK_REAR, y: t.pos.y - Math.sin(t.heading) * TRUCK_REAR, z: t.pos.z + 1 }, age: 0 });
    }
  }

  // The train: wagons crossing under the loadout take ore while the conveyor runs; a new lap starts empty.
  const head = a.train.head + TRAIN_SPEED * scene.train.speed * dt;
  const d0 = pastLoadout(a.train.head);
  const d1 = pastLoadout(head);
  const lapped = head - a.train.head >= RAIL_LENGTH || d1 < d0;
  let filled = lapped ? 0 : a.train.wagonsFilled;
  if (scene.motion.conveyor) filled = Math.min(WAGONS.length, filled + passed(d1) - (lapped ? 0 : passed(d0)));

  const cableDots: Record<string, number> = {};
  SERVICE_GROUPS.forEach((g, i) => {
    const phase = a.cableDots[g.id] ?? 0;
    cableDots[g.id] = scene.cables[g.id] === 'live' ? mod(phase + dt / CABLE_RUN[i]!, 1) : phase;
  });

  const lv = a.lv + LV_SPEED * dt;
  return {
    trucks: next,
    dust,
    train: { head: scene.train.speed > 0 ? head : a.train.head, wagonsFilled: filled },
    beltOffset: scene.motion.conveyor ? mod(a.beltOffset + BELT_SPEED * dt, BELT_DASH.period) : a.beltOffset,
    cableDots,
    lvs: lvs(lv),
    haul,
    lv,
  };
}
