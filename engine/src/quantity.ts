import { z } from 'zod';

// Parse without `new Function`: the site's CSP has no 'unsafe-eval', and zod's eval probe alone reports a violation.
z.config({ jitless: true });

export type Provenance =
  | { kind: 'sourced'; source: string; note?: string } // source = sources[].id
  | { kind: 'measured'; runId: string; date: string; evidence: string } // date = ISO yyyy-mm-dd
  | { kind: 'assumed'; reasoning: string };

/** What the UI labels a number as: its provenance kind, or `computed` for numbers the engine derives. */
export type DisplayKind = Provenance['kind'] | 'computed';

export type Unit = 'hours' | 'days' | 'seconds' | 'count' | 'fraction' | 'Mt/a' | 'USD/t' | 'days/day';

export interface Quantity<U extends Unit = Unit> {
  value: number;
  unit: U;
  provenance: Provenance;
}

const text = z.string().min(1);

export const provenanceSchema: z.ZodType<Provenance> = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('sourced'), source: text, note: text.optional() }).strict(),
  z
    .object({
      kind: z.literal('measured'),
      runId: text,
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be ISO yyyy-mm-dd'),
      evidence: text,
    })
    .strict(),
  z.object({ kind: z.literal('assumed'), reasoning: text }).strict(),
]);

const MEASURED_DISALLOWED =
  'measured provenance is not allowed here (spec §5.3): lab measurements are not real-world durations';

/**
 * Schema for a number that must carry provenance. The value is finite and never negative. `measured`
 * is rejected unless the field opts in with `allowMeasured`, so lab numbers cannot leak into
 * real-world durations.
 */
export function quantity<U extends Unit>(unit: U, opts: { allowMeasured?: boolean } = {}): z.ZodType<Quantity<U>> {
  return z
    .object({
      value: z.number().finite().nonnegative(),
      unit: z.literal(unit),
      provenance: provenanceSchema,
    })
    .strict()
    .superRefine((q, ctx) => {
      if (q.provenance.kind === 'measured' && !opts.allowMeasured) {
        ctx.addIssue({ code: 'custom', path: ['provenance', 'kind'], message: MEASURED_DISALLOWED });
      }
    }) as z.ZodType<Quantity<U>>;
}

export function toHours(q: Quantity<'hours' | 'days'>): number {
  return q.unit === 'days' ? q.value * 24 : q.value;
}
