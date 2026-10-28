import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { formatQty } from '../src/model/format.js';
import { HOLD_PATH, HOLDS_FOR_PATH, caveatInputs } from '../src/model/guided.js';
import { register } from '../src/model/register.js';
import { deriveRun } from '../src/model/run.js';
import { actions, appStore, initialAppState } from '../src/model/store.js';
import { GuidedRun } from '../src/ui/GuidedRun.js';
import { LimitsPage } from '../src/ui/pages/LimitsPage.js';
import { untaggedNumbers } from './helpers/untagged.js';

beforeEach(() => {
  vi.useFakeTimers();
  appStore.set(initialAppState());
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

/** The base s1 projection, unprepared, with no overrides: the run both caveats describe. */
function baseRun() {
  const result = deriveRun(register, { spec: { kind: 'register', scenarioId: 's1-projection' }, variant: 'unprepared', overrides: {} });
  if (!result.ok) throw new Error('s1-projection does not run');
  return result.timeline;
}

function guidedCaveat(): HTMLElement {
  const { container } = render(<GuidedRun />);
  act(() => actions.startGuided());
  for (let t = 0; t < 120_000 && !container.querySelector('[data-step="comparison"]'); t += 50) act(() => vi.advanceTimersByTime(50));
  return container.querySelector<HTMLElement>('[data-step="comparison"] .assumption-caveat')!;
}

/** The text a reader sees: without the tags' popovers (an assumed tag carries its reasoning in one). */
function shownText(el: Element): string {
  const copy = el.cloneNode(true) as Element;
  for (const tip of copy.querySelectorAll('[role="tooltip"]')) tip.remove();
  return copy.textContent ?? '';
}

function limitsCaveat(): HTMLElement {
  const { container } = render(<LimitsPage />);
  return container.querySelector<HTMLElement>('.assumption-caveat')!;
}

describe('AssumptionCaveat', () => {
  test('reads both assumed numbers from the base run', () => {
    const used = baseRun().assumptionsUsed;
    expect(caveatInputs(register)).toEqual(used);
    expect(used[HOLDS_FOR_PATH]?.provenance.kind).toBe('assumed');
    expect(used[HOLD_PATH]?.provenance.kind).toBe('assumed');
  });

  test('the guided comparison card and the Limitations page say the same, with both values tagged', () => {
    const used = baseRun().assumptionsUsed;
    const holdsFor = used[HOLDS_FOR_PATH]!;
    const holdFor = used[HOLD_PATH]!;
    const expected =
      `This projection rests on two assumed numbers: phone-and-email ordering keeps going for ${formatQty(holdsFor.value, 'days')}assumed ` +
      `and new orders are held for ${formatQty(holdFor.value, 'hours')}assumed after the ERP is back. ` +
      'Change either and the figure changes; see the decision log.';

    const limits = limitsCaveat();
    const limitsText = shownText(limits);
    expect(limitsText).toBe(expected);
    expect([...limits.querySelectorAll('[data-quantity]')].map(shownText)).toEqual([
      `${formatQty(holdsFor.value, 'days')}assumed`,
      `${formatQty(holdFor.value, 'hours')}assumed`,
    ]);
    expect(limits.querySelectorAll('.qty-tag--assumed')).toHaveLength(2);
    expect(untaggedNumbers(limits)).toEqual([]);
    cleanup();

    const guided = guidedCaveat();
    expect(shownText(guided)).toBe(limitsText);
    expect(guided.querySelectorAll('.qty-tag--assumed')).toHaveLength(2);
    expect(untaggedNumbers(guided)).toEqual([]);
  });

  test('the Limitations caveat carries the same "Draft copy" marker as the guided run', () => {
    const { container } = render(<LimitsPage />);
    const item = container.querySelector('.assumption-caveat')!.closest('li')!;
    const marker = item.querySelector('.draft-marker');
    expect(marker?.textContent).toBe('Draft copy');
    cleanup();
    const guided = guidedCaveat().closest('[data-step="comparison"]')!;
    expect(guided.querySelector('.draft-marker')?.textContent).toBe('Draft copy');
  });

  test('prints no threshold figure', () => {
    expect(limitsCaveat().textContent).not.toMatch(/10 hours|9 days/);
  });

  test("the comparison card's labels sit inside the Draft copy marker", () => {
    guidedCaveat();
    const draft = document.querySelector('[data-step="comparison"] .guided-draft-region')!;
    expect(draft.querySelector('.draft-marker')?.textContent).toBe('Draft copy');
    expect(draft.querySelector('.guided-totals')).not.toBeNull();
    expect(draft.querySelector('.assumption-caveat')).not.toBeNull();
  });
});
