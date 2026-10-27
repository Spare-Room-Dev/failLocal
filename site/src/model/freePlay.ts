import type { Provenance, Register, Scenario } from '@faillocal/engine';

export interface FreeCut {
  service: string;
  atDays: number;
  forDays: number;
}

export const FREE_PLAY_ID = 'free-play';

const TEMPLATE: Provenance = { kind: 'assumed', reasoning: 'Free-play template; the value is chosen by the visitor.' };
const MIN_HORIZON_DAYS = 1;
const MAX_HORIZON_DAYS = 400;
const HORIZON_MARGIN_DAYS = 4;

/**
 * The visitor's cuts as a scenario. Every event quantity is a schema-valid template placeholder; the
 * visitor's values come back as `overrides` (hours for event times, days for the horizon), so the run
 * flags each of them `overridden`. With no cuts the horizon is one quiet day.
 */
export function freePlayScenario(
  _r: Register,
  cuts: FreeCut[],
  workaroundsHold: boolean,
): { scenario: Scenario; overrides: Record<string, number> } {
  const base = `scenarios.${FREE_PLAY_ID}`;
  const scenario: Scenario = {
    id: FREE_PLAY_ID,
    title: 'Your scenario',
    summary: 'Cuts you chose in free play. A what-if on a fictional site, not a public record.',
    basis: [],
    projection: true,
    workaroundsHold,
    horizon: { value: MIN_HORIZON_DAYS, unit: 'days', provenance: TEMPLATE },
    events: cuts.map((c) => ({
      kind: 'cut-service',
      service: c.service,
      at: { value: 0, unit: 'hours', provenance: TEMPLATE },
      restoreAfter: { value: 1, unit: 'hours', provenance: TEMPLATE },
    })),
  };
  const overrides: Record<string, number> = {};
  cuts.forEach((c, i) => {
    overrides[`${base}.events[${i}].at`] = c.atDays * 24;
    overrides[`${base}.events[${i}].restoreAfter`] = c.forDays * 24;
  });
  const latestEnd = cuts.length ? Math.max(...cuts.map((c) => c.atDays + c.forDays)) + HORIZON_MARGIN_DAYS : MIN_HORIZON_DAYS;
  overrides[`${base}.horizon`] = Math.min(MAX_HORIZON_DAYS, Math.max(MIN_HORIZON_DAYS, latestEnd));
  return { scenario, overrides };
}
