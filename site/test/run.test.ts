import { describe, expect, test } from 'vitest';
import { register } from '../src/model/register.js';
import { deriveRun } from '../src/model/run.js';
import type { RunInput } from '../src/model/run.js';

describe('deriveRun', () => {
  test('register run returns a timeline', () => {
    const r = deriveRun(register, { spec: { kind: 'register', scenarioId: 's1-projection' }, variant: 'unprepared', overrides: {} });
    expect(r.ok && r.timeline.projection).toBe(true);
  });

  test('an invalid override returns issues naming the path, never throws', () => {
    const r = deriveRun(register, {
      spec: { kind: 'register', scenarioId: 's1-projection' },
      variant: 'unprepared',
      overrides: { 'production.degradedOutput': 1.5 },
    });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.issues.join('\n')).toMatch(/production\.degradedOutput/);
  });

  test('an unknown scenario returns issues, never throws', () => {
    const r = deriveRun(register, { spec: { kind: 'register', scenarioId: 'no-such' }, variant: 'unprepared', overrides: {} });
    expect(!r.ok && r.issues.join('\n')).toMatch(/no-such/);
  });

  test('deriveRun memoises identical input', () => {
    const input = (): RunInput => ({ spec: { kind: 'register', scenarioId: 's2-iroc-lost' }, variant: 'prepared', overrides: {} });
    expect(deriveRun(register, input())).toBe(deriveRun(register, input()));
  });

  test('free play merges the editor overrides with the visitor’s cuts', () => {
    const r = deriveRun(register, {
      spec: { kind: 'free', cuts: [{ service: 'hosted-erp', atDays: 1, forDays: 2 }], workaroundsHold: false },
      variant: 'unprepared',
      overrides: { 'production.degradedOutput': 0.25 },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.timeline.assumptionsUsed['production.degradedOutput']).toMatchObject({ value: 0.25, overridden: true });
    expect(r.timeline.assumptionsUsed['scenarios.free-play.events[0].at']).toMatchObject({ value: 24, overridden: true });
  });
});
