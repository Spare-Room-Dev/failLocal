import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  K_MAX,
  K_MIN,
  boxFaces,
  clampCamera,
  depthKey,
  fitCamera,
  project,
  shadowHull,
  tone,
  unproject,
  type Camera,
} from '../../src/scene/iso.js';
import { token } from '../../src/scene/palette.js';

const BOARD = { w: 1600, h: 1000 };
const VIEW = { w: 1280, h: 720 };

describe('palette', () => {
  it('reads the scene poles from tokens.css', () => {
    // A non-literal URL, so vite does not rewrite it as a CSS asset (tokens.css is processed in tests for `?raw`).
    const file = '../../src/styles/tokens.css';
    const css = readFileSync(fileURLToPath(new URL(file, import.meta.url)), 'utf8');
    for (const name of ['shade-dark', 'shade-lite', 'galvanised', 'hivis']) {
      expect(css).toContain(`--${name}: ${token(name)};`);
    }
    expect(() => token('no-such-token')).toThrow();
  });
  it('matches the token name literally and whole', () => {
    expect(() => token('hi.is')).toThrow(); // a regex wildcard must not match --hivis
    expect(() => token('parked')).toThrow(); // --hivis-parked exists; --parked does not
    expect(() => token('-parked')).toThrow(); // nor a dash-led tail of it
  });
});

describe('boxFaces (DESIGN worked values)', () => {
  it('galvanised', () => {
    expect(boxFaces(token('galvanised'))).toEqual({ top: '#e2dcd1', left: '#d2cec5', right: '#938a87' });
  });
  it('hi-vis', () => {
    expect(boxFaces(token('hivis'))).toEqual({ top: '#f5c04a', left: '#eaaa1e', right: '#a2741f' });
  });
  it('tone normalises its normal', () => {
    expect(tone('#d9d5cc', { x: 0, y: 0, z: 7 })).toBe('#e2dcd1');
  });
});

describe('project', () => {
  const cam: Camera = { k: 1, ox: 500, oy: 100 };
  it('turns the board corners into the dimetric diamond, north at the top', () => {
    const n = project({ x: 0, y: 0, z: 0 }, cam);
    const e = project({ x: BOARD.w, y: 0, z: 0 }, cam);
    const w = project({ x: 0, y: BOARD.h, z: 0 }, cam);
    const s = project({ x: BOARD.w, y: BOARD.h, z: 0 }, cam);
    expect(n).toEqual({ sx: 500, sy: 100 });
    expect(Math.min(e.sy, w.sy, s.sy)).toBeGreaterThan(n.sy); // north is the top corner
    expect(e.sx).toBeGreaterThan(n.sx); // +x runs lower right
    expect(e.sy).toBeGreaterThan(n.sy);
    expect(w.sx).toBeLessThan(n.sx); // +y runs lower left
    expect(w.sy).toBeGreaterThan(n.sy);
    expect(s.sy).toBe(Math.max(n.sy, e.sy, w.sy, s.sy)); // far corner at the bottom
    expect(e).toEqual({ sx: 2100, sy: 900 }); // 2:1
  });
  it('lifts height by k·1.2247', () => {
    expect(project({ x: 0, y: 0, z: 10 }, { k: 2, ox: 0, oy: 0 }).sy).toBeCloseTo(-24.494, 9);
  });
});

describe('shadowHull', () => {
  const box = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ];
  it('casts a 10 m box by (15, −1.5) m', () => {
    const hull = shadowHull(box, 10);
    expect(hull).toHaveLength(6);
    for (const p of [
      { x: 0, y: 0 },
      { x: 15, y: -1.5 },
      { x: 25, y: -1.5 },
      { x: 25, y: 8.5 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ]) {
      expect(hull.some((q) => Math.abs(q.x - p.x) < 1e-9 && Math.abs(q.y - p.y) < 1e-9)).toBe(true);
    }
  });
  it('a flat object casts its own footprint', () => {
    expect(shadowHull(box, 0)).toHaveLength(4);
  });
});

describe('depthKey', () => {
  it('orders a far object before a near one', () => {
    const far = { x: 100, y: 50, z: 30 };
    const near = { x: 400, y: 300, z: 0 };
    expect(depthKey(far)).toBeLessThan(depthKey(near));
    expect(depthKey(far, 1)).toBe(151);
  });
});

describe('unproject', () => {
  it('inverts project on the ground plane', () => {
    const cam: Camera = { k: 1.7, ox: -320, oy: 45 };
    for (const p of [
      { x: 0, y: 0 },
      { x: 1600, y: 0 },
      { x: 123.4, y: 987.6 },
      { x: -50, y: 2000 },
    ]) {
      const { sx, sy } = project({ ...p, z: 0 }, cam);
      const g = unproject(sx, sy, cam);
      expect(g.x).toBeCloseTo(p.x, 9);
      expect(g.y).toBeCloseTo(p.y, 9);
    }
  });
});

describe('camera', () => {
  it('clamps: k stays in range and the board is always under the centre of the view', () => {
    const ks = [0.01, K_MIN, 0.5, 1, K_MAX, 9];
    const origins = [-1e5, -3000, -500, 0, 300, 1280, 4000, 1e5];
    const eps = 1e-6;
    for (const view of [VIEW, { w: 390, h: 844 }]) {
      for (const k of ks)
        for (const ox of origins)
          for (const oy of origins) {
            const cam = clampCamera({ k, ox, oy }, BOARD, view);
            expect(cam.k).toBeGreaterThanOrEqual(K_MIN);
            expect(cam.k).toBeLessThanOrEqual(K_MAX);
            const g = unproject(view.w / 2, view.h / 2, cam);
            expect(g.x).toBeGreaterThanOrEqual(-eps);
            expect(g.x).toBeLessThanOrEqual(BOARD.w + eps);
            expect(g.y).toBeGreaterThanOrEqual(-eps);
            expect(g.y).toBeLessThanOrEqual(BOARD.h + eps);
          }
    }
  });

  it('clamps k into range', () => {
    expect(clampCamera({ k: 0.01, ox: 640, oy: -200 }, BOARD, VIEW).k).toBe(K_MIN);
    expect(clampCamera({ k: 9, ox: 640, oy: -200 }, BOARD, VIEW).k).toBe(K_MAX);
  });

  it('pulls a camera looking off the board back to the board edge', () => {
    // Phone at K_MAX with the view far off the north-west: the reviewer's lost-board case.
    const phone = { w: 390, h: 844 };
    const cam = clampCamera({ k: K_MAX, ox: -1e5, oy: -1e5 }, BOARD, phone);
    const g = unproject(phone.w / 2, phone.h / 2, cam);
    expect(g.x).toBeCloseTo(BOARD.w, 6);
    expect(g.y).toBeCloseTo(BOARD.h, 6);
  });

  it('leaves an in-bounds camera alone', () => {
    const cam = { k: 0.8, ox: 700, oy: 50 };
    expect(clampCamera(cam, BOARD, VIEW)).toEqual(cam);
  });

  it('fits the whole board with no focus', () => {
    const cam = fitCamera(BOARD, VIEW);
    expect(cam.k).toBeGreaterThanOrEqual(K_MIN);
    for (const [x, y] of [
      [0, 0],
      [BOARD.w, 0],
      [0, BOARD.h],
      [BOARD.w, BOARD.h],
    ]) {
      const p = project({ x: x!, y: y!, z: 0 }, cam);
      expect(p.sx).toBeGreaterThanOrEqual(0);
      expect(p.sx).toBeLessThanOrEqual(VIEW.w);
      expect(p.sy).toBeGreaterThanOrEqual(0);
      expect(p.sy).toBeLessThanOrEqual(VIEW.h);
    }
  });

  it('centres a focus rectangle', () => {
    const focus = { x: 300, y: 600, w: 200, h: 120 };
    const cam = fitCamera(BOARD, VIEW, focus);
    const c = project({ x: focus.x + focus.w / 2, y: focus.y + focus.h / 2, z: 0 }, cam);
    expect(c.sx).toBeCloseTo(VIEW.w / 2, 9);
    expect(c.sy).toBeCloseTo(VIEW.h / 2, 9);
    expect(cam.k).toBeGreaterThan(fitCamera(BOARD, VIEW).k); // zoomed in on it
    expect(cam.k).toBeLessThanOrEqual(K_MAX);
  });
});
