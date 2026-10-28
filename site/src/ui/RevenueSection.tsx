import type { Register, Sample, Timeline, UsedInput } from '@faillocal/engine';
import type { QtyKind } from '../model/format.js';
import { hoursToCutBack, revenueAtRiskPerDay, shippingStock } from '../model/revenueOutlook.js';
import { usedTag } from '../model/tags.js';
import { Qty } from './Qty.js';

export interface RevenueSectionProps {
  register: Register;
  timeline: Timeline;
  sample: Sample;
}

/** A production input as the run used it, with its tag and "changed by you" when overridden. */
function Input({ timeline, path, kind, sources }: { timeline: Timeline; path: string; kind: QtyKind; sources: Record<string, string> }) {
  const used: UsedInput | undefined = timeline.assumptionsUsed[path];
  if (!used) throw new Error(`the run did not record ${path}`);
  return <Qty value={used.value} kind={kind} {...usedTag(path, used)} sources={sources} />;
}

/**
 * The top of the docked panel (DESIGN.md "Docked Detail Panel"): production deferred so far, then
 * revenue at risk with its working. Each input in the working is the value the run used, from
 * `assumptionsUsed`, so an edited input shows here as edited.
 */
export function RevenueSection({ register, timeline, sample }: RevenueSectionProps) {
  const sources = Object.fromEntries(register.sources.map((s) => [s.id, s.title]));
  const shipping = register.processes.find((p) => p.id === register.production.shippingProcess);
  if (!shipping) throw new Error(`register has no shipping process ${register.production.shippingProcess}`);
  const shippingName = shipping.name.toLowerCase();
  // Both outlook lines show only when the run itself cuts loadings back later (ruling R-ac).
  const hoursLeft = hoursToCutBack(register, timeline, sample);
  const rates = hoursLeft === null ? null : revenueAtRiskPerDay(timeline);
  const stock = shippingStock(register);

  return (
    <section className="revenue" aria-label="Production and revenue">
      <h2 className="panel-heading">Production deferred so far</h2>
      <div className="odometer">
        <Qty value={sample.tonnesDeferred} kind="tonnes" computed odometer />
      </div>
      {hoursLeft !== null && (
        <p className="revenue-state" data-outlook="stockpile">
          Stockpile feeding rail: loadings are cut back in{' '}
          {hoursLeft < 24 ? <Qty value={hoursLeft} kind="hours" computed /> : <Qty value={hoursLeft / 24} kind="days" computed />}
        </p>
      )}
      <hr className="panel-rule" />
      <h2 className="panel-heading">Revenue at risk</h2>
      <p className="figure">
        <Qty value={sample.revenueAtRisk} kind="usd" computed />
      </p>
      {rates && (
        <p className="revenue-rate" data-outlook="rate">
          Revenue at risk once loadings are cut back ≈ <Qty value={rates.cutBack} kind="usd" computed /> per day,{' '}
          <Qty value={rates.empty} kind="usd" computed /> once the stockpile is empty
        </p>
      )}
      <div className="revenue-working" role="group" aria-label="How revenue at risk is worked out">
        <p>
          <Input timeline={timeline} path="production.annualTonnes" kind="mtpa" sources={sources} /> ×{' '}
          <Input timeline={timeline} path="production.price" kind="usdPerT" sources={sources} /> × the share of the year's shipping
          deferred so far.
        </p>
        <p>
          Shipping falls to <Input timeline={timeline} path="production.degradedOutput" kind="fraction" sources={sources} /> when{' '}
          {shippingName} is degraded, and stops when it is stopped.
        </p>
        {rates && (
          <p data-outlook="working">
            A day&rsquo;s shipping is a day&rsquo;s share of that year. Loadings are cut back below{' '}
            <Input timeline={timeline} path={`stocks.${stock.id}.lowThreshold`} kind="days" sources={sources} /> of stockpile.
          </p>
        )}
        <p className="revenue-note">Revenue at risk, not written off: shipments can recover once the stockpile refills.</p>
      </div>
    </section>
  );
}
