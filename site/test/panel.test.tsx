import { act, cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import type { Variant } from '@faillocal/engine';
import { formatQty } from '../src/model/format.js';
import { register } from '../src/model/register.js';
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
    const priceTip = within(working()).getByRole('tooltip', { hidden: true });
    expect(priceTip.textContent).toBe(register.sources.find((s) => s.id === 'worldbank-pink-sheet-oct-2026')!.title);
  });

  test('an overridden price shows changed-by-you', () => {
    render(<DetailPanel />);
    expect(qtyTags(working(), formatQty(register.production.price.value, 'usdPerT'))).toEqual(['sourced']);
    act(() => actions.setOverride('production.price', 120));
    expect(qtyTags(working(), formatQty(120, 'usdPerT'))).toEqual(['sourced', 'changed by you']);
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
    act(() => actions.setOverride('production.price', -3));
    expect(appStore.get().issues).not.toEqual([]);
    act(() => actions.setVariant('prepared'));
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
    expect(qtyTags(continuity(), formatQty(6, 'hours'))).toEqual([mto.provenance.kind, 'changed by you']);
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
  });
});
