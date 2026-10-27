import { act, cleanup, render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { sampleAt } from '../src/model/clock.js';
import { formatQty } from '../src/model/format.js';
import { register } from '../src/model/register.js';
import { serviceName } from '../src/model/serviceGroups.js';
import { actions, appStore, initialAppState } from '../src/model/store.js';
import { StockMeters } from '../src/ui/StockMeters.js';
import { Timeline, usePlayback } from '../src/ui/Timeline.js';
import { untaggedNumbers } from './helpers/untagged.js';

beforeEach(() => appStore.set(initialAppState()));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const slider = () => screen.getByRole('slider', { name: 'Timeline' });
const ticks = (root: HTMLElement) => root.querySelectorAll('[data-tick]').length;

/** A hand-cranked requestAnimationFrame: `frame(ms)` runs the queued callbacks at time `ms`. */
function stubFrames() {
  let queue: FrameRequestCallback[] = [];
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => queue.push(cb));
  vi.stubGlobal('cancelAnimationFrame', () => (queue = []));
  return (ms: number) => {
    const run = queue;
    queue = [];
    act(() => run.forEach((cb) => cb(ms)));
  };
}

describe('Timeline', () => {
  test('axis uses the scenario horizon', () => {
    const { container } = render(<Timeline />);
    expect(ticks(container)).toBe(16);
    expect(slider().getAttribute('aria-valuemax')).toBe('384');
    expect(within(container).getByText(/Day 0 of 16/)).toBeTruthy();
    act(() => actions.setScenario('s1-as-reported'));
    expect(ticks(container)).toBe(14);
    expect(slider().getAttribute('aria-valuemax')).toBe('336');
    expect(within(container).getByText(/Day 0 of 14/)).toBeTruthy();
  });

  test('a free-play run takes its horizon from the overrides', () => {
    act(() => appStore.set({ spec: { kind: 'free', cuts: [{ service: 'iroc-link', atDays: 1, forDays: 3 }], workaroundsHold: false } }));
    act(() => actions.recompute());
    const { container } = render(<Timeline />);
    expect(ticks(container)).toBe(8);
  });

  test('the remaining line is dashed only for a projection', () => {
    const { container } = render(<Timeline />);
    const remaining = () => container.querySelector('.timeline-remaining')!;
    expect(remaining().classList.contains('is-projection')).toBe(true);
    act(() => actions.setScenario('s1-as-reported'));
    expect(remaining().classList.contains('is-projection')).toBe(false);
  });

  test('keyboard scrubbing', async () => {
    const user = userEvent.setup();
    render(<Timeline />);
    slider().focus();
    await user.keyboard('{ArrowRight}');
    expect(appStore.get().clock.hour).toBe(1);
    await user.keyboard('{Shift>}{ArrowRight}{/Shift}');
    expect(appStore.get().clock.hour).toBe(25);
    await user.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}');
    expect(slider().getAttribute('aria-valuenow')).toBe('28');
    expect(slider().getAttribute('aria-valuetext')).toBe('Day 1, hour 4');
    await user.keyboard('{Shift>}{ArrowLeft}{/Shift}');
    expect(appStore.get().clock.hour).toBe(4);
    await user.keyboard('{Shift>}{ArrowLeft}{/Shift}');
    expect(appStore.get().clock.hour).toBe(0);
    await user.keyboard('{End}');
    expect(appStore.get().clock.hour).toBe(384);
    await user.keyboard('{ArrowRight}');
    expect(appStore.get().clock.hour).toBe(384);
    expect(screen.getByText(/Day 16 of 16/)).toBeTruthy();
    await user.keyboard('{Home}');
    expect(appStore.get().clock.hour).toBe(0);
  });

  test('scenario change resets the clock on screen', () => {
    stubFrames();
    render(<Timeline />);
    act(() => actions.setClock({ hour: 200, playing: true }));
    expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy();
    act(() => actions.setScenario('s2-iroc-lost'));
    expect(slider().getAttribute('aria-valuenow')).toBe('0');
    expect(screen.getByRole('button', { name: 'Play' })).toBeTruthy();
  });

  test('play, pause and speed controls drive the clock', async () => {
    stubFrames();
    const user = userEvent.setup();
    render(<Timeline />);
    await user.click(screen.getByRole('button', { name: 'Play' }));
    expect(appStore.get().clock.playing).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Pause' }));
    expect(appStore.get().clock.playing).toBe(false);
    const speeds = screen.getByRole('group', { name: 'Playback speed' });
    await user.click(within(speeds).getAllByRole('button')[3]!);
    expect(appStore.get().clock.hoursPerSecond).toBe(96);
    expect(within(speeds).getAllByRole('button')[3]!.getAttribute('aria-pressed')).toBe('true');
  });

  test('play at the horizon starts again from hour 0', async () => {
    stubFrames();
    const user = userEvent.setup();
    render(<Timeline />);
    act(() => actions.setClock({ hour: 384 }));
    await user.click(screen.getByRole('button', { name: 'Play' }));
    expect(appStore.get().clock).toMatchObject({ hour: 0, playing: true });
  });

  test('event hairlines name the service or process from the register', () => {
    const { container } = render(<Timeline />);
    const events = [...container.querySelectorAll<HTMLElement>('[data-event]')];
    const down = events.filter((e) => e.dataset.event === 'service-down');
    expect(down.map((e) => e.querySelector('.timeline-event-name')!.textContent)).toContain(serviceName('hosted-erp'));
    const stopped = events.filter((e) => e.dataset.event === 'process-stopped');
    const names = stopped.map((e) => e.querySelector('.timeline-event-name')!.textContent);
    expect(names.length).toBeGreaterThan(0);
    expect(new Set(names).size).toBe(names.length);
    const processNames = register.processes.map((p) => p.name);
    for (const n of names) expect(processNames).toContain(n);
    for (const e of events) expect(e.querySelector('.timeline-event-name')!.getAttribute('title')).toBe(e.querySelector('.timeline-event-name')!.textContent);
  });

  test('every numeral is a clock value', () => {
    const { container } = render(<Timeline />);
    act(() => actions.setClock({ hour: 148 }));
    expect(untaggedNumbers(container)).toEqual([]);
  });
});

describe('usePlayback', () => {
  function Player() {
    usePlayback();
    return null;
  }

  test('advances the clock while playing, throttled to about 30 ms', () => {
    const frame = stubFrames();
    render(<Player />);
    act(() => actions.setClock({ playing: true }));
    frame(1000); // first frame sets the reference time
    frame(1016); // too soon
    expect(appStore.get().clock.hour).toBe(0);
    frame(1040);
    expect(appStore.get().clock.hour).toBeCloseTo(0.96); // 24 h/s × 0.040 s
  });

  test('stops and pauses at the horizon', () => {
    const frame = stubFrames();
    render(<Player />);
    act(() => actions.setClock({ hour: 383.5, playing: true }));
    frame(0);
    frame(1000);
    expect(appStore.get().clock).toMatchObject({ hour: 384, playing: false });
  });
});

describe('StockMeters', () => {
  const ROWS = [
    ['Diesel', 'diesel'],
    ['ROM pad', 'rom-pad'],
    ['Stockpile', 'ore-stockpile'],
  ] as const;

  test('stock meters are tagged and match the sample', () => {
    const { container } = render(<StockMeters />);
    act(() => actions.setClock({ hour: 200.5 }));
    const sample = sampleAt(appStore.get().lastGood!, 200.5);
    for (const [label, id] of ROWS) {
      const meter = screen.getByRole('meter', { name: label });
      const qty = meter.closest('.stock-row')!.querySelector('[data-quantity]')!;
      expect(qty.textContent).toBe(`${formatQty(sample.stocks[id]!, 'days')}computed`);
      const capacity = register.stocks.find((s) => s.id === id)!.capacity.value;
      expect(Number(meter.getAttribute('aria-valuemax'))).toBe(capacity);
      expect(Number(meter.getAttribute('aria-valuenow'))).toBe(sample.stocks[id]);
    }
    expect(untaggedNumbers(container)).toEqual([]);
  });

  test('an overridden capacity rescales the fill', () => {
    render(<StockMeters />);
    act(() => actions.setOverride('stocks.diesel.capacity', 14));
    expect(screen.getByRole('meter', { name: 'Diesel' }).getAttribute('aria-valuemax')).toBe('14');
  });
});
