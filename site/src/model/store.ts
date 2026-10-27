import { useSyncExternalStore } from 'react';
import type { Timeline, Variant } from '@faillocal/engine';
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

export interface AppState {
  mode: 'welcome' | 'guided' | 'free';
  spec: RunSpec;
  variant: Variant;
  overrides: Record<string, number>;
  clock: Clock;
  selected: string | null;
  lastGood: Timeline | null;
  issues: string[];
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
    issues: result.ok ? [] : result.issues,
  };
}

export const appStore = createStore<AppState>(initialAppState());

const paused = (clock: Clock): Clock => ({ ...clock, hour: 0, playing: false });

/** The free-play spec to edit: the current one, or an empty one when a register scenario is showing. */
function freeSpec(s: AppState): Extract<RunSpec, { kind: 'free' }> {
  return s.spec.kind === 'free' ? s.spec : { kind: 'free', cuts: [], workaroundsHold: false };
}

function setFree(change: (spec: Extract<RunSpec, { kind: 'free' }>) => Partial<Extract<RunSpec, { kind: 'free' }>>): void {
  appStore.set((s) => {
    const spec = freeSpec(s);
    return { spec: { ...spec, ...change(spec) } };
  });
  actions.recompute();
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
  removeCut(i: number): void {
    setFree((spec) => ({ cuts: spec.cuts.filter((_, j) => j !== i) }));
  },
  setWorkaroundsHold(b: boolean): void {
    setFree(() => ({ workaroundsHold: b }));
  },
  setOverride(path: string, value: number | null): void {
    appStore.set((s) => {
      const overrides = { ...s.overrides };
      if (value === null) delete overrides[path];
      else overrides[path] = value;
      return { overrides };
    });
    actions.recompute();
  },
  clearOverrides(): void {
    appStore.set({ overrides: {} });
    actions.recompute();
  },
  select(id: string | null): void {
    appStore.set({ selected: id });
  },
  enterFreePlay(): void {
    appStore.set((s) => ({ mode: 'free', spec: DEFAULT_SPEC, variant: 'unprepared', clock: paused(s.clock) }));
    actions.recompute();
  },
  startGuided(): void {
    appStore.set({ mode: 'guided' });
  },
  setClock(p: Partial<Clock>): void {
    appStore.set((s) => ({ clock: { ...s.clock, ...p } }));
  },
  setSpeed(hps: number): void {
    appStore.set((s) => ({ clock: { ...s.clock, hoursPerSecond: hps } }));
  },
  /** Derives the current run. A good run replaces `lastGood`; a bad one sets `issues` and keeps `lastGood`. */
  recompute(): void {
    appStore.set((s) => {
      const result = deriveRun(register, { spec: s.spec, variant: s.variant, overrides: s.overrides });
      return result.ok ? { lastGood: result.timeline, issues: [] } : { issues: result.issues };
    });
  },
};
