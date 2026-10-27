import { useEffect } from 'react';
import { advance, horizonHours } from '../model/clock.js';
import { actions, appStore, useStore } from '../model/store.js';
import { timeScale } from '../model/timeScale.js';

/** The loop applies the clock at most this often. */
const FRAME_MS = 30;
/** The longest wall-clock step one frame applies, so a tab that was hidden resumes where it was rather than at the horizon. */
const MAX_FRAME_SECONDS = 0.25;

/**
 * Drives the clock while it plays: one requestAnimationFrame loop, applying `advance` about every
 * 30 ms. The store is read on each frame, so speed and scenario changes take effect at once.
 * `advance` pauses the clock at the horizon, which ends the loop. Mount it once, on the site page.
 */
export function usePlayback(): void {
  const playing = useStore(appStore, (s) => s.clock.playing);
  useEffect(() => {
    if (!playing) return;
    let last: number | null = null;
    let id = requestAnimationFrame(function frame(now) {
      if (last === null) last = now;
      else if (now - last >= FRAME_MS) {
        const { clock, lastGood } = appStore.get();
        const dt = Math.min((now - last) / 1000, MAX_FRAME_SECONDS) * timeScale();
        if (lastGood) actions.setClock(advance(clock, dt, horizonHours(lastGood)));
        last = now;
      }
      if (appStore.get().clock.playing) id = requestAnimationFrame(frame);
    });
    return () => cancelAnimationFrame(id);
  }, [playing]);
}
