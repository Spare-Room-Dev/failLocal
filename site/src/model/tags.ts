import { quantityPaths } from '@faillocal/engine';
import type { Provenance, Quantity, UsedInput } from '@faillocal/engine';
import { register } from './register.js';

/**
 * What a displayed number's tag is derived from. A computed number; an input with its provenance; or
 * an input the visitor changed, with `original`, the register's value in the units shown.
 */
export type QtyTag =
  | { computed: true }
  | { provenance: Provenance; overridden?: false }
  | { provenance: Provenance; overridden: true; original: number };

let byPath: Map<string, Quantity> | undefined;

/** The register's own quantity at `path`. Throws when the register has none there. */
export function registerQuantity(path: string): Quantity {
  byPath ??= new Map(quantityPaths(register).map(({ path: p, quantity }) => [p, quantity]));
  const quantity = byPath.get(path);
  if (!quantity) throw new Error(`register has no quantity at ${path}`);
  return quantity;
}

/**
 * The tag for the run input at `path`. `scale` converts the register's units to the ones shown (1/24
 * for hours shown as days), so a changed input's tooltip gives the register value as displayed.
 */
export function usedTag(path: string, used: UsedInput, scale = 1): QtyTag {
  return used.overridden
    ? { provenance: used.provenance, overridden: true, original: registerQuantity(path).value * scale }
    : { provenance: used.provenance };
}
