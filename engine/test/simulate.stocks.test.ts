import { describe, expect, test } from 'vitest';
import { tonnesPerHour } from '../src/production.js';
import { simulate, simulateWith } from '../src/simulate.js';
import type { Sample, Timeline } from '../src/simulate.js';
import { parseRegister, RegisterError } from '../src/validate.js';
import { minimalRegister, q } from './fixtures.js';

function at(t: Timeline, hour: number): Sample {
  const s = t.samples[hour];
  if (!s) throw new Error(`no sample at hour ${hour}`);
  return s;
}

function cutErp(): Timeline {
  return simulate(parseRegister(minimalRegister()), 'cut-erp', 'unprepared');
}

test('diesel runs down once ordering stops, and haulage degrades then stops', () => {
  const t = cutErp();
  expect(at(t, 24).stocks.diesel).toBe(3);
  expect(at(t, 71).processes.haulage).toBe('normal');
  expect(at(t, 72).processes.haulage).toBe('degraded');
  expect(at(t, 96).processes.haulage).toBe('stopped');
  expect(at(t, 96).processes.crushing).toBe('stopped');
});

test('the stockpile buffers rail after crushing stops', () => {
  const t = cutErp();
  expect(at(t, 155).processes.rail).toBe('normal');
  expect(at(t, 156).processes.rail).toBe('degraded');
  expect(at(t, 168).processes.rail).toBe('stopped');
});

test('production is deferred only while rail is not normal', () => {
  const t = cutErp();
  expect(at(t, 155).tonnesDeferred).toBe(0);
  const perHour = 10e6 / 8760;
  const { stoppedHours: s, nonNormalHours: n } = t.totals;
  expect(t.totals.tonnesDeferred).toBeCloseTo(perHour * (s.rail! + (1 - 0.6) * (n.rail! - s.rail!)), 3);
  expect(t.totals.revenueAtRisk).toBeCloseTo(t.totals.tonnesDeferred * 100, 3);
});

test('stocks refill after the service returns', () => {
  const t = cutErp();
  expect(at(t, 300).processes.haulage).not.toBe('normal');
  expect(at(t, 301).processes.haulage).toBe('normal');
});

test('the whole chain gives these process hours', () => {
  const t = cutErp();
  expect(t.totals.stoppedHours).toEqual({ ordering: 288, haulage: 193, crushing: 193, rail: 122 });
  expect(t.totals.nonNormalHours).toEqual({ ordering: 288, haulage: 229, crushing: 229, rail: 140 });
});

test('a sample reports stock in days at the start of the hour', () => {
  const t = cutErp();
  expect(at(t, 0).stocks).toEqual({ diesel: 4, ore: 3 });
  expect(at(t, 96).stocks).toEqual({ diesel: 0, ore: 3 });
  expect(at(t, 168).stocks.ore).toBe(0);
  expect(at(t, 289).stocks.diesel).toBe(2 / 24);
  expect(at(t, 480).stocks).toEqual({ diesel: 4, ore: 3 });
});

test('tonnes and revenue are cumulative to the end of each hour, and totals match the last sample', () => {
  const t = cutErp();
  const perHour = tonnesPerHour(parseRegister(minimalRegister()).production);
  expect(perHour).toBe(10e6 / 8760);
  expect(at(t, 156).tonnesDeferred).toBeCloseTo(perHour * 0.4, 6);
  expect(at(t, 168).tonnesDeferred).toBeCloseTo(perHour * (12 * 0.4 + 1), 6);
  expect(at(t, 168).revenueAtRisk).toBeCloseTo(at(t, 168).tonnesDeferred * 100, 6);
  const last = at(t, 480);
  expect(t.totals.tonnesDeferred).toBe(last.tonnesDeferred);
  expect(t.totals.revenueAtRisk).toBe(last.revenueAtRisk);
});

test('stock-low and stock-empty fire once per crossing, at the hour that sees the new level', () => {
  const t = cutErp();
  const stockEvents = t.events.filter((e) => e.kind === 'stock-low' || e.kind === 'stock-empty');
  expect(stockEvents).toEqual([
    { hour: 72, kind: 'stock-low', subject: 'diesel' },
    { hour: 96, kind: 'stock-empty', subject: 'diesel' },
    { hour: 156, kind: 'stock-low', subject: 'ore' },
    { hour: 168, kind: 'stock-empty', subject: 'ore' },
  ]);
  expect(t.events).toContainEqual({ hour: 72, kind: 'process-state', subject: 'haulage', from: 'normal', to: 'degraded' });
});

test('a stock event re-arms once the level rises above its threshold', () => {
  const r = minimalRegister();
  r.scenarios[0]!.events.push({
    kind: 'cut-service',
    service: 'erp',
    at: { value: 340, unit: 'hours', provenance: { kind: 'assumed', reasoning: 'test' } },
    restoreAfter: { value: 100, unit: 'hours', provenance: { kind: 'assumed', reasoning: 'test' } },
  });
  const t = simulate(parseRegister(r), 'cut-erp', 'unprepared');
  // Diesel refills from 288 and is full (96 h) by 336, then drains again from 340: low at 412, empty at 436.
  const diesel = t.events.filter((e) => e.subject === 'diesel').map((e) => [e.hour, e.kind]);
  expect(diesel).toEqual([
    [72, 'stock-low'],
    [96, 'stock-empty'],
    [412, 'stock-low'],
    [436, 'stock-empty'],
  ]);
});

test('a stock that starts at its low threshold fires stock-low at hour 0', () => {
  const r = minimalRegister();
  r.stocks[1]!.initial.value = 0.5;
  const t = simulate(parseRegister(r), 'cut-erp', 'unprepared');
  expect(t.events).toContainEqual({ hour: 0, kind: 'stock-low', subject: 'ore' });
  expect(at(t, 0).processes.rail).toBe('degraded');
});

test('assumptionsUsed lists every input with its provenance', () => {
  const t = cutErp();
  expect(t.assumptionsUsed['production.price']).toMatchObject({ value: 100, unit: 'USD/t', overridden: false });
  expect(t.assumptionsUsed['stocks.diesel.initial']).toBeDefined();
  expect(t.assumptionsUsed['production.degradedOutput']).toBeDefined();
  expect(t.assumptionsUsed['production.annualTonnes']).toBeDefined();
  for (const field of ['capacity', 'initial', 'lowThreshold', 'refillRate']) {
    expect(t.assumptionsUsed[`stocks.ore.${field}`]).toBeDefined();
  }
});

test('simulateWith overrides stock and marks it overridden', () => {
  const r = parseRegister(minimalRegister());
  const t = simulateWith(r, 'cut-erp', 'unprepared', { 'stocks.diesel.capacity': 20, 'stocks.diesel.initial': 20 });
  expect(at(t, 200).processes.haulage).toBe('normal');
  expect(t.assumptionsUsed['stocks.diesel.initial']!.overridden).toBe(true);
  expect(t.assumptionsUsed['stocks.diesel.initial']!.provenance).toEqual(r.stocks[0]!.initial.provenance);
});

test('an override above capacity is rejected', () => {
  const r = parseRegister(minimalRegister());
  expect(() => simulateWith(r, 'cut-erp', 'unprepared', { 'stocks.diesel.initial': 20 })).toThrow(RegisterError);
  expect(() => simulateWith(r, 'cut-erp', 'unprepared', { 'stocks.diesel.initial': 20 })).toThrow(/diesel/);
});

test('an unknown override key throws', () => {
  const r = parseRegister(minimalRegister());
  expect(() => simulateWith(r, 'cut-erp', 'unprepared', { 'stocks.nope.initial': 1 })).toThrow(/nope/);
});

describe('delivery lead time', () => {
  function cutErpWithLead(hours?: number): Timeline {
    const r = minimalRegister();
    if (hours !== undefined) r.stocks[0]!.leadTime = q(hours, 'hours');
    return simulate(parseRegister(r), 'cut-erp', 'unprepared');
  }

  test('orders already in transit keep diesel full for the lead time, then it runs down', () => {
    const t = cutErpWithLead(48);
    for (let hour = 0; hour <= 48; hour++) expect(at(t, hour).stocks.diesel).toBe(4);
    expect(at(t, 49).stocks.diesel).toBe(95 / 24);
    expect(at(t, 144).stocks.diesel).toBe(0);
    expect(at(t, 143).processes.haulage).toBe('degraded');
    expect(at(t, 144).processes.haulage).toBe('stopped');
    const diesel = t.events.filter((e) => e.subject === 'diesel').map((e) => [e.hour, e.kind]);
    expect(diesel).toEqual([
      [120, 'stock-low'],
      [144, 'stock-empty'],
    ]);
  });

  test('after the ERP returns at 288, the first delivery arrives at 336 and haulage is normal at 349', () => {
    const t = cutErpWithLead(48);
    expect(at(t, 336).stocks.diesel).toBe(0);
    expect(at(t, 336).processes.haulage).toBe('stopped');
    expect(at(t, 337).stocks.diesel).toBe(2 / 24);
    expect(at(t, 337).processes.haulage).toBe('degraded');
    expect(at(t, 348).processes.haulage).toBe('degraded');
    expect(at(t, 349).processes.haulage).toBe('normal');
  });

  test('a fractional lead time rounds up to whole hours', () => {
    const whole = cutErpWithLead(48);
    const fractional = cutErpWithLead(47.5);
    expect(fractional.samples).toEqual(whole.samples);
  });

  test('a lead time of 0 or none gives exactly the hours without one', () => {
    const none = cutErpWithLead();
    const zero = cutErpWithLead(0);
    for (const t of [none, zero]) {
      expect(at(t, 71).processes.haulage).toBe('normal');
      expect(at(t, 72).processes.haulage).toBe('degraded');
      expect(at(t, 96).processes.haulage).toBe('stopped');
      expect(at(t, 155).processes.rail).toBe('normal');
      expect(at(t, 156).processes.rail).toBe('degraded');
      expect(at(t, 168).processes.rail).toBe('stopped');
      expect(at(t, 300).processes.haulage).not.toBe('normal');
      expect(at(t, 301).processes.haulage).toBe('normal');
    }
    expect(zero.samples).toEqual(none.samples);
    expect(zero.events).toEqual(none.events);
    expect(zero.totals).toEqual(none.totals);
  });

  test('assumptionsUsed records the lead time when it is set, and only then', () => {
    expect(cutErpWithLead(48).assumptionsUsed['stocks.diesel.leadTime']).toMatchObject({
      value: 48,
      unit: 'hours',
      provenance: { kind: 'assumed', reasoning: 'test' },
      overridden: false,
    });
    expect(cutErpWithLead().assumptionsUsed['stocks.diesel.leadTime']).toBeUndefined();
  });

  test('a lead time can be overridden by its path', () => {
    const r = minimalRegister();
    r.stocks[0]!.leadTime = q(0, 'hours');
    const t = simulateWith(parseRegister(r), 'cut-erp', 'unprepared', { 'stocks.diesel.leadTime': 48 });
    expect(at(t, 143).processes.haulage).toBe('degraded');
    expect(at(t, 144).processes.haulage).toBe('stopped');
    expect(t.assumptionsUsed['stocks.diesel.leadTime']!.overridden).toBe(true);
  });

  test('a measured lead time is rejected (spec §5.3)', () => {
    const r: any = minimalRegister();
    r.stocks[0].leadTime = {
      value: 48,
      unit: 'hours',
      provenance: { kind: 'measured', runId: 'lab-1', date: '2026-10-26', evidence: 'lab' },
    };
    expect(() => parseRegister(r)).toThrow(/§5\.3/);
  });

  test('a negative lead time is rejected', () => {
    const r = minimalRegister();
    r.stocks[0]!.leadTime = q(-1, 'hours');
    expect(() => parseRegister(r)).toThrow(RegisterError);
  });
});
