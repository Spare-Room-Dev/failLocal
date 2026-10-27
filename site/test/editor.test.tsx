import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { formatQty } from '../src/model/format.js';
import { register } from '../src/model/register.js';
import { actions, appStore, initialAppState } from '../src/model/store.js';
import { AssumptionsEditor } from '../src/ui/AssumptionsEditor.js';
import { DetailPanel } from '../src/ui/DetailPanel.js';
import { untaggedNumbers } from './helpers/untagged.js';

const DESKTOP = '(min-width: 761px)';

/** A `matchMedia` that answers `matches` for the desktop query. */
function stubMedia(matches: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => {
    if (query !== DESKTOP) throw new Error(`unexpected media query ${query}`);
    return { matches, media: query, addEventListener: () => {}, removeEventListener: () => {} };
  });
}

beforeEach(() => {
  appStore.set(initialAppState());
  actions.enterFreePlay();
  stubMedia(true);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const editor = () => screen.getByRole('region', { name: 'Assumptions' });
const row = (path: string) => {
  const el = editor().querySelector<HTMLElement>(`[data-path="${path}"]`);
  if (!el) throw new Error(`no editor row for ${path}`);
  return el;
};
const input = (path: string) => within(row(path)).getByRole('spinbutton') as HTMLInputElement;
const rowPaths = () => [...editor().querySelectorAll('[data-path]')].map((r) => r.getAttribute('data-path')!);
const working = () => screen.getByRole('group', { name: 'How revenue at risk is worked out' });
/** The tag words of the `<Qty>` under `root` whose text starts with `text`. */
const qtyTags = (root: HTMLElement, text: string) => {
  const qty = [...root.querySelectorAll('[data-quantity]')].find((q) => q.textContent!.startsWith(text));
  if (!qty) throw new Error(`no quantity starting ${text}`);
  return [...qty.querySelectorAll('.qty-tag')].map((t) => t.textContent);
};

describe('AssumptionsEditor', () => {
  test('invalid edit keeps the last good run and names the field', () => {
    render(
      <>
        <AssumptionsEditor />
        <DetailPanel />
      </>,
    );
    const good = appStore.get().lastGood;
    const price = formatQty(register.production.price.value, 'usdPerT');
    fireEvent.change(input('production.price'), { target: { value: '-1' } });
    expect(appStore.get().lastGood).toBe(good);
    // The refused value never reaches the run's overrides; the field keeps what the visitor typed.
    expect(appStore.get().overrides).toEqual({});
    expect(appStore.get().issues).toEqual([]);
    expect(input('production.price').value).toBe('-1');
    const alert = within(row('production.price')).getByRole('alert');
    expect(alert.textContent).toMatch(/^Ore price: .*0/);
    expect(alert.textContent).not.toContain('production.price');
    expect(alert.getAttribute('data-path')).toBe('production.price');
    expect(alert.hasAttribute('data-message')).toBe(true);
    expect(document.getElementById(input('production.price').getAttribute('aria-describedby')!)).toBe(alert);
    expect(untaggedNumbers(editor())).toEqual([]);
    expect(qtyTags(working(), price)).toEqual(['sourced']);
    expect(qtyTags(row('production.price'), price)).toEqual(['sourced']);
    fireEvent.change(input('production.price'), { target: { value: '120' } });
    expect(within(row('production.price')).queryByRole('alert')).toBeNull();
    expect(input('production.price').hasAttribute('aria-describedby')).toBe(false);
    expect(qtyTags(working(), formatQty(120, 'usdPerT'))).toEqual(['changed by you']);
  });

  test('an issue on a path with no row is still shown', () => {
    render(<AssumptionsEditor />);
    act(() => actions.setOverride('stocks.diesel.refillRate', -1));
    expect(within(editor()).getByRole('alert').textContent).toMatch(/stocks\.diesel\.refillRate/);
  });

  test('empty input is ignored until valid', () => {
    render(<AssumptionsEditor />);
    const field = input('production.annualTonnes');
    for (const value of ['', 'abc']) {
      fireEvent.change(field, { target: { value } });
      expect(appStore.get().overrides).toEqual({});
      expect(appStore.get().issues).toEqual([]);
    }
    fireEvent.change(field, { target: { value: '30' } });
    expect(appStore.get().overrides).toEqual({ 'production.annualTonnes': 30 });
  });

  test('editor hides control durations on the unprepared run', () => {
    render(<AssumptionsEditor />);
    expect(rowPaths().some((p) => p.startsWith('controls.'))).toBe(false);
    expect(screen.queryByRole('heading', { name: 'Controls' })).toBeNull();
    act(() => actions.setVariant('prepared'));
    expect(rowPaths().filter((p) => p.startsWith('controls.'))).toEqual(
      Object.keys(appStore.get().lastGood!.assumptionsUsed).filter((p) => /^controls\.[^.]+\.effects\[\d+\]\.(duration|delay)$/.test(p)),
    );
    expect(screen.getByRole('heading', { name: 'Controls' })).toBeTruthy();
  });

  test('changed-by-you appears on the edited input everywhere it is shown', () => {
    render(
      <>
        <AssumptionsEditor />
        <DetailPanel />
      </>,
    );
    const price = formatQty(register.production.price.value, 'usdPerT');
    expect(qtyTags(row('production.price'), price)).toEqual(['sourced']);
    fireEvent.change(input('production.price'), { target: { value: '120' } });
    const edited = formatQty(120, 'usdPerT');
    expect(qtyTags(row('production.price'), edited)).toEqual(['changed by you']);
    expect(qtyTags(working(), edited)).toEqual(['changed by you']);
    // Its tooltip names the register's value, not the edited one.
    const source = register.sources.find((x) => x.id === (register.production.price.provenance as { source: string }).source)!;
    for (const root of [row('production.price'), working()]) {
      const tag = within(root).getByText('changed by you');
      expect(document.getElementById(tag.getAttribute('aria-describedby')!)!.textContent).toBe(`Register value: ${price} (sourced, ${source.title})`);
    }
    const tonnes = formatQty(register.production.annualTonnes.value, 'mtpa');
    expect(qtyTags(row('production.annualTonnes'), tonnes)).toEqual(['assumed']);
  });

  test('rows follow the ruling patterns, grouped under short headings', () => {
    render(<AssumptionsEditor />);
    const paths = rowPaths();
    expect(paths.filter((p) => p.startsWith('production.'))).toEqual(['production.annualTonnes', 'production.price', 'production.degradedOutput']);
    expect(paths).toContain('stocks.diesel.initial');
    expect(paths).toContain('stocks.rom-pad.lowThreshold');
    expect(paths.some((p) => p.endsWith('.refillRate'))).toBe(false);
    expect(paths).toContain('processes.diesel-ordering.dependsOn.hosted-erp.afterRestore.holdFor');
    expect(paths).toContain('processes.haulage.continuity.maxTolerableOutage');
    expect(paths.some((p) => p.startsWith('scenarios.'))).toBe(false);
    const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(headings).toEqual(['Production', 'Stocks', 'Purchasing hold', 'Workarounds', 'Continuity']);
    expect(within(row('stocks.diesel.initial')).getByText(/Diesel in the fuel farm/)).toBeTruthy();
  });

  test('workaround rows list only the services the scenario takes down', () => {
    render(<AssumptionsEditor />);
    const workarounds = () => rowPaths().filter((p) => p.endsWith('.manualWorkaround.holdsFor'));
    expect(workarounds().length).toBeGreaterThan(0);
    expect(workarounds().every((p) => p.includes('.dependsOn.hosted-erp.'))).toBe(true);
    act(() => actions.setScenario('s2-iroc-lost'));
    expect(workarounds()).toEqual([]);
    expect(screen.queryByRole('heading', { name: 'Workarounds' })).toBeNull();
  });

  test('inputs are bounded number fields; fractions stop at 1', () => {
    render(<AssumptionsEditor />);
    const fraction = input('production.degradedOutput');
    expect(fraction.type).toBe('number');
    expect(fraction.min).toBe('0');
    expect(fraction.max).toBe('1');
    expect(input('production.price').min).toBe('0');
    expect(input('production.price').max).toBe('');
  });

  test('per-row reset and reset all clear overrides and restore the inputs', () => {
    render(<AssumptionsEditor />);
    expect(within(row('production.price')).queryByRole('button', { name: /Reset/ })).toBeNull();
    fireEvent.change(input('production.price'), { target: { value: '120' } });
    fireEvent.change(input('production.annualTonnes'), { target: { value: '30' } });
    fireEvent.click(within(row('production.price')).getByRole('button', { name: /Reset/ }));
    expect(appStore.get().overrides).toEqual({ 'production.annualTonnes': 30 });
    expect(input('production.price').value).toBe(String(register.production.price.value));
    fireEvent.click(screen.getByRole('button', { name: 'Reset all' }));
    expect(appStore.get().overrides).toEqual({});
    expect(input('production.annualTonnes').value).toBe(String(register.production.annualTonnes.value));
  });

  test('a phone gets the laptop note instead of the editor', () => {
    stubMedia(false);
    render(<AssumptionsEditor />);
    expect(screen.queryByRole('region', { name: 'Assumptions' })).toBeNull();
    expect(screen.getByText('Best on a laptop: the assumptions editor needs a wider screen.')).toBeTruthy();
  });

  test('no untagged numbers', () => {
    act(() => actions.setVariant('prepared'));
    const { container } = render(<AssumptionsEditor />);
    expect(untaggedNumbers(container)).toEqual([]);
  });
});
