import { stringify } from 'yaml';
import { describe, expect, test } from 'vitest';
import { applyOverrides, judgementPaths, quantityPaths } from '../src/paths.js';
import type { Control, Register, Scenario } from '../src/schema.js';
import { checkScenario, loadRegisterYaml, parseRegister, processOrder, RegisterError } from '../src/validate.js';
import { minimalRegister, q } from './fixtures.js';

const measured = { kind: 'measured', runId: 'r', date: '2026-12-14', evidence: 'x' } as const;

function control(overrides: Partial<Control> = {}): Control {
  return {
    id: 'ctl',
    name: 'Control',
    description: 'A test control.',
    effects: [{ kind: 'restore', service: 'erp', duration: q(24, 'hours') }],
    capability: { works: true, provenance: { kind: 'assumed', reasoning: 'test' }, measurements: [] },
    ...overrides,
  };
}

/** A valid register with one control added, edited by `edit`. */
function withControl(edit: (c: Control) => void): Register {
  const r = minimalRegister();
  const c = control();
  edit(c);
  r.controls.push(c);
  return r;
}

function issuesOf(input: unknown): string[] {
  try {
    parseRegister(input);
  } catch (e) {
    if (e instanceof RegisterError) return e.issues;
    throw e;
  }
  throw new Error('expected parseRegister to throw');
}

test('minimal register is valid', () => {
  expect(() => parseRegister(minimalRegister())).not.toThrow();
});

test('site must be marked fictional', () => {
  const r: any = minimalRegister();
  r.site.fictional = false;
  expect(() => parseRegister(r)).toThrow(RegisterError);
});

test('every input number needs provenance', () => {
  const r: any = minimalRegister();
  delete r.production.price.provenance;
  expect(() => parseRegister(r)).toThrow(/production\.price/);
});

describe('dangling references', () => {
  const cases: [string, string, (r: any) => void][] = [
    ['ghost1', 'dependsOn', (r) => r.processes[0].dependsOn.push({ on: 'ghost1', onLoss: 'stop' })],
    ['ghost2', 'service requires', (r) => (r.services[0].requires = ['ghost2'])],
    [
      'ghost3',
      'control effect service',
      (r) => r.controls.push(control({ effects: [{ kind: 'restore', service: 'ghost3', duration: q(1, 'hours') }] })),
    ],
    ['ghost4', 'control assets', (r) => r.controls.push(control({ assets: ['ghost4'] }))],
    ['ghost5', 'scenario event service', (r) => (r.scenarios[0].events[0].service = 'ghost5')],
    [
      'ghost6',
      'compromise target',
      (r) =>
        r.scenarios[0].events.push({
          kind: 'compromise',
          via: 'erp',
          target: 'ghost6',
          at: q(0, 'hours'),
          downFor: q(1, 'hours'),
        }),
    ],
    ['ghost7', 'stock replenishedBy', (r) => (r.stocks[0].replenishedBy = 'ghost7')],
    ['ghost8', 'stock consumedBy', (r) => r.stocks[0].consumedBy.push('ghost8')],
    ['ghost9', 'fallback process', (r) =>
      r.controls.push(
        control({ effects: [{ kind: 'fallback', process: 'ghost9', service: 'erp' }] }),
      )],
    ['ghost10', 'production shippingProcess', (r) => (r.production.shippingProcess = 'ghost10')],
    ['ghost11', 'scenario basis', (r) => r.scenarios[0].basis.push('ghost11')],
  ];
  test.each(cases)('%s (%s) is rejected and named', (ghost, _label, mutate) => {
    const r: any = minimalRegister();
    mutate(r);
    expect(() => parseRegister(r)).toThrow(new RegExp(ghost));
  });

  test('a reference of the wrong kind is rejected', () => {
    const r: any = minimalRegister();
    r.services[0].requires = ['plc']; // an asset, not a service
    expect(() => parseRegister(r)).toThrow(/'plc' is an? asset, expected a service/);
  });
});

test('collects every issue, not just the first', () => {
  const r: any = minimalRegister();
  r.processes[0].dependsOn.push({ on: 'ghost1', onLoss: 'stop' });
  r.scenarios[0].events[0].service = 'ghost5';
  const issues = issuesOf(r);
  expect(issues.length).toBeGreaterThanOrEqual(2);
  expect(issues.join('\n')).toMatch(/ghost1/);
  expect(issues.join('\n')).toMatch(/ghost5/);
});

test('the error message carries every issue', () => {
  const r: any = minimalRegister();
  r.processes[0].dependsOn.push({ on: 'ghost1', onLoss: 'stop' });
  r.scenarios[0].events[0].service = 'ghost5';
  expect(() => parseRegister(r)).toThrow(/ghost1[\s\S]*ghost5/);
});

test('rejects a dependency cycle and names it', () => {
  const r: any = minimalRegister();
  r.processes.find((p: any) => p.id === 'haulage').dependsOn.push({ on: 'crushing', onLoss: 'stop' });
  expect(() => parseRegister(r)).toThrow(/haulage.*crushing|crushing.*haulage/);
  expect(issuesOf(r)).toContain('dependency cycle: haulage -> crushing -> haulage');
});

test('rejects a process that depends on itself', () => {
  const r: any = minimalRegister();
  r.processes[0].dependsOn.push({ on: 'ordering', onLoss: 'degrade' });
  expect(issuesOf(r)).toContain('dependency cycle: ordering -> ordering');
});

test('rejects a service requires cycle', () => {
  const r: any = minimalRegister();
  r.services = [
    { id: 'a', name: 'A', provider: 'test', hosting: 'test', kind: 'enterprise-app', requires: ['b'] },
    { id: 'b', name: 'B', provider: 'test', hosting: 'test', kind: 'identity', requires: ['a'] },
  ];
  r.processes[0].dependsOn = [{ on: 'a', onLoss: 'stop' }];
  r.scenarios[0].events[0].service = 'a';
  expect(() => parseRegister(r)).toThrow(/a.*b|b.*a/);
  expect(issuesOf(r)).toContain('service requires cycle: a -> b -> a');
});

test('allows a cycle that goes through a stock', () => {
  // ordering needs ore; ore is replenished by crushing; crushing needs haulage; haulage needs diesel;
  // diesel is replenished by ordering. Stock-mediated loops act with a one-step lag, so they are allowed.
  const r = minimalRegister();
  r.processes[0]!.dependsOn.push({ on: 'ore', onLoss: 'degrade' });
  expect(() => parseRegister(r)).not.toThrow();
});

describe('measured provenance on real-world durations (spec §5.3)', () => {
  test('cut-service restoreAfter', () => {
    const r: any = minimalRegister();
    r.scenarios[0].events[0].restoreAfter.provenance = measured;
    expect(() => parseRegister(r)).toThrow(/§5\.3/);
  });
  test('restore effect duration', () => {
    const r: any = withControl(() => {});
    r.controls[0].effects[0].duration.provenance = measured;
    expect(() => parseRegister(r)).toThrow(/§5\.3/);
  });
  test('fallback effect delay', () => {
    const r: any = withControl((c) => {
      c.effects = [{ kind: 'fallback', process: 'ordering', service: 'erp', delay: q(1, 'hours') }];
    });
    r.controls[0].effects[0].delay.provenance = measured;
    expect(() => parseRegister(r)).toThrow(/§5\.3/);
  });
});

test('allows measured duration on detect-and-revoke', () => {
  const r: any = withControl((c) => {
    c.effects = [{ kind: 'detect-and-revoke', service: 'erp', duration: q(2, 'hours') }];
  });
  r.controls[0].effects[0].duration.provenance = measured;
  expect(() => parseRegister(r)).not.toThrow();
});

test('allows measured lab quantities in capability measurements', () => {
  const r: any = withControl((c) => {
    c.capability.measurements = [{ name: 'mock restore', quantity: { value: 40, unit: 'seconds', provenance: measured } }];
  });
  expect(() => parseRegister(r)).not.toThrow();
});

describe('sourced provenance must cite a listed source', () => {
  test('on a quantity', () => {
    const r: any = minimalRegister();
    r.production.price.provenance = { kind: 'sourced', source: 'nope' };
    expect(() => parseRegister(r)).toThrow(/nope/);
  });
  test('on a capability', () => {
    const r: any = withControl((c) => {
      c.capability.provenance = { kind: 'sourced', source: 'nope' };
    });
    expect(() => parseRegister(r)).toThrow(/nope/);
  });
  test('a listed source is accepted', () => {
    const r: any = minimalRegister();
    r.production.price.provenance = { kind: 'sourced', source: 'test-src' };
    expect(() => parseRegister(r)).not.toThrow();
  });
});

test('stock must have at least one consumer', () => {
  const r: any = minimalRegister();
  r.stocks[0].consumedBy = [];
  expect(() => parseRegister(r)).toThrow();
});

test('control must have at least one effect', () => {
  const r: any = withControl((c) => {
    c.effects = [];
  });
  expect(() => parseRegister(r)).toThrow();
});

test('stock initial must not exceed capacity', () => {
  const r: any = minimalRegister();
  r.stocks[0].initial = q(5, 'days');
  expect(() => parseRegister(r)).toThrow(/diesel/);
});

test('duplicate ids across processes, assets, services and stocks are rejected', () => {
  const r: any = minimalRegister();
  r.services.push({ id: 'plc', name: 'Dup', provider: 'test', hosting: 'test', kind: 'identity' });
  expect(() => parseRegister(r)).toThrow(/plc/);
});

test('duplicate dependency targets within a process are rejected', () => {
  const r: any = minimalRegister();
  r.processes[0].dependsOn.push({ on: 'erp', onLoss: 'degrade' });
  expect(() => parseRegister(r)).toThrow(/erp/);
});

test('ids must be path-safe', () => {
  const r: any = minimalRegister();
  r.stocks[0].id = 'die.sel';
  expect(() => parseRegister(r)).toThrow(/stocks\[0\]\.id/);
});

test('a manual workaround is only allowed on a service dependency', () => {
  const r: any = minimalRegister();
  r.processes[1].dependsOn[0].manualWorkaround = { description: 'by hand', holdsFor: q(3, 'days') };
  expect(() => parseRegister(r)).toThrow(/diesel/);
  const ok: any = minimalRegister();
  ok.processes[0].dependsOn[0].manualWorkaround = { description: 'paper', holdsFor: q(3, 'days') };
  expect(() => parseRegister(ok)).not.toThrow();
});

test('rejects unknown keys', () => {
  const r: any = minimalRegister();
  r.production.extra = 1;
  expect(() => parseRegister(r)).toThrow(RegisterError);
});

test('does not mutate or alias its input', () => {
  const input = minimalRegister();
  const parsed = parseRegister(input);
  parsed.production.price.value = 1;
  expect(input.production.price.value).toBe(100);
});

test('loadRegisterYaml parses YAML text', () => {
  const r = loadRegisterYaml(stringify(minimalRegister()));
  expect(r.site.id).toBe('test-site');
  expect(() => loadRegisterYaml('schemaVersion: 2')).toThrow(RegisterError);
});

test('processOrder puts dependencies first', () => {
  const order = processOrder(parseRegister(minimalRegister()));
  expect(order.indexOf('haulage')).toBeLessThan(order.indexOf('crushing'));
  expect([...order].sort()).toEqual(['crushing', 'haulage', 'ordering', 'rail']);
});

describe('checkScenario', () => {
  const scenario = (edit: (s: any) => void): Scenario => {
    const s: any = structuredClone(minimalRegister().scenarios[0]);
    edit(s);
    return s;
  };
  const r = parseRegister(minimalRegister());

  test('accepts a valid ad-hoc scenario', () => {
    expect(() => checkScenario(r, scenario(() => {}))).not.toThrow();
  });
  test('names a dangling reference', () => {
    expect(() => checkScenario(r, scenario((s) => (s.events[0].service = 'ghost5')))).toThrow(/ghost5/);
  });
  test('rejects a measured restoreAfter', () => {
    expect(() => checkScenario(r, scenario((s) => (s.events[0].restoreAfter.provenance = measured)))).toThrow(/§5\.3/);
  });
  test('throws RegisterError', () => {
    expect(() => checkScenario(r, scenario((s) => (s.basis = ['nope'])))).toThrow(RegisterError);
  });
});

describe('paths', () => {
  const r = parseRegister(minimalRegister());

  test('quantityPaths uses id-keyed paths', () => {
    const paths = quantityPaths(r).map((p) => p.path);
    expect(paths).toContain('stocks.diesel.initial');
    expect(paths).toContain('production.price');
    expect(paths).toContain('scenarios.cut-erp.events[0].restoreAfter');
    expect(paths).toContain('processes.crushing.continuity.maxTolerableOutage');
    expect(new Set(paths).size).toBe(paths.length);
  });

  test('quantityPaths covers control effects, workarounds and measurements', () => {
    const reg: any = withControl((c) => {
      c.effects = [
        { kind: 'restore', service: 'erp', duration: q(24, 'hours') },
        { kind: 'fallback', process: 'ordering', service: 'erp', delay: q(2, 'hours') },
      ];
      c.capability.measurements = [{ name: 'lab', quantity: q(40, 'seconds') }];
    });
    reg.processes[0].dependsOn[0].manualWorkaround = { description: 'paper', holdsFor: q(3, 'days') };
    const paths = quantityPaths(parseRegister(reg)).map((p) => p.path);
    expect(paths).toContain('controls.ctl.effects[0].duration');
    expect(paths).toContain('controls.ctl.effects[1].delay');
    expect(paths).toContain('controls.ctl.capability.measurements[0].quantity');
    expect(paths).toContain('processes.ordering.dependsOn.erp.manualWorkaround.holdsFor');
  });

  test('judgementPaths lists every tier and dependency', () => {
    const j = judgementPaths(r);
    expect(j).toContain('processes.crushing.tier');
    expect(j).toContain('processes.crushing.dependsOn.plc');
    expect(j).toContain('processes.ordering.dependsOn.erp');
    expect(j).toHaveLength(4 + 5);
  });

  test('applyOverrides replaces a value and rejects unknown paths', () => {
    const o = applyOverrides(r, { 'production.price': 80 });
    expect(o.production.price.value).toBe(80);
    expect(() => applyOverrides(o, { 'stocks.nope.initial': 1 })).toThrow(/nope/);
  });

  test('applyOverrides leaves provenance and the input untouched', () => {
    const o = applyOverrides(r, { 'scenarios.cut-erp.events[0].restoreAfter': 100 });
    const ev = o.scenarios[0]!.events[0]!;
    expect(ev.kind === 'cut-service' && ev.restoreAfter.value).toBe(100);
    expect(ev.kind === 'cut-service' && ev.restoreAfter.provenance).toEqual({ kind: 'assumed', reasoning: 'test' });
    const orig = r.scenarios[0]!.events[0]!;
    expect(orig.kind === 'cut-service' && orig.restoreAfter.value).toBe(288);
  });

  test('applyOverrides re-validates the result', () => {
    expect(() => applyOverrides(r, { 'stocks.diesel.initial': 9 })).toThrow(/diesel/);
  });

  test('every quantity path is overridable', () => {
    const overrides = Object.fromEntries(quantityPaths(r).map((p) => [p.path, p.quantity.value]));
    expect(applyOverrides(r, overrides)).toEqual(r);
  });
});
