import { expect, test } from 'vitest';
import type { Register, Scenario, ScenarioEvent } from '../src/schema.js';
import { simulate, simulateScenario, simulateWith } from '../src/simulate.js';
import type { Sample, Timeline, TimelineEvent } from '../src/simulate.js';
import { parseRegister, RegisterError } from '../src/validate.js';
import { minimalRegister, q } from './fixtures.js';

function at(t: Timeline, hour: number): Sample {
  const s = t.samples[hour];
  if (!s) throw new Error(`no sample at hour ${hour}`);
  return s;
}

function cut(service: string, from: number, hours: number): ScenarioEvent {
  return { kind: 'cut-service', service, at: q(from, 'hours'), restoreAfter: q(hours, 'hours') };
}

function scenario(events: ScenarioEvent[], edit: Partial<Scenario> = {}): Scenario {
  return {
    id: 'ad-hoc',
    title: 'Ad hoc',
    summary: 'A scenario that is not in the register.',
    basis: [],
    projection: false,
    workaroundsHold: false,
    horizon: q(20, 'days'),
    events,
    ...edit,
  };
}

function dependency(r: Register, process: string, on: string) {
  const d = r.processes.find((p) => p.id === process)?.dependsOn.find((x) => x.on === on);
  if (!d) throw new Error(`no dependency ${process} -> ${on}`);
  return d;
}

test('cutting a service stops the process that needs it, then restores it', () => {
  const t = simulate(parseRegister(minimalRegister()), 'cut-erp', 'unprepared');
  expect(at(t, 1).processes.ordering).toBe('stopped');
  expect(at(t, 287).processes.ordering).toBe('stopped');
  expect(at(t, 288).processes.ordering).toBe('normal');
  expect(at(t, 0).services.erp).toBe('down');
  expect(at(t, 288).services.erp).toBe('up');
  expect(t.events).toContainEqual(expect.objectContaining({ hour: 0, kind: 'service-down', subject: 'erp' }));
  expect(t.events).toContainEqual(expect.objectContaining({ hour: 288, kind: 'service-up', subject: 'erp' }));
  expect(t.events).toContainEqual({ hour: 0, kind: 'process-state', subject: 'ordering', from: 'normal', to: 'stopped' });
  expect(t.events).toContainEqual({ hour: 288, kind: 'process-state', subject: 'ordering', from: 'stopped', to: 'normal' });
});

test('a timeline has one sample per hour up to the horizon, and totals for every process', () => {
  const t = simulate(parseRegister(minimalRegister()), 'cut-erp', 'unprepared');
  expect(t).toMatchObject({ scenarioId: 'cut-erp', variant: 'unprepared', projection: false, stepHours: 1 });
  expect(t.samples).toHaveLength(20 * 24 + 1);
  expect(t.samples.map((s) => s.hour)).toEqual([...Array(481).keys()]);
  const processes = ['crushing', 'haulage', 'ordering', 'rail'];
  expect(Object.keys(t.totals.stoppedHours).sort()).toEqual(processes);
  expect(Object.keys(t.totals.nonNormalHours).sort()).toEqual(processes);
});

test('onLoss degrade yields degraded, not stopped', () => {
  const r = minimalRegister();
  dependency(r, 'ordering', 'erp').onLoss = 'degrade';
  const t = simulate(parseRegister(r), 'cut-erp', 'unprepared');
  expect(at(t, 1).processes.ordering).toBe('degraded');
  expect(t.totals.stoppedHours.ordering).toBe(0);
  expect(t.totals.nonNormalHours.ordering).toBe(288);
});

test('a lost asset stops the process that needs it', () => {
  const r = parseRegister(minimalRegister());
  const compromise: ScenarioEvent = { kind: 'compromise', via: 'erp', target: 'plc', at: q(0, 'hours'), downFor: q(5, 'hours') };
  const t = simulateScenario(r, scenario([compromise]), 'unprepared');
  for (const h of [0, 1, 2, 3, 4]) {
    expect(at(t, h).assets.plc).toBe('down');
    expect(at(t, h).processes.crushing).toBe('stopped');
  }
  expect(at(t, 5).assets.plc).toBe('up');
  expect(at(t, 5).processes.crushing).toBe('normal');
  expect(at(t, 0).services.erp).toBe('up');
  expect(t.events).toContainEqual({ hour: 0, kind: 'compromise-started', subject: 'plc', from: 'erp' });
  expect(t.events).toContainEqual({ hour: 0, kind: 'asset-down', subject: 'plc' });
  expect(t.events).toContainEqual({ hour: 5, kind: 'asset-up', subject: 'plc' });
});

test('a stopped upstream process stops a dependent one', () => {
  const r = minimalRegister();
  r.processes.find((p) => p.id === 'haulage')!.dependsOn.push({ on: 'erp', onLoss: 'stop' });
  let t = simulate(parseRegister(r), 'cut-erp', 'unprepared');
  expect(at(t, 1).processes.haulage).toBe('stopped');
  expect(at(t, 1).processes.crushing).toBe('stopped');

  dependency(r, 'haulage', 'erp').onLoss = 'degrade';
  t = simulate(parseRegister(r), 'cut-erp', 'unprepared');
  expect(at(t, 1).processes.haulage).toBe('degraded');
  expect(at(t, 1).processes.crushing).toBe('degraded');
});

test('overlapping cuts of one service merge into one outage', () => {
  const r = parseRegister(minimalRegister());
  const t = simulateScenario(r, scenario([cut('erp', 0, 10), cut('erp', 5, 15)]), 'unprepared');
  for (const h of [9, 10, 19]) expect(at(t, h).processes.ordering).toBe('stopped');
  expect(at(t, 20).processes.ordering).toBe('normal');
  const erp = (kind: string) => t.events.filter((e) => e.kind === kind && e.subject === 'erp');
  expect(erp('service-down')).toEqual([{ hour: 0, kind: 'service-down', subject: 'erp' }]);
  expect(erp('service-up')).toEqual([{ hour: 20, kind: 'service-up', subject: 'erp' }]);
});

test('fractional times take effect from the next whole hour, and events keep the exact time', () => {
  const r = parseRegister(minimalRegister());
  const t = simulateScenario(r, scenario([cut('erp', 2.5, 3)]), 'unprepared');
  expect(at(t, 2).services.erp).toBe('up');
  expect(at(t, 3).services.erp).toBe('down');
  expect(at(t, 5).services.erp).toBe('down');
  expect(at(t, 6).services.erp).toBe('up');
  expect(t.events).toContainEqual({ hour: 2.5, kind: 'service-down', subject: 'erp' });
  expect(t.events).toContainEqual({ hour: 5.5, kind: 'service-up', subject: 'erp' });
  expect(t.events).toContainEqual({ hour: 3, kind: 'process-state', subject: 'ordering', from: 'normal', to: 'stopped' });
});

test('events after the horizon are left out', () => {
  const r = parseRegister(minimalRegister());
  const t = simulateScenario(r, scenario([cut('erp', 10, 100)], { horizon: q(1, 'days') }), 'unprepared');
  expect(t.samples).toHaveLength(25);
  expect(at(t, 24).services.erp).toBe('down');
  expect(t.events.filter((e) => e.subject === 'erp').map((e) => e.kind)).toEqual(['service-down']);
});

/** The minimal register with a 'net' service that 'erp' requires. */
function withNet(): Register {
  const r = minimalRegister();
  r.services.push({ id: 'net', name: 'Network', provider: 'test', hosting: 'test', kind: 'network-link' });
  r.services.find((s) => s.id === 'erp')!.requires = ['net'];
  return parseRegister(r);
}

function serviceEvents(t: Timeline): TimelineEvent[] {
  return t.events.filter((e) => e.kind === 'service-down' || e.kind === 'service-up');
}

/** Every hour at which the samples show `service` changing state, as service events would report it. */
function sampledChanges(t: Timeline, service: string): { hour: number; kind: string }[] {
  return t.samples.flatMap((s, h) => {
    const before = h === 0 ? 'up' : t.samples[h - 1]!.services[service];
    const now = s.services[service];
    return now === before ? [] : [{ hour: h, kind: now === 'down' ? 'service-down' : 'service-up' }];
  });
}

test('a service is down while a service it requires is down', () => {
  const t = simulateScenario(withNet(), scenario([cut('net', 0, 10)]), 'unprepared');
  expect(at(t, 5).services.net).toBe('down');
  expect(at(t, 5).services.erp).toBe('down');
  expect(at(t, 5).processes.ordering).toBe('stopped');
  expect(at(t, 10).services.erp).toBe('up');
  expect(at(t, 10).processes.ordering).toBe('normal');
  expect(serviceEvents(t)).toEqual([
    { hour: 0, kind: 'service-down', subject: 'net' },
    { hour: 0, kind: 'service-down', subject: 'erp', from: 'net' },
    { hour: 10, kind: 'service-up', subject: 'net' },
    { hour: 10, kind: 'service-up', subject: 'erp' },
  ]);
});

test('an own cut inside an inherited outage gives one outage, not a second down and up', () => {
  const t = simulateScenario(withNet(), scenario([cut('net', 0, 10), cut('erp', 5, 10)]), 'unprepared');
  for (const h of [0, 5, 10, 14]) expect(at(t, h).services.erp).toBe('down');
  expect(at(t, 15).services.erp).toBe('up');
  expect(serviceEvents(t)).toEqual([
    { hour: 0, kind: 'service-down', subject: 'net' },
    { hour: 0, kind: 'service-down', subject: 'erp', from: 'net' },
    { hour: 10, kind: 'service-up', subject: 'net' },
    { hour: 15, kind: 'service-up', subject: 'erp' },
  ]);
});

test('service events always match the sampled service states', () => {
  const r = withNet();
  const cases: ScenarioEvent[][] = [
    [cut('net', 0, 10)],
    [cut('net', 0, 10), cut('erp', 5, 10)],
    [cut('erp', 0, 10), cut('net', 5, 10)],
    [cut('erp', 0, 10.2), cut('erp', 10.5, 5)], // a gap shorter than an hour is not seen by the samples
    [cut('erp', 3.2, 0.5)], // a cut that covers no whole hour is not seen either
    [cut('net', 2.5, 3), cut('erp', 20, 4)],
  ];
  for (const events of cases) {
    const t = simulateScenario(r, scenario(events), 'unprepared');
    for (const service of ['net', 'erp']) {
      const reported = serviceEvents(t)
        .filter((e) => e.subject === service)
        .map((e) => ({ hour: Math.ceil(e.hour), kind: e.kind }));
      expect(reported).toEqual(sampledChanges(t, service));
    }
  }
});

test('an outage that begins with an own cut has no from, and ends at its latest end', () => {
  const t = simulateScenario(withNet(), scenario([cut('erp', 0, 10), cut('net', 5, 10)]), 'unprepared');
  expect(serviceEvents(t).filter((e) => e.subject === 'erp')).toEqual([
    { hour: 0, kind: 'service-down', subject: 'erp' },
    { hour: 15, kind: 'service-up', subject: 'erp' },
  ]);
});

test('manual workaround degrades for holdsFor, then stops, unless workarounds hold', () => {
  const r = minimalRegister();
  dependency(r, 'ordering', 'erp').manualWorkaround = { description: 'paper orders', holdsFor: q(2, 'days') };
  let t = simulate(parseRegister(r), 'cut-erp', 'unprepared');
  expect(at(t, 0).processes.ordering).toBe('degraded');
  expect(at(t, 47).processes.ordering).toBe('degraded');
  expect(at(t, 48).processes.ordering).toBe('stopped');
  expect(at(t, 288).processes.ordering).toBe('normal');

  r.scenarios[0]!.workaroundsHold = true;
  t = simulate(parseRegister(r), 'cut-erp', 'unprepared');
  expect(at(t, 200).processes.ordering).toBe('degraded');
  expect(at(t, 287).processes.ordering).toBe('degraded');
  expect(t.totals.stoppedHours.ordering).toBe(0);
});

test('simulateScenario runs an ad-hoc scenario and rejects bad ids', () => {
  const r = parseRegister(minimalRegister());
  const t = simulateScenario(r, scenario([cut('erp', 0, 24)]), 'unprepared');
  expect(t.scenarioId).toBe('ad-hoc');
  expect(at(t, 1).processes.ordering).toBe('stopped');
  expect(at(t, 24).processes.ordering).toBe('normal');
  expect(() => simulateScenario(r, scenario([cut('ghost', 0, 24)]), 'unprepared')).toThrow(RegisterError);
  expect(() => simulateScenario(r, scenario([cut('ghost', 0, 24)]), 'unprepared')).toThrow(/ghost/);
});

test('assumptionsUsed lists the scenario, workaround, continuity, stock and production inputs the run read', () => {
  const r = minimalRegister();
  dependency(r, 'ordering', 'erp').manualWorkaround = { description: 'paper orders', holdsFor: q(2, 'days') };
  const t = simulate(parseRegister(r), 'cut-erp', 'unprepared');
  const stockInputs = ['capacity', 'initial', 'lowThreshold', 'refillRate'];
  const continuity = r.processes.flatMap((p) => ['maxTolerableOutage', 'recoveryTarget'].map((f) => `processes.${p.id}.continuity.${f}`));
  expect(Object.keys(t.assumptionsUsed).sort()).toEqual(
    [
      ...continuity,
      'processes.ordering.dependsOn.erp.manualWorkaround.holdsFor',
      'production.annualTonnes',
      'production.degradedOutput',
      'production.price',
      'scenarios.cut-erp.events[0].at',
      'scenarios.cut-erp.events[0].restoreAfter',
      'scenarios.cut-erp.horizon',
      ...stockInputs.map((f) => `stocks.diesel.${f}`),
      ...stockInputs.map((f) => `stocks.ore.${f}`),
    ].sort(),
  );
  expect(t.assumptionsUsed['scenarios.cut-erp.events[0].restoreAfter']).toEqual({
    value: 288,
    unit: 'hours',
    provenance: { kind: 'assumed', reasoning: 'test' },
    overridden: false,
  });
});

test('simulateWith applies overrides and keeps the original provenance', () => {
  const sourced = { kind: 'sourced', source: 'test-src' } as const;
  const event = cut('erp', 0, 288);
  if (event.kind === 'cut-service') event.restoreAfter.provenance = sourced;
  const reg = minimalRegister();
  reg.scenarios[0]!.events = [event];
  const r = parseRegister(reg);
  const t = simulateWith(r, 'cut-erp', 'unprepared', { 'scenarios.cut-erp.events[0].restoreAfter': 24 });
  expect(at(t, 23).processes.ordering).toBe('stopped');
  expect(at(t, 24).processes.ordering).toBe('normal');
  expect(t.assumptionsUsed['scenarios.cut-erp.events[0].restoreAfter']).toEqual({
    value: 24,
    unit: 'hours',
    provenance: sourced,
    overridden: true,
  });
  expect(t.assumptionsUsed['scenarios.cut-erp.events[0].at']?.overridden).toBe(false);
  expect(simulate(r, 'cut-erp', 'unprepared').assumptionsUsed['scenarios.cut-erp.events[0].restoreAfter']?.value).toBe(288);
});

test('simulateScenario applies overrides to an ad-hoc scenario', () => {
  const r = parseRegister(minimalRegister());
  const t = simulateScenario(r, scenario([cut('erp', 0, 24)]), 'unprepared', { 'scenarios.ad-hoc.events[0].restoreAfter': 2 });
  expect(at(t, 2).processes.ordering).toBe('normal');
  expect(t.assumptionsUsed['scenarios.ad-hoc.events[0].restoreAfter']?.overridden).toBe(true);
  expect(() => simulateWith(r, 'cut-erp', 'unprepared', { 'scenarios.nope.horizon': 1 })).toThrow(/nope/);
});

test('simulate is deterministic', () => {
  const r = parseRegister(minimalRegister());
  expect(simulate(r, 'cut-erp', 'unprepared')).toEqual(simulate(r, 'cut-erp', 'unprepared'));
});

test('unknown scenario id throws', () => {
  const r = parseRegister(minimalRegister());
  expect(() => simulate(r, 'no-such', 'unprepared')).toThrow(RegisterError);
  expect(() => simulate(r, 'no-such', 'unprepared')).toThrow(/no-such/);
});
