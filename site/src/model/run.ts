import { RegisterError, simulateScenario, simulateWith } from '@faillocal/engine';
import type { Register, Timeline, Variant } from '@faillocal/engine';
import { freePlayScenario } from './freePlay.js';
import type { FreeCut } from './freePlay.js';

export type RunSpec = { kind: 'register'; scenarioId: string } | { kind: 'free'; cuts: FreeCut[]; workaroundsHold: boolean };

export interface RunInput {
  spec: RunSpec;
  variant: Variant;
  overrides: Record<string, number>;
}

export type RunResult = { ok: true; timeline: Timeline } | { ok: false; issues: string[] };

const MEMO_SIZE = 32;
const memos = new WeakMap<Register, Map<string, RunResult>>();

function run(r: Register, { spec, variant, overrides }: RunInput): RunResult {
  try {
    if (spec.kind === 'register') return { ok: true, timeline: simulateWith(r, spec.scenarioId, variant, overrides) };
    const free = freePlayScenario(r, spec.cuts, spec.workaroundsHold);
    // The cuts are the source of truth for free-play values, so they win over editor overrides.
    return { ok: true, timeline: simulateScenario(r, free.scenario, variant, { ...overrides, ...free.overrides }) };
  } catch (e) {
    if (e instanceof RegisterError) return { ok: false, issues: e.issues };
    throw e;
  }
}

/** Runs the input against `r`. Register errors come back as `issues`; results are memoised (LRU, 32 per register). */
export function deriveRun(r: Register, input: RunInput): RunResult {
  let memo = memos.get(r);
  if (!memo) memos.set(r, (memo = new Map()));
  const key = JSON.stringify(input);
  const hit = memo.get(key);
  if (hit) {
    memo.delete(key);
    memo.set(key, hit);
    return hit;
  }
  const result = run(r, input);
  memo.set(key, result);
  if (memo.size > MEMO_SIZE) memo.delete(memo.keys().next().value!);
  return result;
}
