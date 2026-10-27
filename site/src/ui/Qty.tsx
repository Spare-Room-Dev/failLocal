import { formatQty } from '../model/format.js';
import type { QtyKind } from '../model/format.js';
import type { QtyTag } from '../model/tags.js';
import { ChangedByYouTag, ProvenanceTag } from './ProvenanceTag.js';

export type QtyProps = QtyTag & {
  value: number;
  kind: QtyKind;
  /** Source id to title, for the sourced tooltip. */
  sources?: Record<string, string>;
};

/**
 * Every number on screen goes through here, so it always arrives with its tag, derived from what it
 * is: computed, an input with its provenance, or an input the visitor changed. A changed input shows
 * only "changed by you", whose tooltip gives the register's value.
 */
export function Qty(props: QtyProps) {
  const { value, kind, sources } = props;
  return (
    <span className="qty" data-quantity>
      {formatQty(value, kind)}
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
