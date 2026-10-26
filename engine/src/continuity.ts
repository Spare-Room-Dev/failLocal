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
 * site. Prepared, a process without one has one when a working control restores a service it depends
 * on directly, or a service those services require (followed down the whole `requires` chain): the
 * site's own restore is an independent, tested copy. The first such control in register order is the
 * source. A control with `works: false` never counts.
 */
export function independentCopyFor(r: Register, processId: string, variant: Variant): IndependentCopy {
  const process = r.processes.find((p) => p.id === processId);
  if (!process) throw new RegisterError([`unknown process '${processId}'`]);
  const own: IndependentCopy = { value: process.continuity.independentCopy, source: 'register' };
  if (variant === 'unprepared' || own.value) return own;

  const services = new Map(r.services.map((s) => [s.id, s]));
  const used = new Set<string>();
  const visit = (id: string): void => {
    if (used.has(id) || !services.has(id)) return;
    used.add(id);
    for (const req of services.get(id)?.requires ?? []) visit(req);
  };
  for (const d of process.dependsOn) visit(d.on);

  const control = r.controls.find(
    (c) => c.capability.works && c.effects.some((e) => e.kind === 'restore' && used.has(e.service)),
  );
  return control ? { value: true, source: { control: control.id } } : own;
}
