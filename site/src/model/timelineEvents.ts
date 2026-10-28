import type { Timeline, TimelineEvent, UsedInput } from '@faillocal/engine';
import { register } from './register.js';
import { serviceLabel } from './serviceGroups.js';

/** The tag word a timeline label ends in: where the event's time comes from. */
export type MarkerTag = 'computed' | 'sourced' | 'assumed' | 'measured' | 'changed by you';

/** One event on the day timeline: a service outage's start or end, or a process's first stop. */
export interface Marker {
  hour: number;
  kind: 'service-down' | 'service-up' | 'process-stopped';
  name: string;
  word: string;
  /** Where its time comes from (finish B2). */
  tag: MarkerTag;
}

const usedHours = (u: UsedInput): number => (u.unit === 'days' ? u.value * 24 : u.value);
const usedTagWord = (u: UsedInput): MarkerTag => (u.overridden ? 'changed by you' : u.provenance.kind);

/**
 * Where a service event's time comes from. A cut's start is its scenario event's `at`; its end is
 * `at` + `restoreAfter`, tagged by `restoreAfter`, the input that sets it (either one changed by the
 * visitor makes it "changed by you"). An outage inherited from another service, and anything the run
 * cannot trace to a scenario cut, is computed.
 */
function serviceTag(t: Timeline, e: TimelineEvent): MarkerTag {
  if (e.from) return 'computed';
  const base = `scenarios.${t.scenarioId}.events[`;
  for (const [path, at] of Object.entries(t.assumptionsUsed)) {
    if (!path.startsWith(base) || !path.endsWith('].at')) continue;
    if (e.kind === 'service-down' && usedHours(at) === e.hour) return usedTagWord(at);
    const restore = t.assumptionsUsed[path.replace(/\.at$/, '.restoreAfter')];
    if (e.kind === 'service-up' && restore && usedHours(at) + usedHours(restore) === e.hour)
      return at.overridden || restore.overridden ? 'changed by you' : restore.provenance.kind;
  }
  return 'computed';
}

function processName(id: string): string {
  const process = register.processes.find((p) => p.id === id);
  if (!process) throw new Error(`register has no process ${id}`);
  return process.name;
}

/** Every service outage start and end, and the first stop of each process, in the run's order. */
export function timelineMarkers(t: Timeline): Marker[] {
  const stopped = new Set<string>();
  const out: Marker[] = [];
  for (const e of t.events) {
    if (e.kind === 'service-down') out.push({ hour: e.hour, kind: e.kind, name: serviceLabel(e.subject), word: 'down', tag: serviceTag(t, e) });
    else if (e.kind === 'service-up') out.push({ hour: e.hour, kind: e.kind, name: serviceLabel(e.subject), word: 'up', tag: serviceTag(t, e) });
    else if (e.kind === 'process-state' && e.to === 'stopped' && !stopped.has(e.subject)) {
      stopped.add(e.subject);
      out.push({ hour: e.hour, kind: 'process-stopped', name: processName(e.subject), word: 'stopped', tag: 'computed' });
    }
  }
  return out;
}

/** The index of the latest marker at or before `hour`, or -1 when none has happened yet. */
export function currentMarker(markers: Marker[], hour: number): number {
  let current = -1;
  markers.forEach((m, i) => {
    if (m.hour <= hour && (current < 0 || m.hour >= markers[current]!.hour)) current = i;
  });
  return current;
}

/** A clock hour as the timeline reads it: "Day 3, hour 5". */
export function dayHour(hour: number): string {
  const whole = Math.floor(hour);
  return `Day ${Math.floor(whole / 24)}, hour ${whole % 24}`;
}

/** Where a label sits: above the axis, below it, or nowhere (it shows on hover and focus, and in the event list). */
export type Lane = 'above' | 'below' | null;

/** The minimum clear space between two labels in one lane, in px. */
const LABEL_GAP = 8;

/**
 * Lanes for the timeline's labels, so none overlaps another (finish B2). `items` are in axis order: each
 * hairline's x on an axis `axisWidth` wide and its label's width. A label slides from right of its
 * hairline to left of it as x runs across the axis (`--at` in timeline.css), so it never leaves the
 * axis. Each label takes the lane its predecessor did not, else the other one, else none: a label that
 * fits in neither is left to hover, focus and the event list.
 */
export function placeLabels(items: { x: number; width: number }[], axisWidth: number): Lane[] {
  const taken: Record<'above' | 'below', [number, number][]> = { above: [], below: [] };
  let last: Lane = 'below';
  return items.map(({ x, width }) => {
    const at = axisWidth > 0 ? Math.min(Math.max(x / axisWidth, 0), 1) : 0;
    const left = x - at * width;
    const span: [number, number] = [left, left + width];
    const clear = (lane: 'above' | 'below') => taken[lane].every(([a, b]) => span[1] + LABEL_GAP <= a || b + LABEL_GAP <= span[0]);
    const order: ('above' | 'below')[] = last === 'above' ? ['below', 'above'] : ['above', 'below'];
    const lane = order.find(clear) ?? null;
    if (lane) {
      taken[lane].push(span);
      last = lane;
    }
    return lane;
  });
}
