// The CSP forbids eval; this must load before any other PixiJS module (D-104, global constraints).
import 'pixi.js/unsafe-eval';
// Only the filter system is registered beyond the core (see `skipExtensionImports` below).
import 'pixi.js/filters';
import { Application, Container, Rectangle } from 'pixi.js';
import type { Ticker } from 'pixi.js';
import type { SceneState } from '../../model/sceneState.js';
import { e2eHook, timeScale } from '../../model/timeScale.js';
import type { DioramaProbe } from '../../model/timeScale.js';
import { keyMove, panBy, zoomAt } from '../cameraMoves.js';
import { clampCamera, fitCamera, K_MAX, unproject } from '../iso.js';
import type { Camera } from '../iso.js';
import { BOARD, LAYOUT } from '../layout.js';
import { buildStatic } from './static.js';
import type { StaticWorld } from './static.js';

export interface DioramaHandle {
  /** The engine state to draw. The first call builds the static world (its plate comes from the state). */
  setState(s: SceneState, reducedMotion: boolean): void;
  /** Move the camera; it always passes through `clampCamera`. */
  setCamera(c: Camera): void;
  /** Back to the default framing: the pit, ROM pad and crusher. */
  fit(): void;
  destroy(): void;
}

export interface DioramaOptions {
  /** Wheel, drag, pinch and keyboard camera controls. Off for the decorative welcome scene. */
  interactive: boolean;
  /**
   * Called once if the diorama can no longer draw after it started: its WebGL context was lost and not
   * restored within `LOST_CONTEXT_MS`. The caller destroys the handle and shows the schematic (D-106).
   */
  onFail?(): void;
}

/** Frame updates are throttled to about 30 ms (DESIGN.md Motion). */
const FRAME_MS = 30;
/** dt is capped at 0.25 s so a background tab never jumps the scene. */
const MAX_DT = 0.25;
/** Wheel zoom: the factor per pixel of wheel travel. */
const WHEEL_ZOOM = 0.0015;
/** How long a lost WebGL context may stay lost before the scene gives up on it and falls back. */
export const LOST_CONTEXT_MS = 3000;

type Size = { w: number; h: number };
/** The DOM events the diorama listens for, including the canvas's WebGL context events. */
type Events = HTMLElementEventMap & { webglcontextlost: WebGLContextEvent; webglcontextrestored: WebGLContextEvent };

/**
 * Mounts the diorama in `host`: one PixiJS application on WebGL only (no WebGPU or Canvas2D fallback;
 * where WebGL fails, the caller shows the schematic), the static world, one ticker throttled to 30 ms,
 * and the camera controls. The canvas is the host's first child; `host` takes the wheel and keyboard
 * (+, −, 0), the canvas takes drags and pinches. If anything fails after the renderer has started, the
 * renderer is destroyed before the error reaches the caller. `destroy` removes all of it.
 */
export async function createDiorama(host: HTMLElement, onCamera: (c: Camera) => void, options: DioramaOptions = { interactive: true }): Promise<DioramaHandle> {
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
    return await mount(app, host, onCamera, options);
  } catch (error) {
    release();
    throw error;
  }
}

async function mount(app: Application, host: HTMLElement, onCamera: (c: Camera) => void, options: DioramaOptions): Promise<DioramaHandle> {
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
  // Fonts first, so the engraved plate is set in Archivo rather than a fallback face.
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

  const world = new Container({ label: 'world' });
  app.stage.addChild(world);
  let built: StaticWorld | null = null;
  let current = size;
  const defaultCamera = (v: Size) => clampCamera(fitCamera(BOARD, v, LAYOUT.defaultFocus), BOARD, v);
  let cam = defaultCamera(current);
  let moved = false;
  let dirty = true;

  const apply = (next: Camera) => {
    cam = clampCamera(next, BOARD, current);
    world.position.set(cam.ox, cam.oy);
    world.scale.set(cam.k);
    built?.setZoom(cam.k);
    dirty = true;
    onCamera(cam);
  };
  const move = (next: Camera) => {
    moved = true;
    apply(next);
  };
  apply(cam);

  // One ticker, throttled; it renders only when something changed. Story time is scaled for e2e (R9).
  let clock = 0;
  let frames = 0;
  app.ticker.remove(app.render, app);
  app.ticker.maxFPS = 1000 / FRAME_MS;
  const tick = (t: Ticker) => {
    clock += Math.min(t.deltaMS / 1000, MAX_DT) * timeScale();
    if (!dirty) return;
    dirty = false;
    app.render();
    frames++;
  };
  app.ticker.add(tick);
  app.ticker.start();

  const resize = new ResizeObserver(() => {
    const next = view();
    if (next.w === current.w && next.h === current.h) return;
    current = next;
    app.renderer.resize(next.w, next.h);
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
        e.preventDefault();
        const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? current.h : 1;
        const p = local(e);
        move(zoomAt(cam, Math.exp(-e.deltaY * unit * WHEEL_ZOOM), p.x, p.y, BOARD, current));
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
    async sample(step) {
      app.render();
      const { pixels, width, height } = app.renderer.extract.pixels({ target: app.stage, frame: new Rectangle(0, 0, current.w, current.h), resolution: 1 });
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
    setState(s) {
      if (!built) {
        built = buildStatic(s.plate.text, (window.devicePixelRatio || 1) * K_MAX);
        world.addChild(built.root);
        built.setZoom(cam.k);
      }
      dirty = true;
    },
    setCamera(c) {
      move(c);
    },
    fit() {
      moved = false;
      apply(defaultCamera(current));
    },
    destroy() {
      for (const off of cleanups) off();
      resize.disconnect();
      app.ticker.remove(tick);
      if (e2eHook.diorama === probe) delete e2eHook.diorama;
      canvas.remove();
      app.destroy({ removeView: true }, { children: true, texture: true, textureSource: true });
    },
  };
}
