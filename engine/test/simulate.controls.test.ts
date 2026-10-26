import { expect, test } from 'vitest';
import { effectPaths } from '../src/controls.js';
import type { Control, ControlEffect, Register, Scenario, ScenarioEvent } from '../src/schema.js';
import { simulate, simulateScenario } from '../src/simulate.js';
import type { Sample, Timeline } from '../src/simulate.js';
import { parseRegister } from '../src/validate.js';
import { minimalRegister, q } from './fixtures.js';

function at(t: Timeline, hour: number): Sample {
  const s = t.samples[hour];
  if (!s) throw new Error(`no sample at hour ${hour}`);
  return s;
}

function cut(service: string, from: number, hours: number): ScenarioEvent {
  return { kind: 'cut-service', service, at: q(from, 'hours'), restoreAfter: q(hours, 'hours') };
}

function compromise(via: string, target: string, from: number, hours: number): ScenarioEvent {
  return { kind: 'compromise', via, target, at: q(from, 'hours'), downFor: q(hours, 'hours') };
}

function scenario(events: ScenarioEvent[], edit: Partial<Scenario> = {}): Scenario {
  return {
    id: 'ad-hoc',
    title: 'Ad hoc',
    summary: 'A scenario that is not in the register.',
    basis: [],
    projection: false,
    workaroundsHold: false,
    horizon: q(2, 'days'),
    events,
    ...edit,
  };
}

function control(id: string, effects: ControlEffect[], edit: Partial<Control> = {}): Control {
  return {
    id,
    name: id,
    description: 'test control',
    effects,
    capability: { works: true, provenance: { kind: 'assumed', reasoning: 'test' }, measurements: [] },
    ...edit,
  };
}

function withControls(...controls: Control[]): Register {
  const r = minimalRegister();
  r.controls = controls;
  return parseRegister(r);
}

const fallback = (delay?: number): ControlEffect => ({
  kind: 'fallback',
  process: 'ordering',
  service: 'erp',
  ...(delay === undefined ? {} : { delay: q(delay, 'hours') }),
});

const restore = (hours: number): ControlEffect => ({ kind: 'restore', service: 'erp', duration: q(hours, 'hours') });

test('a fallback keeps a process degraded instead of stopped', () => {
  const r = withControls(control('offline-orders', [fallback()]));
  const t = simulate(r, 'cut-erp', 'prepared');
  expect(at(t, 1).processes.ordering).toBe('degraded');
  expect(t.totals.stoppedHours.ordering).toBe(0);
  expect(t.samples.every((s) => s.stocks.diesel! > 0)).toBe(true);
  expect(t.events.filter((e) => e.kind === 'stock-empty' && e.subject === 'diesel')).toEqual([]);
  expect(at(t, 1).processes.haulage).toBe('normal');

  const u = simulate(r, 'cut-erp', 'unprepared');
  expect(at(u, 1).processes.ordering).toBe('stopped');
});

test('a fallback with a delay stops the process until the takeover', () => {
  const t = simulate(withControls(control('offline-orders', [fallback(3)])), 'cut-erp', 'prepared');
  for (const h of [0, 1, 2]) expect(at(t, h).processes.ordering).toBe('stopped');
  expect(at(t, 3).processes.ordering).toBe('degraded');
  expect(at(t, 287).processes.ordering).toBe('degraded');
  expect(at(t, 288).processes.ordering).toBe('normal');
});

test('an independent restore shortens the outage', () => {
  const r = withControls(control('independent-erp-restore', [restore(6)]));
  const t = simulate(r, 'cut-erp', 'prepared');
  expect(at(t, 5).services.erp).toBe('down');
  expect(at(t, 6).services.erp).toBe('up');
  expect(at(t, 6).processes.ordering).toBe('normal');
  expect(t.events.filter((e) => e.subject === 'erp')).toEqual([
    { hour: 0, kind: 'service-down', subject: 'erp' },
    { hour: 6, kind: 'service-up', subject: 'erp' },
  ]);

  const u = simulate(r, 'cut-erp', 'unprepared');
  expect(at(u, 6).services.erp).toBe('down');
  expect(at(u, 288).services.erp).toBe('up');
});

test('restore shortens the merged outage from its start', () => {
  const r = withControls(control('independent-erp-restore', [restore(6)]));
  const t = simulateScenario(r, scenario([cut('erp', 0, 10), cut('erp', 5, 15)]), 'prepared');
  expect(at(t, 5).services.erp).toBe('down');
  expect(at(t, 6).services.erp).toBe('up');
  expect(at(t, 19).services.erp).toBe('up');
  expect(t.events.filter((e) => e.subject === 'erp').map((e) => [e.hour, e.kind])).toEqual([
    [0, 'service-down'],
    [6, 'service-up'],
  ]);
});

/** The minimal register with two vendor-access services and the given controls. */
function withVendors(...controls: Control[]): Register {
  const r = minimalRegister();
  for (const id of ['vendor-a', 'vendor-b']) {
    r.services.push({ id, name: id, provider: 'test', hosting: 'test', kind: 'vendor-access' });
  }
  r.controls = controls;
  return parseRegister(r);
}

const detect = (hours: number): ControlEffect => ({ kind: 'detect-and-revoke', service: 'vendor-a', duration: q(hours, 'hours') });

test('detect-and-revoke protects the asset and revokes only that vendor', () => {
  const r = withVendors(control('brokered-vendor-access', [detect(0.25)]));
  const s = scenario([compromise('vendor-a', 'plc', 2, 8)], { horizon: q(1, 'days') });

  const t = simulateScenario(r, s, 'prepared');
  expect(t.events).toContainEqual({ hour: 2, kind: 'compromise-started', subject: 'plc', from: 'vendor-a' });
  expect(t.events).toContainEqual({ hour: 2.25, kind: 'compromise-detected', subject: 'plc', from: 'vendor-a' });
  expect(t.events).toContainEqual({ hour: 2.25, kind: 'access-revoked', subject: 'vendor-a' });
  expect(t.events.filter((e) => e.kind === 'asset-down')).toEqual([]);
  expect(t.samples.every((x) => x.assets.plc === 'up')).toBe(true);
  expect(t.samples.every((x) => x.processes.crushing !== 'stopped')).toBe(true);
  expect(at(t, 2).services['vendor-a']).toBe('up');
  for (const x of t.samples.slice(3)) expect(x.services['vendor-a']).toBe('revoked');
  expect(t.samples.every((x) => x.services['vendor-b'] === 'up')).toBe(true);

  const u = simulateScenario(r, s, 'unprepared');
  expect(u.events).toContainEqual({ hour: 2, kind: 'compromise-started', subject: 'plc', from: 'vendor-a' });
  for (let h = 2; h <= 9; h++) {
    expect(at(u, h).assets.plc).toBe('down');
    expect(at(u, h).processes.crushing).toBe('stopped');
  }
  expect(at(u, 10).assets.plc).toBe('up');
  expect(u.events.filter((e) => e.kind === 'access-revoked' || e.kind === 'compromise-detected')).toEqual([]);
  expect(u.samples.every((x) => x.services['vendor-a'] === 'up')).toBe(true);
});

test('detection after the compromise ends does not protect the asset, but still revokes', () => {
  const r = withVendors(control('brokered-vendor-access', [detect(8)]));
  const t = simulateScenario(r, scenario([compromise('vendor-a', 'plc', 2, 8)], { horizon: q(1, 'days') }), 'prepared');
  for (let h = 2; h <= 9; h++) expect(at(t, h).assets.plc).toBe('down');
  expect(at(t, 10).assets.plc).toBe('up');
  expect(at(t, 10).services['vendor-a']).toBe('revoked');
  expect(t.events).toContainEqual({ hour: 10, kind: 'access-revoked', subject: 'vendor-a' });
});

test('a service that requires a revoked service is down', () => {
  const r = minimalRegister();
  r.services.push({ id: 'vendor-a', name: 'vendor-a', provider: 'test', hosting: 'test', kind: 'vendor-access' });
  r.services.find((x) => x.id === 'erp')!.requires = ['vendor-a'];
  r.controls = [control('brokered-vendor-access', [detect(0.25)])];
  const t = simulateScenario(parseRegister(r), scenario([compromise('vendor-a', 'plc', 2, 8)]), 'prepared');
  expect(at(t, 3).services['vendor-a']).toBe('revoked');
  expect(at(t, 3).services.erp).toBe('down');
  expect(at(t, 3).processes.ordering).toBe('stopped');
  expect(t.events).toContainEqual({ hour: 2.25, kind: 'service-down', subject: 'erp', from: 'vendor-a' });
});

test('a control whose capability does not work is ignored', () => {
  const failed = control('independent-erp-restore', [restore(6)], {
    capability: { works: false, provenance: { kind: 'assumed', reasoning: 'test' }, measurements: [] },
  });
  const t = simulate(withControls(failed), 'cut-erp', 'prepared');
  expect(at(t, 6).services.erp).toBe('down');
  expect(at(t, 287).services.erp).toBe('down');
  expect(at(t, 288).services.erp).toBe('up');
  expect(t.totals).toEqual(simulate(withControls(failed), 'cut-erp', 'unprepared').totals);
});

test('a control does not apply while an asset it relies on is down', () => {
  const r = withControls(control('offline-orders', [fallback()], { assets: ['plc'] }));
  const t = simulateScenario(r, scenario([cut('erp', 0, 24), compromise('erp', 'plc', 0, 5)]), 'prepared');
  for (const h of [0, 1, 2, 3, 4]) expect(at(t, h).processes.ordering).toBe('stopped');
  for (const h of [5, 23]) expect(at(t, h).processes.ordering).toBe('degraded');
  expect(at(t, 24).processes.ordering).toBe('normal');
});

test('lab measurements on a capability do not change durations', () => {
  const measured = { kind: 'measured', runId: 'lab-001', date: '2026-10-01', evidence: 'lab/runs/001' } as const;
  const c = control('independent-erp-restore', [restore(6)], {
    capability: {
      works: true,
      provenance: measured,
      measurements: [{ name: 'restore', quantity: { value: 40, unit: 'seconds', provenance: measured } }],
    },
  });
  const t = simulate(withControls(c), 'cut-erp', 'prepared');
  expect(at(t, 5).services.erp).toBe('down');
  expect(at(t, 6).services.erp).toBe('up');
  expect(Object.keys(t.assumptionsUsed).filter((p) => p.startsWith('controls.'))).toEqual([
    'controls.independent-erp-restore.effects[0].duration',
  ]);
});

test('assumptionsUsed lists effect durations only for controls the prepared run applies', () => {
  const failed = control('failed-restore', [restore(6)], {
    capability: { works: false, provenance: { kind: 'assumed', reasoning: 'test' }, measurements: [] },
  });
  const r = withControls(control('offline-orders', [fallback(3)]), failed);
  const controlPaths = (t: Timeline) => Object.keys(t.assumptionsUsed).filter((p) => p.startsWith('controls.'));
  const t = simulate(r, 'cut-erp', 'prepared');
  expect(controlPaths(t)).toEqual(['controls.offline-orders.effects[0].delay']);
  expect(t.assumptionsUsed['controls.offline-orders.effects[0].delay']).toEqual({
    value: 3,
    unit: 'hours',
    provenance: { kind: 'assumed', reasoning: 'test' },
    overridden: false,
  });
  expect(controlPaths(simulate(r, 'cut-erp', 'unprepared'))).toEqual([]);
});

test('a restore does not wait for an asset that was down only before the restore time', () => {
  const r = withControls(control('independent-erp-restore', [restore(6)], { assets: ['plc'] }));
  const t = simulateScenario(r, scenario([cut('erp', 0, 288), compromise('erp', 'plc', 0, 1)]), 'prepared');
  expect(at(t, 5).services.erp).toBe('down');
  expect(at(t, 6).services.erp).toBe('up');
  expect(t.events.filter((e) => e.subject === 'erp').map((e) => [e.hour, e.kind])).toEqual([
    [0, 'service-down'],
    [6, 'service-up'],
  ]);
});

test('the shortest of two overlapping restores wins (D-005)', () => {
  const r = withControls(control('slow-restore', [restore(12)]), control('fast-restore', [restore(6)]));
  const t = simulate(r, 'cut-erp', 'prepared');
  expect(at(t, 5).services.erp).toBe('down');
  expect(at(t, 6).services.erp).toBe('up');
  expect(t.events.filter((e) => e.subject === 'erp').map((e) => [e.hour, e.kind])).toEqual([
    [0, 'service-down'],
    [6, 'service-up'],
  ]);
});

test('effectPaths names only effect quantities that exist', () => {
  const r = withControls(control('offline-orders', [fallback(), fallback(3)]), control('independent-erp-restore', [restore(6)]));
  expect([...effectPaths(r, r.controls)]).toEqual([
    'controls.offline-orders.effects[1].delay',
    'controls.independent-erp-restore.effects[0].duration',
  ]);
  expect([...effectPaths(r, r.controls.slice(1))]).toEqual(['controls.independent-erp-restore.effects[0].duration']);
});

test('a restored service goes down again while an asset its restore relies on is down', () => {
  // Intended: the restored ERP runs on the plc for as long as the original 288-hour cut lasts.
  const r = withControls(control('independent-erp-restore', [restore(6)], { assets: ['plc'] }));
  const t = simulateScenario(
    r,
    scenario([cut('erp', 0, 288), compromise('erp', 'plc', 50, 3)], { horizon: q(3, 'days') }),
    'prepared',
  );
  expect(t.samples.filter((x) => x.services.erp === 'down').map((x) => x.hour)).toEqual([0, 1, 2, 3, 4, 5, 50, 51, 52]);
  expect(t.events.filter((e) => e.subject === 'erp' || e.subject === 'plc')).toEqual([
    { hour: 0, kind: 'service-down', subject: 'erp' },
    { hour: 6, kind: 'service-up', subject: 'erp' },
    { hour: 50, kind: 'compromise-started', subject: 'plc', from: 'erp' },
    { hour: 50, kind: 'service-down', subject: 'erp' },
    { hour: 50, kind: 'asset-down', subject: 'plc' },
    { hour: 53, kind: 'service-up', subject: 'erp' },
    { hour: 53, kind: 'asset-up', subject: 'plc' },
  ]);
});

test('a restore waits while an asset it relies on is down', () => {
  const r = withControls(control('independent-erp-restore', [restore(6)], { assets: ['plc'] }));
  const t = simulateScenario(r, scenario([cut('erp', 0, 288), compromise('erp', 'plc', 5, 3)]), 'prepared');
  for (const h of [5, 6, 7]) expect(at(t, h).services.erp).toBe('down');
  expect(at(t, 8).services.erp).toBe('up');
  expect(t.events.filter((e) => e.subject === 'erp').map((e) => [e.hour, e.kind])).toEqual([
    [0, 'service-down'],
    [8, 'service-up'],
  ]);
});

test('detect-and-revoke applies only if its assets are up at the detection hour', () => {
  const sensorRegister = () => {
    const r = minimalRegister();
    r.assets.push({ id: 'sensor', name: 'Sensor', type: 'network', zone: 'test' });
    r.services.push({ id: 'vendor-a', name: 'vendor-a', provider: 'test', hosting: 'test', kind: 'vendor-access' });
    r.controls = [control('brokered-vendor-access', [detect(0.25)], { assets: ['sensor'] })];
    return parseRegister(r);
  };
  const run = (sensorDownFor: number) =>
    simulateScenario(
      sensorRegister(),
      scenario([compromise('erp', 'sensor', 0, sensorDownFor), compromise('vendor-a', 'plc', 2, 8)], { horizon: q(1, 'days') }),
      'prepared',
    );

  const blind = run(4); // the sensor is still down at hour 3, the detection hour
  for (let h = 2; h <= 9; h++) expect(at(blind, h).assets.plc).toBe('down');
  expect(blind.events.filter((e) => e.kind === 'access-revoked' || e.kind === 'compromise-detected')).toEqual([]);
  expect(at(blind, 3).services['vendor-a']).toBe('up');

  const seen = run(3); // the sensor is back up at hour 3
  expect(seen.samples.every((x) => x.assets.plc === 'up')).toBe(true);
  expect(seen.events).toContainEqual({ hour: 2.25, kind: 'access-revoked', subject: 'vendor-a' });
  expect(at(seen, 3).services['vendor-a']).toBe('revoked');
});

test('a cut service that is revoked shows revoked, and its events match the samples', () => {
  const r = withVendors(control('brokered-vendor-access', [detect(0.25)]));
  const t = simulateScenario(r, scenario([cut('vendor-a', 0, 24), compromise('vendor-a', 'plc', 2, 8)], { horizon: q(1, 'days') }), 'prepared');
  expect(t.events.filter((e) => e.subject === 'vendor-a')).toEqual([
    { hour: 0, kind: 'service-down', subject: 'vendor-a' },
    { hour: 2.25, kind: 'access-revoked', subject: 'vendor-a' },
  ]);
  for (let h = 0; h <= 2; h++) expect(at(t, h).services['vendor-a']).toBe('down');
  for (let h = 3; h <= 24; h++) expect(at(t, h).services['vendor-a']).toBe('revoked');
});

test('a service that requires a cut and revoked service is down throughout, with one down event', () => {
  const r = minimalRegister();
  r.services.push({ id: 'vendor-a', name: 'vendor-a', provider: 'test', hosting: 'test', kind: 'vendor-access' });
  r.services.find((x) => x.id === 'erp')!.requires = ['vendor-a'];
  r.controls = [control('brokered-vendor-access', [detect(0.25)])];
  const s = scenario([cut('vendor-a', 0, 24), compromise('vendor-a', 'plc', 2, 8)], { horizon: q(1, 'days') });
  const t = simulateScenario(parseRegister(r), s, 'prepared');
  expect(t.samples.every((x) => x.services.erp === 'down')).toBe(true);
  expect(t.events.filter((e) => e.subject === 'erp')).toEqual([{ hour: 0, kind: 'service-down', subject: 'erp', from: 'vendor-a' }]);
});

/** The minimal register with a 24-hour post-restore hold on ordering's ERP dependency, and the given controls. */
function withHold(...controls: Control[]): Register {
  const r = minimalRegister();
  r.processes.find((p) => p.id === 'ordering')!.dependsOn[0]!.afterRestore = {
    description: 'orders held while transactions are reconciled by hand',
    holdFor: q(24, 'hours'),
  };
  r.controls = controls;
  return r;
}

const reconcile: ControlEffect = { kind: 'reconcile', process: 'ordering', service: 'erp' };

test('a post-restore hold keeps the dependency lost for holdFor hours after the service is back', () => {
  const t = simulate(parseRegister(withHold()), 'cut-erp', 'unprepared');
  expect(at(t, 287).processes.ordering).toBe('stopped');
  expect(at(t, 311).processes.ordering).toBe('stopped');
  expect(at(t, 312).processes.ordering).toBe('normal');
  // The service itself is back: only the dependency is held.
  expect(at(t, 288).services.erp).toBe('up');
  expect(t.events.filter((e) => e.subject === 'erp')).toEqual([
    { hour: 0, kind: 'service-down', subject: 'erp' },
    { hour: 288, kind: 'service-up', subject: 'erp' },
  ]);
});

test('during the hold a workaround that holds keeps the dependency degraded', () => {
  const r = withHold();
  r.processes.find((p) => p.id === 'ordering')!.dependsOn[0]!.manualWorkaround = {
    description: 'paper orders',
    holdsFor: q(2, 'days'),
  };
  r.scenarios[0]!.workaroundsHold = true;
  const t = simulate(parseRegister(r), 'cut-erp', 'unprepared');
  for (const h of [0, 287, 288, 311]) expect(at(t, h).processes.ordering).toBe('degraded');
  expect(at(t, 312).processes.ordering).toBe('normal');
  expect(t.totals.stoppedHours.ordering).toBe(0);
});

test('during the hold a workaround that has run out still counts from the outage start', () => {
  const r = withHold();
  r.processes.find((p) => p.id === 'ordering')!.dependsOn[0]!.manualWorkaround = {
    description: 'paper orders',
    holdsFor: q(2, 'days'),
  };
  const t = simulate(parseRegister(r), 'cut-erp', 'unprepared');
  expect(at(t, 47).processes.ordering).toBe('degraded');
  expect(at(t, 48).processes.ordering).toBe('stopped');
  expect(at(t, 311).processes.ordering).toBe('stopped');
  expect(at(t, 312).processes.ordering).toBe('normal');
});

test('a fallback still covers the dependency during the hold', () => {
  const t = simulate(parseRegister(withHold(control('offline-orders', [fallback()]))), 'cut-erp', 'prepared');
  expect(at(t, 288).processes.ordering).toBe('degraded');
  expect(at(t, 311).processes.ordering).toBe('degraded');
  expect(at(t, 312).processes.ordering).toBe('normal');
});

test('a reconcile control removes the post-restore hold in the prepared run only', () => {
  const r = parseRegister(withHold(control('duplicate-rejection', [reconcile])));
  const t = simulate(r, 'cut-erp', 'prepared');
  expect(at(t, 287).processes.ordering).toBe('stopped');
  expect(at(t, 288).processes.ordering).toBe('normal');

  const u = simulate(r, 'cut-erp', 'unprepared');
  expect(at(u, 311).processes.ordering).toBe('stopped');
  expect(at(u, 312).processes.ordering).toBe('normal');
});

test('a reconcile control whose capability does not work leaves the hold in place', () => {
  const failed = control('duplicate-rejection', [reconcile], {
    capability: { works: false, provenance: { kind: 'assumed', reasoning: 'test' }, measurements: [] },
  });
  const t = simulate(parseRegister(withHold(failed)), 'cut-erp', 'prepared');
  expect(at(t, 311).processes.ordering).toBe('stopped');
  expect(at(t, 312).processes.ordering).toBe('normal');
});

test('a reconcile control does not apply while an asset it relies on is down', () => {
  const r = parseRegister(withHold(control('duplicate-rejection', [reconcile], { assets: ['plc'] })));
  const s = scenario([cut('erp', 0, 24), compromise('erp', 'plc', 24, 6)], { horizon: q(3, 'days') });
  const t = simulateScenario(r, s, 'prepared');
  for (const h of [24, 29]) expect(at(t, h).processes.ordering).toBe('stopped');
  expect(at(t, 30).processes.ordering).toBe('normal');
});

test('a hold that runs into the next outage merges with it', () => {
  const r = parseRegister(withHold());
  const t = simulateScenario(r, scenario([cut('erp', 0, 10), cut('erp', 20, 10)], { horizon: q(3, 'days') }), 'unprepared');
  for (const h of [0, 10, 19, 20, 29, 30, 53]) expect(at(t, h).processes.ordering).toBe('stopped');
  expect(at(t, 54).processes.ordering).toBe('normal');
  expect(at(t, 10).services.erp).toBe('up');
});

test('without a post-restore hold the dependency recovers with the service', () => {
  const t = simulate(parseRegister(minimalRegister()), 'cut-erp', 'unprepared');
  expect(at(t, 287).processes.ordering).toBe('stopped');
  expect(at(t, 288).processes.ordering).toBe('normal');
  expect(Object.keys(t.assumptionsUsed).some((p) => p.includes('afterRestore'))).toBe(false);
});

test('assumptionsUsed records the post-restore hold', () => {
  const r = parseRegister(withHold(control('duplicate-rejection', [reconcile])));
  for (const variant of ['unprepared', 'prepared'] as const) {
    expect(simulate(r, 'cut-erp', variant).assumptionsUsed['processes.ordering.dependsOn.erp.afterRestore.holdFor']).toEqual({
      value: 24,
      unit: 'hours',
      provenance: { kind: 'assumed', reasoning: 'test' },
      overridden: false,
    });
  }
  expect(Object.keys(simulate(r, 'cut-erp', 'prepared').assumptionsUsed).filter((p) => p.startsWith('controls.'))).toEqual([]);
});
