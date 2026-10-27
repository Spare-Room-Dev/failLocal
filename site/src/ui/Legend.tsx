import type { ReactNode } from 'react';
import { FlagGlyph } from './SceneView.js';
import './chrome.css';

function Glyph({ children }: { children: ReactNode }) {
  return (
    <svg className="legend-glyph" viewBox="0 0 40 52" aria-hidden="true">
      {children}
    </svg>
  );
}

/** Each entry is the glyph the scene draws, its state word, and the shape that tells it apart. */
const ENTRIES: { word: string; shape: string; glyph: ReactNode }[] = [
  {
    word: 'Normal',
    shape: 'open pennant',
    glyph: <FlagGlyph flag="pennant" x={8} y={2} />,
  },
  {
    word: 'Degraded',
    shape: 'half flag',
    glyph: <FlagGlyph flag="half" x={8} y={2} />,
  },
  {
    word: 'Stopped',
    shape: 'full flag, hatched ground',
    glyph: (
      <>
        <defs>
          {/* Coarser than the scene's hatch, with no wash or outline, so it reads as ground at glyph size. */}
          <pattern id="legend-hatch" patternUnits="userSpaceOnUse" width={8} height={8} patternTransform="rotate(26.565)">
            <line x1={0} y1={4} x2={8} y2={4} stroke="var(--hatch-ink)" strokeWidth={2.5} opacity={0.8} />
          </pattern>
        </defs>
        <rect data-hatched x={0} y={36} width={40} height={16} fill="url(#legend-hatch)" />
        <FlagGlyph flag="full" x={8} y={2} />
      </>
    ),
  },
  {
    word: 'Parked',
    shape: 'parked marker',
    glyph: (
      <g data-parked>
        <line x1={20} y1={26} x2={20} y2={44} stroke="var(--ink)" strokeWidth={1.5} />
        <rect x={9} y={4} width={22} height={22} fill="var(--paper)" stroke="var(--ink)" strokeWidth={1.5} />
        <path d="M16 10 V20 M24 10 V20" stroke="var(--ink)" strokeWidth={3} />
      </g>
    ),
  },
  {
    word: 'Cut',
    shape: 'severed cable',
    glyph: (
      <g data-break>
        <line x1={20} y1={0} x2={20} y2={14} stroke="var(--ink)" strokeWidth={2} />
        <line x1={12} y1={14} x2={28} y2={14} stroke="var(--ink)" strokeWidth={2} />
        <circle cx={20} cy={26} r={4} fill="none" stroke="var(--stop-red)" strokeWidth={2} />
        <line x1={12} y1={38} x2={28} y2={38} stroke="var(--ink)" strokeWidth={2} />
        <line x1={20} y1={38} x2={20} y2={52} stroke="var(--ink)" strokeWidth={2} strokeDasharray="4 3" opacity={0.55} />
      </g>
    ),
  },
];

/** The stage legend (DESIGN.md "Legend"): it names shapes, not colours. */
export function Legend() {
  return (
    <ul className="legend" aria-label="Legend">
      {ENTRIES.map((e) => (
        <li key={e.word} className="legend-entry">
          <Glyph>{e.glyph}</Glyph>
          <span className="legend-word">{e.word}</span>
          <span className="legend-shape">{e.shape}</span>
        </li>
      ))}
    </ul>
  );
}
