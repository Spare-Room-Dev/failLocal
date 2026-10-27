export type QtyKind = 'days' | 'hours' | 'tonnes' | 'usd' | 'mtpa' | 'usdPerT' | 'fraction';

const grouped = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const oneDecimal = (value: number): string => value.toFixed(1);

/** The on-screen text for a quantity. Plan 2a's format table is the contract; units follow the number. */
export function formatQty(value: number, kind: QtyKind): string {
  switch (kind) {
    case 'days':
      if (value === 1) return '1 day';
      // Below a day, one decimal hides too much (a 0.125-day threshold would read 0.1); two, with
      // trailing zeros trimmed, reads 0.13, 0.5 and 0.
      return `${value < 1 ? Number(value.toFixed(2)) : oneDecimal(value)} days`;
    case 'hours':
      if (value === 1) return '1 hour';
      return `${Number.isInteger(value) ? value : oneDecimal(value)} hours`;
    case 'tonnes':
      return `${grouped.format(value)} t`;
    case 'usd':
      return Math.round(value) < 1_000_000
        ? `US$${grouped.format(value)}`
        : `US$${oneDecimal(value / 1_000_000)} M`;
    case 'mtpa':
      return `${value} Mt/a`;
    case 'usdPerT':
      return `US$${oneDecimal(value)}/t`;
    case 'fraction':
      return `${Math.round(value * 100)}%`;
  }
}
