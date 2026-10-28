import { describe, expect, it } from 'vitest';
import { CABLE, cableRoutes, labelRow } from '../../src/scene/cables.js';
import { chamfer, dashes, lengths, pointAt } from '../../src/scene/polyline.js';
import type { Pt } from '../../src/scene/polyline.js';

const segments = (pts: Pt[]) => pts.slice(1).map((b, i) => [pts[i]!, b] as const);

/** Whether two axis-aligned or diagonal segments properly cross (touching ends do not count). */
function crosses([a, b]: readonly [Pt, Pt], [c, d]: readonly [Pt, Pt]): boolean {
  const o = (p: Pt, q: Pt, r: Pt) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
}

describe('cables', () => {
  // The desktop default framing: anchors at sixths of a 928 px scene, posts left to right, some above the stage.
  const anchors = [155, 309, 464, 619, 773];
  const posts = [
    { x: 476, y: -53 },
    { x: 553, y: -14 },
    { x: 630, y: 25 },
    { x: 708, y: 64 },
    { x: 786, y: 102 },
  ];

  it('reaches every post that sits below the buses', () => {
    const low = posts.map((p) => ({ x: p.x, y: p.y + 200 }));
    for (const [i, r] of cableRoutes(anchors, low).entries()) {
      expect(r.reaches).toBe(true);
      expect(r.points[r.points.length - 1]).toEqual(low[i]);
    }
  });

  it('runs octilinear from the stage top under each card to its post, with 9 px chamfers', () => {
    for (const [i, r] of cableRoutes(anchors, posts).entries()) {
      expect(r.points[0]).toEqual({ x: anchors[i], y: 0 });
      // Posts above the stage top (or too high for a bus) get the drop under their card only.
      expect(r.reaches).toBe(i >= 3);
      expect(r.points[r.points.length - 1]).toEqual(r.reaches ? posts[i] : { x: anchors[i], y: CABLE.stub });
      for (const [a, b] of segments(r.points)) {
        const angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
        expect(Math.abs(angle / 45 - Math.round(angle / 45))).toBeLessThan(1e-9);
        if (a.x !== b.x && a.y !== b.y) expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeLessThanOrEqual(CABLE.chamfer * Math.SQRT2 + 1e-9);
      }
    }
  });

  it('neighbouring cables never cross, whichever way they run', () => {
    const mirrored = anchors.map((a) => 928 - a).reverse();
    const mirroredPosts = posts.map((p) => ({ x: 928 - p.x, y: p.y })).reverse();
    for (const [as, ps] of [
      [anchors, posts],
      [anchors, posts.map((p) => ({ x: p.x, y: p.y + 200 }))],
      [mirrored, mirroredPosts.map((p) => ({ x: p.x, y: p.y + 200 }))],
      [anchors, posts.map((p, i) => ({ x: anchors[i]! + (i - 2) * 60, y: 300 }))],
    ] as const) {
      const routes = cableRoutes([...as], [...ps]);
      for (let i = 0; i < routes.length; i++)
        for (let j = i + 1; j < routes.length; j++)
          for (const s of segments(routes[i]!.points)) for (const t of segments(routes[j]!.points)) expect(crosses(s, t)).toBe(false);
    }
  });

  it('puts the break near the post when its leg has room, otherwise under the card', () => {
    const [far, , , , near] = cableRoutes(anchors, posts.map((p, i) => (i === 4 ? { x: p.x, y: 300 } : p)));
    expect(pointAt(near!.points, near!.breakAt).p.x).toBeCloseTo(786);
    expect(near!.length - near!.breakAt).toBeGreaterThan(CABLE.breakGap);
    expect(pointAt(far!.points, far!.breakAt).p).toEqual({ x: 155, y: CABLE.cardDrop });
  });
});

describe('polyline', () => {
  it('chamfers a right angle at 45° and dashes a line', () => {
    expect(chamfer([{ x: 0, y: 0 }, { x: 0, y: 50 }, { x: 50, y: 50 }], 9)).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 41 },
      { x: 9, y: 50 },
      { x: 50, y: 50 },
    ]);
    const line = [{ x: 0, y: 0 }, { x: 20, y: 0 }];
    expect(dashes(line, 3, 6).map((d) => d.map((p) => p.x))).toEqual([[0, 3], [6, 9], [12, 15], [18, 20]]);
    expect(dashes(line, 3, 6, 2).map((d) => d.map((p) => p.x))[0]).toEqual([2, 5]);
    expect(lengths(line)).toEqual([0, 20]);
  });
});

describe('the hero\'s cabled labels', () => {
  const widths = [78, 86, 140, 122, 136];

  it('sit in one row along the top, left to right, apart, right-aligned inside the view', () => {
    const view = 880;
    const row = labelRow(widths, view);
    expect(row).toHaveLength(5);
    for (const [i, b] of row.entries()) {
      expect(b.w).toBe(widths[i]);
      expect(b.y).toBe(row[0]!.y);
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.w).toBeLessThanOrEqual(view);
      if (i > 0) expect(b.x - (row[i - 1]!.x + row[i - 1]!.w)).toBeGreaterThanOrEqual(6);
    }
    // Right-aligned: the last label ends near the view's right edge.
    expect(view - (row[4]!.x + row[4]!.w)).toBeLessThan(40);
  });

  it('squeeze their gaps, never overlapping, when the view is narrow', () => {
    const row = labelRow(widths, 600);
    for (const [i, b] of row.entries()) if (i > 0) expect(b.x).toBeGreaterThanOrEqual(row[i - 1]!.x + row[i - 1]!.w);
  });

  it('cables start under their labels and still reach their posts', () => {
    const anchors = [155, 309, 464, 619, 773];
    const top = 34;
    const low = [{ x: 476, y: 250 }, { x: 553, y: 270 }, { x: 630, y: 290 }, { x: 708, y: 310 }, { x: 786, y: 330 }];
    for (const [i, r] of cableRoutes(anchors, low, top).entries()) {
      expect(r.points[0]).toEqual({ x: anchors[i], y: top });
      expect(r.reaches).toBe(true);
      expect(r.points[r.points.length - 1]).toEqual(low[i]);
      for (const p of r.points) expect(p.y).toBeGreaterThanOrEqual(top);
    }
  });
});
