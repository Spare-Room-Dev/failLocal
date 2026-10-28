import { Container, Graphics, Text } from 'pixi.js';
import type { SceneState } from '../../model/sceneState.js';
import { cableFraction, SERVICE_GROUPS } from '../../model/serviceGroups.js';
import type { AnimState } from '../animation.js';
import { CABLE, cableRoutes } from '../cables.js';
import type { CableRoute } from '../cables.js';
import { mix, project } from '../iso.js';
import type { Camera, Vec3 } from '../iso.js';
import { LAYOUT } from '../layout.js';
import { token } from '../palette.js';
import { dashes, pointAt, slice } from '../polyline.js';
import type { Pt } from '../polyline.js';
import { ENTRY_POST_H } from './dynamic.js';

/**
 * The board's screen-space marks, in stage pixels over the board (their sizes are pixel sizes, so they
 * are laid out again whenever the camera moves): the service cables, the parked trucks' pause markers,
 * and the survey flags and plaques. All of it is read off `SceneState`; only the cable dots and the
 * cut-link pulse animate.
 */
export interface Overlay {
  /** The engine state (and the selected area) changed. */
  setScene(scene: SceneState, selected: string | null): void;
  /** Draws one frame under camera `cam` in a `view`-sized stage. `clock` (s) drives the cut-link pulse. */
  frame(a: AnimState, scene: SceneState, cam: Camera, view: { w: number; h: number }, clock: number, reduced: boolean): void;
}

export interface OverlayOptions {
  /** Cables and plaques: off for the decorative welcome scene, which has no cards to cable to. */
  labels: boolean;
  /** Pixel density for overlay text. */
  resolution: number;
}

const c = (name: string) => token(name);
const INK = c('ink');
const PAPER = c('paper');
const STOP_RED = c('stop-red');
const FONT = '"Archivo Variable", system-ui, sans-serif';
/** Phones hide the cables (DESIGN.md Layout, Phone). */
const PHONE = '(max-width: 760px)';

export function buildOverlay(screen: Container, options: OverlayOptions): Overlay {
  const cables = new Graphics({ label: 'cables' });
  const cableLabels = SERVICE_GROUPS.map(() => label(options.resolution));
  const markers = new Graphics({ label: 'parked-markers' });
  const flags = Object.keys(LAYOUT.areas).map((id) => new Plaque(id, options.resolution));
  screen.addChild(cables, ...cableLabels.map((l) => l.root), markers, ...flags.map((f) => f.root));
  const phone = typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(PHONE) : null;

  // Cable routes depend only on the camera and the stage size.
  let routes: CableRoute[] = [];
  let routeKey = '';
  let placedKey = '';

  return {
    setScene(scene, selected) {
      for (const f of flags) f.set(scene, selected, options.labels);
      placedKey = '';
    },
    frame(a, scene, cam, view, clock, reduced) {
      const key = `${cam.k},${cam.ox},${cam.oy},${view.w},${view.h}`;
      if (key !== placedKey) {
        placedKey = key;
        for (const f of flags) f.place(cam);
      }
      drawMarkers(markers, a, cam);
      const showCables = options.labels && !phone?.matches;
      cables.visible = showCables;
      for (const l of cableLabels) l.root.visible = false;
      if (!showCables) return;
      if (key !== routeKey) {
        routeKey = key;
        routes = cableRoutes(
          SERVICE_GROUPS.map((_, i) => cableFraction(i) * view.w),
          SERVICE_GROUPS.map((g) => {
            const { sx, sy } = project({ ...LAYOUT.entryPosts[g.id]!, z: ENTRY_POST_H }, cam);
            return { x: sx, y: sy };
          }),
        );
      }
      drawCables(cables, cableLabels, routes, a, scene, view, clock, reduced);
    },
  };
}

/** The boxed pause glyph on a short post over each parked truck (DESIGN.md Survey Flags: Parked). */
function drawMarkers(g: Graphics, a: AnimState, cam: Camera): void {
  g.clear();
  // Every other post is taller, so neighbours' glyphs stay apart where the bay is small on screen.
  let n = 0;
  for (const t of a.trucks) {
    if (!t.parked) continue;
    const { sx, sy } = project({ ...t.pos, z: t.pos.z + 9 }, cam);
    const post = n++ % 2 ? 23 : 11;
    g.moveTo(sx, sy).lineTo(sx, sy - post).stroke({ color: INK, width: 1 });
    g.roundRect(sx - 5.5, sy - post - 11, 11, 11, 1.5).fill(PAPER).stroke({ color: INK, width: 1 });
    g.rect(sx - 2.6, sy - post - 8.6, 1.7, 6.2).fill(INK);
    g.rect(sx + 0.9, sy - post - 8.6, 1.7, 6.2).fill(INK);
  }
}

interface Label {
  root: Container;
  box: Graphics;
  text: Text;
}

function label(resolution: number): Label {
  const root = new Container({ label: 'cable-label' });
  const box = new Graphics();
  const text = new Text({ text: '', resolution, style: { fontFamily: FONT, fontSize: 10.5, fontWeight: '700', fill: STOP_RED } });
  root.addChild(box, text);
  return { root, box, text };
}

/** Ink, 1.5 px, octilinear (cables.ts); a live cable carries a travelling dot, a severed one breaks, a revoked one is dashed. */
function drawCables(g: Graphics, labels: Label[], routes: CableRoute[], a: AnimState, scene: SceneState, view: { w: number; h: number }, clock: number, reduced: boolean): void {
  g.clear();
  const stroke = (pts: Pt[], width: number, alpha = 1) => g.poly(pts.flatMap((p) => [p.x, p.y]), false).stroke({ color: INK, width, alpha, join: 'miter', cap: 'butt' });
  SERVICE_GROUPS.forEach((grp, i) => {
    const r = routes[i]!;
    const state = scene.cables[grp.id];
    if (state === 'live') {
      stroke(r.points, 1.5);
      const dot = reduced ? r.corner : pointAt(r.points, (a.cableDots[grp.id] ?? 0) * r.length).p;
      g.circle(dot.x, dot.y, 2.4).fill(PAPER).stroke({ color: INK, width: 1.2 });
      return;
    }
    const at = pointAt(r.points, r.breakAt);
    const lbl = labels[i]!;
    if (state === 'severed') {
      stroke(slice(r.points, 0, r.breakAt), 1.5);
      const after = r.breakAt + CABLE.breakGap;
      for (const d of dashes(slice(r.points, after, r.length), 3, 6)) stroke(d, 1.3, 0.55);
      const second = pointAt(r.points, after);
      for (const b of [at, second]) {
        const n = { x: -b.dir.y, y: b.dir.x };
        g.moveTo(b.p.x - n.x * 5, b.p.y - n.y * 5).lineTo(b.p.x + n.x * 5, b.p.y + n.y * 5).stroke({ color: INK, width: 1.5, cap: 'round' });
      }
      const ring = pointAt(r.points, r.breakAt + CABLE.breakGap / 2).p;
      // The cut-link ring blinks on a 2.4 s ease-in-out (held lit under reduced motion).
      const pulse = reduced ? 1 : 0.4 + 0.6 * (0.5 - 0.5 * Math.cos((2 * Math.PI * clock) / 2.4));
      g.circle(ring.x, ring.y, 3.2).stroke({ color: STOP_RED, width: 1.4, alpha: pulse });
      placeLabel(lbl, 'Link cut', STOP_RED, ring, view.w);
    } else {
      for (const d of dashes(r.points, 4, 7)) stroke(d, 1.5, 0.9);
      placeLabel(lbl, 'Access revoked', INK, at.p, view.w);
    }
  });
}

/** A boxed label beside the cable at `at`: to its left, or to its right where the left would leave the stage. */
function placeLabel(l: Label, text: string, colour: string, at: Pt, width: number): void {
  if (l.text.text !== text) l.text.text = text;
  l.text.style.fill = colour;
  const w = Math.ceil(l.text.width) + 12;
  const left = at.x - 14 - w >= 0;
  const x = left ? at.x - 14 - w : at.x + 14;
  l.box.clear();
  l.box.roundRect(0, 0, w, 16, 3).fill(PAPER).stroke({ color: INK, width: 1 });
  l.text.position.set(6, (16 - l.text.height) / 2);
  l.root.position.set(Math.min(width - w, x), at.y - 8);
  l.root.visible = true;
}

// --- Survey flags and plaques ------------------------------------------------------------------

/** Pole length (px) and plaque side per area, chosen so plaques do not collide at the default framing. */
const POLE: Record<string, { len: number; side: 1 | -1 }> = {
  'diesel-ordering': { len: 22, side: -1 },
  'explosives-ordering': { len: 34, side: 1 },
  'work-orders': { len: 46, side: -1 },
  payroll: { len: 50, side: -1 },
  'control-room': { len: 100, side: -1 },
  'remote-operations': { len: 150, side: -1 },
  'drill-and-blast': { len: 46, side: -1 },
  haulage: { len: 40, side: 1 },
  crushing: { len: 34, side: 1 },
  rail: { len: 46, side: -1 },
};

const STATE_WORD = { normal: 'Normal', degraded: 'Degraded', stopped: 'Stopped' } as const;

/**
 * One process area's survey flag and plaque (DESIGN.md Survey Flags and Plaques): a pole with a ground
 * ellipse at its foot and a flag at the top — full Stop Red with a white X when stopped, white with an
 * amber lower-left triangle when degraded, an open white pennant when normal — and a paper plaque with the
 * area name over the state word and note. The selected area's plaque inverts to ink and its pole thickens.
 */
class Plaque {
  readonly root: Container;
  private readonly g = new Graphics();
  private readonly name: Text;
  private readonly word: Text;
  private readonly note: Text;
  private readonly anchor: Vec3;

  constructor(readonly id: string, resolution: number) {
    this.root = new Container({ label: `flag-${id}` });
    this.anchor = LAYOUT.areas[id]!.anchor;
    const style = (size: number, weight: '600' | '700') => ({ fontFamily: FONT, fontSize: size, fontWeight: weight, fill: INK });
    this.name = new Text({ text: '', resolution, style: style(11, '700') });
    this.word = new Text({ text: '', resolution, style: style(10.5, '700') });
    this.note = new Text({ text: '', resolution, style: style(10.5, '600') });
    this.root.addChild(this.g, this.name, this.word, this.note);
  }

  set(scene: SceneState, selected: string | null, labels: boolean): void {
    const p = scene.processes[this.id];
    if (!p) throw new Error(`scene has no process ${this.id}`);
    // Without plaques (the decorative scene) there is nothing to stack, so every pole is short.
    const pole = POLE[this.id] ?? { len: 36, side: 1 };
    const side = pole.side;
    const len = labels ? pole.len : 26;
    const sel = selected === this.id;
    const g = this.g;
    g.clear();
    g.ellipse(0, 0, 3.4, 1.6).fill({ color: INK, alpha: 0.45 });
    g.moveTo(0, 0).lineTo(0, -len).stroke({ color: INK, width: sel ? 1.6 : 1.1 });
    flagCloth(g, p.flag, side * 0.6, -len, side);

    this.name.visible = this.word.visible = this.note.visible = labels;
    if (!labels) return;
    this.name.text = p.label;
    this.word.text = STATE_WORD[p.state];
    this.note.text = p.note ? ` · ${p.note}` : '';
    this.name.style.fill = sel ? PAPER : INK;
    this.word.style.fill = sel ? PAPER : p.state === 'stopped' ? c('stop-red-text') : INK;
    this.note.style.fill = sel ? mix(PAPER, INK, 0.12) : c('ink-2');
    const w = Math.ceil(Math.max(this.name.width, this.word.width + this.note.width)) + 14;
    const x0 = side > 0 ? 13 : -13 - w;
    const top = -len - 5;
    g.roundRect(x0, top, w, 31, 3)
      .fill({ color: sel ? INK : PAPER, alpha: sel ? 1 : 0.96 })
      .stroke({ color: INK, width: sel ? 1.2 : 0.8, alpha: sel ? 1 : 0.96 });
    this.name.position.set(x0 + 7, top + 2.5);
    this.word.position.set(x0 + 7, top + 15.5);
    this.note.position.set(x0 + 7 + this.word.width, top + 15.5);
  }

  place(cam: Camera): void {
    const { sx, sy } = project(this.anchor, cam);
    this.root.position.set(Math.round(sx), Math.round(sy));
  }
}

function flagCloth(g: Graphics, flag: SceneState['processes'][string]['flag'], x: number, y: number, dir: number): void {
  const w = 12 * dir;
  const h = 8.5;
  const left = dir > 0 ? x : x + w;
  if (flag === 'full') {
    g.rect(left, y, 12, h).fill(STOP_RED).stroke({ color: INK, width: 1 });
    g.moveTo(x + w * 0.22, y + 2)
      .lineTo(x + w * 0.78, y + h - 2)
      .moveTo(x + w * 0.78, y + 2)
      .lineTo(x + w * 0.22, y + h - 2)
      .stroke({ color: PAPER, width: 1.3 });
  } else if (flag === 'half') {
    g.rect(left, y, 12, h).fill(PAPER).stroke({ color: INK, width: 1 });
    g.poly([x, y + h, x, y, x + w, y + h]).fill(c('degraded-amber')).stroke({ color: INK, width: 1, join: 'round' });
  } else {
    g.poly([x, y, x + w, y + h / 2, x, y + h]).fill(PAPER).stroke({ color: INK, width: 1, join: 'round' });
  }
}
