import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { App } from '../src/App.js';
import { register } from '../src/model/register.js';
import { actions, appStore, initialAppState } from '../src/model/store.js';
import { untaggedNumbers } from './helpers/untagged.js';

/** The engine's wording rule: never "lost" about revenue, production or tonnes. */
const LOST = /\blost (revenue|production|tonnes)\b|\b(revenue|production|tonnes) (is |was )?lost\b/i;

const ROUTES = ['#/', '#/site', '#/sources', '#/tested', '#/built', '#/limits'];

function go(hash: string): void {
  window.location.hash = hash;
}

beforeEach(() => {
  vi.useFakeTimers();
  // The assumptions editor asks whether the screen is desktop-sized; jsdom has no matchMedia.
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: true, media: query, addEventListener: () => {}, removeEventListener: () => {} }));
  appStore.set(initialAppState());
  go('#/');
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  go('#/');
});

const HEADLINE = 'What stops a mine when the systems outside it go down?';
const welcome = () => screen.getByRole('heading', { level: 1, name: HEADLINE });

describe('pages', () => {
  test('welcome primary starts the guided run', () => {
    act(() => actions.setOverride('stocks.diesel.capacity', 3));
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Show me the site' }));
    expect(appStore.get().mode).toBe('guided');
    expect(appStore.get().overrides).toEqual({});
    expect(window.location.hash).toBe('#/site');
  });

  test('explore goes to free play', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Explore freely' }));
    expect(appStore.get().mode).toBe('free');
    expect(window.location.hash).toBe('#/site');
  });

  test('welcome keeps the name placeholder and a non-interactive scene', () => {
    const { container } = render(<App />);
    expect(welcome()).toBeTruthy();
    const byline = screen.getByText((_, el) => el?.tagName === 'P' && /^Built by \[Your name\], cyber security graduate, Perth · How I built this →$/.test(el.textContent ?? ''));
    expect(byline.querySelector('.placeholder')!.textContent).toBe('[Your name]');
    expect(screen.getByRole('link', { name: 'How I built this →' }).getAttribute('href')).toBe('#/built');
    expect(screen.getByRole('link', { name: 'Sources →' }).getAttribute('href')).toBe('#/sources');
    expect(screen.queryByText(/walkthrough/i)).toBeNull();
    const scene = container.querySelector('[data-decorative]')!;
    expect(scene.getAttribute('aria-hidden')).toBe('true');
    expect(scene.hasAttribute('inert')).toBe(true);
    expect(scene.querySelector('svg.scene')).toBeTruthy();
  });

  test('sources page lists every register source with its accessed date', () => {
    go('#/sources');
    render(<App />);
    const items = screen.getAllByRole('listitem').filter((li) => li.closest('[data-sources]'));
    expect(items).toHaveLength(register.sources.length);
    register.sources.forEach((s, i) => {
      const item = items[i]!;
      const link = within(item).getByRole('link', { name: s.title });
      expect(link.getAttribute('href')).toBe(s.url);
      expect(link.getAttribute('rel')).toBe('noopener noreferrer');
      expect(item.querySelector('time')!.getAttribute('dateTime')).toBe(s.accessed);
    });
  });

  test('tested page lists every control with its provenance kind', () => {
    // The note below says every capability is assumed; this fails when the register stops saying so.
    expect(register.controls.every((c) => c.capability.provenance.kind === 'assumed')).toBe(true);
    go('#/tested');
    render(<App />);
    expect(
      screen.getByText("The lab that measures these controls arrives in the next release. Until then every control's capability is labelled assumed."),
    ).toBeTruthy();
    for (const c of register.controls) {
      const item = screen.getByText(c.name).closest('li')!;
      expect(within(item).getByLabelText(`${c.capability.provenance.kind} value`)).toBeTruthy();
    }
  });

  test('built page shows the draft banner', () => {
    go('#/built');
    render(<App />);
    expect(screen.getByText('Draft — awaiting owner review')).toBeTruthy();
    expect(screen.getByText(/Claude Code/)).toBeTruthy();
    const review = screen.getByText('[Placeholder: whole-branch review — confirm once done]');
    expect(review.classList.contains('placeholder')).toBe(true);
    expect(screen.queryByText('A review of the whole branch before release.')).toBeNull();
  });

  test('limits page names the delivery-rate limit and the placeholder decision log', () => {
    go('#/limits');
    render(<App />);
    expect(screen.getByText('Lead times model delivery delay, not delivery rate; there is no delivery-rate modelling.')).toBeTruthy();
    const log = screen.getByRole('link', { name: /decision log/i });
    expect(log.getAttribute('href')).toBe('https://github.com/[owner]/faillocal/blob/main/docs/decisions.md');
    expect(screen.getByText(/placeholder until the repo is public/i)).toBeTruthy();
  });

  test('landing on the site in welcome mode enters free play', () => {
    expect(appStore.get().mode).toBe('welcome');
    go('#/site');
    render(<App />);
    expect(appStore.get().mode).toBe('free');
    expect(screen.getByRole('region', { name: 'Free play' })).toBeTruthy();
  });

  test('unknown route falls back to welcome', () => {
    go('#/nope');
    render(<App />);
    expect(welcome()).toBeTruthy();
  });

  test('routes re-render on hashchange', () => {
    render(<App />);
    expect(welcome()).toBeTruthy();
    act(() => {
      go('#/limits');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(screen.queryByRole('heading', { level: 1, name: HEADLINE })).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'Limitations' })).toBeTruthy();
  });

  test('every page links every route in its footer', () => {
    for (const hash of ROUTES) {
      go(hash);
      render(<App />);
      const nav = screen.getByRole('navigation', { name: 'Pages' });
      const hrefs = within(nav)
        .getAllByRole('link')
        .map((a) => a.getAttribute('href'));
      expect(hrefs).toEqual(ROUTES);
      cleanup();
    }
  });

  test('no page uses the word lost about revenue', () => {
    const views: [string, () => void][] = [
      ...ROUTES.map((h): [string, () => void] => [h, () => {}]),
      ['#/site', () => actions.startGuided()],
      ['#/site', () => actions.enterFreePlay()],
    ];
    for (const [hash, setup] of views) {
      appStore.set(initialAppState());
      go(hash);
      setup();
      render(<App />);
      expect(document.body.textContent ?? '').not.toMatch(LOST);
      cleanup();
    }
  });

  test('copy pages carry no untagged numbers', () => {
    for (const hash of ['#/', '#/sources', '#/tested', '#/built', '#/limits']) {
      go(hash);
      render(<App />);
      expect(untaggedNumbers(document.body)).toEqual([]);
      cleanup();
    }
  });
});
