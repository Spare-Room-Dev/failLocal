import type { DisplayKind, Provenance, Register, Timeline, TimelineEvent, UsedInput, Variant } from '@faillocal/engine';
import { horizonHours } from './clock.js';
import type { QtyKind } from './format.js';
import { deriveRun } from './run.js';

/** Seconds the run holds on each step. */
export const DWELL_SECONDS = 4.5;
/** Clock speed while the run travels between two steps of one segment. */
export const TRAVEL_HOURS_PER_SECOND = 40;

/** A quantity inside a caption, rendered by `<Qty>`. */
export interface CaptionQty {
  value: number;
  kind: QtyKind;
  display: DisplayKind;
  provenance?: Provenance;
  overridden?: boolean;
}

/** A caption: text runs and quantities, in reading order. A date part is a calendar date, shown as written. */
export type CaptionParts = Array<string | { qty: CaptionQty } | { date: string; text: string }>;

export type Segment = 'as-reported' | 'projection' | 'prepared';

export type Moment = 'start' | 'restore' | 'fuel-stops' | 'fleet-parks' | 'trains-slow' | 'total';

export interface GuidedStep {
  segment: Segment;
  moment: Moment;
  scenarioId: string;
  variant: Variant;
  hour: number;
  caption: (t: Timeline) => CaptionParts;
}

const AS_REPORTED = 's1-as-reported';
const PROJECTION = 's1-projection';
const RESTORE_AFTER = `scenarios.${AS_REPORTED}.events[0].restoreAfter`;
/** The one assumed number the comparison rests on (D-094). */
export const HOLD_PATH = 'processes.diesel-ordering.dependsOn.hosted-erp.afterRestore.holdFor';

function timeline(r: Register, scenarioId: string, variant: Variant): Timeline {
  const result = deriveRun(r, { spec: { kind: 'register', scenarioId }, variant, overrides: {} });
  if (!result.ok) throw new Error(`guided run: ${scenarioId} (${variant}) does not run: ${result.issues.join('; ')}`);
  return result.timeline;
}

function used(t: Timeline, path: string): UsedInput {
  const u = t.assumptionsUsed[path];
  if (!u) throw new Error(`guided run: ${t.scenarioId} did not use ${path}`);
  return u;
}

const toProcess = (subject: string, states: string[]) => (e: TimelineEvent) =>
  e.kind === 'process-state' && e.subject === subject && states.includes(e.to ?? '');

/** How each moment is found in a run's events; `total` is the run's last hour. */
const FINDERS: Record<Exclude<Moment, 'start' | 'total'>, (e: TimelineEvent) => boolean> = {
  restore: (e) => e.kind === 'service-up' && e.subject === 'hosted-erp',
  'fuel-stops': toProcess('diesel-ordering', ['stopped']),
  'fleet-parks': toProcess('haulage', ['stopped']),
  'trains-slow': toProcess('rail', ['degraded', 'stopped']),
};

/** The hour of `moment` in `t`, or undefined when it never happens there. */
function findHour(t: Timeline, moment: Moment): number | undefined {
  if (moment === 'start') return 0;
  if (moment === 'total') return horizonHours(t);
  return t.events.find(FINDERS[moment])?.hour;
}

const text = (s: string) => (): CaptionParts => [s];
const totalCaption = (lead: string) => (t: Timeline): CaptionParts => [
  lead,
  { qty: { value: t.totals.revenueAtRisk, kind: 'usd', display: 'computed' } },
  ' of revenue at risk.',
];

/** Draft copy (the owner approves it at the Task 12 gate). */
const CAPTIONS = {
  start: (): CaptionParts => [
    { date: '2026-05', text: 'May 2026' },
    ": Scope Systems' hosted ERP goes down. Purchasing moves to phone and email. This is the record, on a fictional model site.",
  ],
  reportedRestore: (t: Timeline): CaptionParts => {
    const u = used(t, RESTORE_AFTER);
    const days = u.unit === 'hours' ? u.value / 24 : u.value;
    return [
      'The ERP is back after ',
      { qty: { value: days, kind: 'days', display: u.provenance.kind, provenance: u.provenance, overridden: u.overridden } },
      '. The trucks never stopped.',
    ];
  },
  projection: {
    'fuel-stops': text('Projection: what if the workarounds ran out? Fuel orders stop.'),
    'fleet-parks': text('The fuel farm runs dry. The fleet parks.'),
    restore: text('The ERP returns, but orders are held while transactions are reconciled.'),
    'trains-slow': text('The stockpile runs low. Trains slow.'),
    total: totalCaption('By the end of the projection: '),
  },
  prepared: {
    intro: text('Same outage, prepared site: offline ordering and an independent restore keep fuel coming.'),
    'fuel-stops': text('Fuel orders keep going.'),
    'fleet-parks': text('The fleet keeps running.'),
    restore: text('The ERP is back, restored independently.'),
    'trains-slow': text('The trains keep running.'),
    total: totalCaption('By the end, prepared: '),
  },
};

/** Captions for the prepared moments that did happen there. */
const PREPARED_HAPPENED: Record<Exclude<Moment, 'start'>, (t: Timeline) => CaptionParts> = {
  ...CAPTIONS.projection,
  restore: CAPTIONS.prepared.restore,
  total: CAPTIONS.prepared.total,
};

const PROJECTION_MOMENTS = ['fuel-stops', 'fleet-parks', 'restore', 'trains-slow', 'total'] as const;
type ProjectionMoment = (typeof PROJECTION_MOMENTS)[number];
const byHour = (a: GuidedStep, b: GuidedStep) => a.hour - b.hour;

/**
 * The guided run's steps, in order. Every hour is found in that segment's own computed run, so a
 * register change moves the steps with the events. A prepared moment that never happens takes
 * its projection hour and a caption saying so. Each segment is ordered by hour, so the clock only
 * travels forward within it.
 */
export function guidedSteps(r: Register): GuidedStep[] {
  const reported = timeline(r, AS_REPORTED, 'unprepared');
  const projected = timeline(r, PROJECTION, 'unprepared');
  const prepared = timeline(r, PROJECTION, 'prepared');

  const reportedRestore = findHour(reported, 'restore');
  if (reportedRestore === undefined) throw new Error(`guided run: the ERP never comes back in ${AS_REPORTED}`);
  const segment1: GuidedStep[] = [
    { segment: 'as-reported', moment: 'start', scenarioId: AS_REPORTED, variant: 'unprepared', hour: 0, caption: CAPTIONS.start },
    { segment: 'as-reported', moment: 'restore', scenarioId: AS_REPORTED, variant: 'unprepared', hour: reportedRestore, caption: CAPTIONS.reportedRestore },
  ];

  const asOf = (moment: ProjectionMoment): number => {
    const hour = findHour(projected, moment);
    if (hour === undefined) throw new Error(`guided run: ${PROJECTION} (unprepared) has no "${moment}" moment`);
    return hour;
  };
  const segment2: GuidedStep[] = PROJECTION_MOMENTS.map((moment) => ({
    segment: 'projection',
    moment,
    scenarioId: PROJECTION,
    variant: 'unprepared',
    hour: asOf(moment),
    caption: CAPTIONS.projection[moment],
  }));

  const segment3: GuidedStep[] = PROJECTION_MOMENTS
    .map((moment) => {
      const hour = findHour(prepared, moment);
      const caption = hour === undefined ? CAPTIONS.prepared[moment] : PREPARED_HAPPENED[moment];
      return { segment: 'prepared' as const, moment, scenarioId: PROJECTION, variant: 'prepared' as const, hour: hour ?? asOf(moment), caption };
    })
    .sort(byHour);
  segment3[0] = { ...segment3[0]!, caption: CAPTIONS.prepared.intro };

  return [...segment1, ...segment2.sort(byHour), ...segment3];
}

/** Hours the clock travels from `from` to `to`: forward within one segment, otherwise a jump (zero). */
export function travelHours(from: GuidedStep, to: GuidedStep): number {
  return from.segment === to.segment ? Math.max(0, to.hour - from.hour) : 0;
}

/** The run's length: a dwell on every step plus the travel between them. */
export function guidedDurationSeconds(steps: GuidedStep[]): number {
  const travel = steps.slice(1).reduce((sum, step, i) => sum + travelHours(steps[i]!, step), 0);
  return steps.length * DWELL_SECONDS + travel / TRAVEL_HOURS_PER_SECOND;
}

export interface Comparison {
  unprepared: number;
  prepared: number;
  protected: number;
  hold: UsedInput;
}

/** The closing card: revenue at risk in the projection, unprepared and prepared, and the hold it rests on. */
export function comparison(r: Register): Comparison {
  const unprepared = timeline(r, PROJECTION, 'unprepared');
  const prepared = timeline(r, PROJECTION, 'prepared');
  return {
    unprepared: unprepared.totals.revenueAtRisk,
    prepared: prepared.totals.revenueAtRisk,
    protected: unprepared.totals.revenueAtRisk - prepared.totals.revenueAtRisk,
    hold: used(unprepared, HOLD_PATH),
  };
}
