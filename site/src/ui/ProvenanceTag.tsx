import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
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

/**
 * A tag that is a button with a popover: hover or focus shows it, a click or tap pins it open and a
 * second one closes it, and Escape dismisses it wherever focus is (WCAG 1.4.13). The popover sits
 * inside the hover area, so the pointer can move onto it and read it.
 */
function TipTag({ className, label, text, tip }: TipTagProps) {
  const tipId = useId();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const open = !dismissed && (hovered || focused || pinned);
  const tipRef = useRef<HTMLSpanElement>(null);
  // Nudged sideways so an open popover stays inside the window (a tag near the right edge of the detail column).
  const [nudge, setNudge] = useState(0);
  useLayoutEffect(() => {
    const el = tipRef.current;
    if (!open || !el) return;
    const box = el.getBoundingClientRect();
    const left = box.left - nudge;
    const room = document.documentElement.clientWidth - 8;
    setNudge(Math.min(0, room - (left + box.width)) + Math.max(0, 8 - left));
  }, [open]);

  const dismiss = () => {
    setDismissed(true);
    setPinned(false);
  };
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <span
      className="qty-tag-anchor"
      data-provenance
      onMouseEnter={() => {
        setHovered(true);
        setDismissed(false);
      }}
      onMouseLeave={() => {
        setHovered(false);
        setPinned(false);
      }}
    >
      <button
        type="button"
        className={className}
        aria-label={label}
        aria-describedby={tipId}
        aria-expanded={open}
        onFocus={() => {
          setFocused(true);
          setDismissed(false);
        }}
        onBlur={() => {
          setFocused(false);
          setPinned(false);
        }}
        onClick={() => {
          if (pinned) dismiss();
          else {
            setPinned(true);
            setDismissed(false);
          }
        }}
      >
        {text}
      </button>
      <span ref={tipRef} role="tooltip" id={tipId} className="qty-tip" hidden={!open} style={nudge ? { marginLeft: nudge } : undefined}>
        {tip}
      </span>
    </span>
  );
}

/**
 * The kind word after a number, taken from its provenance. A sourced tag reveals its source title,
 * and an assumed tag its reasoning, in a popover (see `TipTag`).
 */
export function ProvenanceTag(props: ProvenanceTagProps) {
  const display = 'computed' in props ? 'computed' : props.provenance.kind;
  const label = `${display} value`;
  const className = `qty-tag qty-tag--${display}`;
  if ('provenance' in props && props.provenance.kind === 'sourced')
    return <TipTag className={className} label={label} text={display} tip={sourceTitle(props.provenance, props.sources)} />;
  if ('provenance' in props && props.provenance.kind === 'assumed')
    return <TipTag className={className} label={label} text={display} tip={props.provenance.reasoning} />;
  return (
    <span className={className} aria-label={label}>
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
