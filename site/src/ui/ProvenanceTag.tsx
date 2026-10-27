import { useId, useState } from 'react';
import type { DisplayKind, Provenance } from '@faillocal/engine';
import './qty.css';

export interface ProvenanceTagProps {
  display: DisplayKind;
  provenance?: Provenance;
  sources?: Record<string, string>;
}

/** The kind word after a number. Sourced tags reveal the source title on hover or focus. */
export function ProvenanceTag({ display, provenance, sources }: ProvenanceTagProps) {
  const tipId = useId();
  const [open, setOpen] = useState(false);
  const label = `${display} value`;
  const className = `qty-tag qty-tag--${display}`;

  if (display === 'sourced' && provenance?.kind === 'sourced') {
    const title = sources?.[provenance.source] ?? provenance.source;
    return (
      <span className="qty-tag-anchor">
        <span
          className={className}
          aria-label={label}
          aria-describedby={tipId}
          tabIndex={0}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
        >
          {display}
        </span>
        <span role="tooltip" id={tipId} className="qty-tip" hidden={!open}>
          {title}
        </span>
      </span>
    );
  }

  const reasoning = display === 'assumed' && provenance?.kind === 'assumed' ? provenance.reasoning : undefined;
  return (
    <span className={className} aria-label={label} title={reasoning}>
      {display}
    </span>
  );
}

export function ChangedByYouTag() {
  return <span className="qty-tag qty-tag--changed">changed by you</span>;
}
