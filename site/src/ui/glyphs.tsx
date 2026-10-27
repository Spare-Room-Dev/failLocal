import type { ReactNode } from 'react';
import type { Flag } from '../model/sceneState.js';

/** A state flag on its pole, 30 × 48 from (x, y): an open pennant, a half flag or a full flag. */
export function FlagGlyph({ flag, x, y }: { flag: Flag; x: number; y: number }) {
  return (
    <g data-flag={flag} transform={`translate(${x} ${y})`} aria-hidden="true">
      <line x1={0} y1={0} x2={0} y2={48} stroke="var(--ink)" strokeWidth={2} />
      {flag === 'pennant' && <path d="M0 0 L30 9 L0 18 Z" fill="var(--paper)" stroke="var(--ink)" strokeWidth={1.5} />}
      {flag === 'half' && (
        <>
          <rect x={0} y={0} width={30} height={20} fill="var(--paper)" stroke="var(--ink)" strokeWidth={1.5} />
          <path d="M0 0 L0 20 L30 20 Z" fill="var(--degraded-amber)" stroke="var(--ink)" strokeWidth={1.5} />
        </>
      )}
      {flag === 'full' && (
        <>
          <rect x={0} y={0} width={30} height={20} fill="var(--stop-red)" stroke="var(--ink)" strokeWidth={1.5} />
          <path d="M6 4 L24 16 M24 4 L6 16" stroke="var(--paper)" strokeWidth={2} />
        </>
      )}
    </g>
  );
}

export interface HatchPatternProps {
  id: string;
  /** The pattern tile's side; the stroke runs across its middle. */
  size: number;
  strokeWidth: number;
  opacity: number;
  /** Opacity of a flat wash under the stroke; none when omitted. */
  wash?: number;
}

/** The stopped-ground hatch, a `<pattern>` for a `<defs>`: diagonal strokes at the scene's 26.565° slope. */
export function HatchPattern({ id, size, strokeWidth, opacity, wash }: HatchPatternProps) {
  return (
    <pattern id={id} patternUnits="userSpaceOnUse" width={size} height={size} patternTransform="rotate(26.565)">
      {wash !== undefined && <rect width={size} height={size} fill="var(--hatch-ink)" opacity={wash} />}
      <line x1={0} y1={size / 2} x2={size} y2={size / 2} stroke="var(--hatch-ink)" strokeWidth={strokeWidth} opacity={opacity} />
    </pattern>
  );
}

export interface BreakGlyphProps {
  /** Centre of the break ring. */
  x: number;
  y: number;
  /** Half the width of each cut end's bar. */
  halfWidth: number;
  /** Distance from the ring's centre to each bar. */
  gap: number;
  r: number;
  strokeWidth: number;
  /** Drawn inside the break's group, after the marks. */
  children?: ReactNode;
}

/** A severed cable: two cut-end bars either side of a red ring. */
export function BreakGlyph({ x, y, halfWidth, gap, r, strokeWidth, children }: BreakGlyphProps) {
  return (
    <g data-break>
      <line x1={x - halfWidth} y1={y - gap} x2={x + halfWidth} y2={y - gap} stroke="var(--ink)" strokeWidth={strokeWidth} />
      <circle cx={x} cy={y} r={r} fill="none" stroke="var(--stop-red)" strokeWidth={strokeWidth} />
      <line x1={x - halfWidth} y1={y + gap} x2={x + halfWidth} y2={y + gap} stroke="var(--ink)" strokeWidth={strokeWidth} />
      {children}
    </g>
  );
}
