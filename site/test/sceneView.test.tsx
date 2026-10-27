import { simulate } from '@faillocal/engine';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { register } from '../src/model/register.js';
import { sceneState } from '../src/model/sceneState.js';
import { SceneView } from '../src/ui/SceneView.js';
import { untaggedNumbers } from './helpers/untagged.js';

afterEach(cleanup);

const timeline = simulate(register, 's1-projection', 'unprepared');
const sceneAt = (hour: number) => sceneState(register, timeline.samples.find((s) => s.hour === hour)!);

describe('SceneView', () => {
  test('scene view renders a button per process area with its state word', () => {
    render(<SceneView scene={sceneAt(300)} selected={null} onSelect={() => {}} reducedMotion={false} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(register.processes.length);
    const haulage = screen.getByRole('button', { name: /^Haulage/ });
    expect(within(haulage).getByText('Stopped')).toBeTruthy();
    expect(haulage.querySelector('[data-flag="full"]')).toBeTruthy();
    expect(haulage.querySelector('[data-hatched]')).toBeTruthy();
    const payroll = screen.getByRole('button', { name: /^Payroll/ });
    expect(within(payroll).getByText('Normal')).toBeTruthy();
    expect(payroll.querySelector('[data-flag="pennant"]')).toBeTruthy();
  });

  test('scene view shows the plinth text', () => {
    render(<SceneView scene={sceneAt(0)} selected={null} onSelect={() => {}} reducedMotion={false} />);
    expect(screen.getByText('FICTIONAL MODEL SITE · PILBARA IRON ORE · SYNTHETIC DATA')).toBeTruthy();
  });

  test('areas are selectable by click, Enter and Space', () => {
    const onSelect = vi.fn();
    render(<SceneView scene={sceneAt(0)} selected="rail" onSelect={onSelect} reducedMotion={false} />);
    const crushing = screen.getByRole('button', { name: /^Crushing and conveying/ });
    expect(crushing.getAttribute('tabindex')).toBe('0');
    fireEvent.click(crushing);
    fireEvent.keyDown(crushing, { key: 'Enter' });
    fireEvent.keyDown(crushing, { key: ' ' });
    fireEvent.keyDown(crushing, { key: 'a' });
    expect(onSelect.mock.calls).toEqual([['crushing'], ['crushing'], ['crushing']]);
    expect(screen.getByRole('button', { name: /^Rail loading/ }).getAttribute('aria-pressed')).toBe('true');
    expect(crushing.getAttribute('aria-pressed')).toBe('false');
  });

  test('four cables from the top edge: severed is dashed and broken', () => {
    const { container } = render(<SceneView scene={sceneAt(0)} selected={null} onSelect={() => {}} reducedMotion={false} />);
    const cables = container.querySelectorAll('[data-cable]');
    expect(cables).toHaveLength(4);
    expect(container.querySelector('[data-cable="hosted-erp"]')?.getAttribute('data-state')).toBe('severed');
    expect(container.querySelector('[data-cable="hosted-erp"] [data-break]')).toBeTruthy();
    expect(container.querySelector('[data-cable="iroc-link"]')?.getAttribute('data-state')).toBe('live');
    expect(container.querySelector('[data-cable="iroc-link"] [data-break]')).toBeNull();
  });

  test('the schematic shows no numbers', () => {
    const { container } = render(<SceneView scene={sceneAt(300)} selected={null} onSelect={() => {}} reducedMotion />);
    expect(untaggedNumbers(container)).toEqual([]);
  });
});
