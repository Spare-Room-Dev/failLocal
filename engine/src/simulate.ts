/**
 * The simulation model.
 *
 * - Time moves in 1-hour steps. There is one sample per hour, from hour 0 to the horizon inclusive.
 * - Something that happens at a fractional time t takes effect from the first whole hour >= t.
 *   Timeline events record t itself. Events after the horizon are left out.
 * - Outages are merged first: windows that overlap, touch, or leave no whole hour between them
 *   become one continuous outage, from the earliest start to the latest end. So two overlapping
 *   cuts give one outage that ends at the later restore. A window too short to cover a whole
 *   hour is ignored, because no sample would see it.
 * - Services: a service is down during its own cuts and while any service it requires is down
 *   or revoked. Both are merged into its outages, and each outage gives exactly one `service-down`
 *   (at its start) and one `service-up` (at its end), so the events always agree with the samples.
 *   When an outage begins because a required service went down, `service-down` names that service
 *   in `from`. Hours in which the service's own access is revoked are taken out of its outages
 *   (it shows `revoked`, not `down`), and an outage cut short by a revocation has no `service-up`.
 * - Assets: a compromise takes its target asset down for `downFor` hours.
 * - Processes are worked out each hour, dependencies first. A process takes the worst result over
 *   its dependencies. A lost dependency (service down, asset down, upstream process stopped) gives
 *   `stopped` or `degraded`, as its `onLoss` says. An upstream process that is only degraded gives
 *   `degraded`.
 * - A manual workaround keeps a lost service dependency at `degraded`: for ever if the scenario says
 *   workarounds hold, otherwise for `holdsFor`, counted from the start of the outage.
 * - Stocks are kept in hours of normal consumption: day values are multiplied by 24 once, at the
 *   start, and a refill rate of r days/day adds r hours each hour. Inputs that come to whole hours
 *   therefore keep the level a whole number, with no floating-point drift. A sample reports a stock in days, as the
 *   level at the START of its hour, which is the level that hour's processes saw.
 * - A process that depends on a stock gets `onLoss` when the stock is empty, `degraded` when it is
 *   at or below its low threshold, and `normal` otherwise.
 * - After the processes are worked out, each stock moves by one hour: if its replenishing process
 *   is running (normal or degraded) it gains its refill rate, up to capacity. Otherwise it loses one
 *   hour if any consumer is not stopped, down to 0. Refill and consumption never both apply.
 * - `stock-low` fires when a stock's level reaches or drops below its low threshold, and
 *   `stock-empty` when it reaches 0, once per crossing: each fires again only after the level has
 *   risen back above that mark. The event hour is the hour whose start first sees the new level.
 *   A stock that starts at or below a mark fires its event at hour 0.
 * - Production deferred: each hour adds the hourly rate in full while the shipping process is
 *   stopped, and `1 - degradedOutput` of it while degraded. Revenue at risk is the tonnes deferred
 *   times the price. Both are cumulative to the end of each hour, and the totals are the last
 *   sample's values.
 *
 * Prepared and unprepared:
 * - "Prepared" is the same register with its `controls` applied. There is no second register.
 *   The unprepared run ignores every control. The prepared run applies each control whose
 *   `capability.works` is true, and only at a sample where none of the assets it relies on is
 *   down. Only effect durations feed the run; lab measurements and observations never do.
 * - Restore: a service's own cuts are merged first, then each merged outage is cut short to
 *   `duration` hours from its start, except for the hours after that in which an asset the control
 *   relies on is down: the service stays down through those. This happens before outages of
 *   required services are added, so a restore cannot bring a service back while a service it
 *   requires is still down.
 * - Fallback: it covers one dependency of one process on one service. For the first `delay` hours
 *   of the service's outage (default 0) the dependency gives its normal result (`onLoss`, or the
 *   manual workaround while it holds); after that it gives `degraded`. A fallback never makes a
 *   dependency worse than it is without one.
 * - Detect-and-revoke: a compromise via the control's service is detected at `at + duration`.
 *   Then `compromise-detected` and `access-revoked` fire, and the service is `revoked` until the
 *   horizon. A revoked service counts as lost, and services that require it are `down`. The target
 *   asset is not taken down: this assumes detection and revocation happen before the write takes
 *   effect, or that the write is reverted. If detection comes no earlier than the end of the
 *   compromise (`duration >= downFor`) nothing was prevented: the asset goes down as it would
 *   unprepared, and the access is still revoked. Compromises are taken in order of `at`, and the
 *   control's assets are checked at its detection hour against the compromises taken so far.
 */
import type { Provenance, Unit } from './quantity.js';
import { toHours } from './quantity.js';
import { applyOverrides, quantityPaths } from './paths.js';
import { tonnesPerHour } from './production.js';
import type { AssetDown } from './controls.js';
import { detectionDelay, effectPaths, restoreEffects, takeoverDelay, workingControls } from './controls.js';
import type { Control, Dependency, Register, Scenario, ScenarioEvent, Stock } from './schema.js';
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

/** A half-open time window [start, end) in hours. `cause` is the required service it came from, if any. */
interface Window {
  start: number;
  end: number;
  cause?: string;
}

const SEVERITY: Record<ProcessState, number> = { normal: 0, degraded: 1, stopped: 2 };

/**
 * A window covers sample `hour` from the first whole hour at or after its start, up to (not
 * including) the first whole hour at or after its end.
 */
function covering(windows: Window[], hour: number): Window | undefined {
  return windows.find((w) => hour >= Math.ceil(w.start) && hour < Math.ceil(w.end));
}

/**
 * Sorts windows and joins any whose covered hours overlap or touch, so each result is one outage
 * that the samples see as continuous. Windows that cover no whole hour are dropped. A merged
 * outage keeps the `cause` of the window that started it.
 */
function merge(windows: Window[]): Window[] {
  const merged: Window[] = [];
  const visible = windows.filter((w) => Math.ceil(w.end) > Math.ceil(w.start));
  for (const w of visible.sort((a, b) => a.start - b.start)) {
    const last = merged[merged.length - 1];
    if (last && Math.ceil(w.start) <= Math.ceil(last.end)) last.end = Math.max(last.end, w.end);
    else merged.push({ ...w });
  }
  return merged;
}

/** The parts of `windows` that fall inside some window of `within`. Each part keeps its own `cause`. */
function intersect(windows: Window[], within: Window[]): Window[] {
  return windows.flatMap((w) =>
    within
      .map((x) => ({ ...w, start: Math.max(w.start, x.start), end: Math.min(w.end, x.end) }))
      .filter((part) => part.end > part.start),
  );
}

/** The parts of `windows` that fall outside every window of `removed`. Each part keeps its own `cause`. */
function subtract(windows: Window[], removed: Window[]): Window[] {
  return removed.reduce(
    (rest, x) =>
      rest.flatMap((w) =>
        [
          { ...w, end: Math.min(w.end, x.start) },
          { ...w, start: Math.max(w.start, x.end) },
        ].filter((part) => part.end > part.start),
      ),
    windows,
  );
}

/** Groups windows by subject id. */
function bySubject(entries: { subject: string; window: Window }[]): Map<string, Window[]> {
  const grouped = new Map<string, Window[]>();
  for (const { subject, window } of entries) grouped.set(subject, [...(grouped.get(subject) ?? []), window]);
  return grouped;
}

/**
 * Each service's outages and the windows in which it is lost. It is lost during its own cuts
 * (merged, then shortened by `restore`), while any service it requires is lost, and while its own
 * access is revoked. Its outages are the lost windows that are not revoked: the hours it is `down`.
 */
function serviceOutages(
  reg: Register,
  cuts: Map<string, Window[]>,
  revocations: Map<string, Window[]>,
  restore: (service: string, outage: Window) => Window[],
): { outages: Map<string, Window[]>; lost: Map<string, Window[]> } {
  const requires = new Map(reg.services.map((x) => [x.id, x.requires ?? []]));
  const outages = new Map<string, Window[]>();
  const lost = new Map<string, Window[]>();
  const resolve = (id: string): Window[] => {
    const known = lost.get(id);
    if (known) return known;
    const own = merge(cuts.get(id) ?? []).flatMap((w) => restore(id, w));
    const inherited = (requires.get(id) ?? []).flatMap((req) =>
      resolve(req).map((w) => ({ start: w.start, end: w.end, cause: req })),
    );
    const merged = merge([...own, ...inherited]);
    const revoked = revocations.get(id) ?? [];
    outages.set(id, merge(subtract(merged, revoked)));
    lost.set(id, merge([...merged, ...revoked]));
    return lost.get(id)!;
  };
  for (const id of requires.keys()) resolve(id);
  return { outages, lost };
}

type Compromise = Extract<ScenarioEvent, { kind: 'compromise' }>;

/**
 * Works through the compromises in order of `at`: the asset outages they cause, the services whose
 * access is revoked from detection to `end`, and the detection and revocation events.
 */
function resolveCompromises(
  compromises: Compromise[],
  controls: Control[],
  end: number,
): { assetOutages: Map<string, Window[]>; revocations: Map<string, Window[]>; events: TimelineEvent[] } {
  const downs: { subject: string; window: Window }[] = [];
  const revoked: { subject: string; window: Window }[] = [];
  const events: TimelineEvent[] = [];
  const downSoFar: AssetDown = (asset, hour) => downs.some((d) => d.subject === asset && covering([d.window], hour));
  for (const c of [...compromises].sort((a, b) => toHours(a.at) - toHours(b.at))) {
    const start = toHours(c.at);
    const downFor = toHours(c.downFor);
    const delay = detectionDelay(controls, c.via, start, downSoFar);
    if (delay !== undefined) {
      const detected = start + delay;
      events.push(
        { hour: detected, kind: 'compromise-detected', subject: c.target, from: c.via },
        { hour: detected, kind: 'access-revoked', subject: c.via },
      );
      revoked.push({ subject: c.via, window: { start: detected, end } });
    }
    if (delay === undefined || delay >= downFor) downs.push({ subject: c.target, window: { start, end: start + downFor } });
  }
  const merged = (entries: { subject: string; window: Window }[]) =>
    new Map([...bySubject(entries)].map(([id, windows]) => [id, merge(windows)]));
  return { assetOutages: merged(downs), revocations: merged(revoked), events };
}

/**
 * One `down` event at the start of each outage and one `up` event at its end, except that an outage
 * ending where a revocation begins has no `up`: the subject goes straight to revoked, which
 * `access-revoked` reports.
 */
function outageEvents(
  outages: Map<string, Window[]>,
  down: TimelineEventKind,
  up: TimelineEventKind,
  revocations: Map<string, Window[]> = new Map(),
): TimelineEvent[] {
  return [...outages].flatMap(([subject, windows]) =>
    windows.flatMap((w): TimelineEvent[] => {
      const start: TimelineEvent = { hour: w.start, kind: down, subject, ...(w.cause ? { from: w.cause } : {}) };
      const revokedAtEnd = covering(revocations.get(subject) ?? [], Math.ceil(w.end));
      return revokedAtEnd ? [start] : [start, { hour: w.end, kind: up, subject }];
    }),
  );
}

function worst(a: ProcessState, b: ProcessState): ProcessState {
  return SEVERITY[b] > SEVERITY[a] ? b : a;
}

function lossResult(d: Dependency): ProcessState {
  return d.onLoss === 'stop' ? 'stopped' : 'degraded';
}

/** A stock as the run tracks it, every amount in hours of normal consumption. */
interface StockLevel {
  stock: Stock;
  level: number;
  capacity: number;
  low: number;
  refill: number;
  lowFired: boolean;
  emptyFired: boolean;
}

function stockLevel(stock: Stock): StockLevel {
  return {
    stock,
    level: stock.initial.value * 24,
    capacity: stock.capacity.value * 24,
    low: stock.lowThreshold.value * 24,
    refill: stock.refillRate.value,
    lowFired: false,
    emptyFired: false,
  };
}

function stockResult(d: Dependency, s: StockLevel): ProcessState {
  if (s.level <= 0) return lossResult(d);
  return s.level <= s.low ? 'degraded' : 'normal';
}

/** Moves the stock on by one hour, given the process states of that hour. */
function stepStock(s: StockLevel, states: Record<string, ProcessState>): void {
  if (states[s.stock.replenishedBy] !== 'stopped') {
    s.level = Math.min(s.capacity, s.level + s.refill);
  } else if (s.stock.consumedBy.some((id) => states[id] !== 'stopped')) {
    s.level = Math.max(0, s.level - 1);
  }
}

/** The `stock-low` and `stock-empty` events for the level that the start of `hour` sees. */
function stockCrossings(s: StockLevel, hour: number): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  if (s.level > s.low) s.lowFired = false;
  else if (!s.lowFired) {
    s.lowFired = true;
    events.push({ hour, kind: 'stock-low', subject: s.stock.id });
  }
  if (s.level > 0) s.emptyFired = false;
  else if (!s.emptyFired) {
    s.emptyFired = true;
    events.push({ hour, kind: 'stock-empty', subject: s.stock.id });
  }
  return events;
}

/** The share of an hour's tonnes deferred when the shipping process is in `state`. */
function deferredShare(state: ProcessState, degradedOutput: number): number {
  return state === 'stopped' ? 1 : state === 'degraded' ? 1 - degradedOutput : 0;
}

/** The register with `scenario` in place of any scenario of the same id, overrides applied and re-validated. */
function prepare(r: Register, scenario: Scenario, overrides: Record<string, number>): { reg: Register; scenario: Scenario } {
  const withScenario = { ...r, scenarios: [...r.scenarios.filter((s) => s.id !== scenario.id), scenario] };
  const reg = applyOverrides(withScenario, overrides);
  return { reg, scenario: reg.scenarios.find((s) => s.id === scenario.id)! };
}

/**
 * The scenario's own quantities, every workaround duration, stock and production input, and the
 * effect durations of the applied controls, as the run used them.
 */
function assumptionsUsed(
  reg: Register,
  scenario: Scenario,
  controls: Control[],
  overrides: Record<string, number>,
): Record<string, UsedInput> {
  const used: Record<string, UsedInput> = {};
  const controlInputs = effectPaths(controls);
  for (const { path, quantity } of quantityPaths(reg)) {
    const read =
      path.startsWith(`scenarios.${scenario.id}.`) ||
      controlInputs.has(path) ||
      path.endsWith('.manualWorkaround.holdsFor') ||
      path.startsWith('stocks.') ||
      path.startsWith('production.');
    if (read) {
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
  const controls = variant === 'prepared' ? workingControls(reg.controls) : [];

  const cuts: { subject: string; window: Window }[] = [];
  const compromises: Compromise[] = [];
  const events: TimelineEvent[] = [];
  for (const e of s.events) {
    const start = toHours(e.at);
    if (e.kind === 'cut-service') {
      cuts.push({ subject: e.service, window: { start, end: start + toHours(e.restoreAfter) } });
    } else {
      events.push({ hour: start, kind: 'compromise-started', subject: e.target, from: e.via });
      compromises.push(e);
    }
  }
  const resolved = resolveCompromises(compromises, controls, horizonHours + 1);
  const { assetOutages, revocations } = resolved;
  const assetDown: AssetDown = (asset, hour) => covering(assetOutages.get(asset) ?? [], hour) !== undefined;
  // Each restore leaves the outage only for its first `hours`, and while an asset it relies on is down.
  const restore = (service: string, w: Window): Window[] =>
    restoreEffects(controls, service).reduce(
      (down, r) => {
        const kept = [{ start: w.start, end: w.start + r.hours }, ...r.assets.flatMap((a) => assetOutages.get(a) ?? [])];
        return intersect(down, kept);
      },
      [w],
    );
  const { outages, lost } = serviceOutages(reg, bySubject(cuts), revocations, restore);
  events.push(
    ...resolved.events,
    ...outageEvents(outages, 'service-down', 'service-up', revocations),
    ...outageEvents(assetOutages, 'asset-down', 'asset-up'),
  );

  const services = new Set(reg.services.map((x) => x.id));
  const processes = new Map(reg.processes.map((p) => [p.id, p]));
  const assets = new Set(reg.assets.map((a) => a.id));
  const order = processOrder(reg);
  const samples: Sample[] = [];
  const nonNormalHours = Object.fromEntries(reg.processes.map((p) => [p.id, 0]));
  const stoppedHours = Object.fromEntries(reg.processes.map((p) => [p.id, 0]));
  let previous: Record<string, ProcessState> = Object.fromEntries(reg.processes.map((p) => [p.id, 'normal']));
  const stocks = new Map(reg.stocks.map((x) => [x.id, stockLevel(x)]));
  for (const x of stocks.values()) events.push(...stockCrossings(x, 0));
  const perHour = tonnesPerHour(reg.production);
  let tonnesDeferred = 0;

  for (let hour = 0; hour <= horizonHours; hour++) {
    const serviceStates: Record<string, ServiceState> = {};
    for (const id of services) {
      const revoked = covering(revocations.get(id) ?? [], hour);
      serviceStates[id] = revoked ? 'revoked' : covering(outages.get(id) ?? [], hour) ? 'down' : 'up';
    }

    const assetStates: Record<string, 'up' | 'down'> = {};
    for (const id of assets) assetStates[id] = assetDown(id, hour) ? 'down' : 'up';

    const processStates: Record<string, ProcessState> = {};
    const dependencyResult = (process: string, d: Dependency): ProcessState => {
      if (services.has(d.on)) {
        const outage = covering(lost.get(d.on) ?? [], hour);
        if (!outage) return 'normal';
        const w = d.manualWorkaround;
        if (w && (s.workaroundsHold || hour < Math.ceil(outage.start + toHours(w.holdsFor)))) return 'degraded';
        const delay = takeoverDelay(controls, process, d.on, hour, assetDown);
        if (delay !== undefined && hour >= Math.ceil(outage.start + delay)) return 'degraded';
        return lossResult(d);
      }
      if (assets.has(d.on)) return assetStates[d.on] === 'down' ? lossResult(d) : 'normal';
      if (processes.has(d.on)) {
        const upstream = processStates[d.on];
        return upstream === 'stopped' ? lossResult(d) : upstream === 'degraded' ? 'degraded' : 'normal';
      }
      const stock = stocks.get(d.on);
      return stock ? stockResult(d, stock) : 'normal';
    };
    for (const id of order) {
      const state = processes.get(id)!.dependsOn.map((d) => dependencyResult(id, d)).reduce(worst, 'normal');
      processStates[id] = state;
      if (state !== 'normal') nonNormalHours[id]! += 1;
      if (state === 'stopped') stoppedHours[id]! += 1;
      if (state !== previous[id]) events.push({ hour, kind: 'process-state', subject: id, from: previous[id], to: state });
    }
    previous = processStates;

    const shipping = processStates[reg.production.shippingProcess]!;
    tonnesDeferred += perHour * deferredShare(shipping, reg.production.degradedOutput.value);
    samples.push({
      hour,
      processes: processStates,
      services: serviceStates,
      assets: assetStates,
      stocks: Object.fromEntries([...stocks].map(([id, x]) => [id, x.level / 24])),
      tonnesDeferred,
      revenueAtRisk: tonnesDeferred * reg.production.price.value,
    });

    for (const x of stocks.values()) {
      stepStock(x, processStates);
      events.push(...stockCrossings(x, hour + 1));
    }
  }
  const last = samples[samples.length - 1]!;

  return {
    scenarioId: s.id,
    variant,
    projection: s.projection,
    stepHours: 1,
    samples,
    events: events.filter((e) => e.hour <= horizonHours).sort((a, b) => a.hour - b.hour),
    totals: { tonnesDeferred: last.tonnesDeferred, revenueAtRisk: last.revenueAtRisk, nonNormalHours, stoppedHours },
    assumptionsUsed: assumptionsUsed(reg, s, controls, overrides),
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
