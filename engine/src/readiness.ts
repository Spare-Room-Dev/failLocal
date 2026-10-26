import type { Register } from './schema.js';
import { simulate } from './simulate.js';
import type { Variant } from './simulate.js';

export interface ReadinessRow {
  processId: string;
  scenarioId: string;
  variant: Variant;
  /**
   * The longest contiguous run of non-normal samples (computed). It counts samples, so an outage
   * still running at the final sample counts up to that sample.
   */
  longestOutageHours: number;
  maxTolerableOutageHours: number;
  recoveryTargetHours: number;
  withinTolerance: boolean; // longestOutageHours <= maxTolerableOutageHours
  withinRecoveryTarget: boolean; // longestOutageHours <= recoveryTargetHours
}

const VARIANTS: Variant[] = ['unprepared', 'prepared'];

/** Every process x scenario x variant, in that order. Degraded counts as outage: the process was not doing its job. */
export function assessReadiness(r: Register): ReadinessRow[] {
  const rows: ReadinessRow[] = [];
  for (const process of r.processes) {
    const maxTolerableOutageHours = process.continuity.maxTolerableOutage.value;
    const recoveryTargetHours = process.continuity.recoveryTarget.value;
    for (const scenario of r.scenarios) {
      for (const variant of VARIANTS) {
        const longestOutageHours = longestRun(
          simulate(r, scenario.id, variant).samples.map((s) => s.processes[process.id] !== 'normal'),
        );
        rows.push({
          processId: process.id,
          scenarioId: scenario.id,
          variant,
          longestOutageHours,
          maxTolerableOutageHours,
          recoveryTargetHours,
          withinTolerance: longestOutageHours <= maxTolerableOutageHours,
          withinRecoveryTarget: longestOutageHours <= recoveryTargetHours,
        });
      }
    }
  }
  return rows;
}

function longestRun(flags: boolean[]): number {
  let longest = 0;
  let run = 0;
  for (const flag of flags) {
    run = flag ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  return longest;
}
