import type { ProcessState, Register, Sample, ServiceState } from '@faillocal/engine';
import { groupState, SERVICE_GROUPS } from './serviceGroups.js';

export type Flag = 'pennant' | 'half' | 'full';
export type Cable = 'live' | 'severed' | 'revoked';

export interface SceneState {
  hour: number;
  processes: Record<string, { state: ProcessState; flag: Flag; hatched: boolean; label: string; note: string }>;
  services: Record<string, { state: ServiceState; cable: Cable }>;
  fleet: { moving: number; parked: number }; // illustrative eight (D-099)
  train: { speed: 0 | 0.5 | 1 };
  fills: { stockpile: number; romPad: number; diesel: number }; // 0..1 of capacity
  motion: { crusher: boolean; conveyor: boolean };
  /** One cable per service group, keyed by `SERVICE_GROUPS` id. */
  cables: Record<string, Cable>;
  /** The honesty plate on the board's front edge (DESIGN.md's fixed engraved wording). */
  plate: { fictional: true; text: string };
}

export const PLATE_TEXT = 'FICTIONAL MODEL SITE · PILBARA IRON ORE · SYNTHETIC DATA';

const FLAG: Record<ProcessState, Flag> = { normal: 'pennant', degraded: 'half', stopped: 'full' };
const FLEET: Record<ProcessState, SceneState['fleet']> = {
  normal: { moving: 8, parked: 0 },
  degraded: { moving: 4, parked: 4 },
  stopped: { moving: 0, parked: 8 },
};
const TRAIN_SPEED: Record<ProcessState, SceneState['train']['speed']> = { normal: 1, degraded: 0.5, stopped: 0 };
const CABLE: Record<ServiceState, Cable> = { up: 'live', down: 'severed', revoked: 'revoked' };

/**
 * What the scene draws for one engine sample. Computed, not scripted: every field below is read off
 * the sample through this binding table, and nothing else moves the scene (D-099).
 *
 * | Engine value | Scene |
 * |---|---|
 * | `processes[id]` | normal → pennant, degraded → half flag, stopped → full flag + hatched ground |
 * | `processes.haulage` | fleet: normal 8/0, degraded 4/4, stopped 0/8 (moving/parked) |
 * | `processes.rail` | train speed 1 / 0.5 / 0 |
 * | `processes.crushing` | crusher and conveyor move unless stopped |
 * | `services[id]` | up → live cable; down → severed; revoked → revoked |
 * | `stocks['ore-stockpile'] / capacity`, `stocks['rom-pad'] / capacity`, `stocks.diesel / capacity` | fill heights |
 * | services of each `SERVICE_GROUPS` group | `cables[group]`: the group's worst cable |
 * | `register.site.fictional` | `plate`; a register not marked fictional throws |
 *
 * Each process's `label` is the register `name`; its `note` is the register's `status.degraded` or
 * `status.stopped` copy, or the empty string when normal. Fills are days over capacity in days,
 * clamped to [0, 1]. A process, service or stock the register declares but the sample lacks throws:
 * the scene never draws a default in place of an engine value.
 */
export function sceneState(r: Register, sample: Sample): SceneState {
  if (r.site.fictional !== true) throw new Error('register is not marked fictional; the scene will not draw an unlabelled site');
  const process = (id: string): ProcessState => {
    const state = sample.processes[id];
    if (!state) throw new Error(`sample has no process ${id}`);
    return state;
  };
  const processes: SceneState['processes'] = {};
  for (const p of r.processes) {
    const state = process(p.id);
    processes[p.id] = {
      state,
      flag: FLAG[state],
      hatched: state === 'stopped',
      label: p.name,
      note: state === 'normal' ? '' : p.status[state],
    };
  }
  const services: SceneState['services'] = {};
  for (const { id } of r.services) {
    const state = sample.services[id];
    if (!state) throw new Error(`sample has no service ${id}`);
    services[id] = { state, cable: CABLE[state] };
  }

  const fill = (stockId: string): number => {
    const stock = r.stocks.find((s) => s.id === stockId);
    if (!stock) throw new Error(`register has no stock ${stockId}`);
    const level = sample.stocks[stockId];
    if (level === undefined) throw new Error(`sample has no stock ${stockId}`);
    return Math.min(1, Math.max(0, level / stock.capacity.value));
  };
  const crushing = process('crushing') !== 'stopped';
  return {
    hour: sample.hour,
    processes,
    services,
    fleet: { ...FLEET[process('haulage')] },
    train: { speed: TRAIN_SPEED[process('rail')] },
    fills: { stockpile: fill('ore-stockpile'), romPad: fill('rom-pad'), diesel: fill('diesel') },
    motion: { crusher: crushing, conveyor: crushing },
    cables: Object.fromEntries(SERVICE_GROUPS.map((g) => [g.id, groupState(services, g)])),
    plate: { fictional: true, text: PLATE_TEXT },
  };
}
