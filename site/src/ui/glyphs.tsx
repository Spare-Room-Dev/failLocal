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

/**
 * Each service card's line icon, one per group, on a 32-unit grid drawn at 30 px: ink strokes 1.5 wide
 * with round joins over a paper fill, as the scene's glyphs. A cut service's icon is slashed in Stop Red.
 */
const SERVICE_ICONS: Record<string, ReactNode> = {
  // Hosted ERP: a stack of ledger pages.
  'hosted-erp': (
    <>
      <rect x={8} y={5} width={15} height={20} rx={1.5} />
      <rect x={11.5} y={8.5} width={15} height={20} rx={1.5} />
      <path d="M15 14h8M15 18h8M15 22h5" fill="none" />
    </>
  ),
  // Cloud logins: a cloud with a keyhole.
  'cloud-identity': (
    <>
      <path d="M9 22h15a5 5 0 0 0 .6-10 7 7 0 0 0-13.5-1.6A5.8 5.8 0 0 0 9 22z" />
      <circle cx={16.5} cy={16.2} r={2} fill="none" />
      <path d="M16.5 18.2v2.3" fill="none" />
    </>
  ),
  // Perth operations link: a control-room screen with a trend, and a signal arc.
  'iroc-link': (
    <>
      <rect x={5} y={9} width={22} height={14} rx={1.5} />
      <path d="M12 27h8M16 23v4M9 18l3-3 3 2 4-5 4 3" fill="none" />
      <path d="M21 5.5a6 6 0 0 1 4.5 2" fill="none" />
    </>
  ),
  // Corporate network: one server feeding three machines.
  'corporate-network': (
    <>
      <rect x={12} y={4} width={8} height={6} rx={1} />
      <path d="M16 10v5M7 15h18M7 15v5M16 15v5M25 15v5" fill="none" />
      <rect x={3.5} y={20} width={7} height={6} rx={1} />
      <rect x={12.5} y={20} width={7} height={6} rx={1} />
      <rect x={21.5} y={20} width={7} height={6} rx={1} />
    </>
  ),
  // Vendor remote access: a spanner.
  'vendor-access': <path d="M19.5 6.5a5 5 0 0 0-5.6 6.6l-7.4 7.4a2.1 2.1 0 0 0 3 3l7.4-7.4a5 5 0 0 0 6.6-5.6l-3.1 3.1-2.9-.6-.6-2.9z" />,
};

/** The service card's icon for `group`. Throws for a group with no icon, so a new group cannot ship without one. */
export function ServiceIcon({ group, cut }: { group: string; cut: boolean }) {
  const icon = SERVICE_ICONS[group];
  if (!icon) throw new Error(`no service icon for ${group}`);
  return (
    <svg className="service-icon" viewBox="0 0 32 32" aria-hidden="true" data-icon={group}>
      <g fill="var(--paper)" stroke="var(--ink)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        {icon}
      </g>
      {cut && <path d="M4 28 L28 4" stroke="var(--stop-red)" strokeWidth={2} strokeLinecap="round" />}
    </svg>
  );
}
