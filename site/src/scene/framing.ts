import { centreOn, clampCamera, fitCamera } from './iso.js';
import type { Camera } from './iso.js';
import { BOARD, LAYOUT } from './layout.js';

type Size = { w: number; h: number };

/** Which default view a diorama opens on: the site page's working view, or the welcome page's hero crop. */
export type Framing = 'site' | 'hero';

/** The landing hero's scale, pixels per metre (DESIGN.md Layout, Projection). */
export const HERO_K = 1.18;
/** The ground point at the hero's centre: between the pit's east wall, the ROM pad and the crusher's dump pocket. */
export const HERO_FOCUS = { x: 850, y: 440 } as const;

/**
 * The camera a diorama opens on, and returns to on Fit or `0`. The site frames the pit, ROM pad and crusher
 * (`LAYOUT.defaultFocus`); on a phone it crops to the working area instead (DESIGN.md Layout, Phone). The
 * hero is a fixed k = 1.18 crop centred on `HERO_FOCUS`, the same on every width.
 */
export function defaultCamera(framing: Framing, view: Size, phone: boolean): Camera {
  if (framing === 'hero') return centreOn(HERO_FOCUS, HERO_K, view);
  return clampCamera(fitCamera(BOARD, view, phone ? LAYOUT.workingArea : LAYOUT.defaultFocus), BOARD, view);
}
