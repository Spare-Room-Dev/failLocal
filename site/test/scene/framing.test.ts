import { describe, expect, test } from 'vitest';
import { defaultCamera, HERO_FOCUS, HERO_K } from '../../src/scene/framing.js';
import { clampCamera, fitCamera, K_MAX, project, unproject } from '../../src/scene/iso.js';
import { BOARD, LAYOUT, PLINTH_DEPTH, SLAB_DEPTH } from '../../src/scene/layout.js';
import { placePlaques, PLAQUE_H, POLE_LENGTHS } from '../../src/scene/plaques.js';
import type { PlaqueRequest } from '../../src/scene/plaques.js';
import { platePosition } from '../../src/scene/plate.js';

type Box = { x: number; y: number; w: number; h: number };
const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const inside = (a: Box, view: { w: number; h: number }) => a.x >= 0 && a.y >= 0 && a.x + a.w <= view.w && a.y + a.h <= view.h;

describe('default framing', () => {
  test('the site frames the pit, ROM pad and crusher', () => {
    const view = { w: 1068, h: 580 };
    expect(defaultCamera('site', view, false)).toEqual(clampCamera(fitCamera(BOARD, view, LAYOUT.defaultFocus), BOARD, view));
  });

  test('a phone crops to the working area, pit to crusher to stockyard', () => {
    const view = { w: 390, h: 312 };
    const cam = defaultCamera('site', view, true);
    const w = LAYOUT.workingArea;
    const g = unproject(view.w / 2, view.h / 2, cam);
    expect(g.x).toBeCloseTo(w.x + w.w / 2, 6);
    expect(g.y).toBeCloseTo(w.y + w.h / 2, 6);
    // The pit's centre and the crusher are both on screen.
    for (const p of [LAYOUT.pit.centre, LAYOUT.areas.crushing!.anchor]) {
      const s = project(p, cam);
      expect(s.sx).toBeGreaterThan(0);
      expect(s.sx).toBeLessThan(view.w);
      expect(s.sy).toBeGreaterThan(0);
      expect(s.sy).toBeLessThan(view.h);
    }
  });

  test('the welcome hero is the k = 1.18 crop on the pit, ROM pad and crusher', () => {
    for (const view of [{ w: 640, h: 560 }, { w: 358, h: 280 }]) {
      const cam = defaultCamera('hero', view, view.w < 500);
      expect(cam.k).toBe(HERO_K);
      expect(HERO_K).toBe(1.18);
      expect(HERO_K).toBeLessThan(K_MAX);
      const g = unproject(view.w / 2, view.h / 2, cam);
      expect(g.x).toBeCloseTo(HERO_FOCUS.x, 6);
      expect(g.y).toBeCloseTo(HERO_FOCUS.y, 6);
    }
    // The ROM pad (haulage) and the crusher's dump pocket are in the desktop crop.
    const view = { w: 640, h: 560 };
    const cam = defaultCamera('hero', view, false);
    for (const p of [LAYOUT.areas.haulage!.anchor, { ...LAYOUT.dumpPocket }]) {
      const s = project(p, cam);
      expect(s.sx).toBeGreaterThan(0);
      expect(s.sx).toBeLessThan(view.w);
      expect(s.sy).toBeGreaterThan(0);
      expect(s.sy).toBeLessThan(view.h);
    }
  });
});

describe('plaque placement', () => {
  const view = { w: 600, h: 400 };
  const req = (id: string, x: number, y: number, w = 150): PlaqueRequest => ({ id, foot: { x, y }, w, side: 1 });

  test('a plaque sits beside the top of its pole, on its preferred side, with the shortest pole that fits', () => {
    const out = placePlaques([req('a', 100, 200)], view, []);
    const a = out.a!;
    expect(a.side).toBe(1);
    expect(a.rect.x).toBe(100 + 13);
    expect(a.rect.y).toBe(200 - a.len - 5);
    expect(a.rect.h).toBe(PLAQUE_H);
    expect(a.len).toBe(POLE_LENGTHS[0]);
  });

  test('crowded flags get longer poles or the other side, never overlapping plaques', () => {
    const reqs = [req('a', 200, 250), req('b', 210, 255), req('c', 190, 245), req('d', 220, 260), req('e', 205, 250)];
    const out = placePlaques(reqs, view, []);
    const rects = Object.values(out).flatMap((p) => (p ? [p.rect] : []));
    expect(rects).toHaveLength(5);
    for (const [i, a] of rects.entries()) {
      expect(inside(a, view)).toBe(true);
      for (const b of rects.slice(i + 1)) expect(overlaps(a, b)).toBe(false);
    }
    // Deterministic.
    expect(placePlaques(reqs, view, [])).toEqual(out);
  });

  test('a plaque near the edge flips to the side with room, and never leaves the stage', () => {
    const out = placePlaques([req('right', 590, 200), req('left', 5, 200)], view, []);
    expect(out.right!.side).toBe(-1);
    expect(inside(out.right!.rect, view)).toBe(true);
    expect(inside(out.left!.rect, view)).toBe(true);
  });

  test('with no room either side, a plaque sits over the top of its pole', () => {
    const narrow = { w: 330, h: 300 };
    // Hard obstacles fill both sides of the pole's height band, leaving the space above.
    const walls = [{ x: 0, y: 200, w: 150, h: 100 }, { x: 180, y: 200, w: 150, h: 100 }];
    const out = placePlaques([req('a', 165, 290)], narrow, walls);
    const r = out.a!.rect;
    expect(r.y + r.h).toBeLessThanOrEqual(290 - out.a!.len);
    expect(r.y + r.h).toBeLessThanOrEqual(200);
    expect(r.x).toBeLessThan(165);
    expect(r.x + r.w).toBeGreaterThan(165);
  });

  test('a flag out of frame has no plaque, and a plaque with no room anywhere is left off', () => {
    const tiny = { w: 120, h: 80 };
    const out = placePlaques([req('off', -40, 50), req('wide', 60, 70, 200)], tiny, []);
    expect(out.off).toBeNull();
    expect(out.wide).toBeNull();
  });

  test('plaques keep off hard obstacles, and off soft ones when they can', () => {
    const fit = { x: 100, y: 120, w: 300, h: 60 };
    const out = placePlaques([req('a', 100, 200)], view, [fit]);
    expect(overlaps(out.a!.rect, fit)).toBe(false);
    const cable = { x: 0, y: 150, w: 600, h: 2 };
    const soft = placePlaques([req('a', 100, 200)], view, [], [cable]);
    expect(overlaps(soft.a!.rect, cable)).toBe(false);
    // With no way round a soft obstacle, it is covered rather than the plaque dropped.
    const wall = { x: 0, y: 0, w: 600, h: 400 };
    expect(placePlaques([req('a', 100, 200)], view, [], [wall]).a).not.toBeNull();
  });
});

describe('the honesty plate', () => {
  const size = { w: 420, h: 22 };

  test('with the front edge in view it hangs under the board\'s front-left plinth face, whole and inside the stage', () => {
    const view = { w: 1068, h: 580 };
    const cam = clampCamera(fitCamera(BOARD, view), BOARD, view);
    const at = platePosition(cam, view, size)!;
    expect(at).not.toBeNull();
    expect(inside({ x: at.x, y: at.y, ...size }, view)).toBe(true);
    // Its top-right corner is on the plinth face along the board's front-left edge (y = BOARD.h), between its arrises.
    const x = (at.x + size.w - cam.ox) / cam.k + BOARD.h;
    expect(x).toBeGreaterThan(0);
    expect(x).toBeLessThan(BOARD.w);
    const top = project({ x, y: BOARD.h, z: -SLAB_DEPTH }, cam).sy;
    const bottom = project({ x, y: BOARD.h, z: -SLAB_DEPTH - PLINTH_DEPTH }, cam).sy;
    expect(at.y).toBeGreaterThanOrEqual(top);
    expect(at.y).toBeLessThanOrEqual(bottom);
  });

  test('zoomed in on the north of the board, the front edge is out of view and there is no face position', () => {
    const view = { w: 1068, h: 580 };
    const north = clampCamera({ ...fitCamera(BOARD, view, { x: 400, y: 100, w: 50, h: 50 }), k: K_MAX }, BOARD, view);
    expect(platePosition(north, view, size)).toBeNull();
  });
});
