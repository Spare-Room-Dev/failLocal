import { describe, expect, test } from 'vitest';
import { fitCamera, K_MAX, K_MIN, unproject } from '../../src/scene/iso.js';
import { BOARD, LAYOUT } from '../../src/scene/layout.js';
import { keyMove, panBy, wheelZoom, zoomAt } from '../../src/scene/cameraMoves.js';

const view = { w: 928, h: 580 };
const start = fitCamera(BOARD, view, LAYOUT.defaultFocus);

describe('camera moves', () => {
  test('zooming keeps the ground point under the cursor where it was', () => {
    const at = { sx: 300, sy: 260 };
    const before = unproject(at.sx, at.sy, start);
    const cam = zoomAt(start, 1.5, at.sx, at.sy, BOARD, view);
    expect(cam.k).toBeCloseTo(start.k * 1.5, 9);
    const after = unproject(at.sx, at.sy, cam);
    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.y).toBeCloseTo(before.y, 6);
  });

  test('zoom stops at K_MAX and K_MIN', () => {
    let cam = start;
    for (let i = 0; i < 40; i++) cam = zoomAt(cam, 1.3, 464, 290, BOARD, view);
    expect(cam.k).toBe(K_MAX);
    for (let i = 0; i < 40; i++) cam = zoomAt(cam, 1 / 1.3, 464, 290, BOARD, view);
    expect(cam.k).toBe(K_MIN);
  });

  test('a pan moves the board with the pointer and never loses it', () => {
    const cam = panBy(start, 40, -25, BOARD, view);
    expect(cam.ox).toBeCloseTo(start.ox + 40, 9);
    expect(cam.oy).toBeCloseTo(start.oy - 25, 9);
    const far = panBy(start, 1e6, 1e6, BOARD, view);
    const g = unproject(view.w / 2, view.h / 2, far);
    expect(g.x).toBeGreaterThanOrEqual(-1e-6);
    expect(g.x).toBeLessThanOrEqual(BOARD.w + 1e-6);
    expect(g.y).toBeGreaterThanOrEqual(-1e-6);
    expect(g.y).toBeLessThanOrEqual(BOARD.h + 1e-6);
  });

  test('+ and - zoom about the view centre, 0 fits, other keys do nothing', () => {
    const fit = fitCamera(BOARD, view, LAYOUT.defaultFocus);
    const plus = keyMove('+', start, BOARD, view, fit)!;
    expect(plus.k).toBeGreaterThan(start.k);
    expect(keyMove('=', start, BOARD, view, fit)!.k).toBe(plus.k);
    expect(keyMove('-', start, BOARD, view, fit)!.k).toBeLessThan(start.k);
    expect(keyMove('0', plus, BOARD, view, fit)).toEqual(fit);
    expect(keyMove('a', start, BOARD, view, fit)).toBeNull();
  });

  test('a wheel turn zooms, but passes to the page when the zoom is already at its limit that way', () => {
    expect(wheelZoom(start, -100, 300, 260, BOARD, view)!.k).toBeGreaterThan(start.k);
    expect(wheelZoom(start, 100, 300, 260, BOARD, view)!.k).toBeLessThan(start.k);
    const max = { ...start, k: K_MAX };
    const min = { ...start, k: K_MIN };
    expect(wheelZoom(max, -100, 300, 260, BOARD, view)).toBeNull();
    expect(wheelZoom(min, 100, 300, 260, BOARD, view)).toBeNull();
    expect(wheelZoom(max, 100, 300, 260, BOARD, view)!.k).toBeLessThan(K_MAX);
    expect(wheelZoom(min, -100, 300, 260, BOARD, view)!.k).toBeGreaterThan(K_MIN);
    expect(wheelZoom(start, 0, 300, 260, BOARD, view)).toBeNull();
  });
});
