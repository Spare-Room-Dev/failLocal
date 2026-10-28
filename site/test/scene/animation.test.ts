import { simulate } from '@faillocal/engine';
import type { Sample } from '@faillocal/engine';
import { describe, expect, it } from 'vitest';
import { register } from '../../src/model/register.js';
import { sceneState } from '../../src/model/sceneState.js';
import type { SceneState } from '../../src/model/sceneState.js';
import { SERVICE_GROUPS } from '../../src/model/serviceGroups.js';
import { PARK_SLOTS, stepAnim, stillFrame } from '../../src/scene/animation.js';
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
function run(s: SceneState, n: number, dt = 0.1, from: AnimState = stillFrame(s)): AnimState {
  let a = from;
  for (let i = 0; i < n; i++) a = stepAnim(a, s, dt);
  return a;
}

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const fuelBay = LAYOUT.structures.find((s) => s.id === 'fuel-bay')!;
const bayCentre = { x: fuelBay.at.x + fuelBay.size.x / 2, y: fuelBay.at.y + fuelBay.size.y / 2 };

/**
 * What a frame says about the engine state, from the frame's own fields. The train-moving flag, the
 * fills and the cable states are not frame fields: dynamic.ts and overlay.ts draw them straight from
 * `SceneState`, so a still frame and a moving one cannot disagree on them by construction.
 */
function stateOf(a: AnimState, s: SceneState, still: AnimState) {
  return {
    moving: a.trucks.filter((t) => !t.parked).length,
    parked: a.trucks.filter((t) => t.parked).length,
    parkedSlots: a.trucks.filter((t) => t.parked).map((t) => t.pos),
    // A wagon fills only while the train runs past the loadout (ruling R-ab: rail runs only while the stockpile feeds it).
    wagonsLoadedStanding: s.train.speed === 0 && a.train.wagonsFilled > 0,
    // A train at speed 0 stands where the still frame has it.
    trainStandsWhenStopped: s.train.speed > 0 || a.train.head === still.train.head,
    // Dust only behind moving trucks.
    dustWithoutHaulage: s.fleet.moving === 0 && a.dust.length > 0,
    // A cut cable's dot does not travel; light vehicles stand while haulage is stopped.
    deadDots: SERVICE_GROUPS.filter((g) => s.cables[g.id] !== 'live').map((g) => a.cableDots[g.id]),
    lvsStand: s.processes.haulage!.state !== 'stopped' || JSON.stringify(a.lvs) === JSON.stringify(still.lvs),
  };
}

describe('animation', () => {
  it('moving and parked trucks follow scene.fleet', () => {
    for (const [state, [moving, parked]] of Object.entries(HAULAGE)) {
      const s = scene({ haulage: state as keyof typeof HAULAGE });
      expect(s.fleet).toEqual({ moving, parked });
      for (const a of [stillFrame(s), run(s, 40), stillFrame(s)]) {
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
    let a = stillFrame(s);
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
    let a = stillFrame(s);
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
    const a = stillFrame(s);
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
    const cutAll = sceneState(register, { ...base, services: Object.fromEntries(Object.keys(base.services).map((k) => [k, 'down'])) as Sample['services'] });
    scenes.push(cutAll, scene({ crushing: 'stopped', rail: 'degraded' }));
    for (const s of scenes) {
      const still = stillFrame(s);
      const moving = run(s, 37, 0.13);
      expect(stateOf(still, s, still)).toEqual(stateOf(moving, s, still));
      const facts = stateOf(moving, s, still);
      expect(facts.wagonsLoadedStanding).toBe(false);
      expect(facts.trainStandsWhenStopped).toBe(true);
      expect(facts.dustWithoutHaulage).toBe(false);
      expect(facts.lvsStand).toBe(true);
      // The still frame shows no ambient motion: no dust in the air.
      expect(stillFrame(s).dust).toEqual([]);
      // Wagons only take ore while the train runs (R-ab).
      if (s.train.speed === 0) expect(stillFrame(s).train.wagonsFilled).toBe(0);
      expect(Object.keys(stillFrame(s).cableDots).sort()).toEqual(SERVICE_GROUPS.map((g) => g.id).sort());
    }
  });

  it('no movement when stopped', () => {
    const haulStopped = scene({ haulage: 'stopped' });
    const a = run(haulStopped, 60);
    expect(a.trucks.every((t) => t.parked)).toBe(true);
    expect(a.dust).toEqual([]);

    const railStopped = scene({ rail: 'stopped' });
    const r0 = stillFrame(railStopped);
    const r1 = run(railStopped, 60, 0.1, r0);
    expect(r1.train.head).toBe(r0.train.head);
    expect(r1.train.wagonsFilled).toBe(0);

    // The belt stands with the crusher; the train, fed from the stockpile, keeps loading (R-ab).
    const crushStopped = scene({ crushing: 'stopped' });
    const c0 = stillFrame(crushStopped);
    const c1 = run(crushStopped, 60, 0.1, c0);
    expect(c1.beltOffset).toBe(c0.beltOffset);
    expect(c1.train.wagonsFilled).toBeGreaterThan(0);

    // A severed cable's dot stays put; a live one travels.
    const live = scene();
    const cut = sceneState(register, { ...base, services: { ...base.services, 'hosted-erp': 'down' } });
    expect(cut.cables['hosted-erp']).toBe('severed');
    expect(run(cut, 30).cableDots['hosted-erp']).toBe(stillFrame(cut).cableDots['hosted-erp']);
    expect(run(live, 30).cableDots['cloud-identity']).not.toBe(stillFrame(live).cableDots['cloud-identity']);
  });

  it('moving things do move while their state runs', () => {
    const s = scene();
    const a0 = stillFrame(s);
    const a1 = run(s, 20);
    expect(a1.train.head).toBeGreaterThan(a0.train.head);
    expect(a1.beltOffset).not.toBe(a0.beltOffset);
    expect(a1.trucks.some((t, i) => dist(t.pos, a0.trucks[i]!.pos) > 1)).toBe(true);
    expect(a1.dust.length).toBeGreaterThan(0);
    // Half speed covers half the ground.
    const half = scene({ rail: 'degraded' });
    expect(run(half, 20).train.head - stillFrame(half).train.head).toBeCloseTo((a1.train.head - a0.train.head) / 2, 6);
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

  it('wagons fill passing the loadout while the train runs, whether or not the crusher does (ruling R-ab)', () => {
    expect(run(scene(), 400, 0.25).train.wagonsFilled).toBeGreaterThan(0);
    expect(run(scene({ rail: 'stopped' }), 400, 0.25).train.wagonsFilled).toBe(0);
    expect(run(scene({ crushing: 'stopped' }), 400, 0.25).train.wagonsFilled).toBeGreaterThan(0);
    // s1 projection, unprepared, day 13: crushing stopped, rail normal, the stockpile still feeding it.
    const d13 = sceneState(register, at(13 * 24));
    expect(d13.processes.crushing!.state).toBe('stopped');
    expect(d13.train.speed).toBeGreaterThan(0);
    expect(d13.motion.conveyor).toBe(false);
    expect(stillFrame(d13).train.wagonsFilled).toBeGreaterThan(0);
    expect(run(d13, 400, 0.25).train.wagonsFilled).toBeGreaterThan(0);
  });

  it('light vehicles circulate only while haulage runs', () => {
    for (const state of ['normal', 'degraded'] as const) {
      const s = scene({ haulage: state });
      expect(run(s, 20).lvs).not.toEqual(stillFrame(s).lvs);
    }
    const stopped = scene({ haulage: 'stopped' });
    expect(run(stopped, 60).lvs).toEqual(stillFrame(stopped).lvs);
    // Stood down mid-run, they stop where they are.
    const moved = run(scene(), 30);
    expect(run(stopped, 30, 0.1, moved).lvs).toEqual(moved.lvs);
  });

  it('refuses a scene without haulage rather than letting the light vehicles run by default', () => {
    const s = scene();
    const { haulage: _, ...rest } = s.processes;
    expect(() => stepAnim(stillFrame(s), { ...s, processes: rest }, 0.1)).toThrow(/haulage/);
  });

  it('refuses a fleet that is not the illustrative eight', () => {
    const s = scene();
    expect(() => stillFrame({ ...s, fleet: { moving: 5, parked: 4 } })).toThrow();
  });

  it('deterministic', () => {
    const s = sceneState(register, at(150));
    expect(run(s, 50, 0.07)).toEqual(run(s, 50, 0.07));
    expect(stillFrame(s)).toEqual(stillFrame(s));
    expect(stillFrame(s)).toEqual(stillFrame(s));
  });
});
