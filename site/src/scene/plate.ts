import { project } from './iso.js';
import type { Camera } from './iso.js';
import { BOARD, PLINTH_DEPTH, SLAB_DEPTH } from './layout.js';

type Size = { w: number; h: number };
type Pt = { x: number; y: number };

/** Kept between the plate and the stage's edges, px. */
const MARGIN = 8;
/** The plate's top edge sits this far down the plinth face, as a fraction of its height. */
const ON_FACE = 0.5;

/**
 * Where the honesty plate's top-left corner goes, in stage pixels: hung from the plinth face along the
 * board's front-left edge (y = BOARD.h), its top-right corner on that face, as far left as the plate fits
 * whole inside the stage. The face falls to the right on screen, so a plate hung from it lies on the gallery
 * floor clear of the board. Null when no part of the face can hold it (zoomed or panned away from the front
 * edge): the caller then pins the plate to the bottom of the stage.
 */
export function platePosition(cam: Camera, view: Size, size: Size): Pt | null {
  const z = -SLAB_DEPTH - ON_FACE * PLINTH_DEPTH;
  const at = (x: number) => project({ x, y: BOARD.h, z }, cam);
  // Along the edge, screen x and y both grow with world x: take the first world x where the plate clears
  // the stage's left and top edges, then check it still clears the right and bottom.
  const clearsLeft = (MARGIN + size.w - cam.ox) / cam.k + BOARD.h;
  const clearsTop = (2 * (MARGIN - at(0).sy)) / cam.k;
  const x0 = Math.max(0, clearsLeft, clearsTop);
  if (x0 > BOARD.w) return null;
  const corner = at(x0);
  if (corner.sx > view.w - MARGIN || corner.sy < MARGIN || corner.sy + size.h > view.h - MARGIN) return null;
  return { x: corner.sx - size.w, y: corner.sy };
}
