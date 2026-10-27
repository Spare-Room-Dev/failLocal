import { beforeEach, describe, expect, test } from 'vitest';
import { actions, appStore, createStore, initialAppState } from '../src/model/store.js';

beforeEach(() => appStore.set(initialAppState()));

describe('createStore', () => {
  test('notifies subscribers until they unsubscribe', () => {
    const store = createStore({ n: 1 });
    let calls = 0;
    const off = store.subscribe(() => calls++);
    store.set({ n: 2 });
    store.set((s) => ({ n: s.n + 1 }));
    off();
    store.set({ n: 9 });
    expect(store.get().n).toBe(9);
    expect(calls).toBe(2);
  });
});

describe('app store', () => {
  test('starts on the welcome page with the s1 projection already run', () => {
    const s = appStore.get();
    expect(s).toMatchObject({
      mode: 'welcome',
      spec: { kind: 'register', scenarioId: 's1-projection' },
      variant: 'unprepared',
      clock: { hour: 0, playing: false, hoursPerSecond: 24 },
      selected: 'haulage',
      issues: [],
    });
    expect(s.lastGood?.scenarioId).toBe('s1-projection');
  });

  test('scenario change resets the clock', () => {
    actions.setClock({ hour: 100, playing: true });
    actions.setSpeed(48);
    actions.setScenario('s2-iroc-lost');
    const s = appStore.get();
    expect(s.spec).toEqual({ kind: 'register', scenarioId: 's2-iroc-lost' });
    expect(s.clock).toEqual({ hour: 0, playing: false, hoursPerSecond: 48 });
    expect(s.lastGood?.scenarioId).toBe('s2-iroc-lost');
  });

  test('an invalid override keeps lastGood and sets issues', () => {
    const good = appStore.get().lastGood;
    expect(good).not.toBeNull();
    actions.setOverride('production.degradedOutput', 1.5);
    let s = appStore.get();
    expect(s.lastGood).toBe(good);
    expect(s.issues.join('\n')).toMatch(/production\.degradedOutput/);
    actions.setOverride('production.degradedOutput', null);
    s = appStore.get();
    expect(s.overrides).toEqual({});
    expect(s.issues).toEqual([]);
  });

  test('enterFreePlay gives its exact state', () => {
    actions.startGuided();
    actions.addCut({ service: 'hosted-erp', atDays: 0, forDays: 12 });
    actions.setVariant('prepared');
    actions.setClock({ hour: 50, playing: true });
    actions.enterFreePlay();
    const s = appStore.get();
    expect(s.mode).toBe('free');
    expect(s.spec).toEqual({ kind: 'register', scenarioId: 's1-projection' });
    expect(s.variant).toBe('unprepared');
    expect(s.clock).toEqual({ hour: 0, playing: false, hoursPerSecond: 24 });
    expect(s.lastGood?.scenarioId).toBe('s1-projection');
    expect(s.lastGood?.variant).toBe('unprepared');
  });

  test('adding a cut switches the spec to free mode, keeping existing cuts', () => {
    actions.addCut({ service: 'hosted-erp', atDays: 0, forDays: 12 });
    expect(appStore.get().spec).toEqual({ kind: 'free', cuts: [{ service: 'hosted-erp', atDays: 0, forDays: 12 }], workaroundsHold: false });
    expect(appStore.get().lastGood?.scenarioId).toBe('free-play');
    actions.addCut({ service: 'iroc-link', atDays: 2, forDays: 1 });
    actions.updateCut(0, { forDays: 5 });
    actions.setWorkaroundsHold(true);
    expect(appStore.get().spec).toEqual({
      kind: 'free',
      cuts: [
        { service: 'hosted-erp', atDays: 0, forDays: 5 },
        { service: 'iroc-link', atDays: 2, forDays: 1 },
      ],
      workaroundsHold: true,
    });
    actions.removeCut(0);
    expect(appStore.get().spec).toMatchObject({ cuts: [{ service: 'iroc-link', atDays: 2, forDays: 1 }] });
  });

  test('variant toggle recomputes with the same cuts', () => {
    actions.addCut({ service: 'hosted-erp', atDays: 0, forDays: 12 });
    actions.setVariant('prepared');
    const s = appStore.get();
    expect(s.spec).toMatchObject({ kind: 'free', cuts: [{ service: 'hosted-erp' }] });
    expect(s.lastGood?.variant).toBe('prepared');
  });
});
