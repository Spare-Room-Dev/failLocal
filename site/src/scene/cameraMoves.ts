import { clampCamera, K_MAX, K_MIN, unproject } from './iso.js';
import type { Camera } from './iso.js';

type Size = { w: number; h: number };

/** One `+` or `-` press zooms by this factor about the view centre. */
export const KEY_ZOOM = 1.25;

/** Zoom by `factor` about screen point (sx, sy): the ground under it stays put (until k or the board clamps). */
export function zoomAt(cam: Camera, factor: number, sx: number, sy: number, board: Size, view: Size): Camera {
  const k = Math.min(K_MAX, Math.max(K_MIN, cam.k * factor));
  const g = unproject(sx, sy, cam);
  // ox, oy such that project(g, next) = (sx, sy).
  const next = { k, ox: sx - (g.x - g.y) * k, oy: sy - ((g.x + g.y) * k) / 2 };
  return clampCamera(next, board, view);
}

/** Move the board by (dx, dy) screen pixels, as a drag does. */
export function panBy(cam: Camera, dx: number, dy: number, board: Size, view: Size): Camera {
  return clampCamera({ k: cam.k, ox: cam.ox + dx, oy: cam.oy + dy }, board, view);
}

/** The camera after a key press with the scene focused, or null when the key is not a camera key. `0` returns to `fit`. */
export function keyMove(key: string, cam: Camera, board: Size, view: Size, fit: Camera): Camera | null {
  if (key === '+' || key === '=') return zoomAt(cam, KEY_ZOOM, view.w / 2, view.h / 2, board, view);
  if (key === '-' || key === '_') return zoomAt(cam, 1 / KEY_ZOOM, view.w / 2, view.h / 2, board, view);
  if (key === '0') return fit;
  return null;
}
