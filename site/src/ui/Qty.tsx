import { formatQty } from '../model/format.js';
import type { QtyKind } from '../model/format.js';
import type { QtyTag } from '../model/tags.js';
import { ChangedByYouTag, ProvenanceTag } from './ProvenanceTag.js';

export type QtyProps = QtyTag & {
  value: number;
  kind: QtyKind;
  /** Source id to title, for the sourced tooltip. */
  sources?: Record<string, string>;
  /** Shown as odometer cells (DESIGN.md "Docked Detail Panel"); whole tonnes only. */
  odometer?: boolean;
};

/** An odometer shows at least this many cells; a longer number gets one cell per digit. */
const ODOMETER_CELLS = 8;

/**
 * Whole tonnes as odometer cells, grouped in threes from the right: the number's own digits lit, the
 * padding before them unlit. A picture of the number, so it is hidden from assistive technology; the
 * `<Qty>` around it says the number once, as text.
 */
function OdometerCells({ value }: { value: number }) {
  const digits = String(Math.max(0, Math.round(value)));
  const cells = digits.padStart(Math.max(ODOMETER_CELLS, digits.length), '0').split('');
  const firstLit = cells.length - digits.length;
  return (
    <span className="odometer-cells" aria-hidden="true">
      {cells.map((d, i) => {
        const fromRight = cells.length - i;
        return (
          <span key={i} className={`odometer-cell${i >= firstLit ? ' is-lit' : ''}${fromRight % 3 === 0 && i > 0 ? ' starts-group' : ''}`}>
            {d}
          </span>
        );
      })}
      <span className="odometer-unit">t</span>
    </span>
  );
}

/**
 * Every number on screen goes through here, so it always arrives with its tag, derived from what it
 * is: computed, an input with its provenance, or an input the visitor changed. A changed input shows
 * only "changed by you", whose tooltip gives the register's value.
 */
export function Qty(props: QtyProps) {
  const { value, kind, sources, odometer } = props;
  const text = formatQty(value, kind);
  return (
    <span className={odometer ? 'qty qty--odometer' : 'qty'} data-quantity>
      {odometer ? (
        <>
          <span className="visually-hidden">{text}</span>
          <OdometerCells value={value} />
        </>
      ) : (
        text
      )}
      {'computed' in props ? (
        <ProvenanceTag computed />
      ) : props.overridden ? (
        <ChangedByYouTag original={formatQty(props.original, kind)} provenance={props.provenance} sources={sources} />
      ) : (
        <ProvenanceTag provenance={props.provenance} sources={sources} />
      )}
    </span>
  );
}
