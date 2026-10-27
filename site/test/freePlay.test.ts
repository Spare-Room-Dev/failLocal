import { describe, expect, test } from 'vitest';
import { freePlayScenario, FREE_PLAY_ID } from '../src/model/freePlay.js';
import { register } from '../src/model/register.js';
import { deriveRun } from '../src/model/run.js';

describe('freePlayScenario', () => {
  test('free-play values arrive as overrides and are flagged chosen-by-visitor', () => {
    const { scenario, overrides } = freePlayScenario(register, [{ service: 'hosted-erp', atDays: 0, forDays: 12 }], false);
    const r = deriveRun(register, {
      spec: { kind: 'free', cuts: [{ service: 'hosted-erp', atDays: 0, forDays: 12 }], workaroundsHold: false },
      variant: 'unprepared',
      overrides: {},
    });
    expect(scenario.projection).toBe(true);
    expect(overrides['scenarios.free-play.events[0].restoreAfter']).toBe(288);
    expect(r.ok && r.timeline.assumptionsUsed['scenarios.free-play.events[0].restoreAfter']!.overridden).toBe(true);
  });

  test('builds the free-play scenario with template provenance', () => {
    const { scenario, overrides } = freePlayScenario(
      register,
      [
        { service: 'hosted-erp', atDays: 1, forDays: 3 },
        { service: 'iroc-link', atDays: 2, forDays: 10 },
      ],
      true,
    );
    expect(scenario).toMatchObject({
      id: FREE_PLAY_ID,
      title: 'Your scenario',
      summary: 'Cuts you chose in free play. A what-if on a fictional site, not a public record.',
      basis: [],
      projection: true,
      workaroundsHold: true,
    });
    expect(scenario.events.map((e) => e.kind === 'cut-service' && e.service)).toEqual(['hosted-erp', 'iroc-link']);
    for (const e of scenario.events) {
      expect(e.at.provenance).toEqual({ kind: 'assumed', reasoning: 'Free-play template; the value is chosen by the visitor.' });
    }
    expect(overrides).toEqual({
      'scenarios.free-play.events[0].at': 24,
      'scenarios.free-play.events[0].restoreAfter': 72,
      'scenarios.free-play.events[1].at': 48,
      'scenarios.free-play.events[1].restoreAfter': 240,
      'scenarios.free-play.horizon': 16, // latest end is day 12, plus 4 days
    });
  });

  test('the horizon is clamped to 400 days', () => {
    const { overrides } = freePlayScenario(register, [{ service: 'hosted-erp', atDays: 390, forDays: 30 }], false);
    expect(overrides['scenarios.free-play.horizon']).toBe(400);
  });

  test('free play with no cuts runs a one-day quiet horizon', () => {
    const { scenario, overrides } = freePlayScenario(register, [], false);
    expect(scenario.events).toEqual([]);
    expect(overrides).toEqual({ 'scenarios.free-play.horizon': 1 }); // days: the horizon is a days quantity
    const r = deriveRun(register, { spec: { kind: 'free', cuts: [], workaroundsHold: false }, variant: 'unprepared', overrides: {} });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.timeline.samples).toHaveLength(25); // hours 0..24
    expect(r.timeline.events.filter((e) => e.kind.startsWith('service-'))).toEqual([]);
    expect(r.timeline.totals.tonnesDeferred).toBe(0);
  });
});
