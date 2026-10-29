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

  test('welcome carries the owner\'s byline and a non-interactive scene', () => {
    const { container } = render(<App />);
    expect(welcome()).toBeTruthy();
    const byline = screen.getByText((_, el) => el?.tagName === 'P' && el.textContent === 'Built by Rob Porter, cyber security graduate, Perth · How I built this →');
    expect(byline.querySelector('.placeholder')).toBeNull();
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

  test('built page carries the owner\'s approved copy, with no draft banner or placeholder', () => {
    go('#/built');
    const { container } = render(<App />);
    expect(screen.queryByText(/awaiting owner review/)).toBeNull();
    expect(container.querySelector('.draft-banner, .placeholder')).toBeNull();
    expect(container.textContent).not.toMatch(/\[Placeholder/);
    expect(screen.getAllByText(/Claude Code/).length).toBeGreaterThan(0);
    expect(
      screen.getByText(
        'Claude Code proposed every modelling judgement and recorded it in the decision log; I reviewed each one and accepted or changed it.',
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/every judgement call in the model/)).toBeNull();
    expect(screen.getByText('A final reviewer read each release\u2019s changes together before it shipped.')).toBeTruthy();
    expect(
      screen.getByText(
        'I expected the danger to be someone in the plant controls. In the Scope Systems case the plants were fine; what stopped work was losing ordinary business systems like ordering and payroll. And getting them back wasn\u2019t the end: in the model, backlogs, a purchasing hold and delivery times keep the site short of fuel for days after the restore.',
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(
        'Claude Code proposed the options and I made the calls, such as holding purchasing after a restore and adding delivery times. What I\u2019d pass on: make the agent write every decision down with its reasoning, because if you can\u2019t explain a decision, you don\u2019t own it.',
      ),
    ).toBeTruthy();
  });

  test('limits page names the delivery-rate limit and links the public decision log', () => {
    go('#/limits');
    const { container } = render(<App />);
    expect(screen.getByText('Lead times model delivery delay, not delivery rate; there is no delivery-rate modelling.')).toBeTruthy();
    // One in the assumption caveat, one in the closing line.
    const logs = screen.getAllByRole('link', { name: /decision log/i });
    expect(logs).toHaveLength(2);
    for (const log of logs) expect(log.getAttribute('href')).toBe('https://github.com/Spare-Room-Dev/failLocal/blob/main/docs/decisions.md');
    expect(
      screen.getByText((_, el) => el?.tagName === 'P' && el.textContent === 'Every modelling choice, and why it was made, is in the decision log.'),
    ).toBeTruthy();
    expect(screen.queryByText(/placeholder until/i)).toBeNull();
    // The deferred network view is stated (D-110, ruling R-x), as approved copy with no draft marker.
    const network = screen.getByText(/The network view is not built yet\./).closest('li')!;
    expect(network.textContent).toBe(
      'The network view is not built yet. The cables and entry posts show which outside services the site depends on, but not how each service\u2019s network runs across the site.',
    );
    expect(container.querySelector('.draft-marker, .placeholder')).toBeNull();
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
