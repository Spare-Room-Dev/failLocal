import { useSyncExternalStore } from 'react';
import type { Timeline, Variant } from '@faillocal/engine';
import { FREE_PLAY_ID, scenarioAsFree } from './freePlay.js';
import type { FreeCut } from './freePlay.js';
import { register } from './register.js';
import { deriveRun } from './run.js';
import type { RunSpec } from './run.js';

export function createStore<S>(initial: S) {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    get: (): S => state,
    set(p: Partial<S> | ((s: S) => Partial<S>)): void {
      state = { ...state, ...(typeof p === 'function' ? p(state) : p) };
      for (const f of listeners) f();
    },
    subscribe(f: () => void): () => void {
      listeners.add(f);
      return () => listeners.delete(f);
    },
  };
}

/** Subscribes a component to `select(state)`. The selector must return a primitive or a stable reference. */
export function useStore<S, T>(store: ReturnType<typeof createStore<S>>, select: (s: S) => T): T {
  return useSyncExternalStore(store.subscribe, () => select(store.get()));
}

export interface Clock {
  hour: number;
  playing: boolean;
  hoursPerSecond: number;
}

/** An override the store refused: the value the visitor gave, and the run's issues with it. */
export interface FieldIssue {
  value: number;
  issues: string[];
}

export interface AppState {
  mode: 'welcome' | 'guided' | 'free';
  spec: RunSpec;
  variant: Variant;
  overrides: Record<string, number>;
  clock: Clock;
  selected: string | null;
  lastGood: Timeline | null;
  /** Whether `lastGood` is a register scenario or the visitor's free play. */
  lastGoodKind: RunSpec['kind'];
  /** Issues from a run that failed for a reason other than an editor field. */
  issues: string[];
  /** Overrides the store refused, by path; they never reached `overrides`. Each is tried again after the next change. */
  fieldIssues: Record<string, FieldIssue>;
  /** Counts resets, so the editor can remount its rows and drop any draft text a reset leaves behind. */
  resets: number;
}

const DEFAULT_SPEC: RunSpec = { kind: 'register', scenarioId: 's1-projection' };
const DEFAULT_SPEED = 24;

/** The state the site opens in, with the default run already derived. */
export function initialAppState(): AppState {
  const result = deriveRun(register, { spec: DEFAULT_SPEC, variant: 'unprepared', overrides: {} });
  return {
    mode: 'welcome',
    spec: DEFAULT_SPEC,
    variant: 'unprepared',
    overrides: {},
    clock: { hour: 0, playing: false, hoursPerSecond: DEFAULT_SPEED },
    selected: 'haulage',
    lastGood: result.ok ? result.timeline : null,
    lastGoodKind: DEFAULT_SPEC.kind,
    issues: result.ok ? [] : result.issues,
    fieldIssues: {},
    resets: 0,
  };
}

export const appStore = createStore<AppState>(initialAppState());

/** A path under one free-play event; group 1 is the event index. */
const FREE_EVENT_PATH = new RegExp(`^scenarios\\.${FREE_PLAY_ID}\\.events\\[(\\d+)\\]\\.`);

const paused = (clock: Clock): Clock => ({ ...clock, hour: 0, playing: false });

/** `record` without `key`. */
function without<T>(record: Record<string, T>, key: string): Record<string, T> {
  const { [key]: _, ...rest } = record;
  return rest;
}

/** The free-play spec to edit: the current one, or one seeded from the register scenario showing (R4). */
function freeSpec(s: AppState): Extract<RunSpec, { kind: 'free' }> {
  return s.spec.kind === 'free' ? s.spec : { kind: 'free', ...scenarioAsFree(register, s.spec.scenarioId) };
}

function setFree(change: (spec: Extract<RunSpec, { kind: 'free' }>) => Partial<Extract<RunSpec, { kind: 'free' }>>): void {
  appStore.set((s) => {
    const spec = freeSpec(s);
    return { spec: { ...spec, ...change(spec) } };
  });
  actions.recompute();
}

/** Tries each refused override once, in order, against the overrides so far: an accepted one joins them; a refused one keeps its latest issues. */
function retryRefused(s: AppState): Partial<AppState> {
  if (Object.keys(s.fieldIssues).length === 0) return {};
  let overrides = s.overrides;
  const fieldIssues: Record<string, FieldIssue> = {};
  for (const [path, { value }] of Object.entries(s.fieldIssues)) {
    const trial = deriveRun(register, { spec: s.spec, variant: s.variant, overrides: { ...overrides, [path]: value } });
    if (trial.ok) overrides = { ...overrides, [path]: value };
    else fieldIssues[path] = { value, issues: trial.issues };
  }
  return { overrides, fieldIssues };
}

export const actions = {
  setVariant(v: Variant): void {
    appStore.set({ variant: v });
    actions.recompute();
  },
  setScenario(id: string): void {
    appStore.set((s) => ({ spec: { kind: 'register', scenarioId: id }, clock: paused(s.clock) }));
    actions.recompute();
  },
  addCut(c: FreeCut): void {
    setFree((spec) => ({ cuts: [...spec.cuts, c] }));
  },
  updateCut(i: number, c: Partial<FreeCut>): void {
    setFree((spec) => ({ cuts: spec.cuts.map((cut, j) => (j === i ? { ...cut, ...c } : cut)) }));
  },
  /** Removes cut `i`, and any override or field issue on a free-play event that no longer exists, which would be an unknown path. */
  removeCut(i: number): void {
    appStore.set((s) => {
      const spec = freeSpec(s);
      const cuts = spec.cuts.filter((_, j) => j !== i);
      const exists = ([path]: [string, unknown]) => {
        const event = FREE_EVENT_PATH.exec(path);
        return !event || Number(event[1]) < cuts.length;
      };
      const overrides = Object.fromEntries(Object.entries(s.overrides).filter(exists));
      const fieldIssues = Object.fromEntries(Object.entries(s.fieldIssues).filter(exists));
      return { spec: { ...spec, cuts }, overrides, fieldIssues };
    });
    actions.recompute();
  },
  setWorkaroundsHold(b: boolean): void {
    setFree(() => ({ workaroundsHold: b }));
  },
  /**
   * Sets or (with null) clears the override at `path`. A new value is tried first: if the run fails
   * with it, `overrides` stays as it was and the value and its issues are kept against `path` in
   * `fieldIssues`, so the site never shows a run the visitor did not get. Clearing always applies,
   * and drops any refused value at `path` too.
   */
  setOverride(path: string, value: number | null): void {
    const s = appStore.get();
    if (value === null) {
      appStore.set({ overrides: without(s.overrides, path), fieldIssues: without(s.fieldIssues, path), resets: s.resets + 1 });
      actions.recompute();
      return;
    }
    const overrides = { ...s.overrides, [path]: value };
    const trial = deriveRun(register, { spec: s.spec, variant: s.variant, overrides });
    if (!trial.ok) {
      appStore.set({ fieldIssues: { ...s.fieldIssues, [path]: { value, issues: trial.issues } } });
      return;
    }
    appStore.set({ overrides, fieldIssues: without(s.fieldIssues, path) });
    actions.recompute();
  },
  clearOverrides(): void {
    appStore.set((s) => ({ overrides: {}, fieldIssues: {}, resets: s.resets + 1 }));
    actions.recompute();
  },
  select(id: string | null): void {
    appStore.set({ selected: id });
  },
  enterFreePlay(): void {
    appStore.set((s) => ({ mode: 'free', spec: DEFAULT_SPEC, variant: 'unprepared', clock: paused(s.clock) }));
    actions.recompute();
  },
  /** Enters the guided run, which always shows register values (R5). */
  startGuided(): void {
    appStore.set((s) => ({ mode: 'guided', overrides: {}, fieldIssues: {}, resets: s.resets + 1 }));
    actions.recompute();
  },
  setClock(p: Partial<Clock>): void {
    appStore.set((s) => ({ clock: { ...s.clock, ...p } }));
  },
  setSpeed(hps: number): void {
    appStore.set((s) => ({ clock: { ...s.clock, hoursPerSecond: hps } }));
  },
  /**
   * Derives the current run, after trying each refused override once more: a change elsewhere (another
   * override, the scenario, the variant) may have made it valid. A good run replaces `lastGood` and its
   * kind; a bad one sets `issues` and keeps both.
   */
  recompute(): void {
    appStore.set(retryRefused);
    appStore.set((s) => {
      const result = deriveRun(register, { spec: s.spec, variant: s.variant, overrides: s.overrides });
      return result.ok ? { lastGood: result.timeline, lastGoodKind: s.spec.kind, issues: [] } : { issues: result.issues };
    });
  },
};
