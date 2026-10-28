import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { actions, appStore, initialAppState } from '../src/model/store.js';
import { SitePage } from '../src/ui/pages/SitePage.js';

/** `matchMedia` answering `matches` for the queries in `matching`. */
function stubMedia(matching: string[]) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: matching.includes(query),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

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

beforeEach(() => appStore.set(initialAppState()));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('SitePage', () => {
  test('the playback loop runs once: a frame advances the clock once', () => {
    stubMedia(['(min-width: 761px)']);
    const frame = stubFrames();
    render(<SitePage />);
    act(() => actions.setClock({ playing: true }));
    frame(1000);
    frame(1040);
    expect(appStore.get().clock.hour).toBeCloseTo(0.96); // 24 h/s × 0.040 s, not twice that
  });

  test('the scene follows prefers-reduced-motion', () => {
    stubMedia(['(prefers-reduced-motion: reduce)']);
    const { unmount } = render(<SitePage />);
    expect(screen.getByRole('group', { name: 'Model site schematic' }).getAttribute('data-reduced-motion')).toBe('true');
    unmount();
    stubMedia([]);
    render(<SitePage />);
    expect(screen.getByRole('group', { name: 'Model site schematic' }).getAttribute('data-reduced-motion')).toBe('false');
  });

  test('free play and the assumptions editor sit in the detail column, below the area panel', () => {
    stubMedia(['(min-width: 761px)']);
    const { container } = render(<SitePage />);
    const detail = container.querySelector('.site-detail')!;
    const order = [...detail.querySelectorAll('.detail-panel, .free-play, .editor')].map((e) => e.className.split(' ')[0]);
    expect(order).toEqual(['detail-panel', 'free-play', 'editor']);
  });

  test('a phone reads in order: scene, summary strip, timeline, legend, events, stocks, then the area panel (finish B4)', () => {
    stubMedia(['(max-width: 760px)']);
    actions.select('haulage');
    const { container } = render(<SitePage />);
    const marks = [
      ['scene', '.site-stage .scene'],
      ['day', '.site-summary .timeline-figure'],
      ['deferred', '.site-summary .odometer'],
      ['revenue', '.site-summary .figure'],
      ['timeline', '.timeline-axis'],
      ['legend', '.legend'],
      ['events', '.event-list'],
      ['stocks', '.stock-meters'],
      ['area', '.area-panel'],
    ] as const;
    const nodes = marks.map(([name, sel]) => {
      const all = container.querySelectorAll(sel);
      expect(all, name).toHaveLength(1);
      return all[0]!;
    });
    for (let i = 1; i < nodes.length; i++)
      expect(nodes[i - 1]!.compareDocumentPosition(nodes[i]!) & Node.DOCUMENT_POSITION_FOLLOWING, `${marks[i - 1]![0]} before ${marks[i]![0]}`).toBeTruthy();
    // One day figure and one revenue section: the timeline and the detail column leave theirs to the strip.
    expect(container.querySelectorAll('.timeline-figure')).toHaveLength(1);
    expect(container.querySelectorAll('.revenue')).toHaveLength(1);
  });

  test('on a laptop the revenue stays at the top of the detail column', () => {
    stubMedia(['(min-width: 761px)']);
    const { container } = render(<SitePage />);
    expect(container.querySelector('.site-summary')).toBeNull();
    expect(container.querySelector('.site-detail .detail-panel > .revenue')).toBeTruthy();
    expect(container.querySelector('.site-strip .timeline-figure')).toBeTruthy();
  });
});
