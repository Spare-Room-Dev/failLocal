import type { Sample, Timeline } from '@faillocal/engine';
import type { Clock } from './store.js';

export type { Clock };

/** Playback rates in hours per second. The store starts at 24 (a day a second). */
export const SPEEDS = [12, 24, 48, 96] as const;

/** The clock `dtSeconds` later. A paused clock stays put; a playing one stops and pauses at the horizon. */
export function advance(c: Clock, dtSeconds: number, horizonHours: number): Clock {
  if (!c.playing) return c;
  const hour = Math.min(c.hour + c.hoursPerSecond * dtSeconds, horizonHours);
  return { ...c, hour, playing: hour < horizonHours };
}

/** A scrubbed hour: rounded to a whole hour and clamped to [0, horizonHours]. */
export function scrubTo(hour: number, horizonHours: number): number {
  return Math.min(Math.max(0, Math.round(hour)), horizonHours);
}

/** The sample at `hour`, floored and clamped to the run, so a clock past a shortened horizon reads the last one. */
export function sampleAt(t: Timeline, hour: number): Sample {
  return t.samples[Math.min(Math.max(0, Math.floor(hour)), t.samples.length - 1)]!;
}

/** The run's last hour: the clock's extent. */
export function horizonHours(t: Timeline): number {
  return t.samples.length - 1;
}

/** The run's horizon in days, as the scenario set it (overrides included), for the timeline axis. */
export function horizonDays(t: Timeline): number {
  const used = t.assumptionsUsed[`scenarios.${t.scenarioId}.horizon`];
  if (!used) return horizonHours(t) / 24;
  return used.unit === 'hours' ? used.value / 24 : used.value;
}
