import type { Quantity } from './quantity.js';
import type { Register } from './schema.js';
import { parseRegister, RegisterError } from './validate.js';

interface Entry {
  path: string;
  quantity: Quantity;
}

/**
 * The one traversal behind both `quantityPaths` and `applyOverrides`, so they cannot disagree.
 * Paths are id-keyed for list entries (and dependency targets) and index-keyed for effects, events and measurements.
 * The returned quantities are the register's own objects.
 */
function collect(r: Register): Entry[] {
  const out: Entry[] = [];
  const add = (path: string, quantity: Quantity | undefined) => {
    if (quantity) out.push({ path, quantity });
  };

  for (const p of r.processes) {
    const base = `processes.${p.id}`;
    add(`${base}.continuity.maxTolerableOutage`, p.continuity.maxTolerableOutage);
    add(`${base}.continuity.recoveryTarget`, p.continuity.recoveryTarget);
    for (const d of p.dependsOn) add(`${base}.dependsOn.${d.on}.manualWorkaround.holdsFor`, d.manualWorkaround?.holdsFor);
  }
  for (const s of r.stocks) {
    const base = `stocks.${s.id}`;
    add(`${base}.capacity`, s.capacity);
    add(`${base}.initial`, s.initial);
    add(`${base}.lowThreshold`, s.lowThreshold);
    add(`${base}.refillRate`, s.refillRate);
  }
  for (const c of r.controls) {
    const base = `controls.${c.id}`;
    c.effects.forEach((e, i) => {
      if (e.kind === 'fallback') add(`${base}.effects[${i}].delay`, e.delay);
      else add(`${base}.effects[${i}].duration`, e.duration);
    });
    c.capability.measurements.forEach((m, i) => add(`${base}.capability.measurements[${i}].quantity`, m.quantity));
  }
  for (const s of r.scenarios) {
    const base = `scenarios.${s.id}`;
    add(`${base}.horizon`, s.horizon);
    s.events.forEach((e, i) => {
      add(`${base}.events[${i}].at`, e.at);
      if (e.kind === 'cut-service') add(`${base}.events[${i}].restoreAfter`, e.restoreAfter);
      else add(`${base}.events[${i}].downFor`, e.downFor);
    });
  }
  add('production.annualTonnes', r.production.annualTonnes);
  add('production.price', r.production.price);
  add('production.degradedOutput', r.production.degradedOutput);
  return out;
}

/** Every Quantity in the register with its id-keyed path. */
export function quantityPaths(r: Register): { path: string; quantity: Quantity }[] {
  return collect(r);
}

/** Every domain judgement that is not a number: each process tier and each dependency. */
export function judgementPaths(r: Register): string[] {
  return r.processes.flatMap((p) => [`processes.${p.id}.tier`, ...p.dependsOn.map((d) => `processes.${p.id}.dependsOn.${d.on}`)]);
}

/** Returns a copy with each path's value replaced (provenance untouched), re-validated. */
export function applyOverrides(r: Register, overrides: Record<string, number>): Register {
  const copy = structuredClone(r);
  const byPath = new Map(collect(copy).map((e) => [e.path, e.quantity]));
  const unknown = Object.keys(overrides).filter((path) => !byPath.has(path));
  if (unknown.length) throw new RegisterError(unknown.map((path) => `unknown override path: ${path}`));
  for (const [path, value] of Object.entries(overrides)) byPath.get(path)!.value = value;
  return parseRegister(copy);
}
