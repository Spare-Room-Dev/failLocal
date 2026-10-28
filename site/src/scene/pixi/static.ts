import { AlphaFilter, BlurFilter, Container, Graphics, Text } from 'pixi.js';
import { mix } from '../iso.js';
import { BOARD } from '../layout.js';
import { token } from '../palette.js';
import { DepthQueue, fill, P } from './draw.js';
import { buildPit } from './pit.js';
import { drawPads, drawRoads, MAIN_LINE, queueFixtures, queueSpinifex, queueStructures, Shadows } from './plant.js';
import { drawCreek, drawGround, drawLip, drawPlinthShadow, drawRidge, drawSlab, plantGums, PLINTH_DEPTH, SLAB_DEPTH } from './terrain.js';

/**
 * The diorama's static world, built once at k = 1 into containers (the world container applies the
 * camera, so nothing is redrawn on zoom or pan). Draw order: the plinth and its shadow; the cut-away
 * slab with its strata and the engraved plate; the faceted ground; the ridge and the creek; the pit
 * (benches, ramp, sump); roads and rail; pads; the cast shadows; then structures, gums and spinifex
 * in one painter's pass by depth. Shadows go under the plant rather than over it, so a shed's own
 * shadow never darkens its walls, and spinifex sorts with the plant so a shed hides the tussock behind it.
 */
export interface StaticWorld {
  root: Container;
  /** Screen-space effects that must follow the zoom: the blur radii. */
  setZoom(k: number): void;
}

/** Blur radius of cast shadows (DESIGN.md: about 1.6·k px) and of the plinth's floor shadow. */
const SHADOW_BLUR = 1.6;
const PLINTH_BLUR = 16;

export function buildStatic(plateText: string, resolution: number): StaticWorld {
  const root = new Container({ label: 'static' });

  const floorShadow = new Graphics();
  drawPlinthShadow(floorShadow);
  const floorBlur = new BlurFilter({ strength: PLINTH_BLUR, quality: 2 });
  floorShadow.filters = [floorBlur];

  const slab = new Graphics();
  drawSlab(slab);

  const terrain = new Graphics();
  drawGround(terrain);
  const ridgeShadow = drawRidge(terrain);
  drawCreek(terrain);

  const ground = new Graphics();
  drawRoads(ground);
  drawPads(ground);
  drawLip(ground);

  const shadowLayer = new Graphics();
  const shadows = new Shadows(shadowLayer);
  for (const piece of ridgeShadow) shadows.poly(piece);
  const castBlur = new BlurFilter({ strength: SHADOW_BLUR, quality: 2 });
  shadowLayer.filters = [castBlur, new AlphaFilter({ alpha: 0.34 })];

  const queue = new DepthQueue();
  for (const s of plantGums(queue)) shadows.disc(s.c, s.r * 1.5, s.r * 0.75);
  queueStructures(queue, shadows);
  queueFixtures(queue);
  queueSpinifex(queue, shadows);
  const objects = new Graphics();
  queue.flush(objects);

  root.addChild(floorShadow, slab, engraving(plateText, resolution), terrain, buildPit(), ground, shadowLayer, objects);
  return {
    root,
    setZoom(k) {
      floorBlur.strength = PLINTH_BLUR * k;
      castBlur.strength = SHADOW_BLUR * k;
    },
  };
}

/** Text set in the plane of a board face: along +x on the front-left face, along −y on the front-right. */
function faceText(text: string, size: number, colour: string, resolution: number, along: 'x' | '-y'): Text {
  const t = new Text({
    text,
    resolution,
    style: { fontFamily: '"Archivo Variable", system-ui, sans-serif', fontSize: size, fontWeight: '600', letterSpacing: size * 0.12, fill: colour },
  });
  t.anchor.set(0, 0.5);
  t.skew.y = (along === 'x' ? 1 : -1) * Math.atan(0.5);
  return t;
}

/** The engraved plate and the 100 m scale bar on the plinth's front-left face, and the rail's destination on the slab. */
function engraving(plateText: string, resolution: number): Container {
  const c = new Container({ label: 'engraving' });
  const ink = token('plate-engraving');
  const z = -SLAB_DEPTH - PLINTH_DEPTH / 2;
  const plate = faceText(plateText, 9.5, ink, resolution, 'x');
  plate.position.set(...P({ x: 40, y: BOARD.h, z }));

  const bar = new Graphics();
  const x0 = BOARD.w - 330;
  const strip = (from: number, to: number) => [
    { x: from, y: BOARD.h, z: z + 0.7 },
    { x: to, y: BOARD.h, z: z + 0.7 },
    { x: to, y: BOARD.h, z: z - 0.7 },
    { x: from, y: BOARD.h, z: z - 0.7 },
  ];
  fill(bar, strip(x0, x0 + 50), ink);
  bar.poly(strip(x0 + 50, x0 + 100).flatMap((p) => P(p))).stroke({ color: ink, width: 0.7 });
  const label = faceText('100 m', 8.5, ink, resolution, 'x');
  label.position.set(...P({ x: x0 + 106, y: BOARD.h, z }));

  const exit = MAIN_LINE[MAIN_LINE.length - 1]!;
  const rail = faceText('RAIL TO PORT HEDLAND', 8.5, mix(token('shade-lite'), token('haul-road'), 0.15), resolution, '-y');
  // It reads up the face toward the back, ending under the point where the main line leaves the board.
  rail.position.set(...P({ x: BOARD.w, y: Math.min(BOARD.h - 5, exit.y + 118), z: -SLAB_DEPTH * 0.45 }));

  c.addChild(plate, bar, label, rail);
  return c;
}
