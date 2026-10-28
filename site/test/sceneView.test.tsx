import { simulate } from '@faillocal/engine';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { register } from '../src/model/register.js';
import { sceneState } from '../src/model/sceneState.js';
import { SceneView } from '../src/ui/SceneView.js';
import { untaggedNumbers } from './helpers/untagged.js';

const gl = vi.hoisted(() => ({ available: false }));
vi.mock('../src/scene/webgl.js', () => ({ webglAvailable: () => gl.available }));
vi.mock('../src/scene/pixi/app.js', () => ({
  createDiorama: vi.fn(async () => ({ setState() {}, setCamera() {}, fit() {}, destroy() {} })),
}));

afterEach(cleanup);

const scene = sceneState(register, simulate(register, 's1-projection', 'unprepared').samples[0]!);
const NOTE = "Simplified view: this browser can't draw the 3D model.";

test('without WebGL the schematic stands in, with the D-106 note', () => {
  gl.available = false;
  const { container } = render(<SceneView scene={scene} selected={null} onSelect={() => {}} reducedMotion={false} />);
  expect(screen.getByText(NOTE)).toBeTruthy();
  expect(screen.getByRole('group', { name: 'Model site schematic' })).toBeTruthy();
  expect(container.querySelector('.scene--diorama')).toBeNull();
  expect(untaggedNumbers(container)).toEqual([]);
});

test('with WebGL the diorama draws the scene, and no note shows', () => {
  gl.available = true;
  const { container } = render(<SceneView scene={scene} selected={null} onSelect={() => {}} reducedMotion={false} />);
  expect(container.querySelector('.scene--diorama')).not.toBeNull();
  expect(screen.queryByText(NOTE)).toBeNull();
  expect(screen.queryByRole('group', { name: 'Model site schematic' })).toBeNull();
});

test('the decorative scene carries no note either way', () => {
  gl.available = false;
  render(<SceneView scene={scene} selected={null} onSelect={() => {}} reducedMotion decorative />);
  expect(screen.queryByText(NOTE)).toBeNull();
});
