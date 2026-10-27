export type QtyKind = 'days' | 'hours' | 'tonnes' | 'usd' | 'mtpa' | 'usdPerT' | 'fraction';

const grouped = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const oneDecimal = (value: number): string => value.toFixed(1);

/** The on-screen text for a quantity. Plan 2a's format table is the contract; units follow the number. */
export function formatQty(value: number, kind: QtyKind): string {
  switch (kind) {
    case 'days':
      return value === 1 ? '1 day' : `${oneDecimal(value)} days`;
    case 'hours': {
      const whole = Math.round(value);
      return whole === 1 ? '1 hour' : `${whole} hours`;
    }
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
