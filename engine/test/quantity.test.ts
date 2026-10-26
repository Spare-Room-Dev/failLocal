import { expect, test } from 'vitest';
import { quantity, toHours } from '../src/quantity.js';

test('accepts each provenance kind', () => {
  const s = quantity('days');
  expect(s.parse({ value: 4, unit: 'days', provenance: { kind: 'assumed', reasoning: 'r' } }).value).toBe(4);
  expect(s.parse({ value: 4, unit: 'days', provenance: { kind: 'sourced', source: 'scope-updates' } })).toBeTruthy();
});

test('rejects a number with no provenance', () => {
  expect(() => quantity('days').parse({ value: 4, unit: 'days' })).toThrow();
});

test('rejects the wrong unit for a field', () => {
  expect(() => quantity('days').parse({ value: 4, unit: 'hours', provenance: { kind: 'assumed', reasoning: 'r' } })).toThrow();
});

test('measured needs runId, ISO date and evidence', () => {
  const s = quantity('seconds', { allowMeasured: true });
  expect(() => s.parse({ value: 9, unit: 'seconds', provenance: { kind: 'measured', runId: 'r1', date: '14 Dec', evidence: 'x' } })).toThrow();
  expect(s.parse({ value: 9, unit: 'seconds', provenance: { kind: 'measured', runId: 'r1', date: '2026-12-14', evidence: 'lab/runs/r1' } }).value).toBe(9);
});

test('measured is rejected unless the field allows it', () => {
  expect(() => quantity('hours').parse({ value: 1, unit: 'hours', provenance: { kind: 'measured', runId: 'r1', date: '2026-12-14', evidence: 'x' } }))
    .toThrow(/§5\.3/);
});

test('toHours converts days', () => {
  expect(toHours({ value: 1.5, unit: 'days', provenance: { kind: 'assumed', reasoning: 'r' } })).toBe(36);
});
