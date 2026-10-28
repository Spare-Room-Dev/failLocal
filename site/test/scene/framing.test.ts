import { describe, expect, test } from 'vitest';
import { defaultCamera, HERO_FOCUS, HERO_K } from '../../src/scene/framing.js';
import { clampCamera, fitCamera, K_MAX, project, unproject } from '../../src/scene/iso.js';
import { BOARD, LAYOUT, PLINTH_DEPTH, SLAB_DEPTH } from '../../src/scene/layout.js';
import { placePlaques, PLAQUE_H, POLE_LENGTHS } from '../../src/scene/plaques.js';
import type { PlaqueRequest } from '../../src/scene/plaques.js';
import { placePlate, plateBoxes, plateCorners, plateFont, platePosition } from '../../src/scene/plate.js';

type Box = { x: number; y: number; w: number; h: number };
const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const inside = (a: Box, view: { w: number; h: number }) => a.x >= 0 && a.y >= 0 && a.x + a.w <= view.w && a.y + a.h <= view.h;

describe('default framing', () => {
  // The diorama's box at 1440 × 900, 1150 × 800, 1024 × 768 and 820 × 1180.
  const SITE_VIEWS = [{ w: 1068, h: 580 }, { w: 1150, h: 440 }, { w: 1024, h: 408 }, { w: 820, h: 512.5 }];
  const onStage = (p: { sx: number; sy: number }, view: { w: number; h: number }, m = 0) => p.sx >= m && p.sx <= view.w - m && p.sy >= m && p.sy <= view.h - m;

  test('the site opens on the model as an object: the front-left corner, its cut-away face and the gallery floor beyond', () => {
    for (const view of SITE_VIEWS) {
      const cam = defaultCamera('site', view, false);
      // The board's front-left corner, down to the foot of the plinth, is in frame with floor to its left.
      const corner = project({ x: 0, y: BOARD.h, z: -SLAB_DEPTH - PLINTH_DEPTH }, cam);
      expect(onStage(corner, view, 12), `${view.w}`).toBe(true);
      // The plinth face runs down-right from it far enough to carry the engraved plate.
      const plate = { w: 300, h: 12 };
      const at = platePosition(cam, view, plate);
      expect(at, `${view.w}`).not.toBeNull();
      // It is a crop of the board, not the whole board shrunk to a map.
      expect(cam.k, `${view.w}`).toBeGreaterThan(fitCamera(BOARD, view).k * 1.1);
    }
  });

  test("the site opens with every area's flag in frame", () => {
    for (const view of SITE_VIEWS) {
      const cam = defaultCamera('site', view, false);
      for (const [id, a] of Object.entries(LAYOUT.areas)) expect(onStage(project(a.anchor, cam), view, 10), `${id} at ${view.w}`).toBe(true);
      for (const p of [LAYOUT.pit.centre, LAYOUT.areas.crushing!.anchor, LAYOUT.areas.haulage!.anchor]) expect(onStage(project(p, cam), view, 40)).toBe(true);
    }
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
  const size = { w: 330, h: 12 };
  const view = { w: 1068, h: 580 };

  test('with the front edge in view it is engraved along the front-left plinth face, whole and inside the stage', () => {
    const cam = defaultCamera('site', view, false);
    const at = platePosition(cam, view, size)!;
    expect(at).not.toBeNull();
    // Its left-centre is on the plinth face along the board's front-left edge (y = BOARD.h), half way down it, from 40 m along.
    const x = (at.x - cam.ox) / cam.k + BOARD.h;
    expect(x).toBeGreaterThanOrEqual(40);
    const mid = project({ x, y: BOARD.h, z: -SLAB_DEPTH - PLINTH_DEPTH / 2 }, cam);
    expect(at.x).toBeCloseTo(mid.sx, 6);
    expect(at.y + size.h / 2).toBeCloseTo(mid.sy, 6);
    // The text runs down the face (slope 1/2) and ends on it, inside the stage.
    const corners = plateCorners({ ...at, ...size, onFace: true, font: 9 });
    for (const c of corners) expect(inside({ x: c.x, y: c.y, w: 0, h: 0 }, view)).toBe(true);
    expect((corners[1]!.y - corners[0]!.y) / (corners[1]!.x - corners[0]!.x)).toBeCloseTo(0.5, 6);
    const endX = (corners[1]!.x - cam.ox) / cam.k + BOARD.h;
    expect(endX).toBeLessThanOrEqual(BOARD.w);
  });

  test("where the face's start is out of the stage, the plate slides along the face until it fits", () => {
    const cam = defaultCamera('site', view, false);
    const panned = { ...cam, ox: cam.ox - 200 };
    const at = platePosition(panned, view, size)!;
    expect(at.x).toBeGreaterThanOrEqual(8);
    expect((at.x - panned.ox) / panned.k + BOARD.h).toBeGreaterThan(40);
  });

  test('zoomed in on the north of the board, the front edge is out of view and the plate is pinned to the stage', () => {
    const north = clampCamera({ ...fitCamera(BOARD, view, { x: 400, y: 100, w: 50, h: 50 }), k: K_MAX }, BOARD, view);
    expect(platePosition(north, view, size)).toBeNull();
    const pinned = placePlate(north, view, 30, false);
    expect(pinned.onFace).toBe(false);
    expect(inside(pinned, view)).toBe(true);
  });

  test('the engraving is sized to the plinth face, never under 9 px', () => {
    expect(plateFont(0.35)).toBe(9);
    expect(plateFont(2)).toBeCloseTo(0.55 * PLINTH_DEPTH * 1.2247 * 2, 6);
  });

  test('plaques keep clear of the plate as drawn, not of the box round its slant', () => {
    const p = { x: 100, y: 300, w: 330, h: 12, onFace: true, font: 9 };
    const boxes = plateBoxes(p, 0);
    // Every corner of the slanted strip is covered...
    for (const c of plateCorners(p)) expect(boxes.some((b) => c.x >= b.x - 1e-6 && c.x <= b.x + b.w + 1e-6 && c.y >= b.y - 1e-6 && c.y <= b.y + b.h + 1e-6)).toBe(true);
    // ...and the open floor under the strip's start, well clear of it, is not.
    const under = { x: 110, y: 400, w: 20, h: 20 };
    expect(boxes.some((b) => overlaps(b, under))).toBe(false);
  });
});
