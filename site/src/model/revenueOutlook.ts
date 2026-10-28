import type { Register, Sample, Timeline } from '@faillocal/engine';

/** Days in the year the engine's annual tonnes are spread over (its 8,760 hours). */
const DAYS_PER_YEAR = 365;

/** The stockpile that feeds the shipping process: the stock it consumes. Throws when there is none. */
export function shippingStock(r: Register): Register['stocks'][number] {
  const stock = r.stocks.find((s) => s.consumedBy.includes(r.production.shippingProcess));
  if (!stock) throw new Error(`register has no stock feeding ${r.production.shippingProcess}`);
  return stock;
}

/**
 * Days of the shipping stockpile left, while it is still covering for the site (finish fix B1, R-v):
 * shown only while the stockpile is above zero, shipping is still normal, and the stockpile is below
 * its capacity, so it is being drawn on. Null otherwise: before anything draws on it (a full
 * stockpile is no story), and once shipping is degraded or stopped, when revenue at risk itself takes over.
 */
export function stockpileDaysLeft(r: Register, timeline: Timeline, sample: Sample): number | null {
  const stock = shippingStock(r);
  const days = sample.stocks[stock.id];
  if (days === undefined) throw new Error(`run has no level for stock ${stock.id}`);
  const capacity = timeline.assumptionsUsed[`stocks.${stock.id}.capacity`]?.value ?? stock.capacity.value;
  const shipping = sample.processes[r.production.shippingProcess];
  return days > 0 && days < capacity && shipping === 'normal' ? days : null;
}

/**
 * Revenue at risk per day once shipping stops: the run's annual tonnes times its price, spread over the
 * year's days. The same inputs, as the run used them, as the revenue working; no new number.
 */
export function revenueAtRiskPerDay(timeline: Timeline): number {
  const tonnes = timeline.assumptionsUsed['production.annualTonnes'];
  const price = timeline.assumptionsUsed['production.price'];
  if (!tonnes || !price) throw new Error('the run did not record its production inputs');
  return ((tonnes.value * 1e6) / DAYS_PER_YEAR) * price.value;
}
