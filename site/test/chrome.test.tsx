import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { register } from '../src/model/register.js';
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

  test('under the title, the public source the scenario is modelled on, tagged sourced (finish B7)', () => {
    actions.setScenario('s1-as-reported');
    const { container } = render(<TopBar />);
    const scenario = register.scenarios.find((s) => s.id === 's1-as-reported')!;
    const source = register.sources.find((s) => s.id === scenario.basis[0])!;
    const line = container.querySelector('.top-bar-basis')!;
    expect(line.querySelector(".top-bar-basis-text")!.textContent).toBe(`Modelled on ${source.title}`);
    expect(line.querySelector('cite')!.textContent).toBe(source.title);
    const tag = within(line as HTMLElement).getByRole('button', { name: 'sourced value' });
    expect(document.getElementById(tag.getAttribute('aria-describedby')!)!.textContent).toBe(source.title);
    expect(untaggedNumbers(container)).toEqual([]);
  });

  test('a scenario that only draws on its source reads "Based on" (ruling R-aa)', () => {
    actions.setScenario('s4-precautionary-isolation');
    const { container } = render(<TopBar />);
    const source = register.sources.find((s) => s.id === register.scenarios.find((x) => x.id === 's4-precautionary-isolation')!.basis[0])!;
    expect(container.querySelector('.top-bar-basis-text')!.textContent).toBe(`Based on ${source.title}`);
    act(() => actions.setScenario('s1-as-reported'));
    expect(container.querySelector('.top-bar-basis-text')!.textContent).toMatch(/^Modelled on /);
  });

  test('the s1 projection reads "Based on": it extends the record counterfactually (final review I4, ruling R-aa)', () => {
    actions.setScenario('s1-projection');
    const { container } = render(<TopBar />);
    const source = register.sources.find((s) => s.id === register.scenarios.find((x) => x.id === 's1-projection')!.basis[0])!;
    expect(container.querySelector('.top-bar-basis-text')!.textContent).toBe(`Based on ${source.title}`);
    act(() => actions.setScenario('s1-as-reported'));
    expect(container.querySelector('.top-bar-basis-text')!.textContent).toBe(`Modelled on ${source.title}`);
  });

  test('free play has no modelled-on line', () => {
    actions.enterFreePlay();
    actions.addCut({ service: 'iroc-link', atDays: 0, forDays: 2 });
    const { container } = render(<TopBar />);
    expect(container.querySelector('.top-bar-basis')).toBeNull();
  });

  test('each badge carries its line glyph, dashed for the projection', () => {
    actions.setScenario('s1-projection');
    render(<TopBar />);
    const glyph = (name: string) => screen.getByText(name).closest('.badge')!.querySelector('svg.badge-glyph');
    const fictional = glyph('Fictional model site');
    const projection = glyph('Projection');
    expect(fictional?.getAttribute('aria-hidden')).toBe('true');
    expect(projection?.getAttribute('aria-hidden')).toBe('true');
    expect(fictional!.querySelector('[stroke-dasharray]')).toBeNull();
    expect(projection!.querySelector('[stroke-dasharray]')).not.toBeNull();
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

  test('after a failed override, a scenario switch shows that run\'s title and badge', () => {
    render(<TopBar />);
    act(() => actions.setOverride('production.degradedOutput', 1.5));
    act(() => actions.setScenario('s1-as-reported'));
    expect(screen.getByText('Hosted ERP lost (as reported)')).toBeTruthy();
    expect(screen.queryByText('Projection')).toBeNull();
    act(() => actions.setVariant('prepared'));
    expect(screen.getByRole('button', { name: 'Prepared' }).getAttribute('aria-pressed')).toBe('true');
    expect(appStore.get().lastGood?.variant).toBe('prepared');
  });

  test('title, badge and variant render from the last good run, not the requested one', () => {
    render(<TopBar />);
    // A run that fails: the store keeps the s1 projection, unprepared, on screen.
    act(() => {
      appStore.set({ overrides: { 'production.price': -1 } });
      actions.setScenario('s1-as-reported');
      actions.setVariant('prepared');
    });
    expect(appStore.get().issues).not.toEqual([]);
    expect(appStore.get().spec).toEqual({ kind: 'register', scenarioId: 's1-as-reported' });
    expect(screen.getByText('Hosted ERP lost: what if the workarounds ran out')).toBeTruthy();
    expect(screen.getByText('Projection')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Unprepared' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Prepared' }).getAttribute('aria-pressed')).toBe('false');
  });

  test('the variant toggle is disabled during the guided run', () => {
    actions.startGuided();
    render(<TopBar />);
    const prepared = screen.getByRole('button', { name: 'Prepared' }) as HTMLButtonElement;
    expect(prepared.disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Unprepared' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(prepared);
    expect(appStore.get().variant).toBe('unprepared');
    act(() => actions.enterFreePlay());
    expect(prepared.disabled).toBe(false);
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
  test('the vendor card is one card: one status, and a keyed Cut button per vendor named for it', () => {
    render(<>{cards()}</>);
    const vendor = card('vendor-access');
    expect(vendor.querySelectorAll('.service-card-name')).toHaveLength(1);
    expect(within(vendor).getByText('Up')).toBeTruthy();
    const buttons = within(vendor).getAllByRole('button');
    expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual([`Cut ${serviceName('vendor-a-access')}`, `Cut ${serviceName('vendor-b-access')}`]);
    expect(buttons.map((b) => b.textContent)).toEqual(['A', 'B']);
    expect(buttons.map((b) => b.getAttribute('title'))).toEqual([serviceName('vendor-a-access'), serviceName('vendor-b-access')]);
  });

  test('each card has its own line icon, hidden from assistive technology, slashed when cut', () => {
    actions.setScenario('s1-projection');
    const { container } = render(<>{cards()}</>);
    const icons = [...container.querySelectorAll('svg.service-icon')];
    expect(icons.map((i) => i.getAttribute('data-icon'))).toEqual(SERVICE_GROUPS.map((g) => g.id));
    expect(new Set(icons.map((i) => i.querySelector('g')!.innerHTML)).size).toBe(SERVICE_GROUPS.length);
    for (const i of icons) expect(i.getAttribute('aria-hidden')).toBe('true');
    const slashed = icons.filter((i) => i.querySelector('[stroke="var(--stop-red)"]')).map((i) => i.getAttribute('data-icon'));
    expect(slashed).toEqual(['hosted-erp']);
  });

  test('once a cut has ended the card says when it was restored and offers to remove the cut', () => {
    actions.enterFreePlay();
    const run = appStore.get().lastGood!;
    const up = run.events.find((e) => e.kind === 'service-up' && e.subject === 'hosted-erp')!;
    actions.setClock({ hour: up.hour + 5 });
    const { container } = render(<>{cards()}</>);
    const erp = card('hosted-erp');
    expect(within(erp).getByText(/^Restored/).textContent).toBe(`Restored day ${Math.floor(up.hour / 24)}`);
    expect(within(erp).queryByText('Up')).toBeNull();
    const remove = within(erp).getByRole('button', { name: 'Remove cut: Hosted ERP' });
    expect(remove.textContent).toBe('Remove cut');
    expect(remove.getAttribute('aria-pressed')).toBe('true');
    expect(within(erp).queryByRole('button', { name: /^Restore/ })).toBeNull();
    expect(untaggedNumbers(container)).toEqual([]);
    fireEvent.click(remove);
    expect(appStore.get().spec).toEqual({ kind: 'free', cuts: [], workaroundsHold: false });
    expect(within(erp).getByRole('button', { name: 'Cut Hosted ERP' })).toBeTruthy();
  });

  test("an inherited outage's end is not the card's own restore (D7)", () => {
    actions.enterFreePlay();
    actions.removeCut(0);
    actions.addCut({ service: 'corporate-network', atDays: 0, forDays: 5 });
    actions.addCut({ service: 'hosted-erp', atDays: 6, forDays: 1 });
    // Hour 130: the corporate network (and with it the ERP) came back at day 5; the ERP's own cut starts at day 6.
    actions.setClock({ hour: 130 });
    render(<>{cards()}</>);
    const erp = card('hosted-erp');
    expect(within(erp).queryByText(/^Restored/)).toBeNull();
    expect(within(erp).getByText(/^Cut from/).textContent).toBe('Cut from day 6');
    act(() => actions.setClock({ hour: 200 }));
    expect(within(erp).getByText(/^Restored/).textContent).toBe('Restored day 7');
  });

  test('a cut that has not started yet reads "Cut from day N", with Remove cut', () => {
    actions.enterFreePlay();
    actions.setClock({ hour: 50 });
    render(<>{cards()}</>);
    fireEvent.click(within(card('cloud-identity')).getByRole('button', { name: /^Cut/ }));
    act(() => actions.setClock({ hour: 10 }));
    const cloud = card('cloud-identity');
    expect(within(cloud).getByText(/^Cut from/).textContent).toBe('Cut from day 2');
    expect(within(cloud).getByRole('button', { name: /^Remove cut: / }).textContent).toBe('Remove cut');
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
    expect(within(cloud).getByText(/Cut since/).textContent).toBe('Cut since day 2');
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
    expect(within(card('hosted-erp')).getByText(/Cut since/).textContent).toBe('Cut since day 0');
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
    expect(within(card('corporate-network')).getByText(/Cut since/).textContent).toBe('Cut since day 0');
    for (const id of ['hosted-erp', 'cloud-identity', 'iroc-link'])
      expect(within(card(id)).getByText('Down via Corporate network')).toBeTruthy();
    expect(untaggedNumbers(container)).toEqual([]);

    cleanup();
    actions.setScenario('s3-vendor-setpoint');
    actions.setVariant('prepared');
    actions.setClock({ hour: 12 });
    render(<>{cards()}</>);
    const vendor = card('vendor-access');
    const lines = [...vendor.querySelectorAll('.service-row-status')].map((l) => l.textContent);
    expect(lines).toEqual(['Vendor A Access revoked', 'Vendor B Up']);
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
