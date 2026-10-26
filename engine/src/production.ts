import type { Production } from './schema.js';

/** Hours in a 365-day year, the basis for turning annual tonnes into an hourly rate. */
const HOURS_PER_YEAR = 8760;

/** Tonnes shipped per hour at the normal annual rate. */
export function tonnesPerHour(p: Production): number {
  return (p.annualTonnes.value * 1e6) / HOURS_PER_YEAR;
}
