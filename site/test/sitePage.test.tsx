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
});
