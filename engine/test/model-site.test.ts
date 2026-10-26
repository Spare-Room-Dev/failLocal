import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { judgementPaths, quantityPaths } from '../src/paths.js';
import { toHours } from '../src/quantity.js';
import type { ControlEffect, ScenarioEvent } from '../src/schema.js';
import { simulate } from '../src/simulate.js';
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
  // The fleet parks inside Scope's sourced 12 days too, not only inside the projection's longer restore.
  expect(firstStop!.hour).toBeLessThan(toHours(firstEvent('s1-as-reported', 'cut-service').restoreAfter));
  expect(t.projection).toBe(true);
});

test('S1 prepared: nothing stops and less revenue is at risk', () => {
  const u = simulate(reg, 's1-projection', 'unprepared');
  const p = simulate(reg, 's1-projection', 'prepared');
  expect(Object.values(p.totals.stoppedHours).every((h) => h === 0)).toBe(true);
  expect(p.totals.revenueAtRisk).toBeLessThan(u.totals.revenueAtRisk);
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

test('every assumed value and every judgement has a decision-log entry', () => {
  const assumed = quantityPaths(reg)
    .filter((p) => p.quantity.provenance.kind === 'assumed')
    .map((p) => p.path);
  for (const path of [...assumed, ...judgementPaths(reg)]) expect(decisionLog).toContain(`**Path:** ${path}`);
});
