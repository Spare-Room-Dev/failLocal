import { describe, expect, test } from 'vitest';
import { assessReadiness } from '../src/readiness.js';
import type { ReadinessRow } from '../src/readiness.js';
import type { Register } from '../src/schema.js';
import { deriveAssetTiers } from '../src/tiers.js';
import { parseRegister } from '../src/validate.js';
import { minimalRegister } from './fixtures.js';

function process(r: Register, id: string): Register['processes'][number] {
  const p = r.processes.find((x) => x.id === id);
  if (!p) throw new Error(`no process ${id}`);
  return p;
}

function row(rows: ReadinessRow[], processId: string, variant: ReadinessRow['variant']): ReadinessRow {
  const found = rows.find((x) => x.processId === processId && x.scenarioId === 'cut-erp' && x.variant === variant);
  if (!found) throw new Error(`no row for ${processId}/${variant}`);
  return found;
}

describe('deriveAssetTiers', () => {
  test('tiers propagate through processes and stocks', () => {
    const r = minimalRegister();
    expect(deriveAssetTiers(parseRegister(r))['plc']).toBe('medium');

    process(r, 'rail').tier = 'high';
    // rail (high) -> ore stock -> crushing -> plc
    expect(deriveAssetTiers(parseRegister(r))['plc']).toBe('high');
  });

  test('an asset used only by a low-tier chain stays low', () => {
    const r = minimalRegister();
    r.processes.push({
      ...structuredClone(process(r, 'ordering')),
      id: 'reporting',
      name: 'reporting',
      tier: 'low',
      dependsOn: [{ on: 'printer', onLoss: 'stop' }],
    });
    r.assets.push(
      { id: 'printer', name: 'Printer', type: 'workstation', zone: 'test' },
      { id: 'spare', name: 'Spare', type: 'workstation', zone: 'test' },
    );
    const tiers = deriveAssetTiers(parseRegister(r));
    expect(tiers['printer']).toBe('low');
    expect(tiers['spare']).toBe('low');
  });

  test("a control's relied-on asset takes the protected process's tier", () => {
    const r = minimalRegister();
    r.assets.push({ id: 'site-id', name: 'Site ID', type: 'server', zone: 'test' });
    r.controls.push({
      id: 'manual-ordering',
      name: 'Manual ordering',
      description: 'Order by phone.',
      effects: [{ kind: 'fallback', process: 'ordering', service: 'erp' }],
      assets: ['site-id'],
      capability: { works: true, provenance: { kind: 'assumed', reasoning: 'test' }, measurements: [] },
    });
    // ordering is itself low but replenishes diesel for haulage (medium)
    expect(process(r, 'ordering').tier).toBe('low');
    expect(deriveAssetTiers(parseRegister(r))['site-id']).toBe('medium');
  });

  test('a restore control takes the tier of the processes depending on its service', () => {
    const r = minimalRegister();
    process(r, 'ordering').tier = 'high';
    r.assets.push({ id: 'backup-box', name: 'Backup box', type: 'server', zone: 'test' });
    r.controls.push({
      id: 'erp-restore',
      name: 'ERP restore',
      description: 'Restore the ERP.',
      effects: [{ kind: 'restore', service: 'erp', duration: { value: 48, unit: 'hours', provenance: { kind: 'assumed', reasoning: 'test' } } }],
      assets: ['backup-box'],
      capability: { works: true, provenance: { kind: 'assumed', reasoning: 'test' }, measurements: [] },
    });
    expect(deriveAssetTiers(parseRegister(r))['backup-box']).toBe('high');
  });

  test("a reconcile control's relied-on asset takes only the reconciled process's tier", () => {
    const r = minimalRegister();
    r.processes.push({ ...structuredClone(process(r, 'ordering')), id: 'billing', tier: 'high' });
    r.assets.push({ id: 'dedupe-box', name: 'Dedupe box', type: 'server', zone: 'test' });
    r.controls.push({
      id: 'duplicate-rejection',
      name: 'Duplicate rejection',
      description: 'Reject stale and duplicate orders.',
      effects: [{ kind: 'reconcile', process: 'ordering', service: 'erp' }],
      assets: ['dedupe-box'],
      capability: { works: true, provenance: { kind: 'assumed', reasoning: 'test' }, measurements: [] },
    });
    // billing (high) also needs the ERP, but the control protects only ordering (medium via diesel)
    expect(deriveAssetTiers(parseRegister(r))['dedupe-box']).toBe('medium');
  });
});

describe('deriveAssetTiers fixpoint', () => {
  const works = { works: true, provenance: { kind: 'assumed' as const, reasoning: 'test' }, measurements: [] };

  test('a tier that needs several passes still reaches a control-relied-on asset', () => {
    const r = minimalRegister();
    process(r, 'rail').tier = 'high';
    r.assets.push({ id: 'site-id', name: 'Site ID', type: 'server', zone: 'test' });
    r.controls.push({
      id: 'manual-ordering',
      name: 'Manual ordering',
      description: 'Order by phone.',
      effects: [{ kind: 'fallback', process: 'ordering', service: 'erp' }],
      assets: ['site-id'],
      capability: works,
    });
    // rail (high) -> ore -> crushing -> haulage -> diesel -> ordering: the last hops need later passes
    expect(deriveAssetTiers(parseRegister(r))['site-id']).toBe('high');
  });

  test('a stock-mediated loop terminates and every member takes the highest tier in it', () => {
    const members = ['ordering', 'haulage', 'crushing'];
    for (const raised of members) {
      const r = minimalRegister();
      // loop: ordering -> ore -> crushing -> haulage -> diesel -> ordering
      process(r, 'ordering').dependsOn.push({ on: 'ore', onLoss: 'degrade' });
      for (const id of members) {
        const p = process(r, id);
        p.tier = id === raised ? 'high' : 'low';
        r.assets.push({ id: `probe-${id}`, name: id, type: 'workstation', zone: 'test' });
        p.dependsOn.push({ on: `probe-${id}`, onLoss: 'stop' });
      }
      const tiers = deriveAssetTiers(parseRegister(r));
      for (const id of members) expect(tiers[`probe-${id}`], `raised ${raised}, probe ${id}`).toBe('high');
    }
  });
});

describe('assessReadiness', () => {
  test('flags a process over its tolerance', () => {
    const r = parseRegister(minimalRegister());
    const ordering = row(assessReadiness(r), 'ordering', 'unprepared');
    expect(ordering.longestOutageHours).toBe(288);
    expect(ordering.maxTolerableOutageHours).toBe(48);
    expect(ordering.recoveryTargetHours).toBe(24);
    expect(ordering.withinTolerance).toBe(false);
    expect(ordering.withinRecoveryTarget).toBe(false);
  });

  test('counts degraded as outage', () => {
    const r = minimalRegister();
    r.controls.push({
      id: 'manual-ordering',
      name: 'Manual ordering',
      description: 'Order by phone.',
      effects: [{ kind: 'fallback', process: 'ordering', service: 'erp' }],
      capability: { works: true, provenance: { kind: 'assumed', reasoning: 'test' }, measurements: [] },
    });
    const rows = assessReadiness(parseRegister(r));
    // the fallback keeps ordering going but only in a degraded state, which still counts
    expect(row(rows, 'ordering', 'prepared').longestOutageHours).toBe(288);
    expect(row(rows, 'ordering', 'prepared').withinTolerance).toBe(false);
  });

  test('rows cover every process, scenario and variant', () => {
    const r = parseRegister(minimalRegister());
    const rows = assessReadiness(r);
    expect(rows).toHaveLength(r.processes.length * r.scenarios.length * 2);
    expect(rows.slice(0, 2).map((x) => [x.processId, x.variant])).toEqual([
      ['ordering', 'unprepared'],
      ['ordering', 'prepared'],
    ]);
  });
});
