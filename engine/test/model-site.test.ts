import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { independentCopyFor } from '../src/continuity.js';
import { judgementPaths, quantityPaths } from '../src/paths.js';
import { toHours } from '../src/quantity.js';
import type { ControlEffect, ScenarioEvent } from '../src/schema.js';
import { simulate } from '../src/simulate.js';
import { deriveAssetTiers } from '../src/tiers.js';
import type { Timeline } from '../src/simulate.js';
import { loadRegisterYaml } from '../src/validate.js';

const root = new URL('../../', import.meta.url);
const reg = loadRegisterYaml(readFileSync(new URL('register/pilbara-model-site.yaml', root), 'utf8'));
const decisionLog = readFileSync(new URL('docs/decisions.md', root), 'utf8');

function firstEvent<K extends ScenarioEvent['kind']>(scenarioId: string, kind: K): Extract<ScenarioEvent, { kind: K }> {
  const e = reg.scenarios.find((s) => s.id === scenarioId)?.events[0];
  if (e?.kind !== kind) throw new Error(`${scenarioId}: expected its first event to be ${kind}`);
  return e as Extract<ScenarioEvent, { kind: K }>;
}

function effect<K extends ControlEffect['kind']>(controlId: string, kind: K): Extract<ControlEffect, { kind: K }> {
  const e = reg.controls.find((c) => c.id === controlId)?.effects.find((x) => x.kind === kind);
  if (!e) throw new Error(`${controlId}: no ${kind} effect`);
  return e as Extract<ControlEffect, { kind: K }>;
}

/** The samples inside [start, end), the hours an event window covers. */
function during(t: Timeline, start: number, end: number) {
  return t.samples.filter((s) => s.hour >= Math.ceil(start) && s.hour < Math.ceil(end));
}

test('the model site register is valid and fictional', () => {
  expect(reg.site.id).toBe('pilbara-model-site');
  expect(reg.site.fictional).toBe(true);
});

test('S1 as reported: no physical process stops, matching the public record', () => {
  const t = simulate(reg, 's1-as-reported', 'unprepared');
  for (const id of ['haulage', 'drill-and-blast', 'crushing', 'rail']) expect(t.totals.stoppedHours[id]).toBe(0);
  expect(t.totals.nonNormalHours['diesel-ordering']).toBeGreaterThan(0);
  expect(t.projection).toBe(false);
});

test('S1 restore duration is sourced, not assumed', () => {
  expect(firstEvent('s1-as-reported', 'cut-service').restoreAfter.provenance.kind).toBe('sourced');
});

test('S1 projection: the fleet stops before the ERP is back', () => {
  const ev = firstEvent('s1-projection', 'cut-service');
  const t = simulate(reg, 's1-projection', 'unprepared');
  const firstStop = t.events.find((e) => e.kind === 'process-state' && e.subject === 'haulage' && e.to === 'stopped');
  expect(firstStop).toBeDefined();
  expect(firstStop!.hour).toBeLessThan(toHours(ev.at) + toHours(ev.restoreAfter));
  expect(t.projection).toBe(true);
});

test('S1 projection: the fleet restarts only once diesel ordered after the post-restore hold arrives, still rationed at the end', () => {
  const ev = firstEvent('s1-projection', 'cut-service');
  const lead = reg.stocks.find((x) => x.id === 'diesel')?.leadTime;
  const hold = reg.processes
    .find((p) => p.id === 'diesel-ordering')
    ?.dependsOn.find((d) => d.on === 'hosted-erp')?.afterRestore?.holdFor;
  expect(lead?.provenance.kind).toBe('assumed');
  expect(hold?.provenance.kind).toBe('assumed');
  const restored = toHours(ev.at) + toHours(ev.restoreAfter);
  const t = simulate(reg, 's1-projection', 'unprepared');
  const ordering = t.events.find((e) => e.kind === 'process-state' && e.subject === 'diesel-ordering' && e.to === 'normal');
  expect(ordering?.hour).toBe(Math.ceil(restored + toHours(hold!)));
  const haulage = t.events.filter((e) => e.kind === 'process-state' && e.subject === 'haulage');
  const restart = haulage.find((e) => e.from === 'stopped');
  // The delivery that lands in the hour `restored + hold + lead` is first seen at the start of the next hour.
  expect(restart?.hour).toBe(Math.ceil(restored + toHours(hold!) + toHours(lead!)) + 1);
  // The 16-day run (D-080) ends before the fuel farm refills past its rationing mark.
  expect(haulage[haulage.length - 1]?.to).toBe('degraded');
  expect(t.samples[t.samples.length - 1]!.processes['haulage']).toBe('degraded');
});

test('S1 projection: revenue is at risk unprepared and not prepared', () => {
  const u = simulate(reg, 's1-projection', 'unprepared');
  const p = simulate(reg, 's1-projection', 'prepared');
  expect(u.totals.revenueAtRisk).toBeGreaterThan(0);
  expect(u.totals.stoppedHours['rail']).toBe(0);
  expect(p.totals.revenueAtRisk).toBe(0);
});

test('S1 prepared: nothing stops and the fleet keeps running', () => {
  const u = simulate(reg, 's1-projection', 'unprepared');
  const p = simulate(reg, 's1-projection', 'prepared');
  expect(Object.values(p.totals.stoppedHours).every((h) => h === 0)).toBe(true);
  expect(u.totals.stoppedHours['haulage']).toBeGreaterThan(0);
  expect(p.totals.stoppedHours['haulage']).toBe(0);
});

test('S2: losing Perth parks the fleet unprepared; site authority takes over prepared', () => {
  const u = simulate(reg, 's2-iroc-lost', 'unprepared');
  const p = simulate(reg, 's2-iroc-lost', 'prepared');
  const handover = effect('site-authority', 'fallback').delay;
  expect(handover).toBeDefined();
  expect(u.totals.stoppedHours['haulage']).toBeGreaterThan(0);
  expect(p.totals.stoppedHours['haulage']).toBeLessThanOrEqual(toHours(handover!));
  expect(p.totals.stoppedHours['haulage']).toBeLessThan(u.totals.stoppedHours['haulage']!);
});

test('S3: crusher trips unprepared; prepared revokes vendor A only', () => {
  const ev = firstEvent('s3-vendor-setpoint', 'compromise');
  const u = simulate(reg, 's3-vendor-setpoint', 'unprepared');
  expect(u.samples.some((s) => s.assets['crusher-plc'] === 'down')).toBe(true);
  expect(u.totals.stoppedHours['crushing']).toBeGreaterThan(0);

  const p = simulate(reg, 's3-vendor-setpoint', 'prepared');
  expect(p.samples.every((s) => s.assets['crusher-plc'] === 'up')).toBe(true);
  expect(p.totals.stoppedHours['crushing']).toBe(0);
  const detected = p.events.find((e) => e.kind === 'compromise-detected' && e.subject === 'crusher-plc');
  expect(detected).toBeDefined();
  expect(detected!.hour).toBeLessThan(toHours(ev.at) + toHours(ev.downFor));
  for (const s of p.samples) {
    expect(s.services['vendor-a-access']).toBe(s.hour >= Math.ceil(detected!.hour) ? 'revoked' : 'up');
    expect(s.services['vendor-b-access']).toBe('up');
  }
});

test('the vendor jump host is high: vendor access reaches the crusher and conveyor PLCs, which crushing (high) needs', () => {
  const tiers = deriveAssetTiers(reg);
  expect(tiers['vendor-jump-host']).toBe('high');
  expect(tiers['site-historian']).toBe('low');
});

test('diesel ordering has no independent copy unprepared, and one prepared through the independent ERP restore', () => {
  expect(independentCopyFor(reg, 'diesel-ordering', 'unprepared')).toEqual({ value: false, source: 'register' });
  expect(independentCopyFor(reg, 'diesel-ordering', 'prepared')).toEqual({ value: true, source: { control: 'independent-erp-restore' } });
});

test('S4 unprepared: isolation takes down the hosted ERP and the Perth link', () => {
  const ev = firstEvent('s4-precautionary-isolation', 'cut-service');
  const start = toHours(ev.at);
  const t = simulate(reg, 's4-precautionary-isolation', 'unprepared');
  const cutHours = during(t, start, start + toHours(ev.restoreAfter));
  expect(cutHours.length).toBeGreaterThan(0);
  for (const s of cutHours) {
    expect(s.services['hosted-erp']).toBe('down');
    expect(s.services['iroc-link']).toBe('down');
  }
  // Vendor access does not ride the corporate network, so S4 leaves it alone.
  for (const s of t.samples) {
    expect(s.services['vendor-a-access']).toBe('up');
    expect(s.services['vendor-b-access']).toBe('up');
  }
});

test('S4 prepared: control room keeps running under isolation', () => {
  const u = simulate(reg, 's4-precautionary-isolation', 'unprepared');
  const p = simulate(reg, 's4-precautionary-isolation', 'prepared');
  expect(u.totals.stoppedHours['control-room']).toBeGreaterThan(0);
  expect(p.totals.stoppedHours['control-room']).toBe(0);
});

test('S4 prepared: less revenue is at risk than unprepared', () => {
  const u = simulate(reg, 's4-precautionary-isolation', 'unprepared');
  const p = simulate(reg, 's4-precautionary-isolation', 'prepared');
  expect(p.totals.revenueAtRisk).toBeLessThan(u.totals.revenueAtRisk);
});

test('every assumed value and every judgement has a decision-log entry', () => {
  const assumed = quantityPaths(reg)
    .filter((p) => p.quantity.provenance.kind === 'assumed')
    .map((p) => p.path);
  for (const path of [...assumed, ...judgementPaths(reg)]) expect(decisionLog).toContain(`**Path:** ${path}`);
});
