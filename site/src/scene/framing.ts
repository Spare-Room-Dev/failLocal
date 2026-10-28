import { HERO_LABEL } from './cables.js';
import { clampCamera, fitCamera, K_MAX, K_MIN, project } from './iso.js';
import type { Camera, Vec3 } from './iso.js';
import { BOARD, ENTRY_POST_H, LAYOUT, PLINTH_DEPTH, SLAB_DEPTH } from './layout.js';

type Size = { w: number; h: number };

/** Which default view a diorama opens on: the site page's working view, or the welcome page's hero crop. */
export type Framing = 'site' | 'hero';

/** The plinth's foot along the board's front-left face (y = BOARD.h), at world x. */
const plinthFoot = (x: number): Vec3 => ({ x, y: BOARD.h, z: -SLAB_DEPTH - PLINTH_DEPTH });

/**
 * What the site opens on (DESIGN.md Layout; finish review A1): the model as an object on its plinth. The board's
 * front-left corner and the first stretch of its cut-away face (where the plate is engraved) with gallery floor
 * beyond, every area's flag, and every entry post. The margins are stage pixels: room above the posts (drawn at
 * least `POST_MIN_H` tall, cables.ts) for the cables' buses, beside the corner for floor, and below the lowest flag.
 */
export const SITE_FRAME = {
  points: [
    plinthFoot(0),
    plinthFoot(500),
    ...Object.values(LAYOUT.areas).map((a) => a.anchor),
    ...Object.values(LAYOUT.entryPosts).map((p) => ({ ...p, z: ENTRY_POST_H })),
  ],
  margin: { top: 90, right: 28, bottom: 22, left: 16 },
} as const;

/** Points round the pit's crest, so a frame holds the whole pit. */
const PIT_RING: Vec3[] = Array.from({ length: 16 }, (_, i) => {
  const a = (i / 16) * 2 * Math.PI;
  const { centre, benches } = LAYOUT.pit;
  return { x: centre.x + benches[0]!.radiusX * Math.cos(a), y: centre.y + benches[0]!.radiusY * Math.sin(a), z: 0 };
});

/**
 * The welcome hero (DESIGN.md Layout, Landing; re-derived from the approved welcome comp, finish review A2): the
 * board as an object on the gallery floor, from its back corner (under the five cabled labels) to its whole
 * front-left face (corner to corner, with the plate), the whole pit at its heart and every entry post in frame;
 * the rest of the board runs off the right edge. On a phone, where the labels and cables are hidden, the pit with the stretch of face below it.
 */
export const HERO_FRAME = {
  desktop: {
    points: [{ x: 0, y: 0, z: 0 }, plinthFoot(0), plinthFoot(BOARD.w), ...PIT_RING, ...Object.values(LAYOUT.entryPosts).map((p) => ({ ...p, z: ENTRY_POST_H }))],
    margin: { top: HERO_LABEL.top + HERO_LABEL.h + 12, right: 20, bottom: 36, left: 28 },
  },
  phone: {
    points: [plinthFoot(300), plinthFoot(1100), ...PIT_RING],
    margin: { top: 10, right: 10, bottom: 14, left: 10 },
  },
} as const;

/**
 * The camera at which every point fits inside the view less its margins, as large as it can be, the points'
 * box centred in the space left over. k is clamped to [K_MIN, K_MAX].
 */
export function fitPoints(points: readonly Vec3[], view: Size, margin: { top: number; right: number; bottom: number; left: number }): Camera {
  const unit = points.map((p) => project(p, { k: 1, ox: 0, oy: 0 }));
  const xs = unit.map((p) => p.sx);
  const ys = unit.map((p) => p.sy);
  const box = { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  const room = { w: view.w - margin.left - margin.right, h: view.h - margin.top - margin.bottom };
  const k = Math.min(K_MAX, Math.max(K_MIN, Math.min(room.w / (box.x1 - box.x0), room.h / (box.y1 - box.y0))));
  return {
    k,
    ox: margin.left + (room.w - (box.x1 - box.x0) * k) / 2 - box.x0 * k,
    oy: margin.top + (room.h - (box.y1 - box.y0) * k) / 2 - box.y0 * k,
  };
}

/**
 * The camera a diorama opens on, and returns to on Fit or `0`. The site fits `SITE_FRAME`; on a phone it
 * crops to the working area instead (DESIGN.md Layout, Phone). The hero fits `HERO_FRAME`.
 */
export function defaultCamera(framing: Framing, view: Size, phone: boolean): Camera {
  if (framing === 'hero') {
    const f = phone ? HERO_FRAME.phone : HERO_FRAME.desktop;
    return fitPoints(f.points, view, f.margin);
  }
  if (phone) return clampCamera(fitCamera(BOARD, view, LAYOUT.workingArea), BOARD, view);
  return clampCamera(fitPoints(SITE_FRAME.points, view, SITE_FRAME.margin), BOARD, view);
}
