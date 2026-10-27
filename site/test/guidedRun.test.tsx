import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { formatQty } from '../src/model/format.js';
import { DWELL_SECONDS, comparison, guidedSteps } from '../src/model/guided.js';
import { register } from '../src/model/register.js';
import { actions, appStore, initialAppState } from '../src/model/store.js';
import { installE2eHook } from '../src/model/timeScale.js';
import { GuidedRun } from '../src/ui/GuidedRun.js';
import { untaggedNumbers } from './helpers/untagged.js';

const steps = guidedSteps(register);
const TICK_MS = 50;
/** Longer than the whole run takes. */
const RUN_CAP_MS = 120_000;

beforeEach(() => {
  vi.useFakeTimers();
  appStore.set(initialAppState());
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  if (window.__faillocal) window.__faillocal.timeScale = 1;
  delete window.__faillocal;
});

const section = () => screen.getByRole('region', { name: 'Guided run' });
const at = () => section().getAttribute('data-step');

/** Runs fake time forward in small steps, letting React commit between them, until `done()` holds. */
function advanceUntil(done: () => boolean): void {
  for (let t = 0; t < RUN_CAP_MS && !done(); t += TICK_MS) act(() => vi.advanceTimersByTime(TICK_MS));
  expect(done()).toBe(true);
}

function startGuided() {
  const view = render(<GuidedRun />);
  act(() => actions.startGuided());
  return view;
}

describe('GuidedRun', () => {
  test('at the default time scale the first step holds DWELL_SECONDS; the e2e scale divides the hold', () => {
    const dwellMs = DWELL_SECONDS * 1000;
    /** Fake milliseconds until the clock first leaves hour 0, in 10 ms steps. */
    const msUntilTravel = () => {
      let t = 0;
      while (appStore.get().clock.hour === 0 && t < RUN_CAP_MS) {
        act(() => vi.advanceTimersByTime(10));
        t += 10;
      }
      return t;
    };
    startGuided();
    // The hold, then one 50 ms travel tick.
    expect(msUntilTravel()).toBe(dwellMs + TICK_MS);
    expect(appStore.get().clock.hour).toBeCloseTo(40 * (TICK_MS / 1000));
    cleanup();

    appStore.set(initialAppState());
    installE2eHook(window, true);
    window.__faillocal!.timeScale = 40;
    startGuided();
    expect(msUntilTravel()).toBe(Math.ceil(dwellMs / 40 / 10) * 10 + TICK_MS);
    expect(appStore.get().clock.hour).toBeCloseTo(40 * 40 * (TICK_MS / 1000));
  });

  test('each step puts the store on its scenario, variant and hour, paused', () => {
    startGuided();
    steps.forEach((step, i) => {
      advanceUntil(() => at() === String(i));
      const s = appStore.get();
      expect({ i, spec: s.spec, variant: s.variant, hour: s.clock.hour, playing: s.clock.playing }).toEqual({
        i,
        spec: { kind: 'register', scenarioId: step.scenarioId },
        variant: step.variant,
        hour: step.hour,
        playing: false,
      });
    });
  });

  test('captions carry a draft marker and the 12 days as a sourced quantity', () => {
    const { container } = startGuided();
    expect(screen.getByText('Draft copy')).toBeTruthy();
    expect(screen.getByText(/What really happened/)).toBeTruthy();
    expect(section().querySelector('time[datetime="2026-05"]')?.textContent).toBe('May 2026');
    expect(untaggedNumbers(container)).toEqual([]);
    const scenario = register.scenarios.find((s) => s.id === 's1-as-reported')!;
    expect(screen.getByRole('heading', { name: scenario.title })).toBeTruthy();
    advanceUntil(() => at() === '1');
    expect(section().textContent).toContain('The ERP is back after');
    expect(section().textContent).toContain(formatQty(12, 'days'));
    expect(container.querySelector('.qty-tag--sourced')).not.toBeNull();
    expect(untaggedNumbers(container)).toEqual([]);
  });

  test('pause holds the step and the clock; resume carries on', () => {
    startGuided();
    advanceUntil(() => at() === '1');
    act(() => vi.advanceTimersByTime(1000));
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    const hour = appStore.get().clock.hour;
    act(() => vi.advanceTimersByTime(60_000));
    expect(at()).toBe('1');
    expect(appStore.get().clock.hour).toBe(hour);
    expect(vi.getTimerCount()).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
    advanceUntil(() => at() === '2');
  });

  test('comparison shows both totals and the assumption caveat with its tags', () => {
    const { container } = startGuided();
    advanceUntil(() => at() === 'comparison');
    const c = comparison(register);
    const text = section().textContent ?? '';
    expect(text).toContain(`Revenue at risk, unprepared${formatQty(c.unprepared, 'usd')}`);
    expect(text).toContain(`Revenue at risk, prepared${formatQty(c.prepared, 'usd')}`);
    expect(text).toContain(`Being prepared protected${formatQty(c.protected, 'usd')}`);
    expect(c.protected).toBeGreaterThan(0);
    const caveat = container.querySelector('.assumption-caveat')!;
    expect(caveat.textContent).toMatch(/^This projection rests on two assumed numbers: /);
    expect(caveat.querySelectorAll('.qty-tag--assumed')).toHaveLength(2);
    expect(container.querySelectorAll('.guided-totals .qty-tag--computed')).toHaveLength(3);
    expect(untaggedNumbers(container)).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'Explore it yourself' }));
    expect(appStore.get().mode).toBe('free');
  });

  test('skip from any step lands cleanly in free play', () => {
    for (let i = 0; i <= steps.length; i++) {
      appStore.set(initialAppState());
      actions.setOverride('stocks.diesel.initial', 1);
      actions.setSpeed(48);
      startGuided();
      const target = i === steps.length ? 'comparison' : String(i);
      advanceUntil(() => at() === target);
      if (i === steps.length) fireEvent.click(screen.getByRole('button', { name: 'Explore it yourself' }));
      else fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
      const s = appStore.get();
      expect({ i, mode: s.mode, spec: s.spec, variant: s.variant, clock: s.clock, overrides: s.overrides }).toEqual({
        i,
        mode: 'free',
        spec: { kind: 'register', scenarioId: 's1-projection' },
        variant: 'unprepared',
        clock: { hour: 0, playing: false, hoursPerSecond: 48 },
        overrides: {},
      });
      expect(s.lastGood?.scenarioId).toBe('s1-projection');
      expect(s.lastGood?.variant).toBe('unprepared');
      expect(screen.queryByRole('region', { name: 'Guided run' })).toBeNull();
      expect(vi.getTimerCount()).toBe(0);
      cleanup();
    }
  });

  test('unmounting mid-travel leaves no timers', () => {
    const { unmount } = startGuided();
    advanceUntil(() => at() === '0');
    act(() => vi.advanceTimersByTime(5000));
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
