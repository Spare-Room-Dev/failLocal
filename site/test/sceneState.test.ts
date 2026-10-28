import { simulate } from '@faillocal/engine';
import type { Register, Sample } from '@faillocal/engine';
import { describe, expect, test } from 'vitest';
import { register } from '../src/model/register.js';
import { sceneState } from '../src/model/sceneState.js';

function sampleAt(hour: number): Sample {
  const sample = simulate(register, 's1-projection', 'unprepared').samples.find((s) => s.hour === hour);
  if (!sample) throw new Error(`no sample at hour ${hour}`);
  return sample;
}

describe('sceneState', () => {
  test('binding table holds at s1-projection hour 300 unprepared', () => {
    const sample = sampleAt(300);
    expect(sample.processes.haulage).toBe('stopped');
    expect(sample.services['hosted-erp']).toBe('up');

    const scene = sceneState(register, sample);
    expect(scene.hour).toBe(300);
    expect(scene.fleet).toEqual({ moving: 0, parked: 8 });
    expect(scene.processes.haulage).toMatchObject({ state: 'stopped', flag: 'full', hatched: true, label: 'Haulage', note: 'Haul fleet parked' });
    expect(scene.services['hosted-erp']).toEqual({ state: 'up', cable: 'live' });
    for (const [id, state] of Object.entries(sample.processes)) expect(scene.processes[id]!.state).toBe(state);
  });

  test('degraded haulage shows four parked', () => {
    const sample: Sample = { ...sampleAt(0), processes: { ...sampleAt(0).processes, haulage: 'degraded' } };
    const scene = sceneState(register, sample);
    expect(scene.fleet).toEqual({ moving: 4, parked: 4 });
    expect(scene.processes.haulage).toMatchObject({ flag: 'half', hatched: false, note: 'Haul fleet running at a reduced rate' });
  });

  test('normal areas fly a pennant with no note', () => {
    const scene = sceneState(register, sampleAt(0));
    expect(scene.processes.crushing).toMatchObject({ state: 'normal', flag: 'pennant', hatched: false, note: '' });
    expect(scene.fleet).toEqual({ moving: 8, parked: 0 });
    expect(scene.train.speed).toBe(1);
    expect(scene.motion).toEqual({ crusher: true, conveyor: true });
  });

  test('rail and crushing drive the train and the plant', () => {
    const base = sampleAt(0);
    const half = sceneState(register, { ...base, processes: { ...base.processes, rail: 'degraded', crushing: 'degraded' } });
    expect(half.train.speed).toBe(0.5);
    expect(half.motion).toEqual({ crusher: true, conveyor: true });
    const stopped = sceneState(register, { ...base, processes: { ...base.processes, rail: 'stopped', crushing: 'stopped' } });
    expect(stopped.train.speed).toBe(0);
    expect(stopped.motion).toEqual({ crusher: false, conveyor: false });
  });

  test('services map to cables', () => {
    const base = sampleAt(0);
    const scene = sceneState(register, { ...base, services: { ...base.services, 'hosted-erp': 'down', 'vendor-a-access': 'revoked' } });
    expect(scene.services['hosted-erp']!.cable).toBe('severed');
    expect(scene.services['vendor-a-access']!.cable).toBe('revoked');
    expect(scene.services['iroc-link']!.cable).toBe('live');
  });

  test('fills are level over capacity', () => {
    const scene = sceneState(register, sampleAt(0));
    expect(scene.fills.diesel).toBe(1);
    for (const fill of Object.values(scene.fills)) expect(fill).toBeGreaterThanOrEqual(0);
    const base = sampleAt(0);
    const clamped = sceneState(register, { ...base, stocks: { ...base.stocks, diesel: 99, 'rom-pad': -1 } });
    expect(clamped.fills.diesel).toBe(1);
    expect(clamped.fills.romPad).toBe(0);
  });

  test('cables are keyed by service group, the worst state of each group', () => {
    const base = sampleAt(0);
    const scene = sceneState(register, { ...base, services: { ...base.services, 'hosted-erp': 'up', 'vendor-b-access': 'revoked' } });
    expect(scene.cables).toEqual({
      'hosted-erp': 'live',
      'cloud-identity': 'live',
      'iroc-link': 'live',
      'corporate-network': 'live',
      'vendor-access': 'revoked',
    });
  });

  test('the plate carries the fixed honesty wording', () => {
    expect(sceneState(register, sampleAt(0)).plate).toEqual({ fictional: true, text: 'FICTIONAL MODEL SITE · PILBARA IRON ORE · SYNTHETIC DATA' });
  });

  test('a register not marked fictional throws rather than render an unlabelled site', () => {
    const real = { ...register, site: { ...register.site, fictional: false } } as unknown as Register;
    expect(() => sceneState(real, sampleAt(0))).toThrow(/fictional/);
  });

  test('a missing process, service or stock value throws', () => {
    const base = sampleAt(0);
    const without = <T extends object>(o: T, key: string) => Object.fromEntries(Object.entries(o).filter(([k]) => k !== key)) as T;
    expect(() => sceneState(register, { ...base, processes: without(base.processes, 'payroll') })).toThrow(/payroll/);
    expect(() => sceneState(register, { ...base, processes: without(base.processes, 'crushing') })).toThrow(/crushing/);
    expect(() => sceneState(register, { ...base, services: without(base.services, 'iroc-link') })).toThrow(/iroc-link/);
    expect(() => sceneState(register, { ...base, stocks: without(base.stocks, 'diesel') })).toThrow(/diesel/);
  });
});
