import type { UsedInput } from '@faillocal/engine';
import type { QtyKind } from '../model/format.js';
import { HOLD_PATH, HOLDS_FOR_PATH } from '../model/guided.js';
import { usedTag } from '../model/tags.js';
import { DECISION_LOG } from './decisionLog.js';
import { Qty } from './Qty.js';

export interface AssumptionCaveatProps {
  /** The inputs of the run the caveat describes. */
  assumptionsUsed: Record<string, UsedInput>;
  sources: Record<string, string>;
}

const KIND: Partial<Record<UsedInput['unit'], QtyKind>> = { days: 'days', hours: 'hours' };

/** The assumed input at `path`. Throws if the run did not use it, or if it is no longer assumed, as the text says it is. */
function assumed(used: Record<string, UsedInput>, path: string): UsedInput & { kind: QtyKind } {
  const u = used[path];
  if (!u) throw new Error(`assumption caveat: the run did not use ${path}`);
  if (u.provenance.kind !== 'assumed') throw new Error(`assumption caveat: ${path} is ${u.provenance.kind}, not assumed`);
  const kind = KIND[u.unit];
  if (!kind) throw new Error(`assumption caveat: ${path} is in ${u.unit}, not days or hours`);
  return { ...u, kind };
}

/**
 * The two assumed numbers the hosted-ERP projection's revenue figure rests on, each with
 * its tag. The guided run's closing card and the Limitations page both show this, so they cannot
 * disagree.
 */
export function AssumptionCaveat({ assumptionsUsed, sources }: AssumptionCaveatProps) {
  const holdsFor = assumed(assumptionsUsed, HOLDS_FOR_PATH);
  const holdFor = assumed(assumptionsUsed, HOLD_PATH);
  return (
    <p className="assumption-caveat">
      This projection rests on two assumed numbers: phone-and-email ordering keeps going for{' '}
      <Qty value={holdsFor.value} kind={holdsFor.kind} {...usedTag(HOLDS_FOR_PATH, holdsFor)} sources={sources} /> and new
      orders are held for <Qty value={holdFor.value} kind={holdFor.kind} {...usedTag(HOLD_PATH, holdFor)} sources={sources} />{' '}
      after the ERP is back. Change either and the figure changes; see the{' '}
      <a href={DECISION_LOG} rel="noopener noreferrer">
        decision log
      </a>
      .
    </p>
  );
}
