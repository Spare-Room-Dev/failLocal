import { simulate } from '@faillocal/engine';
import type { Register } from '@faillocal/engine';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ComponentType } from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { register } from '../src/model/register.js';
import { sceneState } from '../src/model/sceneState.js';
import { SERVICE_GROUPS } from '../src/model/serviceGroups.js';
import { SchematicScene } from '../src/ui/scene/SchematicScene.js';
import type { SceneViewProps } from '../src/ui/SceneView.js';

afterEach(cleanup);

const s1 = simulate(register, 's1-projection', 'unprepared');
const s3 = simulate(register, 's3-vendor-setpoint', 'prepared');
const at = (timeline: typeof s1, hour: number) => sceneState(register, timeline.samples.find((s) => s.hour === hour)!);

const STATE_WORD = { normal: 'Normal', degraded: 'Degraded', stopped: 'Stopped' } as const;

/** Every scene implementation renders this accessible DOM layer (scene contract v2). */
describe.each<[string, ComponentType<SceneViewProps>]>([['SchematicScene', SchematicScene]])('%s meets the scene contract', (_, Scene) => {
  test('one button per process area, labelled with its state word and pressed when selected', () => {
    const scene = at(s1, 300);
    render(<Scene scene={scene} selected="haulage" onSelect={() => {}} reducedMotion={false} />);
    expect(screen.getAllByRole('button')).toHaveLength(register.processes.length);
    for (const p of register.processes) {
      const area = scene.processes[p.id]!;
      const button = screen.getByRole('button', { name: new RegExp(`^${p.name}: ${STATE_WORD[area.state]}`) });
      expect(button.getAttribute('aria-pressed')).toBe(String(p.id === 'haulage'));
    }
    expect(screen.getByRole('button', { name: /^Haulage: Stopped/ })).toBeTruthy();
  });

  test('click, Enter and Space select an area', () => {
    const onSelect = vi.fn();
    render(<Scene scene={at(s1, 0)} selected={null} onSelect={onSelect} reducedMotion={false} />);
    const crushing = screen.getByRole('button', { name: /^Crushing and conveying/ });
    fireEvent.click(crushing);
    fireEvent.keyDown(crushing, { key: 'Enter' });
    fireEvent.keyDown(crushing, { key: ' ' });
    fireEvent.keyDown(crushing, { key: 'a' });
    expect(onSelect.mock.calls).toEqual([['crushing'], ['crushing'], ['crushing']]);
  });

  test('the honesty plate is DOM text built from the register', () => {
    const scene = at(s1, 0);
    const { container } = render(<Scene scene={scene} selected={null} onSelect={() => {}} reducedMotion={false} />);
    const plates = container.querySelectorAll('.scene-plinth');
    expect(plates).toHaveLength(1);
    expect(plates[0]!.textContent).toBe(scene.plate.text);
    expect(scene.plate.text).toBe('FICTIONAL MODEL SITE · PILBARA IRON ORE · SYNTHETIC DATA');
    const real = { ...register, site: { ...register.site, fictional: false } } as unknown as Register;
    expect(() => sceneState(real, s1.samples[0]!)).toThrow(/fictional/);
  });

  test('one cable marker per service group, carrying its state', () => {
    const { container, unmount } = render(<Scene scene={at(s1, 300)} selected={null} onSelect={() => {}} reducedMotion={false} />);
    const markers = [...container.querySelectorAll('[data-cable-group]')];
    expect(markers.map((m) => m.getAttribute('data-cable-group'))).toEqual(SERVICE_GROUPS.map((g) => g.id));
    const state = (id: string) => container.querySelector(`[data-cable-group="${id}"]`)!.getAttribute('data-cable-state');
    expect(state('hosted-erp')).toBe('live');
    unmount();

    const vendor = render(<Scene scene={at(s3, 12)} selected={null} onSelect={() => {}} reducedMotion={false} />);
    expect(vendor.container.querySelector('[data-cable-group="vendor-access"]')!.getAttribute('data-cable-state')).toBe('revoked');
  });

  test('reports one anchor per group, each inside the scene box', () => {
    const onAnchors = vi.fn();
    render(<Scene scene={at(s1, 0)} selected={null} onSelect={() => {}} reducedMotion={false} onAnchors={onAnchors} />);
    expect(onAnchors).toHaveBeenCalled();
    const anchors = onAnchors.mock.calls.at(-1)![0] as Record<string, number>;
    expect(Object.keys(anchors).sort()).toEqual(SERVICE_GROUPS.map((g) => g.id).sort());
    for (const x of Object.values(anchors)) {
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(1);
    }
  });

  test('decorative renders no buttons and hides itself from assistive tech', () => {
    const { container } = render(<Scene scene={at(s1, 300)} selected={null} onSelect={() => {}} reducedMotion decorative />);
    expect(container.querySelectorAll('button, [role="button"], [tabindex]')).toHaveLength(0);
    expect(container.firstElementChild!.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelector('.scene-plinth')!.textContent).toBe('FICTIONAL MODEL SITE · PILBARA IRON ORE · SYNTHETIC DATA');
  });
});
