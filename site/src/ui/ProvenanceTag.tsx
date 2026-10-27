import { useId, useState } from 'react';
import type { Provenance } from '@faillocal/engine';
import './qty.css';

/** What a tag stands for: a number the engine computed, or an input with its provenance. */
export type TagSource = { computed: true } | { provenance: Provenance };

export type ProvenanceTagProps = TagSource & { sources?: Record<string, string> };

/** Source id to title; a source with no title shows its id. */
export function sourceTitle(provenance: Extract<Provenance, { kind: 'sourced' }>, sources?: Record<string, string>): string {
  return sources?.[provenance.source] ?? provenance.source;
}

interface TipTagProps {
  className: string;
  label?: string;
  text: string;
  tip: string;
}

/** A focusable tag whose tooltip shows on hover or focus. */
function TipTag({ className, label, text, tip }: TipTagProps) {
  const tipId = useId();
  const [open, setOpen] = useState(false);
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
        {text}
      </span>
      <span role="tooltip" id={tipId} className="qty-tip" hidden={!open}>
        {tip}
      </span>
    </span>
  );
}

/** The kind word after a number, taken from its provenance. Sourced tags reveal the source title on hover or focus. */
export function ProvenanceTag(props: ProvenanceTagProps) {
  const display = 'computed' in props ? 'computed' : props.provenance.kind;
  const label = `${display} value`;
  const className = `qty-tag qty-tag--${display}`;
  if ('provenance' in props && props.provenance.kind === 'sourced')
    return <TipTag className={className} label={label} text={display} tip={sourceTitle(props.provenance, props.sources)} />;
  const reasoning = 'provenance' in props && props.provenance.kind === 'assumed' ? props.provenance.reasoning : undefined;
  return (
    <span className={className} aria-label={label} title={reasoning}>
      {display}
    </span>
  );
}

export interface ChangedByYouTagProps {
  /** The register's value, already formatted. */
  original: string;
  provenance: Provenance;
  sources?: Record<string, string>;
}

/** Marks a value the visitor changed; its tooltip gives the register's value, kind and source. */
export function ChangedByYouTag({ original, provenance, sources }: ChangedByYouTagProps) {
  const source = provenance.kind === 'sourced' ? `, ${sourceTitle(provenance, sources)}` : '';
  return <TipTag className="qty-tag qty-tag--changed" text="changed by you" tip={`Register value: ${original} (${provenance.kind}${source})`} />;
}
