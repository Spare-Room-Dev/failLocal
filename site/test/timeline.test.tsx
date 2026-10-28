import { act, cleanup, render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { sampleAt } from '../src/model/clock.js';
import { formatQty } from '../src/model/format.js';
import { register } from '../src/model/register.js';
import { serviceLabel } from '../src/model/serviceGroups.js';
import { actions, appStore, initialAppState } from '../src/model/store.js';
import { StockMeters } from '../src/ui/StockMeters.js';
import { EventList } from '../src/ui/EventList.js';
import { Timeline } from '../src/ui/Timeline.js';
import { placeLabels, timelineMarkers } from '../src/model/timelineEvents.js';
import { usePlayback } from '../src/ui/usePlayback.js';
import { installE2eHook, timeScale } from '../src/model/timeScale.js';
import { untaggedNumbers } from './helpers/untagged.js';

beforeEach(() => appStore.set(initialAppState()));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  if (window.__faillocal) window.__faillocal.timeScale = 1;
  delete window.__faillocal;
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
    // "12×" on screen; its accessible name starts with that and spells it out (D2, WCAG 2.5.3).
    const twelve = within(speeds).getByRole('button', { name: '12× (12 hours per second)' });
    expect(twelve.firstChild!.textContent).toBe('12×');
    expect(twelve.querySelector('.visually-hidden')!.textContent).toBe('(12 hours per second)');
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
    expect(down.map((e) => e.querySelector('.timeline-event-name')!.textContent)).toContain(serviceLabel('hosted-erp'));
    expect(serviceLabel('hosted-erp')).toBe('Hosted ERP');
    const stopped = events.filter((e) => e.dataset.event === 'process-stopped');
    const names = stopped.map((e) => e.querySelector('.timeline-event-name')!.textContent);
    expect(names.length).toBeGreaterThan(0);
    expect(new Set(names).size).toBe(names.length);
    const processNames = register.processes.map((p) => p.name);
    for (const n of names) expect(processNames).toContain(n);
    for (const e of events) expect(e.querySelector('.timeline-event-name')!.getAttribute('title')).toBe(e.querySelector('.timeline-event-name')!.textContent);
  });

  test('in guided mode the run drives the clock: play and scrubbing are disabled', async () => {
    const user = userEvent.setup();
    render(<Timeline />);
    act(() => appStore.set({ mode: 'guided' }));
    expect(screen.getByRole('button', { name: 'Play' }).hasAttribute('disabled')).toBe(true);
    expect(slider().getAttribute('aria-disabled')).toBe('true');
    slider().focus();
    await user.keyboard('{ArrowRight}{End}');
    expect(appStore.get().clock).toMatchObject({ hour: 0, playing: false });
    act(() => appStore.set({ mode: 'free' }));
    expect(screen.getByRole('button', { name: 'Play' }).hasAttribute('disabled')).toBe(false);
    expect(slider().getAttribute('aria-disabled')).toBeNull();
  });

  test('each hairline is a button named for its event; only the latest event at or before now is labelled', async () => {
    const user = userEvent.setup();
    const { container } = render(<Timeline />);
    const markers = timelineMarkers(appStore.get().lastGood!);
    const hairlines = () => [...container.querySelectorAll<HTMLButtonElement>('button[data-event]')];
    expect(hairlines().map((b) => b.getAttribute('aria-label'))).toEqual(markers.map((m) => `${m.name} ${m.word}, ${m.tag}`));
    // jsdom is phone-like here (no matchMedia): no lanes, so only the current label shows (R10).
    expect(hairlines().filter((b) => b.hasAttribute('data-lane'))).toEqual([]);
    const current = () => hairlines().filter((b) => b.classList.contains('is-current'));
    expect(current()).toHaveLength(1); // hour 0 has the ERP going down
    const target = markers.findIndex((m) => m.hour > 100);
    act(() => actions.setClock({ hour: markers[target]!.hour }));
    expect(current()).toEqual([hairlines()[markers.map((m) => m.hour).lastIndexOf(markers[target]!.hour)]]);
    await user.click(hairlines()[0]!);
    expect(appStore.get().clock.hour).toBe(markers[0]!.hour);
  });

  test('each label ends in the tag word for where its time comes from', () => {
    actions.setScenario('s1-projection');
    const markers = timelineMarkers(appStore.get().lastGood!);
    const tags = Object.fromEntries(markers.map((m) => [`${m.name} ${m.word}`, m.tag]));
    // The cut's start is the scenario's assumed hour 0; its end is set by the sourced 12-day restore.
    expect(tags['Hosted ERP down']).toBe('assumed');
    expect(tags['Hosted ERP up']).toBe('sourced');
    for (const m of markers.filter((x) => x.kind === 'process-stopped')) expect(m.tag).toBe('computed');
    const { container } = render(<Timeline />);
    expect([...container.querySelectorAll('.timeline-event-tag')].map((t) => t.textContent)).toEqual(markers.map((m) => m.tag));
  });

  test("an inherited outage is computed, and a visitor's cut is changed by you", () => {
    actions.setScenario('s4-precautionary-isolation');
    const inherited = timelineMarkers(appStore.get().lastGood!).filter((m) => m.kind === 'service-down' && m.name !== 'Corporate network');
    expect(inherited.length).toBeGreaterThan(0);
    for (const m of inherited) expect(m.tag).toBe('computed');
    actions.enterFreePlay();
    actions.addCut({ service: 'iroc-link', atDays: 1, forDays: 2 });
    const free = timelineMarkers(appStore.get().lastGood!).filter((m) => m.kind !== 'process-stopped' && m.name === 'Perth operations link');
    expect(free.map((m) => m.tag)).toEqual(['changed by you', 'changed by you']);
  });

  test('wider than a phone, labels get lanes from placeLabels', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: true, media: query, addEventListener: () => {}, removeEventListener: () => {} }));
    const { container } = render(<Timeline />);
    // jsdom lays nothing out: the axis and every label measure 0, so all events stand at one spot. The first
    // two take the two lanes and the rest have none (the real layout is checked end to end).
    const lanes = [...container.querySelectorAll('button[data-event]')].map((b) => b.getAttribute('data-lane'));
    expect(lanes.length).toBeGreaterThan(2);
    expect(lanes).toEqual(['above', 'below', ...lanes.slice(2).map(() => null)]);
    vi.unstubAllGlobals();
  });

  test('every numeral is a clock value', () => {
    const { container } = render(<Timeline />);
    act(() => actions.setClock({ hour: 148 }));
    expect(untaggedNumbers(container)).toEqual([]);
  });
});

describe('EventList', () => {
  test('writes out every timeline event with its day and hour as a clock value', () => {
    const { container } = render(<EventList />);
    const markers = timelineMarkers(appStore.get().lastGood!);
    const items = within(screen.getByRole('region', { name: 'Events' })).getAllByRole('listitem');
    expect(items).toHaveLength(markers.length);
    const m = markers.at(-1)!;
    expect(items.at(-1)!.textContent).toBe(`Day ${Math.floor(m.hour / 24)}, hour ${m.hour % 24} ${m.name} ${m.word}`);
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

  test('a frame applies at most a quarter second, so a hidden tab does not jump to the horizon', () => {
    const frame = stubFrames();
    render(<Player />);
    act(() => actions.setClock({ playing: true }));
    frame(0);
    frame(60_000); // the tab was hidden for a minute
    expect(appStore.get().clock).toMatchObject({ hour: 6, playing: true }); // 24 h/s × 0.25 s
  });

  test('at the default time scale of 1 the clock moves at its own speed; the e2e scale multiplies it', () => {
    const frame = stubFrames();
    installE2eHook(window, true);
    render(<Player />);
    expect(timeScale()).toBe(1);
    act(() => actions.setClock({ playing: true }));
    frame(0);
    frame(100);
    expect(appStore.get().clock.hour).toBeCloseTo(2.4);
    window.__faillocal!.timeScale = 40;
    frame(200);
    expect(appStore.get().clock.hour).toBeCloseTo(2.4 + 96);
    expect(appStore.get().clock.hoursPerSecond).toBe(24);
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

describe('placeLabels', () => {
  const overlaps = (items: { x: number; width: number }[], axis: number, lanes: (string | null)[]) => {
    const spans = items.map(({ x, width }) => {
      const left = x - (x / axis) * width;
      return [left, left + width] as const;
    });
    const hits: string[] = [];
    for (let i = 0; i < items.length; i++)
      for (let j = i + 1; j < items.length; j++)
        if (lanes[i] && lanes[i] === lanes[j] && spans[i]![0] < spans[j]![1] && spans[j]![0] < spans[i]![1]) hits.push(`${i}/${j}`);
    return hits;
  };

  test('three events at one hour (day 3 of the projection) take above, below, then none', () => {
    const items = [{ x: 100, width: 140 }, { x: 100, width: 150 }, { x: 100, width: 160 }];
    const lanes = placeLabels(items, 600);
    expect(lanes).toEqual(['above', 'below', null]);
    expect(overlaps(items, 600, lanes)).toEqual([]);
  });

  test('labels far apart alternate lanes; a label never leaves the axis', () => {
    const items = [{ x: 0, width: 120 }, { x: 300, width: 120 }, { x: 600, width: 120 }];
    expect(placeLabels(items, 600)).toEqual(['above', 'below', 'above']);
  });

  test('no two labels in a lane overlap, over many random layouts', () => {
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let round = 0; round < 200; round++) {
      const axis = 300 + rand() * 700;
      const items = Array.from({ length: 2 + Math.floor(rand() * 10) }, () => ({ x: rand() * axis, width: 40 + rand() * 140 })).sort((a, b) => a.x - b.x);
      const lanes = placeLabels(items, axis);
      expect(overlaps(items, axis, lanes)).toEqual([]);
      for (const [i, { x, width }] of items.entries()) {
        if (!lanes[i]) continue;
        const left = x - (x / axis) * width;
        expect(left).toBeGreaterThanOrEqual(-1e-9);
        expect(left + width).toBeLessThanOrEqual(axis + 1e-9);
      }
    }
  });
});
