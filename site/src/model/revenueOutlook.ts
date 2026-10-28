import { HOURS_PER_YEAR } from '@faillocal/engine';
import type { Register, Sample, Timeline } from '@faillocal/engine';

/** The stockpile that feeds the shipping process: the stock it consumes. Throws when there is none. */
export function shippingStock(r: Register): Register['stocks'][number] {
  const stock = r.stocks.find((s) => s.consumedBy.includes(r.production.shippingProcess));
  if (!stock) throw new Error(`register has no stock feeding ${r.production.shippingProcess}`);
  return stock;
}

/** The run's value for a register input, as it used it (an override included). */
function used(timeline: Timeline, path: string): number {
  const input = timeline.assumptionsUsed[path];
  if (!input) throw new Error(`the run did not record ${path}`);
  return input.value;
}

/**
 * Hours from `sample` until the run cuts rail loadings back (final review I2, ruling R-ac): the first
 * later sample where shipping is no longer normal or the stockpile is below its low mark. Shown only
 * while shipping is still normal, the stockpile is above its low mark, and it is falling, so it is
 * covering for the site (C1): compared with the next hour (the last hour compares with the one
 * before). Null otherwise, and null when the cut-back never comes within the run: the countdown is the
 * run's own result, never the stock's days read as time. Samples are hourly (`samples[h].hour === h`).
 */
export function hoursToCutBack(r: Register, timeline: Timeline, sample: Sample): number | null {
  const stock = shippingStock(r);
  const shipping = r.production.shippingProcess;
  const low = used(timeline, `stocks.${stock.id}.lowThreshold`);
  const level = (s: Sample | undefined) => s?.stocks[stock.id];
  const days = level(sample);
  if (days === undefined) throw new Error(`run has no level for stock ${stock.id}`);
  const next = level(timeline.samples[sample.hour + 1]);
  const prev = level(timeline.samples[sample.hour - 1]);
  const falling = next !== undefined ? next < days : prev !== undefined && days < prev;
  if (!falling || days <= low || sample.processes[shipping] !== 'normal') return null;
  const cut = timeline.samples.find((s) => s.hour > sample.hour && (s.processes[shipping] !== 'normal' || level(s)! < low));
  return cut ? cut.hour - sample.hour : null;
}

/** The two daily rates of revenue at risk, from the run's annual tonnes, price and degraded output: no new number. */
export interface DailyRisk {
  /** Once loadings are cut back: a day's shipping times the share that stops. */
  cutBack: number;
  /** Once the stockpile is empty: a whole day's shipping. */
  empty: number;
}

export function revenueAtRiskPerDay(timeline: Timeline): DailyRisk {
  const daily = ((used(timeline, 'production.annualTonnes') * 1e6) / (HOURS_PER_YEAR / 24)) * used(timeline, 'production.price');
  return { cutBack: daily * (1 - used(timeline, 'production.degradedOutput')), empty: daily };
}
