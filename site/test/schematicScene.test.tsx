import { simulate } from '@faillocal/engine';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';
import { register } from '../src/model/register.js';
import { sceneState } from '../src/model/sceneState.js';
import { SchematicScene } from '../src/ui/scene/SchematicScene.js';
import { untaggedNumbers } from './helpers/untagged.js';

afterEach(cleanup);

const timeline = simulate(register, 's1-projection', 'unprepared');
const sceneAt = (hour: number) => sceneState(register, timeline.samples.find((s) => s.hour === hour)!);

/** What the schematic draws beyond the scene contract (sceneContract.test.tsx). */
describe('SchematicScene', () => {
  test('each area shows its state word, flag and hatching', () => {
    render(<SchematicScene scene={sceneAt(300)} selected={null} onSelect={() => {}} reducedMotion={false} />);
    const haulage = screen.getByRole('button', { name: /^Haulage/ });
    expect(within(haulage).getByText('Stopped')).toBeTruthy();
    expect(haulage.querySelector('[data-flag="full"]')).toBeTruthy();
    expect(haulage.querySelector('[data-hatched]')).toBeTruthy();
    const payroll = screen.getByRole('button', { name: /^Payroll/ });
    expect(within(payroll).getByText('Normal')).toBeTruthy();
    expect(payroll.querySelector('[data-flag="pennant"]')).toBeTruthy();
  });

  test('a severed cable is drawn broken; a live one is whole', () => {
    const { container } = render(<SchematicScene scene={sceneAt(0)} selected={null} onSelect={() => {}} reducedMotion={false} />);
    expect(container.querySelector('[data-cable-group="hosted-erp"]')?.getAttribute('data-cable-state')).toBe('severed');
    expect(container.querySelector('[data-cable-group="hosted-erp"] [data-break]')).toBeTruthy();
    expect(container.querySelector('[data-cable-group="iroc-link"]')?.getAttribute('data-cable-state')).toBe('live');
    expect(container.querySelector('[data-cable-group="iroc-link"] [data-break]')).toBeNull();
  });

  test('the schematic shows no numbers', () => {
    const { container } = render(<SchematicScene scene={sceneAt(300)} selected={null} onSelect={() => {}} reducedMotion />);
    expect(untaggedNumbers(container)).toEqual([]);
  });
});
