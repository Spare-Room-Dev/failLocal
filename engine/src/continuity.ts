import type { Register } from './schema.js';
import type { Variant } from './simulate.js';
import { RegisterError } from './validate.js';

export interface IndependentCopy {
  value: boolean;
  /** `'register'`: the process's own `continuity.independentCopy`. A control: the restore that gives the copy. */
  source: 'register' | { control: string };
}

/**
 * Whether a process has an independent copy in a variant. The register value describes the baseline
 * site. Prepared, a process without one has one when a working control restores a business
 * application (`enterprise-app`) whose data the process depends on: one it depends on directly, or one
 * reached from such an application through `requires` hops that pass only through business
 * applications. The site's own restore of that application is an independent, tested copy of its
 * data. A restored network link, identity, remote-ops or vendor-access service is not a copy of
 * anyone's data, and nothing reached through one counts. The first such control in register order is
 * the source. A control with `works: false` never counts.
 */
export function independentCopyFor(r: Register, processId: string, variant: Variant): IndependentCopy {
  const process = r.processes.find((p) => p.id === processId);
  if (!process) throw new RegisterError([`unknown process '${processId}'`]);
  const own: IndependentCopy = { value: process.continuity.independentCopy, source: 'register' };
  if (variant === 'unprepared' || own.value) return own;

  const services = new Map(r.services.map((s) => [s.id, s]));
  const used = new Set<string>();
  const visit = (id: string): void => {
    const service = services.get(id);
    if (used.has(id) || service?.kind !== 'enterprise-app') return;
    used.add(id);
    for (const req of service.requires ?? []) visit(req);
  };
  for (const d of process.dependsOn) visit(d.on);

  const control = r.controls.find(
    (c) => c.capability.works && c.effects.some((e) => e.kind === 'restore' && used.has(e.service)),
  );
  return control ? { value: true, source: { control: control.id } } : own;
}
