/**
 * Which resilience controls a prepared run applies, and the durations their effects supply. The
 * simulation decides what those durations do; see the doc comment in `simulate.ts`.
 *
 * A control applies only if its capability works, and only at a sample where none of the assets it
 * relies on is down. Only effect durations are read: `capability.measurements` and
 * `capability.observations` never feed the simulation.
 */
import { toHours } from './quantity.js';
import type { Control } from './schema.js';

/** Whether `asset` is down at sample `hour`. */
export type AssetDown = (asset: string, hour: number) => boolean;

/** The controls whose capability works: the ones a prepared run can apply. */
export function workingControls(controls: Control[]): Control[] {
  return controls.filter((c) => c.capability.works);
}

/** The id-keyed paths of every effect duration and delay of `controls`, as `quantityPaths` names them. */
export function effectPaths(controls: Control[]): Set<string> {
  return new Set(
    controls.flatMap((c) =>
      c.effects.map((e, i) => `controls.${c.id}.effects[${i}].${e.kind === 'fallback' ? 'delay' : 'duration'}`),
    ),
  );
}

/** Whether every asset `c` relies on is up at sample `hour`. */
function assetsUp(c: Control, hour: number, assetDown: AssetDown): boolean {
  return (c.assets ?? []).every((a) => !assetDown(a, hour));
}

/** The shortest of `hours`, or undefined when there are none. */
function shortest(hours: number[]): number | undefined {
  return hours.length ? Math.min(...hours) : undefined;
}

/**
 * Hours from a compromise via `service` at time `at` until a control detects it and revokes that
 * service's access, or undefined if none does. Each control is checked at its detection hour.
 */
export function detectionDelay(controls: Control[], service: string, at: number, assetDown: AssetDown): number | undefined {
  return shortest(
    controls.flatMap((c) =>
      c.effects.flatMap((e) => {
        if (e.kind !== 'detect-and-revoke' || e.service !== service) return [];
        const hours = toHours(e.duration);
        return assetsUp(c, Math.ceil(at + hours), assetDown) ? [hours] : [];
      }),
    ),
  );
}

/** The restore time for an outage of `service` that starts at `start`, or undefined if no control restores it. */
export function restoreDuration(controls: Control[], service: string, start: number, assetDown: AssetDown): number | undefined {
  return shortest(
    controls
      .filter((c) => assetsUp(c, Math.ceil(start), assetDown))
      .flatMap((c) => c.effects.flatMap((e) => (e.kind === 'restore' && e.service === service ? [toHours(e.duration)] : []))),
  );
}

/**
 * The takeover delay of a fallback for the dependency of `process` on `service` at sample `hour`,
 * or undefined if no fallback covers it then.
 */
export function takeoverDelay(
  controls: Control[],
  process: string,
  service: string,
  hour: number,
  assetDown: AssetDown,
): number | undefined {
  return shortest(
    controls
      .filter((c) => assetsUp(c, hour, assetDown))
      .flatMap((c) =>
        c.effects.flatMap((e) =>
          e.kind === 'fallback' && e.process === process && e.service === service ? [e.delay ? toHours(e.delay) : 0] : [],
        ),
      ),
  );
}
