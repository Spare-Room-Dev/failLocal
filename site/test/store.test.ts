import { beforeEach, describe, expect, test } from 'vitest';
import type { RunSpec } from '../src/model/run.js';
import { register } from '../src/model/register.js';
import { deriveRun } from '../src/model/run.js';
import { actions, appStore, createStore, initialAppState } from '../src/model/store.js';

beforeEach(() => appStore.set(initialAppState()));

const EMPTY_FREE: RunSpec = { kind: 'free', cuts: [], workaroundsHold: false };

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
      fieldIssues: {},
      lastGoodKind: 'register',
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

  test('an invalid override leaves overrides unchanged and records a field issue', () => {
    actions.setOverride('production.price', 120);
    const good = appStore.get().lastGood;
    expect(good?.assumptionsUsed['production.price']?.value).toBe(120);
    actions.setOverride('production.degradedOutput', 1.5);
    let s = appStore.get();
    expect(s.overrides).toEqual({ 'production.price': 120 });
    expect(s.lastGood).toBe(good);
    expect(s.issues).toEqual([]);
    expect(Object.keys(s.fieldIssues)).toEqual(['production.degradedOutput']);
    expect(s.fieldIssues['production.degradedOutput']!.value).toBe(1.5);
    expect(s.fieldIssues['production.degradedOutput']!.issues.join('\n')).toMatch(/production\.degradedOutput/);
    actions.setOverride('production.degradedOutput', 0.5);
    s = appStore.get();
    expect(s.overrides).toEqual({ 'production.price': 120, 'production.degradedOutput': 0.5 });
    expect(s.fieldIssues).toEqual({});
    expect(s.lastGood?.assumptionsUsed['production.degradedOutput']?.value).toBe(0.5);
  });

  test('resetting a field, or every field, clears its issue', () => {
    actions.setOverride('production.degradedOutput', 1.5);
    actions.setOverride('production.degradedOutput', null);
    expect(appStore.get().fieldIssues).toEqual({});
    actions.setOverride('production.price', -1);
    actions.clearOverrides();
    expect(appStore.get().fieldIssues).toEqual({});
  });

  test('after a failed override, setScenario gives a run whose scenario, projection and samples agree', () => {
    actions.setOverride('production.degradedOutput', 1.5);
    actions.setScenario('s1-as-reported');
    const s = appStore.get();
    const expected = deriveRun(register, { spec: { kind: 'register', scenarioId: 's1-as-reported' }, variant: 'unprepared', overrides: {} });
    if (!expected.ok) throw new Error('s1-as-reported does not run');
    expect(s.issues).toEqual([]);
    expect(s.lastGoodKind).toBe('register');
    expect(s.lastGood?.scenarioId).toBe('s1-as-reported');
    expect(s.lastGood?.projection).toBe(false);
    expect(s.lastGood?.samples).toEqual(expected.timeline.samples);
  });

  test('after a failed override, setVariant gives a run on that variant', () => {
    actions.setOverride('production.degradedOutput', 1.5);
    actions.setVariant('prepared');
    const s = appStore.get();
    const expected = deriveRun(register, { spec: { kind: 'register', scenarioId: 's1-projection' }, variant: 'prepared', overrides: {} });
    if (!expected.ok) throw new Error('s1-projection does not run');
    expect(s.issues).toEqual([]);
    expect(s.lastGood?.variant).toBe('prepared');
    expect(s.lastGood?.samples).toEqual(expected.timeline.samples);
  });

  test('lastGoodKind follows the run that last succeeded', () => {
    expect(appStore.get().lastGoodKind).toBe('register');
    actions.addCut({ service: 'iroc-link', atDays: 0, forDays: 1 });
    expect(appStore.get().lastGoodKind).toBe('free');
    // A failing run leaves the last good one, and its kind, in place.
    appStore.set({ overrides: { 'production.price': -1 } });
    actions.setScenario('s1-as-reported');
    expect(appStore.get().issues).not.toEqual([]);
    expect(appStore.get().lastGoodKind).toBe('free');
    expect(appStore.get().lastGood?.scenarioId).toBe('free-play');
  });

  test('removing a free-play cut prunes overrides on its event paths', () => {
    appStore.set({ spec: EMPTY_FREE });
    actions.addCut({ service: 'iroc-link', atDays: 0, forDays: 1 });
    actions.addCut({ service: 'hosted-erp', atDays: 1, forDays: 2 });
    actions.setOverride('scenarios.free-play.events[1].at', 5);
    actions.setOverride('scenarios.free-play.events[0].restoreAfter', 7);
    actions.setOverride('production.price', 120);
    expect(appStore.get().issues).toEqual([]);
    actions.removeCut(1);
    const s = appStore.get();
    expect(s.overrides).toEqual({ 'scenarios.free-play.events[0].restoreAfter': 7, 'production.price': 120 });
    expect(s.issues).toEqual([]);
  });

  test('startGuided clears overrides so the guided run uses register values', () => {
    actions.setOverride('stocks.diesel.initial', 1);
    const edited = appStore.get().lastGood;
    actions.startGuided();
    const s = appStore.get();
    expect(s.mode).toBe('guided');
    expect(s.overrides).toEqual({});
    expect(s.lastGood).not.toBe(edited);
    expect(s.lastGood?.assumptionsUsed['stocks.diesel.initial']?.overridden).toBe(false);
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

  test('cut edits apply to the free spec', () => {
    appStore.set({ spec: EMPTY_FREE });
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
    appStore.set({ spec: EMPTY_FREE });
    actions.addCut({ service: 'hosted-erp', atDays: 0, forDays: 12 });
    actions.setVariant('prepared');
    const s = appStore.get();
    expect(s.spec).toMatchObject({ kind: 'free', cuts: [{ service: 'hosted-erp' }] });
    expect(s.lastGood?.variant).toBe('prepared');
  });

  test("the first cut on a register scenario keeps the scenario's cuts", () => {
    actions.addCut({ service: 'cloud-identity', atDays: 2, forDays: 12 });
    expect(appStore.get().spec).toEqual({
      kind: 'free',
      cuts: [
        { service: 'hosted-erp', atDays: 0, forDays: 12 },
        { service: 'cloud-identity', atDays: 2, forDays: 12 },
      ],
      workaroundsHold: false,
    });
    expect(appStore.get().lastGood?.scenarioId).toBe('free-play');
  });

  test('removing a seeded cut leaves the rest of the scenario', () => {
    actions.setScenario('s4-precautionary-isolation');
    actions.removeCut(0);
    expect(appStore.get().spec).toEqual({ kind: 'free', cuts: [], workaroundsHold: false });
  });

  test("setWorkaroundsHold seeds from the scenario, its workarounds included, and leaves out compromises", () => {
    actions.setScenario('s1-as-reported');
    actions.updateCut(0, { forDays: 3 });
    expect(appStore.get().spec).toEqual({
      kind: 'free',
      cuts: [{ service: 'hosted-erp', atDays: 0, forDays: 3 }],
      workaroundsHold: true,
    });
    actions.setScenario('s3-vendor-setpoint');
    actions.setWorkaroundsHold(true);
    expect(appStore.get().spec).toEqual({ kind: 'free', cuts: [], workaroundsHold: true });
  });
});
