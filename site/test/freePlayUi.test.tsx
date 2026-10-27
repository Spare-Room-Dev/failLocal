import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { register } from '../src/model/register.js';
import { serviceName } from '../src/model/serviceGroups.js';
import { actions, appStore, initialAppState } from '../src/model/store.js';
import { FreePlay } from '../src/ui/FreePlay.js';
import { TopBar } from '../src/ui/TopBar.js';
import { untaggedNumbers } from './helpers/untagged.js';

beforeEach(() => {
  appStore.set(initialAppState());
  actions.enterFreePlay();
});
afterEach(cleanup);

const picker = () => screen.getByRole('combobox', { name: 'Scenario' }) as HTMLSelectElement;
const optionLabels = () => [...picker().options].map((o) => o.textContent);
const cutRows = () => screen.queryAllByRole('group', { name: /^Cut:/ });
const startInput = (row: HTMLElement) => within(row).getByRole('spinbutton', { name: 'Start day' }) as HTMLInputElement;
const lengthInput = (row: HTMLElement) => within(row).getByRole('spinbutton', { name: 'Days cut' }) as HTMLInputElement;
const freeCuts = () => {
  const { spec } = appStore.get();
  if (spec.kind !== 'free') throw new Error('spec is not free');
  return spec.cuts;
};

describe('FreePlay', () => {
  test('variant toggle keeps free-play cuts', () => {
    render(
      <>
        <TopBar />
        <FreePlay />
      </>,
    );
    act(() => actions.addCut({ service: 'iroc-link', atDays: 1, forDays: 2 }));
    expect(cutRows().map((r) => r.getAttribute('aria-label'))).toEqual([
      'Cut: Hosted ERP',
      `Cut: ${serviceName('iroc-link')}`,
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'Prepared' }));
    const s = appStore.get();
    expect(s.lastGood?.variant).toBe('prepared');
    expect(freeCuts()).toEqual([
      { service: 'hosted-erp', atDays: 0, forDays: 12 },
      { service: 'iroc-link', atDays: 1, forDays: 2 },
    ]);
    expect(s.lastGood?.events.some((e) => e.kind === 'service-down' && e.subject === 'iroc-link')).toBe(true);
    expect(cutRows()).toHaveLength(2);
  });

  test('scenario picker switches and resets the clock', () => {
    render(<FreePlay />);
    expect(optionLabels()).toEqual(register.scenarios.map((s) => s.title));
    expect(picker().value).toBe('s1-projection');
    act(() => actions.setClock({ hour: 100, playing: true }));
    fireEvent.change(picker(), { target: { value: 's2-iroc-lost' } });
    const s = appStore.get();
    expect(s.spec).toEqual({ kind: 'register', scenarioId: 's2-iroc-lost' });
    expect(s.clock).toMatchObject({ hour: 0, playing: false });
    expect(s.lastGood?.scenarioId).toBe('s2-iroc-lost');
  });

  test('"Your scenario" is listed and selected once the spec is free', () => {
    render(<FreePlay />);
    act(() => actions.addCut({ service: 'iroc-link', atDays: 0, forDays: 1 }));
    expect(optionLabels()).toEqual([...register.scenarios.map((s) => s.title), 'Your scenario']);
    expect(picker().selectedOptions[0]!.textContent).toBe('Your scenario');
  });

  test('a register scenario shows its own cuts; editing one starts free play from them', () => {
    render(<FreePlay />);
    const [row] = cutRows();
    expect(startInput(row!).value).toBe('0');
    expect(lengthInput(row!).value).toBe('12');
    fireEvent.change(lengthInput(row!), { target: { value: '5' } });
    expect(freeCuts()).toEqual([{ service: 'hosted-erp', atDays: 0, forDays: 5 }]);
    expect(appStore.get().overrides).toEqual({});
  });

  test('cut days outside their bounds are ignored', () => {
    act(() => actions.addCut({ service: 'iroc-link', atDays: 10, forDays: 2 }));
    render(<FreePlay />);
    const row = cutRows()[1]!;
    expect(startInput(row).min).toBe('0');
    expect(startInput(row).max).toBe('398');
    expect(lengthInput(row).min).toBe('1');
    expect(lengthInput(row).max).toBe('390');
    for (const value of ['', '-1', '399']) fireEvent.change(startInput(row), { target: { value } });
    for (const value of ['', '0', '391']) fireEvent.change(lengthInput(row), { target: { value } });
    expect(freeCuts()[1]).toEqual({ service: 'iroc-link', atDays: 10, forDays: 2 });
    fireEvent.change(startInput(row), { target: { value: '398' } });
    expect(freeCuts()[1]).toEqual({ service: 'iroc-link', atDays: 398, forDays: 2 });
  });

  test('remove drops the cut', () => {
    act(() => actions.addCut({ service: 'iroc-link', atDays: 1, forDays: 2 }));
    render(<FreePlay />);
    fireEvent.click(within(cutRows()[0]!).getByRole('button', { name: 'Remove' }));
    expect(freeCuts()).toEqual([{ service: 'iroc-link', atDays: 1, forDays: 2 }]);
    expect(cutRows()).toHaveLength(1);
  });

  test('vendor cuts are told apart by service', () => {
    act(() => actions.setScenario('s2-iroc-lost'));
    act(() => actions.addCut({ service: 'vendor-a-access', atDays: 0, forDays: 1 }));
    render(<FreePlay />);
    expect(cutRows().map((r) => r.getAttribute('aria-label'))).toContain(`Cut: ${serviceName('vendor-a-access')}`);
  });

  test('workarounds checkbox defaults off and sets workaroundsHold', () => {
    render(<FreePlay />);
    const box = screen.getByRole('checkbox', { name: 'Workarounds keep going' }) as HTMLInputElement;
    expect(box.checked).toBe(false);
    fireEvent.click(box);
    expect(box.checked).toBe(true);
    const { spec } = appStore.get();
    expect(spec).toMatchObject({ kind: 'free', workaroundsHold: true });
  });

  test('the checkbox mirrors a register scenario whose workarounds hold', () => {
    const holding = register.scenarios.find((s) => s.workaroundsHold);
    if (!holding) throw new Error('the register has no scenario whose workarounds hold');
    act(() => actions.setScenario(holding.id));
    render(<FreePlay />);
    expect((screen.getByRole('checkbox', { name: 'Workarounds keep going' }) as HTMLInputElement).checked).toBe(true);
  });

  test('reset returns to the default free play and clears overrides', () => {
    act(() => actions.addCut({ service: 'iroc-link', atDays: 1, forDays: 2 }));
    act(() => actions.setOverride('production.price', 120));
    act(() => actions.setVariant('prepared'));
    render(<FreePlay />);
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    const s = appStore.get();
    expect(s).toMatchObject({ mode: 'free', spec: { kind: 'register', scenarioId: 's1-projection' }, variant: 'unprepared', overrides: {} });
    expect(s.lastGood?.assumptionsUsed['production.price']?.overridden).toBe(false);
  });

  test('a scenario with a compromise event notes that free play is cuts only', () => {
    const note = "Vendor tampering isn't editable in free play; cuts only.";
    render(<FreePlay />);
    expect(screen.queryByText(note)).toBeNull();
    act(() => actions.setScenario('s3-vendor-setpoint'));
    expect(screen.getByText(note)).toBeTruthy();
  });

  test('renders nothing outside free play', () => {
    appStore.set(initialAppState());
    const { container } = render(<FreePlay />);
    expect(container.innerHTML).toBe('');
  });

  test('no untagged numbers', () => {
    act(() => actions.addCut({ service: 'iroc-link', atDays: 1, forDays: 2 }));
    const { container } = render(<FreePlay />);
    expect(untaggedNumbers(container)).toEqual([]);
  });
});
