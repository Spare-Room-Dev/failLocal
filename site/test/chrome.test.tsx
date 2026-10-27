import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { SERVICE_GROUPS, serviceName } from '../src/model/serviceGroups.js';
import { actions, appStore, initialAppState } from '../src/model/store.js';
import { Legend } from '../src/ui/Legend.js';
import { ServiceCard } from '../src/ui/ServiceCard.js';
import { TopBar } from '../src/ui/TopBar.js';
import { untaggedNumbers } from './helpers/untagged.js';

beforeEach(() => appStore.set(initialAppState()));
afterEach(cleanup);

const group = (id: string) => SERVICE_GROUPS.find((g) => g.id === id)!;
const card = (id: string) => screen.getByRole('group', { name: group(id).name });
const cards = () => SERVICE_GROUPS.map((g) => <ServiceCard key={g.id} group={g} />);

describe('TopBar', () => {
  test('projection badge follows the timeline', () => {
    actions.setScenario('s1-projection');
    render(<TopBar />);
    expect(screen.getByText('Fictional model site')).toBeTruthy();
    expect(screen.getByText('Projection')).toBeTruthy();
    expect(screen.getByText('Hosted ERP lost: what if the workarounds ran out')).toBeTruthy();

    act(() => actions.setScenario('s1-as-reported'));
    expect(screen.queryByText('Projection')).toBeNull();
    expect(screen.getByText('Hosted ERP lost (as reported)')).toBeTruthy();
  });

  test('variant toggle updates the store', () => {
    render(<TopBar />);
    const unprepared = screen.getByRole('button', { name: 'Unprepared' });
    const prepared = screen.getByRole('button', { name: 'Prepared' });
    expect(unprepared.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(prepared);
    expect(appStore.get().variant).toBe('prepared');
    expect(appStore.get().lastGood?.variant).toBe('prepared');
    expect(prepared.getAttribute('aria-pressed')).toBe('true');
    expect(unprepared.getAttribute('aria-pressed')).toBe('false');
  });

  test('a free-play run is titled "Your scenario"', () => {
    actions.enterFreePlay();
    actions.addCut({ service: 'iroc-link', atDays: 0, forDays: 2 });
    const { container } = render(<TopBar />);
    expect(screen.getByText('Your scenario')).toBeTruthy();
    expect(screen.getByText('Projection')).toBeTruthy();
    expect(untaggedNumbers(container)).toEqual([]);
  });
});

describe('ServiceCard', () => {
  test('the vendor card labels its rows Vendor A and Vendor B, keeping the register names for tooltips and buttons', () => {
    render(<>{cards()}</>);
    const vendor = card('vendor-access');
    const rows = [...vendor.querySelectorAll('.service-row-name')];
    expect(rows.map((r) => r.textContent)).toEqual(['Vendor A', 'Vendor B']);
    expect(rows.map((r) => r.getAttribute('title'))).toEqual([serviceName('vendor-a-access'), serviceName('vendor-b-access')]);
    expect(within(vendor).getByRole('button', { name: `Cut ${serviceName('vendor-a-access')}` })).toBeTruthy();
  });

  test('cut in free play adds a cut and the card shows Restore with aria-pressed', () => {
    actions.enterFreePlay();
    actions.setClock({ hour: 50 });
    render(<>{cards()}</>);
    const cloud = card('cloud-identity');
    expect(within(cloud).getByText('Up')).toBeTruthy();
    fireEvent.click(within(cloud).getByRole('button', { name: /Cut/ }));

    expect(appStore.get().spec).toEqual({
      kind: 'free',
      cuts: [
        { service: 'hosted-erp', atDays: 0, forDays: 12 },
        { service: 'cloud-identity', atDays: 2, forDays: 12 },
      ],
      workaroundsHold: false,
    });
    const restore = within(cloud).getByRole('button', { name: /Restore/ });
    expect(restore.getAttribute('aria-pressed')).toBe('true');
    expect(cloud.getAttribute('data-cut')).toBe('true');
    expect(within(cloud).getByText(/Cut since day/).textContent).toBe('Cut since day 2');
    expect(within(cloud).getByText('2').closest('[data-clock]')).toBeTruthy();

    fireEvent.click(restore);
    expect(appStore.get().spec).toMatchObject({ kind: 'free', cuts: [{ service: 'hosted-erp' }] });
    expect(within(cloud).getByRole('button', { name: /Cut/ }).getAttribute('aria-pressed')).toBe('false');
    expect(within(cloud).getByText('Up')).toBeTruthy();
  });

  test('cards are read-only during the guided run', () => {
    actions.startGuided();
    render(<>{cards()}</>);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(6);
    for (const b of buttons) expect((b as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(within(card('iroc-link')).getByRole('button'));
    expect(appStore.get().spec).toEqual({ kind: 'register', scenarioId: 's1-projection' });
    expect(within(card('hosted-erp')).getByText(/Cut since day/).textContent).toBe('Cut since day 0');
  });

  test("a guided card reads the scenario's own cut as pressed, still disabled", () => {
    actions.startGuided();
    render(<>{cards()}</>);
    const erp = within(card('hosted-erp')).getByRole('button', { name: /Restore/ });
    expect(erp.getAttribute('aria-pressed')).toBe('true');
    expect((erp as HTMLButtonElement).disabled).toBe(true);
    expect(within(card('iroc-link')).getByRole('button', { name: /Cut/ }).getAttribute('aria-pressed')).toBe('false');
  });

  test("restoring a scenario's cut in free play keeps the rest of the scenario", () => {
    actions.enterFreePlay();
    render(<>{cards()}</>);
    fireEvent.click(within(card('hosted-erp')).getByRole('button', { name: /Restore/ }));
    expect(appStore.get().spec).toEqual({ kind: 'free', cuts: [], workaroundsHold: false });
    expect(within(card('hosted-erp')).getByText('Up')).toBeTruthy();
  });

  test('an inherited outage names its cause, and each vendor row keeps its own status', () => {
    actions.setScenario('s4-precautionary-isolation');
    const { container } = render(<>{cards()}</>);
    expect(within(card('corporate-network')).getByText(/Cut since day/).textContent).toBe('Cut since day 0');
    for (const id of ['hosted-erp', 'cloud-identity', 'iroc-link'])
      expect(within(card(id)).getByText('Down via Corporate network')).toBeTruthy();
    expect(untaggedNumbers(container)).toEqual([]);

    cleanup();
    actions.setScenario('s3-vendor-setpoint');
    actions.setVariant('prepared');
    actions.setClock({ hour: 12 });
    render(<>{cards()}</>);
    const vendor = card('vendor-access');
    expect(within(vendor).getByText('Access revoked')).toBeTruthy();
    expect(within(vendor).getByText('Up')).toBeTruthy();
    expect(within(vendor).getAllByRole('button')).toHaveLength(2);
  });
});

describe('Legend', () => {
  test('legend names shapes', () => {
    const { container } = render(<Legend />);
    for (const shape of ['open pennant', 'half flag', 'full flag, hatched ground', 'parked marker', 'severed cable'])
      expect(screen.getByText(shape)).toBeTruthy();
    for (const flag of ['pennant', 'half', 'full']) expect(container.querySelector(`[data-flag="${flag}"]`)).toBeTruthy();
    expect(container.querySelector('[data-hatched]')).toBeTruthy();
    expect(container.querySelector('[data-parked]')).toBeTruthy();
    expect(container.querySelector('[data-break]')).toBeTruthy();
    expect(container.textContent).not.toMatch(/\b(red|amber|yellow|green|khaki|grey|white)\b/i);
  });
});
