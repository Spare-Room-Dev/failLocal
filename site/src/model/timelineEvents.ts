import type { Timeline } from '@faillocal/engine';
import { register } from './register.js';
import { serviceLabel } from './serviceGroups.js';

/** One event on the day timeline: a service outage's start or end, or a process's first stop. */
export interface Marker {
  hour: number;
  kind: 'service-down' | 'service-up' | 'process-stopped';
  name: string;
  word: string;
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
    if (e.kind === 'service-down') out.push({ hour: e.hour, kind: e.kind, name: serviceLabel(e.subject), word: 'down' });
    else if (e.kind === 'service-up') out.push({ hour: e.hour, kind: e.kind, name: serviceLabel(e.subject), word: 'up' });
    else if (e.kind === 'process-state' && e.to === 'stopped' && !stopped.has(e.subject)) {
      stopped.add(e.subject);
      out.push({ hour: e.hour, kind: 'process-stopped', name: processName(e.subject), word: 'stopped' });
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
