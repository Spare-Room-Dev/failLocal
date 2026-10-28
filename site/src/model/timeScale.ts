import { actions } from './store.js';

/** The end-to-end speed hook (controller ruling R9). */
export interface E2eHook {
  /** Story time's multiplier: playback hours per second and guided travel are multiplied by it, guided dwells divided. */
  timeScale: number;
  setSpeed(hoursPerSecond: number): void;
  /** Set while a diorama is mounted: what the end-to-end suite reads off the canvas. */
  diorama?: DioramaProbe;
}

/** The mounted diorama, as the end-to-end suite sees it. */
export interface DioramaProbe {
  camera(): { k: number; ox: number; oy: number };
  /** The camera `0` and the Fit button return to. */
  defaultCamera(): { k: number; ox: number; oy: number };
  /** The ground point (metres) under the centre of the view. */
  groundAtCentre(): { x: number; y: number };
  /** How many frames the ticker has rendered since mount. */
  frames(): number;
  /** Where an entry post's foot is drawn, in stage pixels. */
  entryPost(groupId: string): { x: number; y: number };
  /**
   * Each process area's plaque as placed now, in stage pixels: null when it has none (its flag is out of
   * frame, or no spot fits it). `inFrame`: whether the flag's foot is inside the stage. `foot` and `flagTop`:
   * the ends of its pole; `side`: the side its cloth flies to.
   */
  plaques(): Record<string, { rect: { x: number; y: number; w: number; h: number } | null; inFrame: boolean; foot: { x: number; y: number }; flagTop: { x: number; y: number }; side: 1 | -1 }>;
  /** The rendered colour of every `step`-th CSS pixel (of the whole stage, or of `rect`), as [r, g, b]. */
  sample(step: number, rect?: { x: number; y: number; w: number; h: number }): Promise<[number, number, number][]>;
}

declare global {
  interface Window {
    __faillocal?: E2eHook;
  }
}

/** The hook object itself: present in every build, exposed on `window` only under `installE2eHook`. */
export const e2eHook: E2eHook = { timeScale: 1, setSpeed: (hps) => actions.setSpeed(hps) };

/** The current multiplier: 1 unless an end-to-end run changed it through the hook. */
export function timeScale(): number {
  return e2eHook.timeScale;
}

/** Exposes the hook as `window.__faillocal` in a dev build, or when the query string has an `e2e` parameter. Returns whether it did. */
export function installE2eHook(win: Window, dev: boolean): boolean {
  if (!dev && !new URLSearchParams(win.location.search).has('e2e')) return false;
  win.__faillocal = e2eHook;
  return true;
}
