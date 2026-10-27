import { describe, expect, it } from 'vitest';
import { formatQty } from '../src/model/format.js';
import type { QtyKind } from '../src/model/format.js';

describe('formatQty', () => {
  const rows: [number, QtyKind, string][] = [
    [1.4, 'days', '1.4 days'],
    [1, 'days', '1 day'],
    [0.4, 'days', '0.40 days'],
    [0.125, 'days', '0.13 days'],
    [24, 'hours', '24 hours'],
    [1, 'hours', '1 hour'],
    [0.5, 'hours', '0.5 hours'],
    [1.5, 'hours', '1.5 hours'],
    [12400, 'tonnes', '12,400 t'],
    [950000, 'usd', 'US$950,000'],
    [6_000_000, 'usd', 'US$6.0 M'],
    [25, 'mtpa', '25 Mt/a'],
    [97.7, 'usdPerT', 'US$97.7/t'],
    [0.6, 'fraction', '60%'],
  ];

  it.each(rows)('formats %s as %s', (value, kind, expected) => {
    expect(formatQty(value, kind)).toBe(expected);
  });

  it('switches to millions when rounding reaches one million', () => {
    expect(formatQty(999_999.6, 'usd')).toBe('US$1.0 M');
  });
});
