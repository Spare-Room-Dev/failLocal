import { simulate } from '@faillocal/engine';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { register } from '../src/model/register.js';
import { sceneState } from '../src/model/sceneState.js';
import type { DioramaOptions, SceneLayout } from '../src/scene/pixi/app.js';
import { LAYOUT } from '../src/scene/layout.js';
import { defaultCamera } from '../src/scene/framing.js';
import { FACE_TRANSFORM } from '../src/scene/plate.js';
import { DioramaScene } from '../src/ui/scene/DioramaScene.js';

/** How the mocked renderer behaves on this test's mount. */
const pixi = vi.hoisted(() => ({
  mode: 'ok' as 'ok' | 'reject' | 'throw',
  destroy: vi.fn(),
  reveal: vi.fn(),
  options: null as DioramaOptions | null,
  onLayout: null as ((l: SceneLayout) => void) | null,
}));
vi.mock('../src/scene/pixi/app.js', () => ({
  createDiorama: vi.fn(async (_host: HTMLElement, onLayout: (l: SceneLayout) => void, options: DioramaOptions) => {
    pixi.options = options;
    pixi.onLayout = onLayout;
    if (pixi.mode === 'reject') throw new Error('no WebGL renderer');
    return {
      setState() {
        if (pixi.mode === 'throw') throw new Error('world failed to build');
      },
      setCamera() {},
      fit() {},
      reveal: pixi.reveal,
      destroy: pixi.destroy,
    };
  }),
}));

beforeEach(() => {
  pixi.mode = 'ok';
  pixi.destroy.mockClear();
  pixi.reveal.mockClear();
  pixi.options = null;
  pixi.onLayout = null;
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

/** A layout as the renderer reports it: haulage's plaque placed, crushing's flag in frame without one, rail out of frame. */
function layout(): SceneLayout {
  const view = { w: 1000, h: 600 };
  const plaques: SceneLayout['plaques'] = {};
  for (const id of Object.keys(LAYOUT.areas)) plaques[id] = { foot: { x: 500, y: 300 }, flagTop: { x: 500, y: 274 }, rect: null, inFrame: true };
  plaques.haulage = { foot: { x: 400, y: 300 }, flagTop: { x: 400, y: 260 }, rect: { x: 413, y: 255, w: 150, h: 31 }, inFrame: true };
  plaques.crushing = { foot: { x: 700, y: 350 }, flagTop: { x: 700, y: 324 }, rect: null, inFrame: true };
  plaques.rail = { foot: { x: 1300, y: 900 }, flagTop: { x: 1300, y: 874 }, rect: null, inFrame: false };
  return { cam: defaultCamera('site', view, false), view, plaques, plate: { x: 40, y: 500, w: 330, h: 12, onFace: true, font: 9.5 } };
}

async function mounted() {
  const r = render(<DioramaScene scene={scene} selected={null} onSelect={() => {}} reducedMotion={false} />);
  await waitFor(() => expect(r.container.querySelector('.scene--diorama')!.getAttribute('data-ready')).toBe('true'));
  act(() => pixi.onLayout!(layout()));
  const button = (id: string) => r.container.querySelector<HTMLElement>(`.scene-hit[data-area="${id}"]`)!;
  return { ...r, button };
}

test('an area button covers its plaque and flag, or its flag alone when it has no plaque', async () => {
  const { button } = await mounted();
  const h = button('haulage').style;
  // The plaque (413..563 × 255..286) and the flag's cloth and pole top beside it.
  expect(parseFloat(h.left)).toBeLessThanOrEqual(400 - 12);
  expect(parseFloat(h.left) + parseFloat(h.width)).toBeGreaterThanOrEqual(563);
  expect(parseFloat(h.top)).toBeLessThanOrEqual(255);
  expect(parseFloat(h.top) + parseFloat(h.height)).toBeGreaterThanOrEqual(286);
  const c = button('crushing').style;
  expect(parseFloat(c.left) + parseFloat(c.width) / 2).toBeCloseTo(700, 0);
  expect(parseFloat(c.top)).toBeLessThanOrEqual(324);
});

test('an area out of frame keeps its button for keyboard and screen reader users, hidden, and focusing it brings the area into view', async () => {
  const { button } = await mounted();
  expect(button('rail').classList.contains('scene-hit--away')).toBe(true);
  expect(button('haulage').classList.contains('scene-hit--away')).toBe(false);
  act(() => button('rail').focus());
  expect(pixi.reveal).toHaveBeenCalledWith('rail');
  expect(screen.getByRole('button', { name: /^Rail loading and haul to port: / })).toBe(button('rail'));
});

test('the decorative scene asks for the hero framing; the site for its own', async () => {
  const site = render(<DioramaScene scene={scene} selected={null} onSelect={() => {}} reducedMotion={false} />);
  await waitFor(() => expect(pixi.options).not.toBeNull());
  expect(pixi.options!.framing).toBe('site');
  site.unmount();
  pixi.options = null;
  render(<DioramaScene scene={scene} selected={null} onSelect={() => {}} reducedMotion decorative />);
  await waitFor(() => expect(pixi.options).not.toBeNull());
  expect(pixi.options!.framing).toBe('hero');
  expect(pixi.options!.interactive).toBe(false);
});

test('the plate goes where the renderer placed it, under the same camera as the plaques: engraved on the face, or pinned', async () => {
  const { container } = await mounted();
  const plate = container.querySelector<HTMLElement>('.scene-plinth')!;
  // On the face it is the engraving itself: DOM text set in the face's plane at the renderer's size.
  expect(plate.dataset.placement).toBe('face');
  expect(plate.style.left).toBe('40px');
  expect(plate.style.top).toBe('500px');
  expect(plate.style.fontSize).toBe('9.5px');
  expect(plate.style.transform).toBe(FACE_TRANSFORM);
  expect(plate.textContent).toBe('FICTIONAL MODEL SITE · PILBARA IRON ORE · SYNTHETIC DATA');
  // Off the face it is the pinned plate, upright at its own size.
  const pinned = { ...layout(), plate: { x: 570, y: 560, w: 420, h: 22, onFace: false, font: 11 } };
  act(() => pixi.onLayout!(pinned));
  expect(plate.dataset.placement).toBe('pinned');
  expect(plate.style.left).toBe('570px');
  expect(plate.style.transform).toBe('');
  expect(plate.style.fontSize).toBe('');
});

test('a focused area button whose area leaves the frame stays where it was, visible, and the camera brings the area back', async () => {
  const { button } = await mounted();
  const before = { left: button('haulage').style.left, width: button('haulage').style.width };
  act(() => button('haulage').focus());
  expect(pixi.reveal).not.toHaveBeenCalled();
  const away = layout();
  away.plaques.haulage = { ...away.plaques.haulage!, rect: null, inFrame: false };
  act(() => pixi.onLayout!(away));
  expect(pixi.reveal).toHaveBeenCalledWith('haulage');
  expect(button('haulage').classList.contains('scene-hit--away')).toBe(false);
  expect(button('haulage').style.left).toBe(before.left);
  expect(button('haulage').style.width).toBe(before.width);
  // Without focus, an area out of frame is hidden.
  act(() => button('haulage').blur());
  act(() => pixi.onLayout!({ ...away }));
  expect(button('haulage').classList.contains('scene-hit--away')).toBe(true);
});
