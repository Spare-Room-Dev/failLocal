import type { Register, Tier } from './schema.js';

const RANK: Record<Tier, number> = { low: 0, medium: 1, high: 2 };

function higher(a: Tier, b: Tier): Tier {
  return RANK[b] > RANK[a] ? b : a;
}

/**
 * Each process's own tier raised to the highest tier of anything that relies on it.
 * X supports Y when Y depends on process X, or on a stock that X replenishes (a buffer
 * changes how soon an outage bites, not whether it does). Stock-mediated loops are
 * possible, so this iterates to a fixpoint.
 */
export function effectiveProcessTiers(r: Register): Record<string, Tier> {
  const effective: Record<string, Tier> = {};
  for (const p of r.processes) effective[p.id] = p.tier;
  const replenisher = new Map(r.stocks.map((s) => [s.id, s.replenishedBy]));

  let changed = true;
  while (changed) {
    changed = false;
    for (const p of r.processes) {
      const tier = effective[p.id] as Tier;
      for (const dep of p.dependsOn) {
        const supporter = replenisher.get(dep.on) ?? dep.on;
        const current = effective[supporter];
        if (current === undefined) continue; // an asset or service, handled by deriveAssetTiers
        const raised = higher(current, tier);
        if (raised !== current) {
          effective[supporter] = raised;
          changed = true;
        }
      }
    }
  }
  return effective;
}

/**
 * Tier of every asset: the highest effective tier of any process that depends on it directly,
 * or that a control relying on it protects. An asset nothing depends on is `low`.
 */
export function deriveAssetTiers(r: Register): Record<string, Tier> {
  const effective = effectiveProcessTiers(r);
  const tiers: Record<string, Tier> = {};
  for (const a of r.assets) tiers[a.id] = 'low';

  const raise = (assetId: string, tier: Tier): void => {
    const current = tiers[assetId];
    if (current !== undefined) tiers[assetId] = higher(current, tier);
  };
  const dependents = (target: string): string[] =>
    r.processes.filter((p) => p.dependsOn.some((d) => d.on === target)).map((p) => p.id);

  for (const p of r.processes) {
    for (const dep of p.dependsOn) raise(dep.on, effective[p.id] as Tier);
  }

  for (const control of r.controls) {
    const protectedProcesses = control.effects.flatMap((e) =>
      e.kind === 'fallback' ? [e.process] : dependents(e.service),
    );
    for (const assetId of control.assets ?? []) {
      for (const processId of protectedProcesses) raise(assetId, effective[processId] ?? 'low');
    }
  }
  return tiers;
}
