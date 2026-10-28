import { centreOn, clampCamera, fitCamera, K_MAX, K_MIN, project } from './iso.js';
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
 * beyond, every area's flag, and every entry post. The margins are stage pixels: room above the posts for the
 * cables' buses, beside the corner for floor, and below the lowest flag.
 */
export const SITE_FRAME = {
  points: [
    plinthFoot(0),
    plinthFoot(500),
    ...Object.values(LAYOUT.areas).map((a) => a.anchor),
    ...Object.values(LAYOUT.entryPosts).map((p) => ({ ...p, z: ENTRY_POST_H })),
  ],
  margin: { top: 76, right: 28, bottom: 22, left: 16 },
} as const;

/** The landing hero's scale, pixels per metre (DESIGN.md Layout, Projection). */
export const HERO_K = 1.18;
/** The ground point at the hero's centre: between the pit's east wall, the ROM pad and the crusher's dump pocket. */
export const HERO_FOCUS = { x: 850, y: 440 } as const;

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
 * crops to the working area instead (DESIGN.md Layout, Phone). The hero is a fixed k = `HERO_K` crop centred
 * on `HERO_FOCUS`, the same on every width.
 */
export function defaultCamera(framing: Framing, view: Size, phone: boolean): Camera {
  if (framing === 'hero') return centreOn(HERO_FOCUS, HERO_K, view);
  if (phone) return clampCamera(fitCamera(BOARD, view, LAYOUT.workingArea), BOARD, view);
  return clampCamera(fitPoints(SITE_FRAME.points, view, SITE_FRAME.margin), BOARD, view);
}
