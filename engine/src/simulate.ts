/**
 * The simulation model.
 *
 * - Time moves in 1-hour steps. There is one sample per hour, from hour 0 to the horizon inclusive.
 * - Something that happens at a fractional time t takes effect from the first whole hour >= t.
 *   Timeline events record t itself. Events after the horizon are left out.
 * - Services: all cuts of one service are merged into continuous outages first, so two overlapping
 *   cuts give one outage that ends at the later restore. A service is down during an outage, and
 *   also while any service it requires is down.
 * - Assets: a compromise takes its target asset down for `downFor` hours.
 * - Processes are worked out each hour, dependencies first. A process takes the worst result over
 *   its dependencies. A lost dependency (service down, asset down, upstream process stopped) gives
 *   `stopped` or `degraded`, as its `onLoss` says. An upstream process that is only degraded gives
 *   `degraded`.
 * - A manual workaround keeps a lost service dependency at `degraded`: for ever if the scenario says
 *   workarounds hold, otherwise for `holdsFor`, counted from the start of the outage.
 */
import type { Provenance, Unit } from './quantity.js';
import { toHours } from './quantity.js';
import { applyOverrides, quantityPaths } from './paths.js';
import type { Dependency, Register, Scenario } from './schema.js';
import { checkScenario, processOrder, RegisterError } from './validate.js';

export type Variant = 'unprepared' | 'prepared';
export type ProcessState = 'normal' | 'degraded' | 'stopped';
export type ServiceState = 'up' | 'down' | 'revoked';

export interface Sample {
  hour: number;
  processes: Record<string, ProcessState>;
  services: Record<string, ServiceState>;
  assets: Record<string, 'up' | 'down'>;
  stocks: Record<string, number>; // days remaining at the START of this hour
  tonnesDeferred: number; // cumulative to the end of this hour
  revenueAtRisk: number; // cumulative USD to the end of this hour
}

export type TimelineEventKind =
  | 'service-down'
  | 'service-up'
  | 'access-revoked'
  | 'asset-down'
  | 'asset-up'
  | 'compromise-started'
  | 'compromise-detected'
  | 'process-state'
  | 'stock-low'
  | 'stock-empty';

export interface TimelineEvent {
  hour: number;
  kind: TimelineEventKind;
  subject: string;
  from?: string;
  to?: string;
}

export interface UsedInput {
  value: number;
  unit: Unit;
  provenance: Provenance;
  overridden: boolean;
}

export interface Timeline {
  scenarioId: string;
  variant: Variant;
  projection: boolean;
  stepHours: 1;
  samples: Sample[];
  events: TimelineEvent[];
  totals: {
    tonnesDeferred: number;
    revenueAtRisk: number;
    nonNormalHours: Record<string, number>;
    stoppedHours: Record<string, number>;
  };
  assumptionsUsed: Record<string, UsedInput>; // every input quantity the run used, keyed by path
}

/** A half-open time window [start, end) in hours. */
interface Window {
  start: number;
  end: number;
}

const SEVERITY: Record<ProcessState, number> = { normal: 0, degraded: 1, stopped: 2 };

/** Sorts windows and joins those that overlap or touch, so each result is one continuous outage. */
function merge(windows: Window[]): Window[] {
  const merged: Window[] = [];
  for (const w of [...windows].filter((x) => x.end > x.start).sort((a, b) => a.start - b.start)) {
    const last = merged[merged.length - 1];
    if (last && w.start <= last.end) last.end = Math.max(last.end, w.end);
    else merged.push({ ...w });
  }
  return merged;
}

/** A window covers sample `hour` from the first whole hour at or after its start, up to (not including) the first at or after its end. */
function covering(windows: Window[], hour: number): Window | undefined {
  return windows.find((w) => hour >= Math.ceil(w.start) && hour < Math.ceil(w.end));
}

/** Groups windows by subject id and merges each group. */
function outagesBySubject(entries: { subject: string; window: Window }[]): Map<string, Window[]> {
  const grouped = new Map<string, Window[]>();
  for (const { subject, window } of entries) grouped.set(subject, [...(grouped.get(subject) ?? []), window]);
  return new Map([...grouped].map(([subject, windows]) => [subject, merge(windows)]));
}

function outageEvents(outages: Map<string, Window[]>, down: TimelineEventKind, up: TimelineEventKind): TimelineEvent[] {
  return [...outages].flatMap(([subject, windows]) =>
    windows.flatMap((w) => [
      { hour: w.start, kind: down, subject },
      { hour: w.end, kind: up, subject },
    ]),
  );
}

function worst(a: ProcessState, b: ProcessState): ProcessState {
  return SEVERITY[b] > SEVERITY[a] ? b : a;
}

function lossResult(d: Dependency): ProcessState {
  return d.onLoss === 'stop' ? 'stopped' : 'degraded';
}

/** The register with `scenario` in place of any scenario of the same id, overrides applied and re-validated. */
function prepare(r: Register, scenario: Scenario, overrides: Record<string, number>): { reg: Register; scenario: Scenario } {
  const withScenario = { ...r, scenarios: [...r.scenarios.filter((s) => s.id !== scenario.id), scenario] };
  const reg = applyOverrides(withScenario, overrides);
  return { reg, scenario: reg.scenarios.find((s) => s.id === scenario.id)! };
}

/** The scenario's own quantities and every workaround duration, as the run used them. */
function assumptionsUsed(reg: Register, scenario: Scenario, overrides: Record<string, number>): Record<string, UsedInput> {
  const used: Record<string, UsedInput> = {};
  for (const { path, quantity } of quantityPaths(reg)) {
    if (path.startsWith(`scenarios.${scenario.id}.`) || path.endsWith('.manualWorkaround.holdsFor')) {
      used[path] = {
        value: quantity.value,
        unit: quantity.unit,
        provenance: quantity.provenance,
        overridden: Object.hasOwn(overrides, path),
      };
    }
  }
  return used;
}

/**
 * Runs `scenario` hour by hour against the register. The scenario need not be in the register
 * (free play), but its ids must resolve. `overrides` replace input values by path.
 */
export function simulateScenario(
  r: Register,
  scenario: Scenario,
  variant: Variant,
  overrides: Record<string, number> = {},
): Timeline {
  checkScenario(r, scenario);
  const prepared = prepare(r, scenario, overrides);
  const { reg } = prepared;
  const s = prepared.scenario;
  const horizonHours = Math.floor(toHours(s.horizon));

  const cuts: { subject: string; window: Window }[] = [];
  const compromises: { subject: string; window: Window }[] = [];
  const events: TimelineEvent[] = [];
  for (const e of s.events) {
    const start = toHours(e.at);
    if (e.kind === 'cut-service') {
      cuts.push({ subject: e.service, window: { start, end: start + toHours(e.restoreAfter) } });
    } else {
      events.push({ hour: start, kind: 'compromise-started', subject: e.target, from: e.via });
      compromises.push({ subject: e.target, window: { start, end: start + toHours(e.downFor) } });
    }
  }
  const serviceOutages = outagesBySubject(cuts);
  const assetOutages = outagesBySubject(compromises);
  events.push(
    ...outageEvents(serviceOutages, 'service-down', 'service-up'),
    ...outageEvents(assetOutages, 'asset-down', 'asset-up'),
  );

  const services = new Map(reg.services.map((x) => [x.id, x]));
  const processes = new Map(reg.processes.map((p) => [p.id, p]));
  const assets = new Set(reg.assets.map((a) => a.id));
  const order = processOrder(reg);
  const samples: Sample[] = [];
  const nonNormalHours = Object.fromEntries(reg.processes.map((p) => [p.id, 0]));
  const stoppedHours = Object.fromEntries(reg.processes.map((p) => [p.id, 0]));
  // For each service that is down this hour: when its current outage began (exact hours), for timing workarounds.
  let downSince = new Map<string, number>();
  let previous: Record<string, ProcessState> = Object.fromEntries(reg.processes.map((p) => [p.id, 'normal']));

  for (let hour = 0; hour <= horizonHours; hour++) {
    // A service is down if one of its own cuts covers this hour or a service it requires is down.
    // A new outage starts at the earliest of those starts; a continuing one keeps the start it had.
    const before = downSince;
    downSince = new Map<string, number>();
    const startOf = (id: string): number | undefined => {
      if (downSince.has(id)) return downSince.get(id);
      const starts = [
        covering(serviceOutages.get(id) ?? [], hour)?.start,
        ...(services.get(id)?.requires ?? []).map(startOf),
      ].filter((x): x is number => x !== undefined);
      if (starts.length === 0) return undefined;
      const start = before.get(id) ?? Math.min(...starts);
      downSince.set(id, start);
      return start;
    };
    const serviceStates: Record<string, ServiceState> = {};
    for (const id of services.keys()) serviceStates[id] = startOf(id) === undefined ? 'up' : 'down';

    const assetStates: Record<string, 'up' | 'down'> = {};
    for (const id of assets) assetStates[id] = covering(assetOutages.get(id) ?? [], hour) ? 'down' : 'up';

    const processStates: Record<string, ProcessState> = {};
    const dependencyResult = (d: Dependency): ProcessState => {
      if (services.has(d.on)) {
        if (serviceStates[d.on] === 'up') return 'normal';
        const w = d.manualWorkaround;
        if (w && (s.workaroundsHold || hour < Math.ceil(downSince.get(d.on)! + toHours(w.holdsFor)))) return 'degraded';
        return lossResult(d);
      }
      if (assets.has(d.on)) return assetStates[d.on] === 'down' ? lossResult(d) : 'normal';
      if (processes.has(d.on)) {
        const upstream = processStates[d.on];
        return upstream === 'stopped' ? lossResult(d) : upstream === 'degraded' ? 'degraded' : 'normal';
      }
      return 'normal'; // a stock: treated as full until stocks are modelled
    };
    for (const id of order) {
      const state = processes.get(id)!.dependsOn.map(dependencyResult).reduce(worst, 'normal');
      processStates[id] = state;
      if (state !== 'normal') nonNormalHours[id]! += 1;
      if (state === 'stopped') stoppedHours[id]! += 1;
      if (state !== previous[id]) events.push({ hour, kind: 'process-state', subject: id, from: previous[id], to: state });
    }
    previous = processStates;

    samples.push({
      hour,
      processes: processStates,
      services: serviceStates,
      assets: assetStates,
      stocks: Object.fromEntries(reg.stocks.map((x) => [x.id, x.initial.value])),
      tonnesDeferred: 0,
      revenueAtRisk: 0,
    });
  }

  return {
    scenarioId: s.id,
    variant,
    projection: s.projection,
    stepHours: 1,
    samples,
    events: events.filter((e) => e.hour <= horizonHours).sort((a, b) => a.hour - b.hour),
    totals: { tonnesDeferred: 0, revenueAtRisk: 0, nonNormalHours, stoppedHours },
    assumptionsUsed: assumptionsUsed(reg, s, overrides),
  };
}

export function simulateWith(r: Register, scenarioId: string, variant: Variant, overrides: Record<string, number>): Timeline {
  const scenario = r.scenarios.find((s) => s.id === scenarioId);
  if (!scenario) throw new RegisterError([`unknown scenario '${scenarioId}'`]);
  return simulateScenario(r, scenario, variant, overrides);
}

export function simulate(r: Register, scenarioId: string, variant: Variant): Timeline {
  return simulateWith(r, scenarioId, variant, {});
}
