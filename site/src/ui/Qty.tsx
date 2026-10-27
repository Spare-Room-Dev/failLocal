import type { DisplayKind, Provenance } from '@faillocal/engine';
import { formatQty } from '../model/format.js';
import type { QtyKind } from '../model/format.js';
import { ChangedByYouTag, ProvenanceTag } from './ProvenanceTag.js';

export interface QtyProps {
  value: number;
  kind: QtyKind;
  display: DisplayKind;
  overridden?: boolean;
  provenance?: Provenance;
  /** Source id to title, for the sourced tooltip. */
  sources?: Record<string, string>;
}

/** Every number on screen goes through here, so it always arrives with its provenance tag. */
export function Qty({ value, kind, display, overridden = false, provenance, sources }: QtyProps) {
  return (
    <span className="qty" data-quantity>
      {formatQty(value, kind)}
      <ProvenanceTag display={display} provenance={provenance} sources={sources} />
      {overridden && <ChangedByYouTag />}
    </span>
  );
}
