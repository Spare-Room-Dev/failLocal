import type { Register, Sample, Timeline, UsedInput } from '@faillocal/engine';
import type { QtyKind } from '../model/format.js';
import { Qty } from './Qty.js';

export interface RevenueSectionProps {
  register: Register;
  timeline: Timeline;
  sample: Sample;
}

/** A production input as the run used it, with its tag and "changed by you" when overridden. */
function Input({ used, kind, sources }: { used: UsedInput | undefined; kind: QtyKind; sources: Record<string, string> }) {
  if (!used) throw new Error('the run did not record a production input');
  return <Qty value={used.value} kind={kind} display={used.provenance.kind} provenance={used.provenance} overridden={used.overridden} sources={sources} />;
}

/**
 * The top of the docked panel (DESIGN.md "Docked Detail Panel"): production deferred so far, then
 * revenue at risk with its working. Each input in the working is the value the run used, from
 * `assumptionsUsed`, so an edited input shows here as edited.
 */
export function RevenueSection({ register, timeline, sample }: RevenueSectionProps) {
  const used = timeline.assumptionsUsed;
  const sources = Object.fromEntries(register.sources.map((s) => [s.id, s.title]));
  const shipping = register.processes.find((p) => p.id === register.production.shippingProcess);
  if (!shipping) throw new Error(`register has no shipping process ${register.production.shippingProcess}`);
  const shippingName = shipping.name.toLowerCase();

  return (
    <section className="revenue" aria-label="Production and revenue">
      <h2 className="panel-heading">Production deferred so far</h2>
      <div className="odometer">
        <Qty value={sample.tonnesDeferred} kind="tonnes" display="computed" />
      </div>
      <hr className="panel-rule" />
      <h2 className="panel-heading">Revenue at risk</h2>
      <p className="figure">
        <Qty value={sample.revenueAtRisk} kind="usd" display="computed" />
      </p>
      <div className="revenue-working" role="group" aria-label="How revenue at risk is worked out">
        <p>
          <Input used={used['production.annualTonnes']} kind="mtpa" sources={sources} /> ×{' '}
          <Input used={used['production.price']} kind="usdPerT" sources={sources} /> × the share of the year's shipping
          deferred so far.
        </p>
        <p>
          Shipping falls to <Input used={used['production.degradedOutput']} kind="fraction" sources={sources} /> when{' '}
          {shippingName} is degraded, and stops when it is stopped.
        </p>
        <p className="revenue-note">Revenue at risk, not written off: shipments can recover once the stockpile refills.</p>
      </div>
    </section>
  );
}
