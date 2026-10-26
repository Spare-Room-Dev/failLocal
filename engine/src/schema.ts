import { z } from 'zod';
import { provenanceSchema, quantity } from './quantity.js';
import type { Quantity, Unit } from './quantity.js';

const text = z.string().min(1);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be ISO yyyy-mm-dd');

/** Ids appear inside override and decision-log paths, so they must not contain `.` or `[`. */
export const ID_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;

const id = z.string().regex(ID_PATTERN, 'id must be lowercase letters, digits, "-" or "_" (it appears in paths)');

const UNITS = ['hours', 'days', 'seconds', 'count', 'fraction', 'Mt/a', 'USD/t', 'days/day'] as const;
const _unitsAreExhaustive: Unit extends (typeof UNITS)[number] ? true : never = true;
void _unitsAreExhaustive;

/** A quantity whose value must also pass `ok`. The issue is reported on its `value`. */
function bounded<U extends Unit>(q: z.ZodType<Quantity<U>>, ok: (value: number) => boolean, message: string) {
  return q.refine((x) => ok(x.value), { message, path: ['value'] });
}

/** The longest scenario a run will simulate: 400 days of hourly samples. */
const MAX_HORIZON_DAYS = 400;

const fraction = bounded(quantity('fraction'), (v) => v <= 1, 'a fraction must be at most 1');
const positiveHours = bounded(quantity('hours'), (v) => v > 0, 'must be more than 0 hours');
const horizon = bounded(
  quantity('days'),
  (v) => v > 0 && v <= MAX_HORIZON_DAYS,
  `horizon must be more than 0 and at most ${MAX_HORIZON_DAYS} days`,
);

/** A quantity in any unit, measured allowed: lab results that never feed the simulation. */
const anyQuantity = z
  .object({ value: z.number().finite(), unit: z.enum(UNITS), provenance: provenanceSchema })
  .strict();

export const tierSchema = z.enum(['high', 'medium', 'low']);
export const processKindSchema = z.enum(['back-office', 'physical']);

export const sourceSchema = z
  .object({ id, title: text, url: text, accessed: isoDate })
  .strict();

export const dependencySchema = z
  .object({
    on: text, // id of a service | asset | process | stock
    onLoss: z.enum(['stop', 'degrade']),
    manualWorkaround: z
      .object({ description: text, holdsFor: quantity('days') })
      .strict()
      .optional(), // service dependencies only
    // Service dependencies only: after each outage the dependency stays lost for `holdFor` more hours.
    afterRestore: z
      .object({ description: text, holdFor: quantity('hours') })
      .strict()
      .optional(),
  })
  .strict();

export const processSchema = z
  .object({
    id,
    name: text,
    area: text,
    kind: processKindSchema,
    tier: tierSchema,
    safetyFunction: text,
    productionConsequence: text,
    dependsOn: z.array(dependencySchema),
    status: z.object({ degraded: text, stopped: text }).strict(), // plain-English UI copy
    continuity: z
      .object({
        maxTolerableOutage: quantity('hours'),
        recoveryTarget: quantity('hours'),
        owner: text,
        independentCopy: z.boolean(),
        lastRestoreTest: z
          .object({ date: isoDate, result: z.enum(['pass', 'fail']), provenance: provenanceSchema })
          .strict()
          .optional(),
      })
      .strict(),
  })
  .strict();

export const assetSchema = z
  .object({
    id,
    name: text,
    type: z.enum(['plc', 'hmi', 'historian', 'server', 'network', 'workstation']),
    zone: text,
    area: text.optional(),
  })
  .strict();

export const serviceSchema = z
  .object({
    id,
    name: text,
    provider: text,
    hosting: text,
    kind: z.enum(['enterprise-app', 'identity', 'remote-ops', 'vendor-access', 'network-link']),
    requires: z.array(text).optional(), // service ids; down if any required service is down
    // Remote access only: the asset ids on site this service can reach. A compromise through it must target one.
    reaches: z.array(text).optional(),
  })
  .strict();

export const stockSchema = z
  .object({
    id,
    name: text,
    capacity: quantity('days'),
    initial: quantity('days'),
    lowThreshold: quantity('days'),
    refillRate: quantity('days/day'),
    leadTime: quantity('hours').optional(), // order to delivery; absent means 0
    replenishedBy: text, // process id
    consumedBy: z.array(text).min(1), // process ids
  })
  .strict();

export const controlEffectSchema = z.discriminatedUnion('kind', [
  z
    .object({ kind: z.literal('fallback'), process: text, service: text, delay: quantity('hours').optional() })
    .strict(),
  z.object({ kind: z.literal('restore'), service: text, duration: quantity('hours') }).strict(),
  // Removes the post-restore hold (`afterRestore`) on the dependency of `process` on `service`. No duration.
  z.object({ kind: z.literal('reconcile'), process: text, service: text }).strict(),
  // The only real-world duration a lab run may supply (spec §5.3).
  z
    .object({
      kind: z.literal('detect-and-revoke'),
      service: text,
      duration: quantity('hours', { allowMeasured: true }),
    })
    .strict(),
]);

export const controlSchema = z
  .object({
    id,
    name: text,
    description: text,
    effects: z.array(controlEffectSchema).min(1),
    assets: z.array(text).optional(), // asset ids the control relies on
    capability: z
      .object({
        works: z.boolean(),
        provenance: provenanceSchema,
        measurements: z.array(z.object({ name: text, quantity: anyQuantity }).strict()),
        observations: z
          .array(z.object({ name: text, value: text, provenance: provenanceSchema }).strict())
          .optional(),
      })
      .strict(),
  })
  .strict();

export const scenarioEventSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('cut-service'),
      service: text,
      at: quantity('hours'),
      restoreAfter: positiveHours,
    })
    .strict(),
  z
    .object({
      kind: z.literal('compromise'),
      via: text, // service id
      target: text, // asset id
      at: quantity('hours'),
      downFor: positiveHours,
    })
    .strict(),
]);

export const scenarioSchema = z
  .object({
    id,
    title: text,
    summary: text,
    basis: z.array(text), // source ids
    projection: z.boolean(), // true => the UI must label the run as a projection
    workaroundsHold: z.boolean(), // true => manualWorkaround degrades indefinitely ("as reported")
    horizon,
    events: z.array(scenarioEventSchema),
  })
  .strict();

export const productionSchema = z
  .object({
    annualTonnes: quantity('Mt/a'),
    price: quantity('USD/t'),
    shippingProcess: text, // process id whose state defers tonnes
    degradedOutput: fraction,
  })
  .strict();

export const registerSchema = z
  .object({
    schemaVersion: z.literal(1),
    site: z.object({ id, name: text, fictional: z.literal(true), description: text }).strict(),
    sources: z.array(sourceSchema),
    processes: z.array(processSchema),
    assets: z.array(assetSchema),
    services: z.array(serviceSchema),
    stocks: z.array(stockSchema),
    controls: z.array(controlSchema),
    scenarios: z.array(scenarioSchema),
    production: productionSchema,
  })
  .strict();

export type Tier = z.infer<typeof tierSchema>;
export type ProcessKind = z.infer<typeof processKindSchema>;
export type Source = z.infer<typeof sourceSchema>;
export type Dependency = z.infer<typeof dependencySchema>;
export type Process = z.infer<typeof processSchema>;
export type Asset = z.infer<typeof assetSchema>;
export type Service = z.infer<typeof serviceSchema>;
export type Stock = z.infer<typeof stockSchema>;
export type ControlEffect = z.infer<typeof controlEffectSchema>;
export type Control = z.infer<typeof controlSchema>;
export type ScenarioEvent = z.infer<typeof scenarioEventSchema>;
export type Scenario = z.infer<typeof scenarioSchema>;
export type Production = z.infer<typeof productionSchema>;
export type Register = z.infer<typeof registerSchema>;
