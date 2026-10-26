import { describe, expect, test } from 'vitest';
import { independentCopyFor } from '../src/continuity.js';
import type { Control, Register } from '../src/schema.js';
import { parseRegister } from '../src/validate.js';
import { minimalRegister, q } from './fixtures.js';

function restore(id: string, service: string, works = true): Control {
  return {
    id,
    name: id,
    description: 'Restore from the site copy.',
    effects: [{ kind: 'restore', service, duration: q(48, 'hours') }],
    capability: { works, provenance: { kind: 'assumed', reasoning: 'test' }, measurements: [] },
  };
}

/** minimalRegister (ordering depends on erp) with `controls` added. */
function withControls(...controls: Control[]): Register {
  const r = minimalRegister();
  r.controls.push(...controls);
  return r;
}

describe('independentCopyFor', () => {
  test('unprepared: the register value, even with a working restore', () => {
    const r = parseRegister(withControls(restore('erp-restore', 'erp')));
    expect(independentCopyFor(r, 'ordering', 'unprepared')).toEqual({ value: false, source: 'register' });
  });

  test('prepared: a working restore of a service the process depends on is an independent copy', () => {
    const r = parseRegister(withControls(restore('erp-restore', 'erp')));
    expect(independentCopyFor(r, 'ordering', 'prepared')).toEqual({ value: true, source: { control: 'erp-restore' } });
  });

  test('prepared: a restore that does not work never counts', () => {
    const r = parseRegister(withControls(restore('erp-restore', 'erp', false)));
    expect(independentCopyFor(r, 'ordering', 'prepared')).toEqual({ value: false, source: 'register' });
  });

  test('prepared: a register value of true stays true, from the register', () => {
    const doc = withControls(restore('erp-restore', 'erp'));
    doc.processes.find((p) => p.id === 'ordering')!.continuity.independentCopy = true;
    const r = parseRegister(doc);
    expect(independentCopyFor(r, 'ordering', 'unprepared')).toEqual({ value: true, source: 'register' });
    expect(independentCopyFor(r, 'ordering', 'prepared')).toEqual({ value: true, source: 'register' });
  });

  test('prepared: a restore of a service that a dependency requires counts, through the whole requires chain', () => {
    const doc = withControls(restore('dc-restore', 'dc'));
    doc.services.push(
      { id: 'net', name: 'Network', provider: 'test', hosting: 'test', kind: 'network-link', requires: ['dc'] },
      { id: 'dc', name: 'Data centre', provider: 'test', hosting: 'test', kind: 'network-link' },
    );
    doc.services[0]!.requires = ['net'];
    expect(independentCopyFor(parseRegister(doc), 'ordering', 'prepared')).toEqual({ value: true, source: { control: 'dc-restore' } });
  });

  test('prepared: when several controls qualify, the first in register order is the source', () => {
    const r = parseRegister(withControls(restore('second', 'erp', false), restore('first', 'erp'), restore('third', 'erp')));
    expect(independentCopyFor(r, 'ordering', 'prepared').source).toEqual({ control: 'first' });
  });

  test('prepared: other effect kinds, and restores of services the process does not use, do not count', () => {
    const doc = withControls({
      ...restore('fallback', 'erp'),
      effects: [{ kind: 'fallback', process: 'ordering', service: 'erp' }],
    });
    doc.services.push({ id: 'other', name: 'Other', provider: 'test', hosting: 'test', kind: 'enterprise-app' });
    doc.controls.push(restore('other-restore', 'other'));
    const r = parseRegister(doc);
    expect(independentCopyFor(r, 'ordering', 'prepared')).toEqual({ value: false, source: 'register' });
    // haulage depends on no service at all
    expect(independentCopyFor(r, 'haulage', 'prepared')).toEqual({ value: false, source: 'register' });
  });

  test('an unknown process is an error', () => {
    expect(() => independentCopyFor(parseRegister(minimalRegister()), 'ghost', 'prepared')).toThrow(/ghost/);
  });
});
