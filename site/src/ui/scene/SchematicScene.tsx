import { useEffect } from 'react';
import type { KeyboardEvent } from 'react';
import type { Cable } from '../../model/sceneState.js';
import { cableFraction, SERVICE_GROUPS } from '../../model/serviceGroups.js';
import { BreakGlyph, FlagGlyph, HatchPattern } from '../glyphs.js';
import type { SceneViewProps } from '../SceneView.js';
import '../scene.css';

/** The board is 1,600 × 1,000 m (D-100); the schematic keeps its proportions. */
const WIDTH = 1600;
const HEIGHT = 1000;
const BOARD_TOP = 180;
const PLINTH_TOP = 920;
const AREA = { width: 300, height: 300, columnStep: 316, left: 20, rows: [220, 560] };

/** Each cable's entry post sits at its even share of the board's width, so the anchors never change. */
const ANCHORS: Record<string, number> = Object.fromEntries(SERVICE_GROUPS.map((g, i) => [g.id, cableFraction(i)]));

/** Business processes on the top row, the ore chain from blast to rail on the bottom row. */
const GRID: string[][] = [
  ['diesel-ordering', 'explosives-ordering', 'work-orders', 'payroll', 'remote-operations'],
  ['control-room', 'drill-and-blast', 'haulage', 'crushing', 'rail'],
];

const STATE_WORD = { normal: 'Normal', degraded: 'Degraded', stopped: 'Stopped' } as const;

function CableLine({ id, name, x, state }: { id: string; name: string; x: number; state: Cable }) {
  const post = <rect x={x - 8} y={BOARD_TOP - 24} width={16} height={24} fill={state === 'live' ? 'var(--galvanised)' : 'var(--ink-3)'} stroke="var(--ink)" />;
  if (state === 'live')
    return (
      <g data-cable-group={id} data-cable-state={state}>
        <title>{`${name}: up`}</title>
        <line x1={x} y1={0} x2={x} y2={BOARD_TOP - 24} stroke="var(--ink)" strokeWidth={3} />
        {post}
      </g>
    );
  const breakY = 70;
  // The label sits beside the marker, not in it, so the marker stays centred on its cable.
  return (
    <>
      <g data-cable-group={id} data-cable-state={state}>
        <title>{`${name}: ${state === 'severed' ? 'link cut' : 'access revoked'}`}</title>
        <line x1={x} y1={0} x2={x} y2={breakY - 16} stroke="var(--ink)" strokeWidth={3} />
        <BreakGlyph x={x} y={breakY} halfWidth={10} gap={16} r={6} strokeWidth={3} />
        <line x1={x} y1={breakY + 16} x2={x} y2={BOARD_TOP - 24} stroke="var(--ink)" strokeWidth={3} strokeDasharray="10 6" opacity={0.55} />
        {post}
      </g>
      <text x={x + 18} y={breakY + 6} className="scene-cable-label">
        {state === 'severed' ? 'Link cut' : 'Access revoked'}
      </text>
    </>
  );
}

/**
 * The scene as a plain schematic SVG: the first implementation of the scene contract, and the
 * fallback where the diorama cannot run. It draws no motion, so `reducedMotion` only marks the SVG.
 */
export function SchematicScene({ scene, selected, onSelect, reducedMotion, decorative = false, onAnchors }: SceneViewProps) {
  useEffect(() => onAnchors?.(ANCHORS), [onAnchors]);
  const onKeyDown = (id: string) => (e: KeyboardEvent<SVGGElement>) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    onSelect(id);
  };
  return (
    <svg
      className="scene"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="xMidYMin meet"
      {...(decorative ? { 'aria-hidden': true } : { role: 'group', 'aria-label': 'Model site schematic' })}
      data-reduced-motion={reducedMotion}
    >
      <defs>
        <HatchPattern id="scene-hatch" size={7} wash={0.08} strokeWidth={1.5} opacity={0.62} />
      </defs>

      {SERVICE_GROUPS.map((g) => (
        <CableLine key={g.id} id={g.id} name={g.name} x={WIDTH * ANCHORS[g.id]!} state={scene.cables[g.id]!} />
      ))}
      <rect x={0} y={BOARD_TOP} width={WIDTH} height={PLINTH_TOP - BOARD_TOP} fill="var(--paper-2)" stroke="var(--line-2)" />

      {GRID.flatMap((row, r) =>
        row.map((id, c) => {
          const area = scene.processes[id];
          if (!area) return null;
          const x = AREA.left + c * AREA.columnStep;
          const y = AREA.rows[r]!;
          const word = STATE_WORD[area.state];
          const isSelected = selected === id;
          const button = {
            role: 'button',
            tabIndex: 0,
            'aria-pressed': isSelected,
            'aria-label': `${area.label}: ${word}${area.note ? `. ${area.note}` : ''}`,
            onClick: () => onSelect(id),
            onKeyDown: onKeyDown(id),
          };
          return (
            <g key={id} className="scene-area" data-area={id} {...(decorative ? {} : button)}>
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
        {scene.plate.text}
      </text>
    </svg>
  );
}
