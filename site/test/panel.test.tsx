import { act, cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import type { Variant } from '@faillocal/engine';
import { formatQty } from '../src/model/format.js';
import { register } from '../src/model/register.js';
import { revenueAtRiskPerDay, shippingStock } from '../src/model/revenueOutlook.js';
import { serviceName } from '../src/model/serviceGroups.js';
import { actions, appStore, initialAppState } from '../src/model/store.js';
import { DetailPanel } from '../src/ui/DetailPanel.js';
import { untaggedNumbers } from './helpers/untagged.js';

beforeEach(() => appStore.set(initialAppState()));
afterEach(cleanup);

const working = () => screen.getByRole('group', { name: 'How revenue at risk is worked out' });
/** The `<Qty>` whose text starts with `text`, and its tag words. */
const qtyTags = (root: HTMLElement, text: string) => {
  const qty = [...root.querySelectorAll('[data-quantity]')].find((q) => q.textContent!.startsWith(text));
  if (!qty) throw new Error(`no quantity starting ${text}`);
  return [...qty.querySelectorAll('.qty-tag')].map((t) => t.textContent);
};

describe('RevenueSection', () => {
  test('revenue working shows each input with its tag from assumptionsUsed', () => {
    render(<DetailPanel />);
    const { annualTonnes, price, degradedOutput } = register.production;
    expect(qtyTags(working(), formatQty(price.value, 'usdPerT'))).toEqual(['sourced']);
    expect(qtyTags(working(), formatQty(annualTonnes.value, 'mtpa'))).toEqual(['assumed']);
    expect(qtyTags(working(), formatQty(degradedOutput.value, 'fraction'))).toEqual(['assumed']);
    expect(screen.getByText('Revenue at risk, not written off: shipments can recover once the stockpile refills.')).toBeTruthy();
    const priceTag = within(working()).getByRole('button', { name: 'sourced value' });
    const priceTip = document.getElementById(priceTag.getAttribute('aria-describedby')!)!;
    expect(priceTip.textContent).toBe(register.sources.find((s) => s.id === 'worldbank-pink-sheet-oct-2026')!.title);
    // Each assumed input's reasoning is in its own popover.
    const assumedTips = within(working())
      .getAllByRole('button', { name: 'assumed value' })
      .map((t) => document.getElementById(t.getAttribute('aria-describedby')!)!.textContent);
    expect(assumedTips).toEqual([annualTonnes.provenance, degradedOutput.provenance].map((p) => (p.kind === 'assumed' ? p.reasoning : null)));
  });

  test('an overridden price shows changed-by-you', () => {
    render(<DetailPanel />);
    expect(qtyTags(working(), formatQty(register.production.price.value, 'usdPerT'))).toEqual(['sourced']);
    act(() => actions.setOverride('production.price', 120));
    expect(qtyTags(working(), formatQty(120, 'usdPerT'))).toEqual(['changed by you']);
    expect(qtyTags(working(), formatQty(register.production.annualTonnes.value, 'mtpa'))).toEqual(['assumed']);
  });

  test('deferred tonnes and revenue at risk come from the sample, tagged computed', () => {
    const sample = appStore.get().lastGood!.samples.at(-1)!;
    actions.setClock({ hour: sample.hour });
    render(<DetailPanel />);
    expect(sample.revenueAtRisk).toBeGreaterThan(0);
    const panel = screen.getByRole('region', { name: 'Production and revenue' });
    expect(qtyTags(panel, formatQty(sample.tonnesDeferred, 'tonnes'))).toEqual(['computed']);
    expect(qtyTags(panel, formatQty(sample.revenueAtRisk, 'usd'))).toEqual(['computed']);
  });
});

describe('the stockpile outlook (B1)', () => {
  const stock = shippingStock(register);
  const shipping = register.production.shippingProcess;
  /** The first hour of the run on screen for which `when` holds. */
  const firstHour = (when: (s: { stocks: Record<string, number>; processes: Record<string, string> }) => boolean) => {
    const sample = appStore.get().lastGood!.samples.find(when);
    if (!sample) throw new Error('no such hour');
    return sample.hour;
  };
  const stateLine = () => document.querySelector('[data-outlook="stockpile"]');
  const rateLine = () => document.querySelector('[data-outlook="rate"]');

  test('the stockpile is the stock rail draws on', () => {
    expect(stock.id).toBe('ore-stockpile');
  });

  test('while the stockpile is drawn on and rail is normal: days left and the rate, both computed', () => {
    actions.setScenario('s1-projection');
    const hour = firstHour((s) => s.stocks[stock.id]! < stock.capacity.value && s.stocks[stock.id]! > 0 && s.processes[shipping] === 'normal');
    act(() => actions.setClock({ hour }));
    render(<DetailPanel />);
    const days = appStore.get().lastGood!.samples[hour]!.stocks[stock.id]!;
    expect(stateLine()!.textContent).toBe(`Stockpile still feeding rail: ${formatQty(days, 'days')}computed left`);
    const perDay = (register.production.annualTonnes.value * 1e6 * register.production.price.value) / 365;
    expect(revenueAtRiskPerDay(appStore.get().lastGood!)).toBeCloseTo(perDay);
    expect(rateLine()!.textContent).toMatch(new RegExp(`^Revenue at risk once the stockpile runs dry: ≈ ${formatQty(perDay, 'usd').replace(/[$.]/g, '\\$&')}computed per day`));
    expect(qtyTags(rateLine() as HTMLElement, formatQty(perDay, 'usd'))).toEqual(['computed']);
    expect(qtyTags(rateLine() as HTMLElement, formatQty(register.production.annualTonnes.value, 'mtpa'))).toEqual(['assumed']);
    expect(qtyTags(rateLine() as HTMLElement, formatQty(register.production.price.value, 'usdPerT'))).toEqual(['sourced']);
    expect(untaggedNumbers(screen.getByRole('region', { name: 'Production and revenue' }))).toEqual([]);
  });

  test('hidden while the stockpile is full (nothing draws on it yet)', () => {
    actions.setScenario('s1-projection');
    render(<DetailPanel />);
    expect(appStore.get().lastGood!.samples[0]!.stocks[stock.id]).toBe(stock.capacity.value);
    expect(stateLine()).toBeNull();
    expect(rateLine()).toBeNull();
  });

  test('hidden once rail is degraded or stopped', () => {
    actions.setScenario('s1-projection');
    const hour = firstHour((s) => s.processes[shipping] !== 'normal');
    act(() => actions.setClock({ hour }));
    render(<DetailPanel />);
    expect(stateLine()).toBeNull();
    expect(rateLine()).toBeNull();
  });

  test('the rate follows an overridden price, still computed', () => {
    actions.setScenario('s1-projection');
    act(() => actions.setOverride('production.price', 120));
    const hour = firstHour((s) => s.stocks[stock.id]! < stock.capacity.value && s.stocks[stock.id]! > 0 && s.processes[shipping] === 'normal');
    act(() => actions.setClock({ hour }));
    render(<DetailPanel />);
    const perDay = (register.production.annualTonnes.value * 1e6 * 120) / 365;
    expect(qtyTags(rateLine() as HTMLElement, formatQty(perDay, 'usd'))).toEqual(['computed']);
    expect(qtyTags(rateLine() as HTMLElement, formatQty(120, 'usdPerT'))).toEqual(['changed by you']);
  });
});

describe('the odometer (B6)', () => {
  test('production deferred reads as one number to assistive technology, drawn as grouped cells', () => {
    const sample = appStore.get().lastGood!.samples.at(-1)!;
    actions.setClock({ hour: sample.hour });
    render(<DetailPanel />);
    const qty = document.querySelector('.odometer [data-quantity]') as HTMLElement;
    const text = formatQty(sample.tonnesDeferred, 'tonnes');
    expect(qty.querySelector('.visually-hidden')!.textContent).toBe(text);
    const cells = qty.querySelector('.odometer-cells')!;
    expect(cells.getAttribute('aria-hidden')).toBe('true');
    const digits = String(Math.round(sample.tonnesDeferred));
    const all = [...cells.querySelectorAll('.odometer-cell')];
    expect(all.length).toBe(Math.max(8, digits.length));
    expect(all.filter((c) => c.classList.contains('is-lit')).map((c) => c.textContent).join('')).toBe(digits);
    // Grouped in threes from the right.
    const starts = all.flatMap((c, i) => (c.classList.contains('starts-group') ? [all.length - i] : []));
    expect(starts.every((n) => n % 3 === 0)).toBe(true);
    expect(qtyTags(qty.parentElement!, text)).toEqual(['computed']);
  });

  test('zero tonnes lights only the last cell', () => {
    render(<DetailPanel />);
    const lit = [...document.querySelectorAll('.odometer .odometer-cell.is-lit')];
    expect(lit.map((c) => c.textContent)).toEqual(['0']);
  });
});

describe('AreaPanel', () => {
  const area = () => screen.getByRole('region', { name: /^Area:/ });
  const whyStops = () => screen.getByRole('list', { name: 'Why this stops' });

  test('why-this-stops names hosted-erp-driven loss for diesel-ordering at s1-projection hour 100 unprepared', () => {
    actions.setScenario('s1-projection');
    actions.setClock({ hour: 100 });
    actions.select('diesel-ordering');
    render(<DetailPanel />);
    expect(within(area()).getByRole('heading', { name: 'Diesel ordering' })).toBeTruthy();
    expect(within(area()).getByText('Stopped')).toBeTruthy();
    const items = within(whyStops()).getAllByRole('listitem');
    expect(items.map((i) => i.textContent)).toEqual([`${serviceName('hosted-erp')}: Down`]);
  });

  test('the "why" heading follows the area state (finish B8)', () => {
    actions.setScenario('s1-projection');
    const samples = appStore.get().lastGood!.samples;
    const heading = () => within(area()).getByRole('heading', { level: 3, name: /^Why/ }).textContent;
    for (const [state, title] of [
      ['normal', 'Why it is running'],
      ['degraded', 'Why it is degraded'],
      ['stopped', 'Why this stops'],
    ] as const) {
      const hour = samples.find((s) => s.processes['diesel-ordering'] === state)!.hour;
      act(() => actions.setClock({ hour }));
      act(() => actions.select('diesel-ordering'));
      const { unmount } = render(<DetailPanel />);
      expect(heading()).toBe(title);
      unmount();
    }
  });

  test('why-this-stops says nothing is down at hour 0', () => {
    render(<DetailPanel />);
    expect(screen.getByText("Nothing on this process's dependencies is down at this hour.")).toBeTruthy();
  });

  test('independent copy reads yes on prepared via independent-erp-restore for diesel-ordering', () => {
    actions.select('diesel-ordering');
    render(<DetailPanel />);
    const copy = () => within(area()).getByTestId('independent-copy');
    expect(copy().textContent).toBe('No');
    act(() => actions.setVariant('prepared'));
    const control = register.controls.find((c) => c.id === 'independent-erp-restore')!;
    expect(copy().textContent).toBe(`Yes, via ${control.name}`);
  });

  test('after a failed recompute the copy row follows the run shown, not the store variant', () => {
    actions.select('diesel-ordering');
    render(<DetailPanel />);
    // setOverride refuses a failing value, so put one in place directly to make the next run fail.
    act(() => appStore.set({ overrides: { 'production.price': -3 } }));
    act(() => actions.setVariant('prepared'));
    expect(appStore.get().issues).not.toEqual([]);
    expect(appStore.get().variant).toBe('prepared');
    expect(appStore.get().lastGood!.variant).toBe('unprepared');
    expect(within(area()).getByTestId('independent-copy').textContent).toBe('No');
  });

  test('why-this-stops explains a post-restore hold for diesel-ordering after hosted-erp comes back', () => {
    actions.setScenario('s1-projection');
    const timeline = appStore.get().lastGood!;
    const up = timeline.events.find((e) => e.kind === 'service-up' && e.subject === 'hosted-erp')!;
    actions.setClock({ hour: up.hour + 1 });
    actions.select('diesel-ordering');
    render(<DetailPanel />);
    expect(timeline.samples[up.hour + 1]!.processes['diesel-ordering']).not.toBe('normal');
    const dep = register.processes.find((p) => p.id === 'diesel-ordering')!.dependsOn.find((d) => d.on === 'hosted-erp')!;
    const hold = timeline.assumptionsUsed['processes.diesel-ordering.dependsOn.hosted-erp.afterRestore.holdFor']!;
    const items = within(whyStops()).getAllByRole('listitem');
    expect(items).toHaveLength(1);
    expect(items[0]!.textContent).toContain(`${serviceName('hosted-erp')}: Back up — ${dep.afterRestore!.description}`);
    expect(qtyTags(items[0]!, formatQty(hold.value, 'hours'))).toEqual([hold.provenance.kind]);
    expect(screen.queryByText("Nothing on this process's dependencies is down at this hour.")).toBeNull();
  });

  test('continuity targets come from the run, marking an override', () => {
    actions.select('haulage');
    render(<DetailPanel />);
    const continuity = () => screen.getByRole('list', { name: 'Continuity' });
    const mto = register.processes.find((p) => p.id === 'haulage')!.continuity.maxTolerableOutage;
    expect(qtyTags(continuity(), formatQty(mto.value, 'hours'))).toEqual([mto.provenance.kind]);
    act(() => actions.setOverride('processes.haulage.continuity.maxTolerableOutage', 6));
    expect(qtyTags(continuity(), formatQty(6, 'hours'))).toEqual(['changed by you']);
  });

  test('the fleet row shows eight trucks for haulage only, parked ones marked, with no count', () => {
    actions.setScenario('s1-projection');
    actions.setClock({ hour: 300 });
    render(<DetailPanel />);
    expect(appStore.get().lastGood!.samples[300]!.processes.haulage).toBe('stopped');
    const fleet = within(area()).getByTestId('fleet');
    expect(fleet.querySelectorAll('[data-truck]')).toHaveLength(8);
    expect(fleet.querySelectorAll('[data-truck="parked"]')).toHaveLength(8);
    expect(fleet.textContent).not.toMatch(/\d/);
    expect(fleet.getAttribute('aria-label')).not.toMatch(/\d/);

    act(() => actions.select('crushing'));
    expect(within(area()).queryByTestId('fleet')).toBeNull();
  });

  test('depends-on lists every dependency with its live state and onLoss', () => {
    actions.select('haulage');
    render(<DetailPanel />);
    const rows = within(screen.getByRole('list', { name: 'Depends on' })).getAllByRole('listitem');
    expect(rows).toHaveLength(register.processes.find((p) => p.id === 'haulage')!.dependsOn.length);
    expect(rows[0]!.textContent).toContain('Diesel in the fuel farm');
    expect(rows[0]!.textContent).toContain('Stops on loss');
  });

  // About 750 renders: past the 5 s default when the whole suite runs in parallel.
  test('no untagged numbers in the panel', () => {
    const scenarios = register.scenarios.map((s) => s.id);
    const variants: Variant[] = ['unprepared', 'prepared'];
    const { container } = render(<DetailPanel />);
    for (const scenario of scenarios) {
      for (const variant of variants) {
        act(() => {
          actions.setScenario(scenario);
          actions.setVariant(variant);
        });
        const last = appStore.get().lastGood!.samples.length - 1;
        for (const hour of [0, 60, 100, 200, last]) {
          for (const p of register.processes) {
            act(() => {
              actions.setClock({ hour });
              actions.select(p.id);
            });
            expect({ scenario, variant, hour, process: p.id, found: untaggedNumbers(container) }).toEqual({
              scenario,
              variant,
              hour,
              process: p.id,
              found: [],
            });
          }
        }
      }
    }
  }, 30_000);
});
