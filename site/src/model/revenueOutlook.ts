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
 * Days of stockpile left before rail loadings are cut back (finish fix C2, ruling R-z): the stockpile's
 * level less its low mark. Shown only while shipping is still normal, the stockpile is above its low
 * mark, and it is falling, so it is covering for the site (C1): compared with the next hour (the last
 * hour compares with the one before). Null otherwise: a full or refilling stockpile is no countdown,
 * and once shipping is degraded or stopped revenue at risk itself takes over.
 */
export function stockpileDaysLeft(r: Register, timeline: Timeline, sample: Sample): number | null {
  const stock = shippingStock(r);
  const level = (s: Sample | undefined) => s?.stocks[stock.id];
  const days = level(sample);
  if (days === undefined) throw new Error(`run has no level for stock ${stock.id}`);
  const next = level(timeline.samples[sample.hour + 1]);
  const prev = level(timeline.samples[sample.hour - 1]);
  const falling = next !== undefined ? next < days : prev !== undefined && days < prev;
  const left = days - used(timeline, `stocks.${stock.id}.lowThreshold`);
  return falling && left > 0 && sample.processes[r.production.shippingProcess] === 'normal' ? left : null;
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
