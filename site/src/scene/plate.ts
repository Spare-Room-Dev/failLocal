import { project } from './iso.js';
import type { Camera } from './iso.js';
import { BOARD, PLINTH_DEPTH, SLAB_DEPTH } from './layout.js';

type Size = { w: number; h: number };
type Pt = { x: number; y: number };
type Box = { x: number; y: number; w: number; h: number };

/** Kept between the plate and the stage's edges, px. */
const MARGIN = 8;
/** The engraving starts this far along the front-left face from the board's corner, metres. */
const PLATE_START = 40;
/** The plate's line height, in ems (scene.css `.scene-plinth`). */
export const PLATE_LINE = 1.3;
/** The 2:1 face runs down-right at a slope of 1/2: the engraving's text runs along (cos, sin) of that angle. */
const COS = 2 / Math.sqrt(5);
const SIN = 1 / Math.sqrt(5);
/** The CSS transform that sets text, its origin at its left-centre, in the plane of the front-left face. */
export const FACE_TRANSFORM = `matrix(${COS}, ${SIN}, 0, 1, 0, 0)`;
/** Vertical factor of the projection (iso.ts). */
const Z_FACTOR = 1.2247;
/** The engraving's centre line: half way down the plinth face. */
const FACE_Z = -SLAB_DEPTH - PLINTH_DEPTH / 2;

/**
 * The engraving's font size at scale k, px: 0.55 of the plinth face's height (the proportion of DESIGN.md's
 * engraved plate), never under 9 px so it stays readable when the board is small on screen.
 */
export function plateFont(k: number): number {
  return Math.max(9, 0.55 * PLINTH_DEPTH * Z_FACTOR * k);
}

/**
 * Where the engraved plate goes, in stage pixels: the top-left of its text box `size` (before the face's skew;
 * its left-centre is the skew's origin), set in the plane of the board's front-left plinth face (y = BOARD.h),
 * from 40 m along the face, or further along where the start would leave the stage. Null when no stretch of the
 * face in view holds it whole inside the stage (zoomed or panned away from the front edge): the caller then
 * pins the plate to the bottom of the stage.
 */
export function platePosition(cam: Camera, view: Size, size: Size): Pt | null {
  const at = (x: number) => project({ x, y: BOARD.h, z: FACE_Z }, cam);
  // Along the face, screen x and y both grow with world x: take the first world x where the text's left-centre
  // clears the stage's left edge and its top clears the top, then check the rest still fits.
  const clearsLeft = (MARGIN - cam.ox) / cam.k + BOARD.h;
  const clearsTop = (2 * (MARGIN + size.h / 2 - at(0).sy)) / cam.k;
  const x0 = Math.max(PLATE_START, clearsLeft, clearsTop);
  const run = (size.w * COS) / cam.k;
  if (x0 + run > BOARD.w) return null;
  const start = at(x0);
  const end = { x: start.sx + size.w * COS, y: start.sy + size.w * SIN };
  if (end.x > view.w - MARGIN || end.y + size.h / 2 > view.h - MARGIN || start.sy - size.h / 2 < MARGIN) return null;
  return { x: start.sx, y: start.sy - size.h / 2 };
}

/** Where the plate is pinned while the face is out of view: its bottom-right corner this far in from the stage's (scene.css). */
export const PLATE_PINNED = { desktop: { right: 12, bottom: 10 }, phone: { right: 8, bottom: 8 } } as const;
/** The pinned plate's font size and padding, px (scene.css `.scene-plinth`). */
export const PLATE_PILL = { desktop: { font: 11, padX: 10, padY: 4 }, phone: { font: 9, padX: 7, padY: 3 } } as const;

export interface PlatePlacement {
  /** The plate's box, in stage pixels: on the face, its text box before the skew. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Engraved on the plinth face (true), or pinned to the bottom of the stage. */
  onFace: boolean;
  /** On the face, the engraving's font size, px. */
  font: number;
}

/**
 * The plate's box under camera `cam`: engraved on the plinth face where it fits (`platePosition`), otherwise
 * pinned bottom-right. `perPx` is the plate text's width per pixel of font size (measured from the page).
 */
export function placePlate(cam: Camera, view: Size, perPx: number, phone: boolean): PlatePlacement {
  const font = plateFont(cam.k);
  const face = { w: perPx * font, h: PLATE_LINE * font };
  const at = perPx > 0 ? platePosition(cam, view, face) : null;
  if (at) return { ...at, ...face, onFace: true, font };
  const pill = phone ? PLATE_PILL.phone : PLATE_PILL.desktop;
  const pin = phone ? PLATE_PINNED.phone : PLATE_PINNED.desktop;
  const w = perPx * pill.font + 2 * pill.padX;
  const h = PLATE_LINE * pill.font + 2 * pill.padY;
  return { x: view.w - pin.right - w, y: view.h - pin.bottom - h, w, h, onFace: false, font: pill.font };
}

/** The four corners of the plate as drawn, in stage pixels: on the face, its text box skewed into the face's plane. */
export function plateCorners(p: PlatePlacement): Pt[] {
  if (!p.onFace) return [{ x: p.x, y: p.y }, { x: p.x + p.w, y: p.y }, { x: p.x + p.w, y: p.y + p.h }, { x: p.x, y: p.y + p.h }];
  const run = { x: p.w * COS, y: p.w * SIN };
  return [{ x: p.x, y: p.y }, { x: p.x + run.x, y: p.y + run.y }, { x: p.x + run.x, y: p.y + run.y + p.h }, { x: p.x, y: p.y + p.h }];
}

/** Boxes covering the plate as drawn, grown by `pad`: one for a pinned plate, a run of short ones along an engraved one. */
export function plateBoxes(p: PlatePlacement, pad: number): Box[] {
  if (!p.w) return [];
  if (!p.onFace) return [{ x: p.x - pad, y: p.y - pad, w: p.w + 2 * pad, h: p.h + 2 * pad }];
  const pieces = Math.max(1, Math.ceil(p.w / 32));
  const step = { x: (p.w * COS) / pieces, y: (p.w * SIN) / pieces };
  return Array.from({ length: pieces }, (_, i) => ({
    x: p.x + i * step.x - pad,
    y: p.y + i * step.y - pad,
    w: step.x + 2 * pad,
    h: step.y + p.h + 2 * pad,
  }));
}
