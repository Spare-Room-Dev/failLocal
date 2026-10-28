import { simulate } from '@faillocal/engine';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { register } from '../src/model/register.js';
import { sceneState } from '../src/model/sceneState.js';
import type { DioramaOptions } from '../src/scene/pixi/app.js';
import { DioramaScene } from '../src/ui/scene/DioramaScene.js';

/** How the mocked renderer behaves on this test's mount. */
const pixi = vi.hoisted(() => ({
  mode: 'ok' as 'ok' | 'reject' | 'throw',
  destroy: vi.fn(),
  options: null as DioramaOptions | null,
}));
vi.mock('../src/scene/pixi/app.js', () => ({
  createDiorama: vi.fn(async (_host: HTMLElement, _onCamera: unknown, options: DioramaOptions) => {
    pixi.options = options;
    if (pixi.mode === 'reject') throw new Error('no WebGL renderer');
    return {
      setState() {
        if (pixi.mode === 'throw') throw new Error('world failed to build');
      },
      setCamera() {},
      fit() {},
      destroy: pixi.destroy,
    };
  }),
}));

beforeEach(() => {
  pixi.mode = 'ok';
  pixi.destroy.mockClear();
  pixi.options = null;
});
afterEach(cleanup);

const scene = sceneState(register, simulate(register, 's1-projection', 'unprepared').samples[0]!);
const NOTE = "Simplified view: this browser can't draw the 3D model.";

/** The never-blank rule: the schematic and the D-106 note, no diorama. */
async function expectFallback(container: HTMLElement) {
  await waitFor(() => expect(screen.getByText(NOTE)).toBeTruthy());
  expect(screen.getByRole('group', { name: 'Model site schematic' })).toBeTruthy();
  expect(container.querySelector('.scene--diorama')).toBeNull();
}

test('a renderer that fails to start falls back to the schematic with the note', async () => {
  pixi.mode = 'reject';
  const { container } = render(<DioramaScene scene={scene} selected={null} onSelect={() => {}} reducedMotion={false} />);
  await expectFallback(container);
});

test('a world that fails to build releases the renderer and falls back', async () => {
  pixi.mode = 'throw';
  const { container } = render(<DioramaScene scene={scene} selected={null} onSelect={() => {}} reducedMotion={false} />);
  await expectFallback(container);
  expect(pixi.destroy).toHaveBeenCalledTimes(1);
});

test('a renderer that reports a failure later (a lost context that never returns) is released and replaced', async () => {
  const { container } = render(<DioramaScene scene={scene} selected={null} onSelect={() => {}} reducedMotion={false} />);
  await waitFor(() => expect(container.querySelector('.scene--diorama')!.getAttribute('data-ready')).toBe('true'));
  act(() => pixi.options!.onFail!());
  await expectFallback(container);
  expect(pixi.destroy).toHaveBeenCalledTimes(1);
});
