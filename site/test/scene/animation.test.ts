import { simulate } from '@faillocal/engine';
import type { Sample } from '@faillocal/engine';
import { describe, expect, it } from 'vitest';
import { register } from '../../src/model/register.js';
import { sceneState } from '../../src/model/sceneState.js';
import type { SceneState } from '../../src/model/sceneState.js';
import { SERVICE_GROUPS } from '../../src/model/serviceGroups.js';
import { initAnim, PARK_SLOTS, stepAnim, stillFrame } from '../../src/scene/animation.js';
import type { AnimState } from '../../src/scene/animation.js';
import { LAYOUT } from '../../src/scene/layout.js';

const samples = simulate(register, 's1-projection', 'unprepared').samples;
const at = (hour: number): Sample => {
  const s = samples.find((x) => x.hour === hour);
  if (!s) throw new Error(`no sample at hour ${hour}`);
  return s;
};
const base = at(0);
/** The scene with some processes overridden. */
const scene = (processes: Partial<Sample['processes']> = {}, sample: Sample = base): SceneState =>
  sceneState(register, { ...sample, processes: { ...sample.processes, ...processes } as Sample['processes'] });

const HAULAGE = { normal: [8, 0], degraded: [4, 4], stopped: [0, 8] } as const;

/** Run `n` steps of `dt` seconds. */
function run(s: SceneState, n: number, dt = 0.1, from: AnimState = initAnim(s)): AnimState {
  let a = from;
  for (let i = 0; i < n; i++) a = stepAnim(a, s, dt);
  return a;
}

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const fuelBay = LAYOUT.structures.find((s) => s.id === 'fuel-bay')!;
const bayCentre = { x: fuelBay.at.x + fuelBay.size.x / 2, y: fuelBay.at.y + fuelBay.size.y / 2 };

/** What a frame says about the engine state: the parts that must not differ between a still and a moving frame. */
function stateOf(a: AnimState, s: SceneState) {
  return {
    moving: a.trucks.filter((t) => !t.parked).length,
    parked: a.trucks.filter((t) => t.parked).length,
    trainMoving: s.train.speed > 0,
    fills: s.fills,
    cables: s.cables,
    loadedOnlyWhileMoving: a.trucks.every((t) => !t.loaded || !t.parked),
  };
}

describe('animation', () => {
  it('moving and parked trucks follow scene.fleet', () => {
    for (const [state, [moving, parked]] of Object.entries(HAULAGE)) {
      const s = scene({ haulage: state as keyof typeof HAULAGE });
      expect(s.fleet).toEqual({ moving, parked });
      for (const a of [initAnim(s), run(s, 40), stillFrame(s)]) {
        expect(a.trucks).toHaveLength(8);
        expect(a.trucks.filter((t) => !t.parked)).toHaveLength(moving);
        const bay = a.trucks.filter((t) => t.parked);
        expect(bay).toHaveLength(parked);
        for (const t of bay) {
          expect(dist(t.pos, bayCentre)).toBeLessThan(70);
          expect(PARK_SLOTS.some((p) => dist(p, t.pos) < 1e-9)).toBe(true);
          expect(t.loaded).toBe(false);
        }
        // Parked trucks each have their own slot.
        expect(new Set(bay.map((t) => `${t.pos.x},${t.pos.y}`)).size).toBe(parked);
      }
    }
  });

  it('moving trucks run loaded on the way up and empty on the way down', () => {
    const s = scene();
    let a = initAnim(s);
    let sawLoadedClimbing = false;
    let sawEmptyDescending = false;
    for (let i = 0; i < 2000; i++) {
      const b = stepAnim(a, s, 0.25);
      for (let j = 0; j < 8; j++) {
        const dz = b.trucks[j]!.pos.z - a.trucks[j]!.pos.z;
        if (dz > 0.05) {
          expect(b.trucks[j]!.loaded).toBe(true);
          sawLoadedClimbing = true;
        }
        if (dz < -0.05) {
          expect(b.trucks[j]!.loaded).toBe(false);
          sawEmptyDescending = true;
        }
      }
      a = b;
    }
    expect(sawLoadedClimbing && sawEmptyDescending).toBe(true);
  });

  it('trucks turn round at the shovel and the dump pocket instead of crabbing sideways', () => {
    const s = scene();
    let a = initAnim(s);
    for (let i = 0; i < 4000; i++) {
      const b = stepAnim(a, s, 0.05);
      for (let j = 0; j < 8; j++) {
        const p = a.trucks[j]!;
        const q = b.trucks[j]!;
        if (p.hidden || q.hidden) continue;
        const moved = dist(p.pos, q.pos);
        if (moved < 1e-6) continue;
        // The truck travels along its heading (within a turn's curvature), never across it.
        const along = ((q.pos.x - p.pos.x) * Math.cos(p.heading) + (q.pos.y - p.pos.y) * Math.sin(p.heading)) / moved;
        expect(along).toBeGreaterThan(0.6);
        // No quarter-turn snap onto a sideways jump (road bends are the only kinks, under 45°).
        const turn = Math.abs(Math.atan2(Math.sin(q.heading - p.heading), Math.cos(q.heading - p.heading)));
        expect(turn).toBeLessThan(Math.PI / 4);
      }
      a = b;
    }
  });

  it('animation step caps dt', () => {
    const s = scene();
    const a = initAnim(s);
    expect(stepAnim(a, s, 30)).toEqual(stepAnim(a, s, 0.25));
    expect(stepAnim(a, s, 30)).not.toEqual(stepAnim(a, s, 0.1));
  });

  it('still frame matches state', () => {
    const scenes = [
      scene(),
      scene({ haulage: 'degraded', rail: 'degraded' }),
      scene({ haulage: 'stopped', rail: 'stopped', crushing: 'stopped' }),
      ...[0, 150, 300].map((h) => sceneState(register, at(h))),
    ];
    for (const s of scenes) {
      const moving = run(s, 37, 0.13);
      expect(stateOf(stillFrame(s), s)).toEqual(stateOf(moving, s));
      // The still frame shows no ambient motion: no dust in the air.
      expect(stillFrame(s).dust).toEqual([]);
      // Wagons only take ore while the conveyor runs.
      if (!s.motion.conveyor) expect(stillFrame(s).train.wagonsFilled).toBe(0);
      expect(Object.keys(stillFrame(s).cableDots).sort()).toEqual(SERVICE_GROUPS.map((g) => g.id).sort());
    }
  });

  it('no movement when stopped', () => {
    const haulStopped = scene({ haulage: 'stopped' });
    const a = run(haulStopped, 60);
    expect(a.trucks.every((t) => t.parked)).toBe(true);
    expect(a.dust).toEqual([]);

    const railStopped = scene({ rail: 'stopped' });
    const r0 = initAnim(railStopped);
    expect(run(railStopped, 60, 0.1, r0).train.head).toBe(r0.train.head);

    const crushStopped = scene({ crushing: 'stopped' });
    const c0 = initAnim(crushStopped);
    const c1 = run(crushStopped, 60, 0.1, c0);
    expect(c1.beltOffset).toBe(c0.beltOffset);
    expect(c1.train.wagonsFilled).toBe(0);

    // A severed cable's dot stays put; a live one travels.
    const live = scene();
    const cut = sceneState(register, { ...base, services: { ...base.services, 'hosted-erp': 'down' } });
    expect(cut.cables['hosted-erp']).toBe('severed');
    expect(run(cut, 30).cableDots['hosted-erp']).toBe(initAnim(cut).cableDots['hosted-erp']);
    expect(run(live, 30).cableDots['cloud-identity']).not.toBe(initAnim(live).cableDots['cloud-identity']);
  });

  it('moving things do move while their state runs', () => {
    const s = scene();
    const a0 = initAnim(s);
    const a1 = run(s, 20);
    expect(a1.train.head).toBeGreaterThan(a0.train.head);
    expect(a1.beltOffset).not.toBe(a0.beltOffset);
    expect(a1.trucks.some((t, i) => dist(t.pos, a0.trucks[i]!.pos) > 1)).toBe(true);
    expect(a1.dust.length).toBeGreaterThan(0);
    // Half speed covers half the ground.
    const half = scene({ rail: 'degraded' });
    expect(run(half, 20).train.head - initAnim(half).train.head).toBeCloseTo((a1.train.head - a0.train.head) / 2, 6);
  });

  it('dust puffs every 0.22 s behind moving trucks only and fades over 2.6 s', () => {
    const s = scene({ haulage: 'degraded' });
    const a = run(s, 200, 0.05);
    expect(a.dust.every((d) => d.age >= 0 && d.age < 2.6)).toBe(true);
    // Four moving trucks shed a puff each 0.22 s; 2.6 s of trail is about 12 puffs each.
    expect(a.dust.length).toBeGreaterThanOrEqual(4 * 10);
    expect(a.dust.length).toBeLessThanOrEqual(4 * 13);
    for (const d of a.dust) expect(PARK_SLOTS.every((p) => dist(p, d.pos) > 10)).toBe(true);
  });

  it('wagons fill passing the loadout only while the conveyor runs', () => {
    const s = scene();
    const a = run(s, 400, 0.25);
    const stopped = scene({ crushing: 'stopped' });
    expect(run(stopped, 400, 0.25).train.wagonsFilled).toBe(0);
    expect(a.train.wagonsFilled).toBeGreaterThan(0);
  });

  it('deterministic', () => {
    const s = sceneState(register, at(150));
    expect(run(s, 50, 0.07)).toEqual(run(s, 50, 0.07));
    expect(initAnim(s)).toEqual(initAnim(s));
    expect(stillFrame(s)).toEqual(stillFrame(s));
  });
});
