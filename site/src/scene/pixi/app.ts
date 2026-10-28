// The CSP forbids eval; this must load before any other PixiJS module (D-104, global constraints).
import 'pixi.js/unsafe-eval';
// Only the filter system is registered beyond the core (see `skipExtensionImports` below).
import 'pixi.js/filters';
import { Application, Container, Rectangle } from 'pixi.js';
import type { Ticker, WebGLRenderer } from 'pixi.js';
import type { SceneState } from '../../model/sceneState.js';
import { e2eHook, timeScale } from '../../model/timeScale.js';
import type { DioramaProbe } from '../../model/timeScale.js';
import { MAX_DT, stepAnim, stillFrame } from '../animation.js';
import type { AnimState } from '../animation.js';
import { keyMove, panBy, wheelZoom, zoomAt } from '../cameraMoves.js';
import { defaultCamera as defaultView } from '../framing.js';
import type { Framing } from '../framing.js';
import { centreOn, clampCamera, K_MAX, project, unproject } from '../iso.js';
import type { Camera } from '../iso.js';
import { BOARD, LAYOUT } from '../layout.js';
import { buildDynamic } from './dynamic.js';
import type { Dynamic } from './dynamic.js';
import { buildOverlay } from './overlay.js';
import type { FlagLayout, Overlay } from './overlay.js';
import { placePlate, plateBoxes } from '../plate.js';
import type { PlatePlacement } from '../plate.js';
import { Snapshot } from './snapshot.js';
import { buildStatic } from './static.js';
import type { StaticWorld } from './static.js';

export interface DioramaHandle {
  /**
   * The engine state to draw, whether to hold still (reduced motion: one still frame of the same state)
   * and the selected area, whose plaque inverts. The first call builds the world.
   */
  setState(s: SceneState, reducedMotion: boolean, selected?: string | null): void;
  /** Move the camera; it always passes through `clampCamera`. */
  setCamera(c: Camera): void;
  /** Back to the default framing: the pit, ROM pad and crusher (on a phone, the working area). */
  fit(): void;
  /** Pans, at the current zoom, so the area's flag is at the centre of the view (an out-of-frame area's button took focus). */
  reveal(areaId: string): void;
  destroy(): void;
}

/** What the accessible DOM layer needs from a drawn frame, in stage pixels. */
export interface SceneLayout {
  cam: Camera;
  view: Size;
  /** Keyed by process area id. */
  plaques: Record<string, FlagLayout>;
  /** The honesty plate: engraved on the plinth face or pinned, placed under the same camera the plaques kept clear of. */
  plate: PlatePlacement;
}

export interface DioramaOptions {
  /** Wheel, drag, pinch and keyboard camera controls. Off for the decorative welcome scene. */
  interactive: boolean;
  /** The default view: the site's working view, or the welcome page's hero crop. */
  framing: Framing;
  /**
   * Called once if the diorama can no longer draw after it started: its WebGL context was lost and not
   * restored within `LOST_CONTEXT_MS`. The caller destroys the handle and shows the schematic (D-106).
   */
  onFail?(): void;
}

/** Frame updates are throttled to about 30 ms (DESIGN.md Motion). */
const FRAME_MS = 30;
/** At most this many capped steps per frame when the e2e time scale speeds story time up. */
const MAX_SUBSTEPS = 8;
/** Phones crop to the working area (DESIGN.md Layout, Phone). */
const PHONE = '(max-width: 760px)';
/** The Fit button's corner of the stage (scene.css), which plaques keep clear of. */
const FIT_CORNER = { w: 56, h: 68 };
/** How long a lost WebGL context may stay lost before the scene gives up on it and falls back. */
export const LOST_CONTEXT_MS = 3000;

type Size = { w: number; h: number };
/** The DOM events the diorama listens for, including the canvas's WebGL context events. */
type Events = HTMLElementEventMap & { webglcontextlost: WebGLContextEvent; webglcontextrestored: WebGLContextEvent };

/**
 * Mounts the diorama in `host`. `onLayout` hears where the camera, flags and plaques are after each frame that
 * moved them (at most once per drawn frame, so a drag does not re-render the DOM layer per pointer event).
 * It runs one PixiJS application on WebGL only (no WebGPU or Canvas2D fallback;
 * where WebGL fails, the caller shows the schematic), the static world, one ticker throttled to 30 ms,
 * and the camera controls. The canvas is the host's first child; `host` takes the wheel and keyboard
 * (+, −, 0), the canvas takes drags and pinches. If anything fails after the renderer has started, the
 * renderer is destroyed before the error reaches the caller. `destroy` removes all of it.
 */
export async function createDiorama(host: HTMLElement, onLayout: (l: SceneLayout) => void, options: DioramaOptions = { interactive: true, framing: 'site' }): Promise<DioramaHandle> {
  const app = new Application();
  const release = () => {
    try {
      app.canvas.remove();
      app.destroy({ removeView: true }, { children: true, texture: true, textureSource: true });
    } catch {
      // Init failed before the renderer existed: nothing was created to release.
    }
  };
  try {
    return await mount(app, host, onLayout, options);
  } catch (error) {
    release();
    throw error;
  }
}

async function mount(app: Application, host: HTMLElement, onLayout: (l: SceneLayout) => void, options: DioramaOptions): Promise<DioramaHandle> {
  const view = (): Size => ({ w: Math.max(1, host.clientWidth), h: Math.max(1, host.clientHeight) });
  const size = view();
  await app.init({
    // An array restricts PixiJS to WebGL; a string would only put it first, ahead of WebGPU and Canvas2D.
    preference: ['webgl'],
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
    backgroundAlpha: 0,
    width: size.w,
    height: size.h,
    autoStart: false,
    hello: false,
    // Skip PixiJS's browser bundle: its accessibility system would add a focusable hook div to the page
    // on touch devices and listen for Tab globally, and its event system would set touch-action: none.
    // The scene's accessible layer is DOM (DioramaScene), and its controls are the listeners below.
    skipExtensionImports: true,
  });
  // Fonts first, so the face's lettering (scale bar, rail) is set in Archivo rather than a fallback face.
  await document.fonts?.load('600 12px "Archivo Variable"').catch(() => undefined);

  const canvas = app.canvas;
  canvas.classList.add('scene-canvas');
  host.prepend(canvas);

  const cleanups: (() => void)[] = [];
  const listen = <K extends keyof Events>(el: HTMLElement, type: K, fn: (e: Events[K]) => void, opts?: AddEventListenerOptions) => {
    const handler = fn as EventListener;
    el.addEventListener(type, handler, opts);
    cleanups.push(() => el.removeEventListener(type, handler, opts));
  };

  // Painter's order on the stage: the static world up to the pit's rock (a snapshot), the vehicles in the pit
  // (live), the static world over the pit (a snapshot), the moving surface (live), then stage-pixel marks.
  // The snapshots are redrawn only when the camera, the stage size or the engine state changes.
  const underSlot = new Container({ label: 'under' });
  const pitWorld = new Container({ label: 'pit-world' });
  const overSlot = new Container({ label: 'over' });
  const aboveWorld = new Container({ label: 'above-world' });
  const overlayRoot = new Container({ label: 'overlay' });
  app.stage.addChild(underSlot, pitWorld, overSlot, aboveWorld, overlayRoot);
  let built: StaticWorld | null = null;
  let snapshots: Snapshot[] = [];
  let dynamic: Dynamic | null = null;
  let overlay: Overlay | null = null;
  let scene: SceneState | null = null;
  let anim: AnimState | null = null;
  let reduced = false;
  let current = size;
  const phone = window.matchMedia?.(PHONE);
  const defaultCamera = (v: Size) => defaultView(options.framing, v, phone?.matches ?? false);
  let cam = defaultCamera(current);
  let moved = false;
  let dirty = true;

  const apply = (next: Camera) => {
    cam = clampCamera(next, BOARD, current);
    for (const w of [pitWorld, aboveWorld]) {
      w.position.set(cam.ox, cam.oy);
      w.scale.set(cam.k);
    }
    built?.setZoom(cam.k);
    for (const snap of snapshots) snap.invalidate();
    dirty = true;
  };
  const move = (next: Camera) => {
    moved = true;
    apply(next);
  };
  apply(cam);

  // One ticker, throttled. While anything may move (not reduced motion) every tick steps the animation
  // and redraws; otherwise it renders only when the state or camera changed. Ambient time is scaled for e2e (R9),
  // in steps of at most MAX_DT. Nothing renders while the WebGL context is lost.
  let clock = 0;
  let laid: Record<string, FlagLayout> = {};
  // The plate is DOM text (DioramaScene) but placed here, from the same camera the plaques keep clear of.
  // Only its text's width per pixel of font size is read from the page, when it changes.
  let platePerPx = 0;
  const plateAt = (c: Camera, v: Size) => placePlate(c, v, platePerPx, phone?.matches ?? false);
  const plateEl = host.querySelector<HTMLElement>('.scene-plinth');
  const plateResize = new ResizeObserver(() => {
    if (!plateEl) return;
    const css = getComputedStyle(plateEl);
    const font = parseFloat(css.fontSize);
    const text = plateEl.offsetWidth - parseFloat(css.paddingLeft) - parseFloat(css.paddingRight);
    const next = font > 0 && text > 0 ? text / font : 0;
    if (Math.abs(next - platePerPx) < 0.01) return;
    platePerPx = next;
    overlay?.relayout();
    dirty = true;
  });
  if (plateEl) plateResize.observe(plateEl);
  cleanups.push(() => plateResize.disconnect());
  let frames = 0;
  app.ticker.remove(app.render, app);
  app.ticker.maxFPS = 1000 / FRAME_MS;
  const contextLost = () => (app.renderer as WebGLRenderer).gl.isContextLost();
  const draw = () => {
    if (dynamic && overlay && scene && anim) {
      // The hatching sits in both snapshots (the drill pad's is on the pit's first berm).
      if (dynamic.prepare(cam.k)) for (const snap of snapshots) snap.invalidate();
      for (const snap of snapshots) snap.update(app.renderer, cam);
      dynamic.frame(anim);
      const plaques = overlay.frame(anim, scene, cam, current, clock, reduced);
      if (plaques) {
        laid = plaques;
        onLayout({ cam: { ...cam }, view: { ...current }, plaques, plate: plateAt(cam, current) });
      }
    }
    app.render();
  };
  const tick = (t: Ticker) => {
    const dt = Math.min(t.deltaMS / 1000, MAX_DT) * timeScale();
    clock += dt;
    if (scene && anim && !reduced) {
      let left = dt;
      for (let i = 0; i < MAX_SUBSTEPS && left > 1e-9; i++) {
        anim = stepAnim(anim, scene, Math.min(left, MAX_DT));
        left -= MAX_DT;
      }
      dirty = true;
    }
    if (!dirty || contextLost()) return;
    dirty = false;
    draw();
    frames++;
  };
  app.ticker.add(tick);
  app.ticker.start();

  const resize = new ResizeObserver(() => {
    const next = view();
    if (next.w === current.w && next.h === current.h) return;
    current = next;
    app.renderer.resize(next.w, next.h);
    for (const snap of snapshots) snap.resize(next.w, next.h, app.renderer.resolution);
    apply(moved ? cam : defaultCamera(next));
  });
  resize.observe(host);

  // A lost context (GPU reset, driver crash, too many contexts) blanks the canvas. PixiJS asks the browser
  // to restore it; when it comes back, redraw. If it stays lost, report failure so the schematic stands in.
  let lostTimer: ReturnType<typeof setTimeout> | undefined;
  listen(canvas, 'webglcontextlost', () => {
    clearTimeout(lostTimer);
    lostTimer = setTimeout(() => options.onFail?.(), LOST_CONTEXT_MS);
  });
  listen(canvas, 'webglcontextrestored', () => {
    clearTimeout(lostTimer);
    for (const snap of snapshots) snap.invalidate();
    dirty = true;
  });
  cleanups.push(() => clearTimeout(lostTimer));

  // Camera controls.
  if (options.interactive) {
    const local = (e: { clientX: number; clientY: number }) => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    listen(
      host,
      'wheel',
      (e) => {
        const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? current.h : 1;
        const p = local(e);
        const next = wheelZoom(cam, e.deltaY * unit, p.x, p.y, BOARD, current);
        // Already zoomed as far as it goes that way: let the page scroll instead.
        if (!next) return;
        e.preventDefault();
        move(next);
      },
      { passive: false },
    );
    const pointers = new Map<number, { x: number; y: number }>();
    listen(canvas, 'pointerdown', (e) => {
      canvas.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, local(e));
    });
    listen(canvas, 'pointermove', (e) => {
      const before = pointers.get(e.pointerId);
      if (!before) return;
      const now = local(e);
      if (pointers.size === 1) {
        move(panBy(cam, now.x - before.x, now.y - before.y, BOARD, current));
      } else {
        // Pinch: zoom by the change in finger spread about the midpoint, and pan with the midpoint.
        const other = [...pointers.entries()].find(([id]) => id !== e.pointerId)![1];
        const d0 = Math.hypot(before.x - other.x, before.y - other.y) || 1;
        const d1 = Math.hypot(now.x - other.x, now.y - other.y) || 1;
        const m0 = { x: (before.x + other.x) / 2, y: (before.y + other.y) / 2 };
        const m1 = { x: (now.x + other.x) / 2, y: (now.y + other.y) / 2 };
        move(panBy(zoomAt(cam, d1 / d0, m0.x, m0.y, BOARD, current), m1.x - m0.x, m1.y - m0.y, BOARD, current));
      }
      pointers.set(e.pointerId, now);
    });
    const release = (e: PointerEvent) => pointers.delete(e.pointerId);
    listen(canvas, 'pointerup', release);
    listen(canvas, 'pointercancel', release);
    listen(host, 'keydown', (e) => {
      if (e.target !== host || e.ctrlKey || e.metaKey || e.altKey) return;
      const next = keyMove(e.key, cam, BOARD, current, defaultCamera(current));
      if (!next) return;
      e.preventDefault();
      if (e.key === '0') {
        moved = false;
        apply(next);
      } else move(next);
    });
  }

  // The end-to-end probe, only where the `?e2e` hook is installed.
  const probe: DioramaProbe = {
    camera: () => ({ ...cam }),
    defaultCamera: () => defaultCamera(current),
    groundAtCentre: () => unproject(current.w / 2, current.h / 2, cam),
    frames: () => frames,
    plaques: () => Object.fromEntries(Object.entries(laid).map(([id, l]) => [id, { rect: l.rect && { ...l.rect }, inFrame: l.inFrame }])),
    entryPost(id) {
      const post = LAYOUT.entryPosts[id];
      if (!post) throw new Error(`layout has no entry post ${id}`);
      const { sx, sy } = project(post, cam);
      return { x: sx, y: sy };
    },
    async sample(step, rect) {
      draw();
      const r = rect ?? { x: 0, y: 0, w: current.w, h: current.h };
      const x0 = Math.max(0, Math.floor(r.x));
      const y0 = Math.max(0, Math.floor(r.y));
      const frame = new Rectangle(x0, y0, Math.max(1, Math.min(current.w - x0, Math.ceil(r.w))), Math.max(1, Math.min(current.h - y0, Math.ceil(r.h))));
      const { pixels, width, height } = app.renderer.extract.pixels({ target: app.stage, frame, resolution: 1 });
      const out: [number, number, number][] = [];
      for (let y = 0; y < height; y += step)
        for (let x = 0; x < width; x += step) {
          const i = (y * width + x) * 4;
          if (pixels[i + 3]! >= 250) out.push([pixels[i]!, pixels[i + 1]!, pixels[i + 2]!]);
        }
      return out;
    },
  };
  if (window.__faillocal === e2eHook) e2eHook.diorama = probe;

  return {
    setState(s, reducedMotion, selected = null) {
      if (!built) {
        built = buildStatic((window.devicePixelRatio || 1) * K_MAX);
        built.setZoom(cam.k);
        pitWorld.addChild(built.layers.pitActors);
        snapshots = [new Snapshot(built.layers.under, 'under'), new Snapshot(built.layers.over, 'over')];
        underSlot.addChild(snapshots[0]!.sprite);
        overSlot.addChild(snapshots[1]!.sprite);
        for (const snap of snapshots) snap.resize(current.w, current.h, app.renderer.resolution);
        dynamic = buildDynamic(built.slots, aboveWorld);
        overlay = buildOverlay(overlayRoot, {
          labels: options.interactive,
          resolution: window.devicePixelRatio || 1,
          keepClear: (c, v) => [{ x: v.w - FIT_CORNER.w, y: 0, w: FIT_CORNER.w, h: FIT_CORNER.h }, ...plateBoxes(plateAt(c, v), 4)],
        });
      }
      scene = s;
      reduced = reducedMotion;
      // Reduced motion: one still frame of this state. Otherwise motion carries on from where it was.
      if (!anim || reduced) anim = stillFrame(s);
      if (dynamic!.setScene(s)) for (const snap of snapshots) snap.invalidate();
      overlay!.setScene(s, selected);
      dirty = true;
    },
    setCamera(c) {
      move(c);
    },
    fit() {
      moved = false;
      apply(defaultCamera(current));
    },
    reveal(areaId) {
      const area = LAYOUT.areas[areaId];
      if (!area) throw new Error(`layout has no area ${areaId}`);
      move(centreOn(area.anchor, cam.k, current));
    },
    destroy() {
      for (const off of cleanups) off();
      resize.disconnect();
      app.ticker.remove(tick);
      if (e2eHook.diorama === probe) delete e2eHook.diorama;
      canvas.remove();
      // The snapshots' groups are not on the stage, so they are released here with their textures.
      for (const snap of snapshots) snap.destroy();
      snapshots = [];
      app.destroy({ removeView: true }, { children: true, texture: true, textureSource: true });
    },
  };
}
