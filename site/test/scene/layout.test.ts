import { describe, expect, it } from 'vitest';
import { register } from '../../src/model/register.js';
import { cableFraction, SERVICE_GROUPS } from '../../src/model/serviceGroups.js';
import { cableRoutes } from '../../src/scene/cables.js';
import { defaultCamera } from '../../src/scene/framing.js';
import { project, type Vec3 } from '../../src/scene/iso.js';
import {
  BATTER_RUN,
  ENTRY_POST_H,
  BOARD,
  LAYOUT,
  RAMP_HEAD_APPROACH,
  ROAD_CREST_SETBACK,
  TRUCK,
  crestValue,
  distToPolyline,
  insidePolygon,
  rectDistance,
  spinifexPoints,
  type Structure,
} from '../../src/scene/layout.js';
import {
  CONVEYOR,
  HAUL_CENTRELINE,
  HAUL_CYCLE,
  HAUL_LANE_OFFSET,
  LV_LOOP,
  RAIL_LOOP,
  rampCentreline,
  type Path,
} from '../../src/scene/paths.js';

type Pt = { x: number; y: number };

const { pit, roads, structures, areas, entryPosts, railLoop } = LAYOUT;
const crest = pit.benches[0]!;
const floor = pit.benches[pit.benches.length - 1]!;
const footprint = (s: Structure) => ({ x: s.at.x, y: s.at.y, w: s.size.x, h: s.size.y });
const byId = (id: string) => {
  const s = structures.find((t) => t.id === id);
  if (!s) throw new Error(`no structure ${id}`);
  return s;
};
const inBoard = (p: Pt, eps = 1e-9) => p.x >= -eps && p.y >= -eps && p.x <= BOARD.w + eps && p.y <= BOARD.h + eps;
const samples = (path: Path, step = 2) => {
  const out: Vec3[] = [];
  for (let s = 0; s < path.length; s += step) out.push(path.at(s).p);
  return out;
};
const dist3 = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
/** Screen east (u) and south (v) of a ground point: north is up the screen (controller ruling). */
const screen = (p: Pt) => project({ x: p.x, y: p.y, z: 0 }, { k: 1, ox: 0, oy: 0 });
const centreOf = (s: Structure) => ({ x: s.at.x + s.size.x / 2, y: s.at.y + s.size.y / 2 });
const rectPerimeter = (r: { x: number; y: number; w: number; h: number }) => {
  const pts: Pt[] = [];
  for (let t = 0; t <= 1; t += 1 / 64) {
    pts.push({ x: r.x + t * r.w, y: r.y }, { x: r.x + t * r.w, y: r.y + r.h }, { x: r.x, y: r.y + t * r.h }, { x: r.x + r.w, y: r.y + t * r.h });
  }
  return pts;
};

describe('pit (DESIGN.md Mining Accuracy)', () => {
  it('has five benches 12 m apart in height, floor at −60 m', () => {
    expect(pit.benches).toHaveLength(5);
    pit.benches.forEach((b, i) => expect(b.floorZ).toBe(-12 * (i + 1)));
  });

  it('leaves berms of at least 11 m after a 5 m batter run', () => {
    expect(BATTER_RUN).toBe(5);
    for (let i = 0; i + 1 < pit.benches.length; i++) {
      const [a, b] = [pit.benches[i]!, pit.benches[i + 1]!];
      expect(a.radiusX - b.radiusX - BATTER_RUN).toBeGreaterThanOrEqual(11);
      expect(a.radiusY - b.radiusY - BATTER_RUN).toBeGreaterThanOrEqual(11);
    }
  });

  it('cuts a ramp 25 ± 3 m wide at 11 ± 2 % grade on every segment, measured on the ramp itself', () => {
    expect(Math.abs(pit.rampWidth - 25)).toBeLessThanOrEqual(3);
    expect(Math.abs(pit.rampGrade - 0.11)).toBeLessThanOrEqual(0.02);
    const ramp = rampCentreline();
    expect(ramp[0]!.z - ramp[ramp.length - 1]!.z).toBeCloseTo(60, 6);
    for (let i = 1; i < ramp.length; i++) {
      const [a, b] = [ramp[i - 1]!, ramp[i]!];
      const grade = (a.z - b.z) / Math.hypot(b.x - a.x, b.y - a.y);
      expect(Math.abs(grade - 0.11), `segment ${i}`).toBeLessThanOrEqual(0.02);
    }
    // And per 12 m bench interval, the grade a truck feels over a whole bench.
    for (let k = 0; k < 5; k++) {
      let run = 0;
      for (let i = 1; i < ramp.length; i++) {
        const [a, b] = [ramp[i - 1]!, ramp[i]!];
        const overlap = Math.min(a.z, -12 * k) - Math.max(b.z, -12 * (k + 1)); // metres of this segment's drop within bench k
        if (overlap > 0) run += (Math.hypot(b.x - a.x, b.y - a.y) * overlap) / (a.z - b.z);
      }
      expect(Math.abs(12 / run - 0.11), `bench ${k + 1}`).toBeLessThanOrEqual(0.02);
    }
  });

  it('never sits below the bench surface at its own inset, and its inset deepens with it', () => {
    const ramp = rampCentreline();
    const step = crest.radiusX - pit.benches[1]!.radiusX;
    const surfaceZ = (d: number) => {
      const i = Math.floor(d / step);
      const r = d - i * step;
      if (i >= pit.benches.length - 1 && r >= BATTER_RUN) return floor.floorZ;
      if (i >= pit.benches.length) return floor.floorZ;
      return r < BATTER_RUN ? -12 * i - (12 * r) / BATTER_RUN : -12 * (i + 1);
    };
    const insetOf = (p: Vec3) => {
      let lo = 0;
      let hi = Math.min(crest.radiusX, crest.radiusY) - 1;
      for (let k = 0; k < 60; k++) {
        const d = (lo + hi) / 2;
        const v = ((p.x - pit.centre.x) / (crest.radiusX - d)) ** 2 + ((p.y - pit.centre.y) / (crest.radiusY - d)) ** 2;
        if (v > 1) hi = d;
        else lo = d;
      }
      return (lo + hi) / 2;
    };
    let prev = -1;
    for (const p of ramp) {
      const d = insetOf(p);
      expect(p.z, `inset ${d.toFixed(1)}`).toBeGreaterThanOrEqual(surfaceZ(d) - 1e-6);
      expect(d).toBeGreaterThanOrEqual(prev - 1e-6);
      prev = d;
    }
  });

  it('starts the ramp on the crest and ends it on the floor, inside the bottom toe', () => {
    const ramp = rampCentreline();
    expect(crestValue(ramp[0]!, 0)).toBeCloseTo(1, 6);
    const end = ramp[ramp.length - 1]!;
    expect(end.z).toBe(floor.floorZ);
    const toeX = floor.radiusX - BATTER_RUN;
    const toeY = floor.radiusY - BATTER_RUN;
    const half = pit.rampWidth / 2;
    expect(((end.x - pit.centre.x) / (toeX - half)) ** 2 + ((end.y - pit.centre.y) / (toeY - half)) ** 2).toBeLessThanOrEqual(1.0001);
  });

  it('keeps ultra-class trucks (13 × 7.6 m) inside the ramp and the haul roads on their lanes', () => {
    expect(TRUCK).toEqual({ length: 13, width: 7.6 });
    expect(HAUL_LANE_OFFSET + TRUCK.width / 2).toBeLessThanOrEqual(pit.rampWidth / 2);
    for (const r of roads.filter((r) => r.id.startsWith('haul-'))) {
      expect(HAUL_LANE_OFFSET + TRUCK.width / 2).toBeLessThanOrEqual(r.width / 2);
    }
  });
});

describe('roads', () => {
  it('haul roads are 26 m; light-vehicle and magazine roads are narrower', () => {
    const haul = roads.filter((r) => r.id.startsWith('haul-'));
    expect(haul.length).toBeGreaterThanOrEqual(2);
    haul.forEach((r) => expect(r.width).toBe(26));
    roads.filter((r) => !r.id.startsWith('haul-')).forEach((r) => expect(r.width).toBeLessThan(26));
  });

  it('never cross the pit crest; only a haul road may end at the ramp head', () => {
    for (const r of roads) {
      const pts = r.points;
      for (let i = 1; i < pts.length; i++) {
        const [a, b] = [pts[i - 1]!, pts[i]!];
        const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y));
        for (let j = 0; j <= n; j++) {
          const p = { x: a.x + ((b.x - a.x) * j) / n, y: a.y + ((b.y - a.y) * j) / n };
          const end = pts[pts.length - 1]!;
          if (r.id.startsWith('haul-') && Math.hypot(p.x - end.x, p.y - end.y) < 2) continue;
          expect(crestValue(p, 0), `${r.id} at ${p.x.toFixed(0)},${p.y.toFixed(0)}`).toBeGreaterThan(1);
        }
      }
    }
    const rampHead = rampCentreline()[0]!;
    // Road edges keep a windrow/setback clear of the crest, except on the declared approach to the ramp head.
    const crestLine = Array.from({ length: 4001 }, (_, i) => ({
      x: pit.centre.x + crest.radiusX * Math.cos((2 * Math.PI * i) / 4000),
      y: pit.centre.y + crest.radiusY * Math.sin((2 * Math.PI * i) / 4000),
    }));
    let closest = Infinity;
    for (const r of roads) {
      for (let i = 1; i < r.points.length; i++) {
        const [a, b] = [r.points[i - 1]!, r.points[i]!];
        const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y));
        for (let j = 0; j <= n; j++) {
          const p = { x: a.x + ((b.x - a.x) * j) / n, y: a.y + ((b.y - a.y) * j) / n };
          if (r.id === 'haul-rom' && Math.hypot(p.x - rampHead.x, p.y - rampHead.y) < RAMP_HEAD_APPROACH) continue;
          const edgeGap = distToPolyline(p, crestLine) - r.width / 2;
          closest = Math.min(closest, edgeGap);
          expect(edgeGap, `${r.id} edge at ${p.x.toFixed(0)},${p.y.toFixed(0)}`).toBeGreaterThanOrEqual(ROAD_CREST_SETBACK);
        }
      }
    }
    expect(ROAD_CREST_SETBACK).toBeGreaterThanOrEqual(20);
    expect(RAMP_HEAD_APPROACH).toBeLessThanOrEqual(100);
    expect(closest).toBeGreaterThanOrEqual(ROAD_CREST_SETBACK);
    const rom = roads.find((r) => r.id === 'haul-rom')!;
    const end = rom.points[rom.points.length - 1]!;
    expect(Math.hypot(end.x - rampHead.x, end.y - rampHead.y)).toBeLessThan(1e-6);
    expect(rom.points[0]).toEqual({ x: LAYOUT.dumpPocket.x, y: LAYOUT.dumpPocket.y });
  });

  it('form one connected network: every road joins another at an endpoint', () => {
    const joined = (a: (typeof roads)[number], b: (typeof roads)[number]) =>
      [a.points[0]!, a.points[a.points.length - 1]!].some((p) => distToPolyline(p, b.points) < 0.5) ||
      [b.points[0]!, b.points[b.points.length - 1]!].some((p) => distToPolyline(p, a.points) < 0.5);
    const reached = new Set([roads[0]!.id]);
    for (let grew = true; grew; ) {
      grew = false;
      for (const r of roads) {
        if (reached.has(r.id)) continue;
        if (roads.some((q) => reached.has(q.id) && joined(r, q))) {
          reached.add(r.id);
          grew = true;
        }
      }
    }
    expect([...reached].sort()).toEqual(roads.map((r) => r.id).sort());
  });

  it('bring site deliveries in from the north edge to the workshop end, where the magazine track starts', () => {
    const site = roads.find((r) => r.id === 'site-road')!;
    expect(site.points[0]!.y).toBe(0);
    const track = roads.find((r) => r.id === 'magazine-track')!;
    expect(site.points[site.points.length - 1]).toEqual(track.points[0]);
    const camp = footprint(byId('camp'));
    for (const r of [site, track]) for (const p of r.points) expect(rectDistance({ x: p.x, y: p.y, w: 0, h: 0 }, camp)).toBeGreaterThan(500);
  });

  it('serve the magazine, the waste dump and the workshop by road', () => {
    const near = (s: Structure, r: (typeof roads)[number]) => rectDistance(footprint(s), { x: r.points[r.points.length - 1]!.x, y: r.points[r.points.length - 1]!.y, w: 0, h: 0 });
    const ends = (id: string) => roads.filter((r) => near(byId(id), r) < 60);
    expect(ends('magazine-1').map((r) => r.id)).toContain('magazine-track');
    expect(ends('waste-dump').map((r) => r.id)).toContain('haul-dump');
    const access = roads.find((r) => r.id === 'access')!;
    expect(Math.min(...rectPerimeter(footprint(byId('workshop'))).map((p) => distToPolyline(p, access.points)))).toBeLessThan(80);
  });
});

describe('structures', () => {
  it('use real colour tokens and positive sizes', async () => {
    const { token } = await import('../../src/scene/palette.js');
    for (const s of structures) {
      expect(() => token(s.base), s.id).not.toThrow();
      expect(s.size.x > 0 && s.size.y > 0 && s.size.z > 0, s.id).toBe(true);
    }
    expect(new Set(structures.map((s) => s.id)).size).toBe(structures.length);
  });

  it('sit at least 30 m back from the pit crest', () => {
    for (const s of structures) {
      for (const p of rectPerimeter(footprint(s))) expect(crestValue(p, 30), s.id).toBeGreaterThan(1);
    }
  });

  it('stay clear of every road (no footprint inside a road surface)', () => {
    for (const s of structures) {
      for (const r of roads) {
        const d = Math.min(...rectPerimeter(footprint(s)).map((p) => distToPolyline(p, r.points)));
        const c = centreOf(s);
        const inside = r.points.some((p) => p.x > s.at.x && p.x < s.at.x + s.size.x && p.y > s.at.y && p.y < s.at.y + s.size.y);
        expect(inside, `${r.id} enters ${s.id}`).toBe(false);
        expect(d, `${s.id} vs ${r.id} (${c.x},${c.y})`).toBeGreaterThanOrEqual(r.width / 2);
      }
    }
  });

  it('keep the explosives magazine at least 500 m from the workshop, fuel farm and camp', () => {
    const magazines = structures.filter((s) => s.kind === 'magazine');
    const protectedIds = structures.filter((s) => s.id === 'workshop' || s.id.startsWith('fuel-') || s.kind === 'camp');
    expect(magazines).toHaveLength(2);
    expect(protectedIds.map((s) => s.id)).toEqual(expect.arrayContaining(['workshop', 'fuel-bund', 'fuel-bay', 'camp']));
    for (const m of magazines) for (const s of protectedIds) expect(rectDistance(footprint(m), footprint(s)), `${m.id}–${s.id}`).toBeGreaterThanOrEqual(500);
  });

  it('give the stockyard a windrow structure per declared windrow', () => {
    expect(structures.filter((s) => s.id.startsWith('windrow-'))).toHaveLength(LAYOUT.stockyard.windrows);
  });

  it('keep the balloon loop at radius ≥ 200 m, clear of everything but the loadout bin over the track', () => {
    expect(railLoop.radius).toBeGreaterThanOrEqual(200);
    const bin = byId('loadout');
    const bc = centreOf(bin);
    expect(Math.abs(Math.hypot(bc.x - railLoop.centre.x, bc.y - railLoop.centre.y) - railLoop.radius)).toBeLessThan(2);
    for (const s of structures.filter((t) => t.id !== 'loadout')) {
      for (const p of rectPerimeter(footprint(s))) {
        expect(Math.abs(Math.hypot(p.x - railLoop.centre.x, p.y - railLoop.centre.y) - railLoop.radius), s.id).toBeGreaterThan(5);
      }
    }
  });
});

describe('arrangement (screen compass: north is up the screen)', () => {
  const mid = screen({ x: BOARD.w / 2, y: BOARD.h / 2 });
  const at = (id: string) => screen(centreOf(byId(id)));
  const pitC = screen(pit.centre);

  it('puts the pit west of centre, then ROM pad and crusher, the stockyard, and the camp in turn eastward', () => {
    expect(pitC.sx).toBeLessThan(mid.sx);
    expect(at('crusher').sx).toBeGreaterThan(pitC.sx);
    expect(at('windrow-1').sx).toBeGreaterThan(at('crusher').sx);
    expect(at('camp').sx).toBe(Math.max(...structures.map((s) => screen(centreOf(s)).sx)));
  });

  it('puts the balloon loop south-east, the workshop and fuel farm north-east', () => {
    const loop = screen(railLoop.centre);
    expect(loop.sx).toBeGreaterThan(mid.sx);
    expect(loop.sy).toBeGreaterThan(mid.sy);
    for (const id of ['workshop', 'fuel-bund', 'fuel-bay']) {
      expect(at(id).sx, id).toBeGreaterThan(mid.sx);
      expect(at(id).sy, id).toBeLessThan(mid.sy);
    }
  });

  it('puts the magazine in the far corner: the westernmost structure, near the board corner (0, h)', () => {
    const west = Math.min(...structures.map((s) => screen(centreOf(s)).sx));
    for (const m of structures.filter((s) => s.kind === 'magazine')) {
      expect(screen(centreOf(m)).sx).toBeLessThan(west + 80);
      expect(Math.hypot(centreOf(m).x, centreOf(m).y - BOARD.h)).toBeLessThan(250);
    }
  });

  it('runs the conveyor over the creek from the crusher to the stockyard', () => {
    const start = CONVEYOR.at(0).p;
    const crusher = byId('crusher');
    expect(rectDistance({ x: start.x, y: start.y, w: 0, h: 0 }, footprint(crusher))).toBeLessThan(1);
    const pts = samples(CONVEYOR, 1);
    const overCreek = pts.filter((p) => distToPolyline(p, LAYOUT.creek) < 5);
    expect(overCreek.length).toBeGreaterThan(0);
    overCreek.forEach((p) => expect(p.z).toBeGreaterThanOrEqual(8));
    const gallery = byId('overland-gallery');
    const onGallery = pts.filter((p) => p.x >= gallery.at.x && p.x <= gallery.at.x + gallery.size.x);
    expect(onGallery.length).toBeGreaterThan(100);
    onGallery.forEach((p) => {
      expect(p.z).toBeCloseTo(gallery.size.z, 9);
      expect(p.y).toBeCloseTo(gallery.at.y + gallery.size.y / 2, 9);
    });
    const yard = LAYOUT.stockyard.at;
    expect(insidePolygon(pts[pts.length - 1]!, [
      { x: yard.x, y: yard.y }, { x: yard.x + yard.w, y: yard.y }, { x: yard.x + yard.w, y: yard.y + yard.h }, { x: yard.x, y: yard.y + yard.h },
    ])).toBe(true);
  });

  it('keeps conveyor inclines within a troughed belt’s 18°', () => {
    for (let s = 0; s + 1 < CONVEYOR.length; s += 1) {
      const a = CONVEYOR.at(s).p;
      const b = CONVEYOR.at(s + 1).p;
      const run = Math.hypot(b.x - a.x, b.y - a.y);
      if (run > 0.01) expect(Math.atan2(Math.abs(b.z - a.z), run)).toBeLessThanOrEqual((18 * Math.PI) / 180 + 1e-9);
    }
  });

  it('frames the pit, ROM pad and crusher by default', () => {
    const f = LAYOUT.defaultFocus;
    const c = footprint(byId('crusher'));
    expect(f.x).toBeLessThanOrEqual(pit.centre.x - crest.radiusX);
    expect(f.y).toBeLessThanOrEqual(pit.centre.y - crest.radiusY);
    expect(f.y + f.h).toBeGreaterThanOrEqual(pit.centre.y + crest.radiusY);
    expect(f.x + f.w).toBeGreaterThanOrEqual(c.x + c.w);
    expect(f.y).toBeLessThanOrEqual(c.y);
    expect(f.y + f.h).toBeGreaterThanOrEqual(c.y + c.h);
  });
});

describe('process areas and entry posts', () => {
  it('give every register process an area whose flag pole stands on its own pad', () => {
    const ids = register.processes.map((p) => p.id);
    expect(Object.keys(areas).sort()).toEqual([...ids].sort());
    for (const [id, a] of Object.entries(areas)) expect(insidePolygon(a.anchor, a.pad), id).toBe(true);
  });

  it('keep pads off the pit, except the drill pattern on the first bench', () => {
    for (const [id, a] of Object.entries(areas)) {
      if (id === 'drill-and-blast') {
        expect(a.anchor.z).toBe(pit.benches[0]!.floorZ);
        continue;
      }
      expect(a.anchor.z, id).toBe(0);
      for (const p of a.pad) expect(crestValue(p, 0), id).toBeGreaterThan(1);
    }
  });

  it('keep flag poles off roads and outside buildings', () => {
    for (const [id, a] of Object.entries(areas)) {
      for (const r of roads) expect(distToPolyline(a.anchor, r.points), `${id} on ${r.id}`).toBeGreaterThan(r.width / 2);
      for (const s of structures) expect(rectDistance({ x: a.anchor.x, y: a.anchor.y, w: 0, h: 0 }, footprint(s)), `${id} in ${s.id}`).toBeGreaterThan(0);
    }
  });

  it('set the entry posts in a row along the default framing\'s north edge, left to right in card order, clear of everything', () => {
    expect(Object.keys(entryPosts)).toEqual(SERVICE_GROUPS.map((g) => g.id));
    const posts = SERVICE_GROUPS.map((g) => entryPosts[g.id]!);
    const xs = posts.map((p) => screen(p).sx);
    for (let i = 1; i < xs.length; i++) expect(xs[i]! - xs[i - 1]!).toBeGreaterThan(100); // spread, not bunched
    // One row: the same world y, just north of the framing's north edge.
    const f = LAYOUT.defaultFocus;
    for (const p of posts) {
      expect(p.y).toBe(posts[0]!.y);
      expect(p.y).toBeLessThan(f.y);
      expect(p.y).toBeGreaterThan(f.y - 40);
      expect(p.x).toBeGreaterThan(f.x);
      expect(p.x).toBeLessThan(f.x + f.w);
    }
    // A 3 × 3 m post, at least 10 m from every road edge, pad, structure and flag, and outside the pit's setback.
    for (const [i, p] of posts.entries()) {
      const id = SERVICE_GROUPS[i]!.id;
      const foot = { x: p.x - 1.5, y: p.y - 1.5, w: 3, h: 3 };
      for (const r of roads) expect(distToPolyline(p, r.points) - r.width / 2, `${id} by ${r.id}`).toBeGreaterThan(10);
      for (const s of structures) expect(rectDistance(foot, footprint(s)), `${id} by ${s.id}`).toBeGreaterThan(10);
      for (const [aid, a] of Object.entries(areas)) {
        expect(insidePolygon(p, a.pad), `${id} on ${aid}`).toBe(false);
        expect(distToPolyline(p, [...a.pad, a.pad[0]!]), `${id} by ${aid}`).toBeGreaterThan(10);
        expect(Math.hypot(p.x - a.anchor.x, p.y - a.anchor.y), `${id} by ${aid}'s flag`).toBeGreaterThan(10);
      }
      expect(crestValue(p, 30), id).toBeGreaterThan(1);
    }
  });

  it('put every entry post inside the stage at the default views, with room for its cable to drop onto it', () => {
    // The diorama's box at 1440 × 900, 1150 × 800, 1024 × 768 and 820 × 1180 (the stage between the card and legend bands).
    for (const view of [{ w: 1068, h: 580 }, { w: 1150, h: 440 }, { w: 1024, h: 408 }, { w: 820, h: 512.5 }]) {
      const cam = defaultCamera('site', view, false);
      const tops = SERVICE_GROUPS.map((g) => project({ ...entryPosts[g.id]!, z: ENTRY_POST_H }, cam));
      for (const t of tops) {
        expect(t.sx, `${view.w}`).toBeGreaterThan(20);
        expect(t.sx, `${view.w}`).toBeLessThan(view.w - 20);
        expect(t.sy, `${view.w}`).toBeLessThan(view.h - 20);
      }
      const routes = cableRoutes(SERVICE_GROUPS.map((_, i) => cableFraction(i) * view.w), tops.map((t) => ({ x: t.sx, y: t.sy })));
      for (const [i, r] of routes.entries()) expect(r.reaches, `${SERVICE_GROUPS[i]!.id} at ${view.w}`).toBe(true);
    }
  });
});

describe('everything inside the board', () => {
  it('structures, pads, roads, posts, creek, ridge, loop, focus and every path', () => {
    for (const s of structures) for (const p of rectPerimeter(footprint(s))) expect(inBoard(p), s.id).toBe(true);
    for (const a of Object.values(areas)) [a.anchor, ...a.pad].forEach((p) => expect(inBoard(p)).toBe(true));
    for (const r of roads) r.points.forEach((p) => expect(inBoard(p), r.id).toBe(true));
    Object.values(entryPosts).forEach((p) => expect(inBoard(p)).toBe(true));
    [...LAYOUT.creek, ...LAYOUT.ridge].forEach((p) => expect(inBoard(p)).toBe(true));
    const { centre, radius } = railLoop;
    [{ x: centre.x - radius, y: centre.y - radius }, { x: centre.x + radius, y: centre.y + radius }].forEach((p) => expect(inBoard(p)).toBe(true));
    const f = LAYOUT.defaultFocus;
    [{ x: f.x, y: f.y }, { x: f.x + f.w, y: f.y + f.h }].forEach((p) => expect(inBoard(p)).toBe(true));
    [{ x: pit.centre.x - crest.radiusX, y: pit.centre.y - crest.radiusY }, { x: pit.centre.x + crest.radiusX, y: pit.centre.y + crest.radiusY }].forEach((p) => expect(inBoard(p)).toBe(true));
    for (const path of [HAUL_CYCLE, RAIL_LOOP, LV_LOOP, CONVEYOR]) samples(path, 5).forEach((p) => expect(inBoard(p)).toBe(true));
  });
});

describe('paths', () => {
  it('wrap s and move continuously, including across the seam', () => {
    for (const path of [HAUL_CYCLE, RAIL_LOOP, LV_LOOP, CONVEYOR]) {
      expect(dist3(path.at(path.length + 3).p, path.at(3).p)).toBeLessThan(1e-6);
      expect(dist3(path.at(-3).p, path.at(path.length - 3).p)).toBeLessThan(1e-6);
    }
    for (const path of [HAUL_CYCLE, RAIL_LOOP, LV_LOOP]) {
      expect(dist3(path.at(path.length - 1).p, path.at(0).p)).toBeLessThanOrEqual(1 + 1e-6);
      for (let s = 0; s < path.length; s += 0.5) expect(dist3(path.at(s).p, path.at(s + 0.5).p)).toBeLessThanOrEqual(0.5 + 1e-6);
    }
  });

  it('report a heading along the direction of travel', () => {
    for (const path of [HAUL_CYCLE, RAIL_LOOP, LV_LOOP, CONVEYOR]) {
      for (const s of [10, path.length / 3, path.length / 2]) {
        const { p, heading } = path.at(s);
        const q = path.at(s + 0.01).p;
        if (Math.hypot(q.x - p.x, q.y - p.y) < 1e-4) continue;
        expect(Math.cos(heading - Math.atan2(q.y - p.y, q.x - p.x))).toBeGreaterThan(0.999);
      }
    }
  });

  it('run the haul cycle from the dump pocket down the ramp to the pit floor', () => {
    const pts = samples(HAUL_CYCLE, 1);
    expect(Math.min(...pts.map((p) => dist3(p, LAYOUT.dumpPocket)))).toBeLessThanOrEqual(HAUL_LANE_OFFSET + 0.5);
    const onFloor = pts.filter((p) => p.z === floor.floorZ);
    expect(onFloor.length).toBeGreaterThan(20);
    const toeX = floor.radiusX - BATTER_RUN;
    const toeY = floor.radiusY - BATTER_RUN;
    for (const p of onFloor) expect(((p.x - pit.centre.x) / toeX) ** 2 + ((p.y - pit.centre.y) / toeY) ** 2).toBeLessThan(1);
    expect(Math.min(...pts.map((p) => dist3(p, pit.loadingPoint)))).toBeLessThanOrEqual(HAUL_LANE_OFFSET + 0.5);
    for (const p of pts) {
      expect(p.z).toBeGreaterThanOrEqual(-60);
      expect(p.z).toBeLessThanOrEqual(0);
      // On the surface a lane is never more than its offset inside the crest; below it, never outside it.
      if (p.z === 0) expect(crestValue(p, -(HAUL_LANE_OFFSET + 0.5))).toBeGreaterThan(1);
      else expect(crestValue(p, HAUL_LANE_OFFSET + 0.5)).toBeLessThan(1);
    }
  });

  it('keep the two haul lanes 9.2 m apart, one each side of the centreline', () => {
    expect(2 * HAUL_LANE_OFFSET).toBeCloseTo(9.2, 9);
    const ends = [HAUL_CENTRELINE[0]!, HAUL_CENTRELINE[HAUL_CENTRELINE.length - 1]!];
    const sides = new Set<number>();
    for (let s = 0; s < HAUL_CYCLE.length; s += 3) {
      const p = HAUL_CYCLE.at(s).p;
      if (ends.some((e) => dist3(p, e) < 2 * HAUL_LANE_OFFSET)) continue;
      let best = Infinity;
      let side = 0;
      for (let i = 1; i < HAUL_CENTRELINE.length; i++) {
        const [a, b] = [HAUL_CENTRELINE[i - 1]!, HAUL_CENTRELINE[i]!];
        const d = segDist3(p, a, b);
        if (d < best) {
          best = d;
          side = Math.sign((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x));
        }
      }
      expect(Math.abs(best - HAUL_LANE_OFFSET), `s=${s}`).toBeLessThan(0.3);
      sides.add(side);
    }
    expect([...sides].sort()).toEqual([-1, 1]);
  });

  it('circle the balloon loop at its radius', () => {
    expect(RAIL_LOOP.length).toBeCloseTo(2 * Math.PI * railLoop.radius, 6);
    for (const p of samples(RAIL_LOOP, 25)) expect(Math.hypot(p.x - railLoop.centre.x, p.y - railLoop.centre.y)).toBeCloseTo(railLoop.radius, 6);
  });

  it('keep light vehicles on the access road', () => {
    const access = roads.find((r) => r.id === 'access')!;
    for (const p of samples(LV_LOOP, 3)) expect(distToPolyline(p, access.points)).toBeLessThanOrEqual(access.width / 2);
  });
});

describe('spinifexPoints', () => {
  it('is deterministic per seed', () => {
    expect(spinifexPoints(7)).toEqual(spinifexPoints(7));
    expect(spinifexPoints(7)).not.toEqual(spinifexPoints(8));
    expect(spinifexPoints(7).length).toBeGreaterThanOrEqual(1000);
  });

  it('grows only on open ground: never on roads, pads, structures, the pit, the creek bed or the rail', () => {
    for (const p of spinifexPoints(7)) {
      expect(inBoard(p)).toBe(true);
      expect(crestValue(p, 0)).toBeGreaterThan(1);
      for (const r of roads) expect(distToPolyline(p, r.points)).toBeGreaterThan(r.width / 2);
      for (const a of Object.values(areas)) expect(insidePolygon(p, a.pad)).toBe(false);
      for (const s of structures) expect(rectDistance({ x: p.x, y: p.y, w: 0, h: 0 }, footprint(s))).toBeGreaterThan(0);
      expect(distToPolyline(p, LAYOUT.creek)).toBeGreaterThan(15);
      expect(Math.abs(Math.hypot(p.x - railLoop.centre.x, p.y - railLoop.centre.y) - railLoop.radius)).toBeGreaterThan(5);
    }
  });
});

function segDist3(p: Vec3, a: Vec3, b: Vec3): number {
  const d = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
  const len2 = d.x * d.x + d.y * d.y + d.z * d.z;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * d.x + (p.y - a.y) * d.y + (p.z - a.z) * d.z) / len2));
  return dist3(p, { x: a.x + t * d.x, y: a.y + t * d.y, z: a.z + t * d.z });
}
