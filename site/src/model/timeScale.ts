import { actions } from './store.js';

/** The end-to-end speed hook (controller ruling R9). */
export interface E2eHook {
  /** Story time's multiplier: playback hours per second and guided travel are multiplied by it, guided dwells divided. */
  timeScale: number;
  setSpeed(hoursPerSecond: number): void;
}

declare global {
  interface Window {
    __faillocal?: E2eHook;
  }
}

const hook: E2eHook = { timeScale: 1, setSpeed: (hps) => actions.setSpeed(hps) };

/** The current multiplier: 1 unless an end-to-end run changed it through the hook. */
export function timeScale(): number {
  return hook.timeScale;
}

/** Exposes the hook as `window.__faillocal` in a dev build, or when the query string names `e2e`. Returns whether it did. */
export function installE2eHook(win: Window, dev: boolean): boolean {
  if (!dev && !win.location.search.includes('e2e')) return false;
  win.__faillocal = hook;
  return true;
}
