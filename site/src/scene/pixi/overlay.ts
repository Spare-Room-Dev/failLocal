import { Container, Graphics, Text } from 'pixi.js';
import type { SceneState } from '../../model/sceneState.js';
import { cableFraction, SERVICE_GROUPS } from '../../model/serviceGroups.js';
import type { AnimState } from '../animation.js';
import { CABLE, cableRoutes, HERO_LABEL, labelRow, POST_MIN_H, postTop } from '../cables.js';
import type { CableRoute } from '../cables.js';
import { boxFaces, mix, project } from '../iso.js';
import type { Camera, Vec3 } from '../iso.js';
import { ENTRY_POST_H, LAYOUT } from '../layout.js';
import { token } from '../palette.js';
import { BARE_POLE, flagBox, placePlaques } from '../plaques.js';
import type { Box, PlaqueRequest } from '../plaques.js';
import { dashes, pointAt, slice } from '../polyline.js';
import { POST_CUT } from './dynamic.js';
import type { Pt } from '../polyline.js';

/**
 * The board's screen-space marks, in stage pixels over the board (their sizes are pixel sizes, so they
 * are laid out again whenever the camera moves): the service cables, the parked trucks' pause markers,
 * and the survey flags and plaques. All of it is read off `SceneState`; only the cable dots and the
 * cut-link pulse animate.
 */
export interface Overlay {
  /** The engine state (and the selected area) changed. */
  setScene(scene: SceneState, selected: string | null): void;
  /** Something the plaques keep clear of changed (the plate's size): lay them out again on the next frame. */
  relayout(): void;
  /**
   * Draws one frame under camera `cam` in a `view`-sized stage. `clock` (s) drives the cut-link pulse.
   * Returns the flags' layout when it was laid out again (the camera, the stage or the state changed), else null.
   */
  frame(a: AnimState, scene: SceneState, cam: Camera, view: { w: number; h: number }, clock: number, reduced: boolean): Record<string, FlagLayout> | null;
}

/** Where an area's flag and plaque are, in stage pixels. */
export interface FlagLayout {
  /** The pole's foot. */
  foot: { x: number; y: number };
  /** The top of the pole, where the flag flies. */
  flagTop: { x: number; y: number };
  /** The plaque, or null when it has none: its flag is out of frame, or no spot fits it. */
  rect: Box | null;
  /** Whether the flag's foot is inside the stage. */
  inFrame: boolean;
  /** The side its cloth flies to: 1 right of the pole, −1 left. */
  side: 1 | -1;
}

export interface OverlayOptions {
  /** Plaques on the survey flags: off for the decorative welcome scene. */
  plaques: boolean;
  /**
   * Where the service cables come from: the cards over the stage's top edge (the site), or the hero's own boxed
   * service labels along its top, drawn here (the welcome scene, DESIGN.md Layout, Landing).
   */
  cables: 'cards' | 'labels';
  /** Stage-pixel boxes that plaques must keep clear of under camera `cam` (the Fit button and the honesty plate). */
  keepClear?(cam: Camera, view: { w: number; h: number }): Box[];
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
  const posts = new Graphics({ label: 'entry-posts' });
  const flags = Object.keys(LAYOUT.areas).map((id) => new Plaque(id, options.resolution));
  // The hero's service labels, one per group, which its cables drop from.
  const serviceLabels = options.cables === 'labels' ? SERVICE_GROUPS.map((g) => serviceLabel(g.name, options.resolution)) : [];
  // Every pole and cloth goes under every plaque, so a pole never draws across another area's plaque.
  screen.addChild(posts, cables, ...cableLabels.map((l) => l.root), ...serviceLabels.map((l) => l.root), markers, ...flags.map((f) => f.pole), ...flags.map((f) => f.root));
  const phone = typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(PHONE) : null;

  // Cable routes depend only on the camera and the stage size.
  let routes: CableRoute[] = [];
  let routeKey = '';
  let placedKey = '';
  let keepOff: Box[] = [];

  return {
    setScene(scene, selected) {
      for (const f of flags) f.set(scene, selected, options.plaques);
      placedKey = '';
    },
    relayout() {
      placedKey = '';
    },
    frame(a, scene, cam, view, clock, reduced) {
      const key = `${cam.k},${cam.ox},${cam.oy},${view.w},${view.h}`;
      const showCables = !phone?.matches;
      if (showCables && key !== routeKey) {
        routeKey = key;
        const tops = SERVICE_GROUPS.map((g) => postTop(LAYOUT.entryPosts[g.id]!, cam));
        if (options.cables === 'labels') {
          const row = labelRow(serviceLabels.map((l) => l.w), view.w);
          row.forEach((b, i) => serviceLabels[i]!.root.position.set(Math.round(b.x), b.y));
          routes = cableRoutes(row.map((b) => Math.round(b.x + b.w / 2)), tops, HERO_LABEL.top + HERO_LABEL.h);
        } else routes = cableRoutes(SERVICE_GROUPS.map((_, i) => cableFraction(i) * view.w), tops);
      }
      let laid: Record<string, FlagLayout> | null = null;
      const placeKey = `${key},${showCables}`;
      if (placeKey !== placedKey) {
        placedKey = placeKey;
        laid = layFlags(flags, scene, cam, view, options, showCables ? routes : []);
        // The parked markers find room round the plaques and flag cloths just placed.
        keepOff = Object.values(laid).flatMap((l) => [...(l.rect ? [l.rect] : []), flagBox(l.flagTop, 0)]);
      }
      drawMarkers(markers, layMarkers(a, cam, keepOff));
      drawPosts(posts, scene, cam, showCables);
      cables.visible = showCables;
      for (const l of serviceLabels) l.root.visible = showCables;
      for (const l of cableLabels) l.root.visible = false;
      if (showCables) drawCables(cables, cableLabels, routes, a, scene, view, clock, reduced);
      return laid;
    },
  };
}

/** Stopped areas claim plaque space first, then degraded, then normal; ties keep the layout's order. */
const SEVERITY = { stopped: 0, degraded: 1, normal: 2 } as const;
/** Cables are 1.5 px; plaques keep this clear of them where they can. */
const CABLE_CLEAR = 3;

/** Places every plaque clear of the others (plaques.ts), poses each flag, and reports where everything went. */
function layFlags(flags: Plaque[], scene: SceneState, cam: Camera, view: { w: number; h: number }, options: OverlayOptions, routes: CableRoute[]): Record<string, FlagLayout> {
  const feet = new Map(flags.map((f) => [f.id, f.foot(cam)]));
  const order = flags.map((f, i) => ({ f, i, rank: SEVERITY[scene.processes[f.id]!.state] })).sort((a, b) => a.rank - b.rank || a.i - b.i);
  const requests: PlaqueRequest[] = options.plaques ? order.map(({ f }) => ({ id: f.id, foot: feet.get(f.id)!, w: f.width, side: POLE_SIDE[f.id] ?? 1 })) : [];
  const soft = routes.flatMap((r) => segmentBoxes(r.points, CABLE_CLEAR));
  const placed = placePlaques(requests, view, options.keepClear?.(cam, view) ?? [], soft);
  const out: Record<string, FlagLayout> = {};
  for (const f of flags) {
    const foot = feet.get(f.id)!;
    const p = placed[f.id] ?? null;
    const len = p ? p.len : BARE_POLE;
    const side = p ? p.side : (POLE_SIDE[f.id] ?? 1);
    f.pose(foot, len, side, p && { ...p.rect, x: p.rect.x - foot.x, y: p.rect.y - foot.y });
    out[f.id] = { foot, flagTop: { x: foot.x, y: foot.y - len }, rect: p ? p.rect : null, inFrame: foot.x >= 0 && foot.x <= view.w && foot.y >= 0 && foot.y <= view.h, side };
  }
  return out;
}

/** Each straight run of a polyline as a thin box, grown by `pad`. */
function segmentBoxes(points: Pt[], pad: number): Box[] {
  const out: Box[] = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    out.push({ x: Math.min(a.x, b.x) - pad, y: Math.min(a.y, b.y) - pad, w: Math.abs(a.x - b.x) + 2 * pad, h: Math.abs(a.y - b.y) + 2 * pad });
  }
  return out;
}

/** Parked markers whose trucks stand closer than this on screen, px, are fanned out as one group. */
const MARKER_NEAR = 16;
/** A marker's glyph, px, and the spacing of fanned glyphs, centre to centre. */
const GLYPH = 11;
const FAN_STEP = { x: 13, y: 14 };
/** A lone marker's post, px; a fanned group's lowest glyph sits `FAN_POST` above its highest truck. */
const MARKER_POST = 13;
const FAN_POST = 7;

interface Marker {
  /** The parked truck's top, where the marker's post stands. */
  foot: Pt;
  /** The centre of the glyph's bottom edge. */
  at: Pt;
}

/** Where a fanned block may shift to find room, in steps of `FAN_STEP`: in place first, then sideways, then up. */
const FAN_SHIFTS = [0, -1, 1, -2, 2, -3, 3].flatMap((dx) => [0, 1, 2].map((up) => ({ dx, up }))).sort((p, q) => p.up - q.up || Math.abs(p.dx) - Math.abs(q.dx));

/**
 * Where the parked markers go (DESIGN.md Survey Flags: Parked): a boxed pause glyph on a short post over each
 * parked truck. Trucks parked close together on screen (the fuel bay's bays at app scale) have their glyphs
 * fanned out above them in a compact block of two rows, left to right in the trucks' order, each on its own
 * post from its own truck, so every parked truck keeps a visible marker and none hides another. The block
 * shifts sideways or up, a step at a time, to the first place clear of the plaques and flag cloths in `keepOff`.
 */
function layMarkers(a: AnimState, cam: Camera, keepOff: Box[]): Marker[] {
  const feet = a.trucks.filter((t) => t.parked).map((t) => {
    const { sx, sy } = project({ ...t.pos, z: t.pos.z + 9 }, cam);
    return { x: sx, y: sy };
  });
  return clusters(feet, MARKER_NEAR).flatMap((group) => {
    if (group.length === 1) return [{ foot: group[0]!, at: { x: group[0]!.x, y: group[0]!.y - MARKER_POST } }];
    group.sort((p, q) => p.x - q.x || p.y - q.y);
    const cols = Math.ceil(group.length / 2);
    const cx = group.reduce((sum, p) => sum + p.x, 0) / group.length;
    const base = Math.min(...group.map((p) => p.y)) - FAN_POST;
    const block = ({ dx, up }: { dx: number; up: number }) =>
      group.map((foot, i) => ({
        foot,
        at: { x: cx + (Math.floor(i / 2) - (cols - 1) / 2 + dx) * FAN_STEP.x, y: base - ((i % 2) + up) * FAN_STEP.y },
      }));
    const clear = (ms: Marker[]) => !markerBoxes(ms).some((b) => keepOff.some((o) => b.x < o.x + o.w && o.x < b.x + b.w && b.y < o.y + o.h && o.y < b.y + b.h));
    for (const shift of FAN_SHIFTS) {
      const ms = block(shift);
      if (clear(ms)) return ms;
    }
    return block(FAN_SHIFTS[0]!);
  });
}

/** The glyph boxes of the parked markers. */
function markerBoxes(markers: Marker[]): Box[] {
  return markers.map((m) => ({ x: m.at.x - GLYPH / 2 - 1, y: m.at.y - GLYPH - 1, w: GLYPH + 2, h: GLYPH + 2 }));
}

function drawMarkers(g: Graphics, markers: Marker[]): void {
  g.clear();
  for (const { foot, at } of markers) g.moveTo(foot.x, foot.y).lineTo(at.x, at.y).stroke({ color: INK, width: 1 });
  for (const { at } of markers) {
    g.roundRect(at.x - GLYPH / 2, at.y - GLYPH, GLYPH, GLYPH, 1.5).fill(PAPER).stroke({ color: INK, width: 1 });
    g.rect(at.x - 2.6, at.y - 8.6, 1.7, 6.2).fill(INK);
    g.rect(at.x + 0.9, at.y - 8.6, 1.7, 6.2).fill(INK);
  }
}

/** Points grouped so each is within `near` px of another in its group (single linkage), in input order. */
function clusters(points: { x: number; y: number }[], near: number): { x: number; y: number }[][] {
  const groups: { x: number; y: number }[][] = [];
  for (const p of points) {
    const joined = groups.filter((grp) => grp.some((q) => Math.hypot(p.x - q.x, p.y - q.y) < near));
    const merged = [p, ...joined.flat()];
    for (const j of joined) groups.splice(groups.indexOf(j), 1);
    groups.push(merged);
  }
  return groups;
}

/** Its width on screen at that size, px. */
const POST_W = 6;

/**
 * Where the board is small on screen, each entry post is drawn at `POST_MIN_H` px over its 3 × 3 × 5 m box
 * (dynamic.ts), faceted by the one sun, galvanised or greyed when its service is cut, with a socket at its top
 * where the cable plugs in, so no cable appears to end in open ground.
 */
function drawPosts(g: Graphics, scene: SceneState, cam: Camera, shown: boolean): void {
  g.clear();
  if (!shown || ENTRY_POST_H * cam.k * 1.2247 >= POST_MIN_H) return;
  for (const grp of SERVICE_GROUPS) {
    const post = LAYOUT.entryPosts[grp.id]!;
    const { sx: x, sy: foot } = project(post, cam);
    const top = postTop(post, cam).y;
    const face = boxFaces(scene.cables[grp.id] === 'live' ? c('galvanised') : POST_CUT);
    const h = POST_W / 2;
    g.ellipse(x + 2, foot + 0.5, 5, 2).fill({ color: INK, alpha: 0.3 });
    g.poly([x - h, top, x, top + h / 2, x, foot + h / 2, x - h, foot]).fill(face.left);
    g.poly([x, top + h / 2, x + h, top, x + h, foot, x, foot + h / 2]).fill(face.right);
    g.poly([x - h, top, x, top - h / 2, x + h, top, x, top + h / 2]).fill(face.top);
    g.poly([x - h, top, x, top - h / 2, x + h, top, x + h, foot, x, foot + h / 2, x - h, foot]).stroke({ color: INK, width: 0.8, alpha: 0.85, join: 'round' });
    g.circle(x, top, 1.6).fill(INK);
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

/** A hero service label: the group's name in a paper box with an ink hairline (DESIGN.md Layout, Landing). */
function serviceLabel(name: string, resolution: number): { root: Container; w: number } {
  const root = new Container({ label: 'service-label' });
  const text = new Text({ text: name, resolution, style: { fontFamily: FONT, fontSize: 11.5, fontWeight: '600', fill: INK } });
  const w = Math.ceil(text.width) + 16;
  const box = new Graphics().roundRect(0, 0, w, HERO_LABEL.h, 3).fill(PAPER).stroke({ color: INK, width: 1 });
  text.position.set(8, Math.round((HERO_LABEL.h - text.height) / 2));
  root.addChild(box, text);
  return { root, w };
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

/** The side each area's plaque prefers (plaques.ts flips it where there is no room). */
const POLE_SIDE: Record<string, 1 | -1> = {
  'diesel-ordering': -1,
  'explosives-ordering': 1,
  'work-orders': -1,
  payroll: -1,
  'control-room': -1,
  'remote-operations': 1,
  'drill-and-blast': -1,
  haulage: 1,
  crushing: 1,
  rail: -1,
};

const STATE_WORD = { normal: 'Normal', degraded: 'Degraded', stopped: 'Stopped' } as const;

/**
 * One process area's survey flag and plaque (DESIGN.md Survey Flags and Plaques): a pole with a ground
 * ellipse at its foot and a flag at the top — full Stop Red with a white X when stopped, white with an
 * amber lower-left triangle when degraded, an open white pennant when normal — and a paper plaque with the
 * area name over the state word and note. The selected area's plaque inverts to ink and its pole thickens.
 * `set` takes the state and sets the text; `pose` draws it with the pole and side the placement chose.
 */
class Plaque {
  readonly root: Container;
  /** The pole, its ground mark and the cloth, drawn under every plaque (buildOverlay). */
  readonly pole = new Graphics();
  private readonly g = new Graphics();
  private readonly name: Text;
  private readonly word: Text;
  private readonly note: Text;
  private readonly anchor: Vec3;
  private flag: SceneState['processes'][string]['flag'] = 'pennant';
  private selected = false;
  /** The plaque's width with its current text, px. */
  width = 0;

  constructor(readonly id: string, resolution: number) {
    this.root = new Container({ label: `flag-${id}` });
    this.anchor = LAYOUT.areas[id]!.anchor;
    const style = (size: number, weight: '600' | '700') => ({ fontFamily: FONT, fontSize: size, fontWeight: weight, fill: INK });
    this.name = new Text({ text: '', resolution, style: style(11, '700') });
    this.word = new Text({ text: '', resolution, style: style(10.5, '700') });
    this.note = new Text({ text: '', resolution, style: style(10.5, '600') });
    this.root.addChild(this.g, this.name, this.word, this.note);
  }

  set(scene: SceneState, selected: string | null, plaques: boolean): void {
    const p = scene.processes[this.id];
    if (!p) throw new Error(`scene has no process ${this.id}`);
    this.flag = p.flag;
    this.selected = selected === this.id;
    this.name.visible = this.word.visible = this.note.visible = plaques;
    if (!plaques) return;
    const sel = this.selected;
    this.name.text = p.label;
    this.word.text = STATE_WORD[p.state];
    this.note.text = p.note ? ` · ${p.note}` : '';
    this.name.style.fill = sel ? PAPER : INK;
    this.word.style.fill = sel ? PAPER : p.state === 'stopped' ? c('stop-red-text') : INK;
    this.note.style.fill = sel ? mix(PAPER, INK, 0.12) : c('ink-2');
    this.width = Math.ceil(Math.max(this.name.width, this.word.width + this.note.width)) + 14;
  }

  /** The pole's foot on screen. */
  foot(cam: Camera): { x: number; y: number } {
    const { sx, sy } = project(this.anchor, cam);
    return { x: Math.round(sx), y: Math.round(sy) };
  }

  /** Draws the flag at `foot` on a pole `len` px long, its cloth flying to `side`, with its plaque at `r` (relative to the foot) if any. */
  pose(foot: { x: number; y: number }, len: number, side: 1 | -1, r: Box | null): void {
    const sel = this.selected;
    const g = this.g;
    this.root.position.set(foot.x, foot.y);
    this.pole.position.set(foot.x, foot.y);
    g.clear();
    const pole = this.pole.clear();
    pole.ellipse(0, 0, 3.4, 1.6).fill({ color: INK, alpha: 0.45 });
    pole.moveTo(0, 0).lineTo(0, -len).stroke({ color: INK, width: sel ? 1.6 : 1.1 });
    flagCloth(pole, this.flag, side * 0.6, -len, side);
    this.name.visible = this.word.visible = this.note.visible = r !== null;
    if (!r) return;
    g.roundRect(r.x, r.y, r.w, r.h, 3)
      .fill({ color: sel ? INK : PAPER, alpha: sel ? 1 : 0.96 })
      .stroke({ color: INK, width: sel ? 1.2 : 0.8, alpha: sel ? 1 : 0.96 });
    this.name.position.set(r.x + 7, r.y + 2.5);
    this.word.position.set(r.x + 7, r.y + 15.5);
    this.note.position.set(r.x + 7 + this.word.width, r.y + 15.5);
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
