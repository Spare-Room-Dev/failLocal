import type { Register } from '@faillocal/engine';
import { describe, expect, test } from 'vitest';
import { DWELL_SECONDS, TRAVEL_HOURS_PER_SECOND, comparison, guidedDurationSeconds, guidedSteps } from '../src/model/guided.js';
import type { GuidedStep } from '../src/model/guided.js';
import { register } from '../src/model/register.js';
import { deriveRun } from '../src/model/run.js';

function run(r: Register, scenarioId: string, variant: 'unprepared' | 'prepared') {
  const result = deriveRun(r, { spec: { kind: 'register', scenarioId }, variant, overrides: {} });
  if (!result.ok) throw new Error(result.issues.join('; '));
  return result.timeline;
}

const step = (steps: GuidedStep[], segment: GuidedStep['segment'], moment: GuidedStep['moment']) => {
  const found = steps.find((s) => s.segment === segment && s.moment === moment);
  if (!found) throw new Error(`no ${segment} ${moment} step`);
  return found;
};

const firstHaulageStop = (r: Register) =>
  run(r, 's1-projection', 'unprepared').events.find((e) => e.kind === 'process-state' && e.subject === 'haulage' && e.to === 'stopped')?.hour;

describe('guidedSteps', () => {
  test('fleet-park step hour equals the first haulage stopped event', () => {
    const hour = firstHaulageStop(register);
    expect(hour).toBeDefined();
    expect(step(guidedSteps(register), 'projection', 'fleet-parks').hour).toBe(hour);
  });

  test('no step hour is a literal', () => {
    const before = guidedSteps(register);
    const changed = structuredClone(register);
    changed.stocks.find((s) => s.id === 'diesel')!.initial.value = 1;
    const after = guidedSteps(changed);
    const moved = firstHaulageStop(changed);
    expect(moved).not.toBe(firstHaulageStop(register));
    expect(step(after, 'projection', 'fleet-parks').hour).toBe(moved);
    expect(after.map((s) => s.hour)).not.toEqual(before.map((s) => s.hour));
  });

  test('segments run as reported, then the projection, then prepared, each with its run', () => {
    const steps = guidedSteps(register);
    expect(steps.map((s) => [s.segment, s.scenarioId, s.variant])).toEqual([
      ...Array(2).fill(['as-reported', 's1-as-reported', 'unprepared']),
      ...Array(5).fill(['projection', 's1-projection', 'unprepared']),
      ...Array(5).fill(['prepared', 's1-projection', 'prepared']),
    ]);
    const reported = run(register, 's1-as-reported', 'unprepared');
    expect(steps[0]!.hour).toBe(0);
    expect(steps[1]!.hour).toBe(reported.events.find((e) => e.kind === 'service-up' && e.subject === 'hosted-erp')!.hour);
    expect(step(steps, 'projection', 'total').hour).toBe(run(register, 's1-projection', 'unprepared').samples.length - 1);
  });

  test('a prepared moment that never happens keeps the projection hour and says so', () => {
    const steps = guidedSteps(register);
    const prepared = run(register, 's1-projection', 'prepared');
    expect(prepared.events.some((e) => e.kind === 'process-state' && e.subject === 'haulage' && e.to === 'stopped')).toBe(false);
    const parks = step(steps, 'prepared', 'fleet-parks');
    expect(parks.hour).toBe(step(steps, 'projection', 'fleet-parks').hour);
    expect(parks.caption(prepared)).toEqual(['The fleet keeps running.']);
    const restore = step(steps, 'prepared', 'restore');
    expect(restore.hour).toBe(prepared.events.find((e) => e.kind === 'service-up' && e.subject === 'hosted-erp')!.hour);
  });

  test('the clock only moves forward within a segment', () => {
    const steps = guidedSteps(register);
    for (let i = 1; i < steps.length; i++) {
      if (steps[i]!.segment === steps[i - 1]!.segment) expect(steps[i]!.hour).toBeGreaterThanOrEqual(steps[i - 1]!.hour);
    }
  });

  test("each segment's intro comes before its first step's own caption, never in place of it", () => {
    const steps = guidedSteps(register);
    const projected = run(register, 's1-projection', 'unprepared');
    const prepared = run(register, 's1-projection', 'prepared');
    const firstProjection = steps.find((s) => s.segment === 'projection')!;
    expect(firstProjection.caption(projected)).toEqual(['Projection: what if the workarounds ran out?', ' ', 'Fuel orders stop.']);
    const firstPrepared = steps.find((s) => s.segment === 'prepared')!;
    expect(firstPrepared.moment).toBe('restore');
    expect(firstPrepared.caption(prepared)).toEqual([
      'Same outage, prepared site: offline ordering and an independent restore keep fuel coming.',
      ' ',
      'The ERP is back, restored independently.',
    ]);
  });

  test('an intro on a fallback step keeps the "did not happen" caption', () => {
    // A slow independent restore puts the prepared ERP return after the fuel moment, so the first prepared step is a fallback.
    const slow = structuredClone(register);
    const control = slow.controls.find((c) => c.id === 'independent-erp-restore')!;
    const effect = control.effects.find((e) => e.kind === 'restore')!;
    if (effect.kind !== 'restore') throw new Error('expected a restore effect');
    effect.duration.value = 300;
    const steps = guidedSteps(slow);
    const first = steps.find((s) => s.segment === 'prepared')!;
    const prepared = run(slow, 's1-projection', 'prepared');
    expect(prepared.events.some((e) => e.kind === 'process-state' && e.subject === 'diesel-ordering' && e.to === 'stopped')).toBe(false);
    expect(first.moment).toBe('fuel-stops');
    expect(first.caption(prepared)).toEqual([
      'Same outage, prepared site: offline ordering and an independent restore keep fuel coming.',
      ' ',
      'Fuel orders keep going.',
    ]);
  });

  test('the 12 days comes from the sourced restore', () => {
    const steps = guidedSteps(register);
    const reported = run(register, 's1-as-reported', 'unprepared');
    const qty = steps[1]!.caption(reported).find((p) => typeof p === 'object' && 'qty' in p);
    expect(qty).toMatchObject({ qty: { value: 12, kind: 'days', display: 'sourced', provenance: { source: 'scope-incident-updates' } } });
  });
});

describe('pacing', () => {
  test('total guided duration is 60–90 s', () => {
    const steps = guidedSteps(register);
    let travel = 0;
    for (let i = 1; i < steps.length; i++) {
      if (steps[i]!.segment === steps[i - 1]!.segment) travel += steps[i]!.hour - steps[i - 1]!.hour;
    }
    const total = steps.length * DWELL_SECONDS + travel / TRAVEL_HOURS_PER_SECOND;
    expect(guidedDurationSeconds(steps)).toBeCloseTo(total);
    expect(total).toBeGreaterThanOrEqual(60);
    expect(total).toBeLessThanOrEqual(90);
  });
});

describe('comparison', () => {
  test('reads both totals and the assumed hold from the runs', () => {
    const c = comparison(register);
    const unprepared = run(register, 's1-projection', 'unprepared');
    const prepared = run(register, 's1-projection', 'prepared');
    expect(c.unprepared).toBe(unprepared.totals.revenueAtRisk);
    expect(c.prepared).toBe(prepared.totals.revenueAtRisk);
    expect(c.protected).toBe(unprepared.totals.revenueAtRisk - prepared.totals.revenueAtRisk);
    expect(c.hold).toBe(unprepared.assumptionsUsed['processes.diesel-ordering.dependsOn.hosted-erp.afterRestore.holdFor']);
    expect(c.hold.provenance.kind).toBe('assumed');
  });
});
