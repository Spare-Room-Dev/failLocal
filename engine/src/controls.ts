/**
 * Which resilience controls a prepared run applies, and the durations their effects supply. The
 * simulation decides what those durations do; see the doc comment in `simulate.ts`.
 *
 * A control applies only if its capability works, and only at a sample where none of the assets it
 * relies on is down. Only effect durations are read: `capability.measurements` and
 * `capability.observations` never feed the simulation.
 *
 * When several applicable controls cover the same thing, the shortest duration wins (D-005): the
 * earliest detection, the shortest fallback delay, and the shortest restore. A reconcile has no
 * duration: it applies or it does not.
 */
import { quantityPaths } from './paths.js';
import { toHours } from './quantity.js';
import type { Control, Register } from './schema.js';

/** Whether `asset` is down at sample `hour`. */
export type AssetDown = (asset: string, hour: number) => boolean;

/** The controls whose capability works: the ones a prepared run can apply. */
export function workingControls(controls: Control[]): Control[] {
  return controls.filter((c) => c.capability.works);
}

/** The `quantityPaths` of `r` that are an effect duration or delay of one of `controls`. */
export function effectPaths(r: Register, controls: Control[]): Set<string> {
  const prefixes = controls.map((c) => `controls.${c.id}.effects[`);
  return new Set(
    quantityPaths(r)
      .map((e) => e.path)
      .filter((path) => prefixes.some((prefix) => path.startsWith(prefix))),
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

/** Each restore of `service`: its restore time and the assets its control relies on. */
export function restoreEffects(controls: Control[], service: string): { hours: number; assets: string[] }[] {
  return controls.flatMap((c) =>
    c.effects.flatMap((e) =>
      e.kind === 'restore' && e.service === service ? [{ hours: toHours(e.duration), assets: c.assets ?? [] }] : [],
    ),
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

/**
 * Whether a reconcile control removes the post-restore hold on the dependency of `process` on
 * `service` at sample `hour`.
 */
export function reconcileApplies(
  controls: Control[],
  process: string,
  service: string,
  hour: number,
  assetDown: AssetDown,
): boolean {
  return controls.some(
    (c) =>
      assetsUp(c, hour, assetDown) &&
      c.effects.some((e) => e.kind === 'reconcile' && e.process === process && e.service === service),
  );
}
