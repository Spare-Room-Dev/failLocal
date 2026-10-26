import { describe, expect, test } from 'vitest';
import { applyOverrides } from '../src/paths.js';
import type { Register, Scenario, ScenarioEvent } from '../src/schema.js';
import { simulateScenario, simulateWith } from '../src/simulate.js';
import { parseRegister, RegisterError } from '../src/validate.js';
import { minimalRegister, q } from './fixtures.js';

/** The minimal register with a restore control and a scenario that has a compromise, so every range has a path. */
function register(): Register {
  const r = minimalRegister();
  r.controls = [
    {
      id: 'ctl',
      name: 'Control',
      description: 'A test control.',
      effects: [{ kind: 'restore', service: 'erp', duration: q(6, 'hours') }],
      capability: { works: true, provenance: { kind: 'assumed', reasoning: 'test' }, measurements: [] },
    },
  ];
  r.scenarios.push({
    ...structuredClone(r.scenarios[0]!),
    id: 'hit-plc',
    events: [{ kind: 'compromise', via: 'erp', target: 'plc', at: q(2, 'hours'), downFor: q(8, 'hours') }],
  });
  return parseRegister(r);
}

function registerError(run: () => unknown): RegisterError {
  try {
    run();
  } catch (e) {
    if (e instanceof RegisterError) return e;
    throw e;
  }
  throw new Error('expected a RegisterError');
}

describe('out-of-range overrides are rejected with the offending path', () => {
  // [scenario, override path, bad value]: the error names the override path itself.
  const rows: [string, string, number][] = [
    ['cut-erp', 'production.degradedOutput', 1.5],
    ['cut-erp', 'production.degradedOutput', -0.5],
    ['cut-erp', 'stocks.diesel.refillRate', -1],
    ['cut-erp', 'stocks.diesel.capacity', -1],
    ['cut-erp', 'stocks.diesel.initial', -1],
    ['cut-erp', 'stocks.diesel.lowThreshold', 5],
    ['cut-erp', 'production.price', -1],
    ['cut-erp', 'production.annualTonnes', -1],
    ['cut-erp', 'scenarios.cut-erp.horizon', -1],
    ['cut-erp', 'scenarios.cut-erp.horizon', 0],
    ['cut-erp', 'scenarios.cut-erp.horizon', 36500],
    ['cut-erp', 'scenarios.cut-erp.events[0].at', -1],
    ['cut-erp', 'scenarios.cut-erp.events[0].restoreAfter', -1],
    ['cut-erp', 'scenarios.cut-erp.events[0].restoreAfter', 0],
    ['hit-plc', 'scenarios.hit-plc.events[0].at', -1],
    ['hit-plc', 'scenarios.hit-plc.events[0].downFor', -1],
    ['hit-plc', 'scenarios.hit-plc.events[0].downFor', 0],
    ['cut-erp', 'controls.ctl.effects[0].duration', -1],
  ];
  const r = register();
  test.each(rows)('%s: %s = %d', (scenarioId, path, value) => {
    const error = registerError(() => simulateWith(r, scenarioId, 'prepared', { [path]: value }));
    expect(error.message).toContain(path);
  });
});

describe('out-of-range ad-hoc scenarios are rejected with the offending path', () => {
  const cut = (at: number, restoreAfter: number): ScenarioEvent => ({
    kind: 'cut-service',
    service: 'erp',
    at: q(at, 'hours'),
    restoreAfter: q(restoreAfter, 'hours'),
  });
  const hit = (at: number, downFor: number): ScenarioEvent => ({
    kind: 'compromise',
    via: 'erp',
    target: 'plc',
    at: q(at, 'hours'),
    downFor: q(downFor, 'hours'),
  });
  const scenario = (horizonDays: number, events: ScenarioEvent[]): Scenario => ({
    id: 'ad-hoc',
    title: 'Ad hoc',
    summary: 'A scenario that is not in the register.',
    basis: [],
    projection: false,
    workaroundsHold: false,
    horizon: q(horizonDays, 'days'),
    events,
  });
  const rows: [string, Scenario, string][] = [
    ['horizon -1', scenario(-1, [cut(0, 24)]), 'scenarios.ad-hoc.horizon'],
    ['horizon 0', scenario(0, [cut(0, 24)]), 'scenarios.ad-hoc.horizon'],
    ['horizon 36500', scenario(36500, [cut(0, 24)]), 'scenarios.ad-hoc.horizon'],
    ['at -1', scenario(2, [cut(-1, 24)]), 'scenarios.ad-hoc.events[0].at'],
    ['restoreAfter -1', scenario(2, [cut(0, -1)]), 'scenarios.ad-hoc.events[0].restoreAfter'],
    ['restoreAfter 0', scenario(2, [cut(0, 0)]), 'scenarios.ad-hoc.events[0].restoreAfter'],
    ['downFor -1', scenario(2, [hit(0, -1)]), 'scenarios.ad-hoc.events[0].downFor'],
    ['downFor 0', scenario(2, [hit(0, 0)]), 'scenarios.ad-hoc.events[0].downFor'],
  ];
  const r = register();
  test.each(rows)('%s', (_name, s, named) => {
    const error = registerError(() => simulateScenario(r, s, 'prepared'));
    expect(error.message).toContain(named);
  });
});

test('values on the edge of each range are accepted', () => {
  const r = register();
  const edges: Record<string, number>[] = [
    { 'production.degradedOutput': 0 },
    { 'production.degradedOutput': 1 },
    { 'stocks.diesel.lowThreshold': 4 }, // equal to capacity
    { 'stocks.diesel.refillRate': 0 },
    { 'scenarios.cut-erp.horizon': 400 },
    { 'scenarios.cut-erp.events[0].at': 0 },
  ];
  for (const overrides of edges) {
    expect(() => applyOverrides(r, overrides), JSON.stringify(overrides)).not.toThrow();
  }
});
