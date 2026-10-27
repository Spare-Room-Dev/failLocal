import type { Sample, Timeline } from '@faillocal/engine';

/** The sample at `hour`, floored and clamped to the run, so a clock past a shortened horizon reads the last one. */
export function sampleAt(t: Timeline, hour: number): Sample {
  return t.samples[Math.min(Math.max(0, Math.floor(hour)), t.samples.length - 1)]!;
}
