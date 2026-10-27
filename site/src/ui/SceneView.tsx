import type { KeyboardEvent } from 'react';
import type { Cable, Flag, SceneState } from '../model/sceneState.js';
import { groupState, SERVICE_GROUPS } from '../model/serviceGroups.js';
import './scene.css';

export interface SceneViewProps {
  scene: SceneState;
  selected: string | null;
  onSelect(processId: string): void;
  reducedMotion: boolean;
}

/** The board is 1,600 × 1,000 m (D-100); the schematic keeps its proportions. */
const WIDTH = 1600;
const HEIGHT = 1000;
const BOARD_TOP = 180;
const PLINTH_TOP = 920;
const AREA = { width: 300, height: 300, columnStep: 316, left: 20, rows: [220, 560] };
const PLINTH_TEXT = 'FICTIONAL MODEL SITE · PILBARA IRON ORE · SYNTHETIC DATA';

/** Business processes on the top row, the ore chain from blast to rail on the bottom row. */
const GRID: string[][] = [
  ['diesel-ordering', 'explosives-ordering', 'work-orders', 'payroll', 'remote-operations'],
  ['control-room', 'drill-and-blast', 'haulage', 'crushing', 'rail'],
];

const STATE_WORD = { normal: 'Normal', degraded: 'Degraded', stopped: 'Stopped' } as const;

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

function CableLine({ name, x, state }: { name: string; x: number; state: Cable }) {
  const post = <rect x={x - 8} y={BOARD_TOP - 24} width={16} height={24} fill={state === 'live' ? 'var(--galvanised)' : 'var(--ink-3)'} stroke="var(--ink)" />;
  if (state === 'live')
    return (
      <g data-cable-group>
        <title>{`${name}: up`}</title>
        <line x1={x} y1={0} x2={x} y2={BOARD_TOP - 24} stroke="var(--ink)" strokeWidth={3} />
        {post}
      </g>
    );
  const breakY = 70;
  return (
    <g data-cable-group>
      <title>{`${name}: ${state === 'severed' ? 'link cut' : 'access revoked'}`}</title>
      <line x1={x} y1={0} x2={x} y2={breakY - 16} stroke="var(--ink)" strokeWidth={3} />
      <g data-break>
        <line x1={x - 10} y1={breakY - 16} x2={x + 10} y2={breakY - 16} stroke="var(--ink)" strokeWidth={3} />
        <circle cx={x} cy={breakY} r={6} fill="none" stroke="var(--stop-red)" strokeWidth={3} />
        <line x1={x - 10} y1={breakY + 16} x2={x + 10} y2={breakY + 16} stroke="var(--ink)" strokeWidth={3} />
        <text x={x + 18} y={breakY + 6} className="scene-cable-label">
          {state === 'severed' ? 'Link cut' : 'Access revoked'}
        </text>
      </g>
      <line x1={x} y1={breakY + 16} x2={x} y2={BOARD_TOP - 24} stroke="var(--ink)" strokeWidth={3} strokeDasharray="10 6" opacity={0.55} />
      {post}
    </g>
  );
}

/** The 2a stand-in for the scene: a plain schematic SVG. Plan 2b replaces it with the PixiJS board. */
export function SceneView({ scene, selected, onSelect }: SceneViewProps) {
  const onKeyDown = (id: string) => (e: KeyboardEvent<SVGGElement>) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    onSelect(id);
  };
  return (
    <svg className="scene" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="group" aria-label="Model site schematic">
      <defs>
        <pattern id="scene-hatch" patternUnits="userSpaceOnUse" width={7} height={7} patternTransform="rotate(26.565)">
          <rect width={7} height={7} fill="var(--hatch-ink)" opacity={0.08} />
          <line x1={0} y1={3.5} x2={7} y2={3.5} stroke="var(--hatch-ink)" strokeWidth={1.5} opacity={0.62} />
        </pattern>
      </defs>

      {SERVICE_GROUPS.map((g, i) => {
        const state = groupState(scene, g);
        return (
          <g key={g.id} data-cable={g.id} data-state={state}>
            <CableLine name={g.name} x={(WIDTH / (SERVICE_GROUPS.length + 1)) * (i + 1)} state={state} />
          </g>
        );
      })}
      <rect x={0} y={BOARD_TOP} width={WIDTH} height={PLINTH_TOP - BOARD_TOP} fill="var(--paper-2)" stroke="var(--line-2)" />

      {GRID.flatMap((row, r) =>
        row.map((id, c) => {
          const area = scene.processes[id];
          if (!area) return null;
          const x = AREA.left + c * AREA.columnStep;
          const y = AREA.rows[r]!;
          const word = STATE_WORD[area.state];
          const isSelected = selected === id;
          return (
            <g
              key={id}
              className="scene-area"
              role="button"
              tabIndex={0}
              aria-pressed={isSelected}
              aria-label={`${area.label}: ${word}${area.note ? `. ${area.note}` : ''}`}
              onClick={() => onSelect(id)}
              onKeyDown={onKeyDown(id)}
            >
              <rect x={x} y={y} width={AREA.width} height={AREA.height} rx={6} fill="var(--paper)" />
              {area.hatched && (
                <rect data-hatched x={x} y={y} width={AREA.width} height={AREA.height} rx={6} fill="url(#scene-hatch)" stroke="var(--hatch-ink)" strokeDasharray="5 3" />
              )}
              <rect
                className="scene-area-outline"
                x={x}
                y={y}
                width={AREA.width}
                height={AREA.height}
                rx={6}
                fill="none"
                stroke="var(--ink)"
                strokeWidth={isSelected ? 4 : 1}
              />
              <FlagGlyph flag={area.flag} x={x + 20} y={y + 20} />
              <rect x={x + 10} y={y + 82} width={AREA.width - 20} height={108} rx={3} fill="var(--paper)" stroke="var(--ink)" strokeWidth={0.8} />
              <text x={x + 20} y={y + 110} className="scene-area-name">
                {area.label}
              </text>
              <text x={x + 20} y={y + 145} className={`scene-area-state${area.state === 'stopped' ? ' is-stopped' : ''}`}>
                {word}
              </text>
              <text x={x + 20} y={y + 175} className="scene-area-note">
                {area.note}
              </text>
            </g>
          );
        }),
      )}

      <rect x={0} y={PLINTH_TOP} width={WIDTH} height={HEIGHT - PLINTH_TOP} fill="var(--plinth)" />
      <text x={WIDTH / 2} y={PLINTH_TOP + 50} textAnchor="middle" className="scene-plinth">
        {PLINTH_TEXT}
      </text>
    </svg>
  );
}
