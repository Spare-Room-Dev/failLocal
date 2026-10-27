import { independentCopyFor } from '@faillocal/engine';
import { useId } from 'react';
import type { ReactNode } from 'react';
import type { Dependency, Process, ProcessState, Register, Sample, Timeline, UsedInput, Variant } from '@faillocal/engine';
import { sceneState } from '../model/sceneState.js';
import type { SceneState } from '../model/sceneState.js';
import { ProvenanceTag } from './ProvenanceTag.js';
import { Qty } from './Qty.js';
import { FlagGlyph } from './glyphs.js';

export interface AreaPanelProps {
  register: Register;
  timeline: Timeline;
  sample: Sample;
  variant: Variant;
  processId: string;
  onClose(): void;
}

const PROCESS_WORD: Record<ProcessState, string> = { normal: 'Normal', degraded: 'Degraded', stopped: 'Stopped' };
const SERVICE_WORD = { up: 'Up', down: 'Down', revoked: 'Access revoked' } as const;
const ON_LOSS_WORD = { stop: 'Stops on loss', degrade: 'Degrades on loss' } as const;

interface DependencyView {
  name: string;
  state: string;
  /** Lost at this sample: its service is down or revoked, its asset down, its upstream process not normal, or its stock at or below its low mark. */
  lost: boolean;
}

/** What a dependency of the selected process looks like at `sample`, whatever kind of thing it is on. */
function dependencyView(r: Register, timeline: Timeline, sample: Sample, d: Dependency): DependencyView {
  const service = r.services.find((s) => s.id === d.on);
  if (service) {
    const state = sample.services[d.on] ?? 'up';
    return { name: service.name, state: SERVICE_WORD[state], lost: state !== 'up' };
  }
  const asset = r.assets.find((a) => a.id === d.on);
  if (asset) {
    const down = sample.assets[d.on] === 'down';
    return { name: asset.name, state: down ? 'Down' : 'Up', lost: down };
  }
  const process = r.processes.find((p) => p.id === d.on);
  if (process) {
    const state = sample.processes[d.on] ?? 'normal';
    return { name: process.name, state: PROCESS_WORD[state], lost: state !== 'normal' };
  }
  const stock = r.stocks.find((s) => s.id === d.on);
  if (stock) {
    const level = sample.stocks[d.on] ?? 0;
    // The run's low mark, so an edited threshold counts.
    const low = timeline.assumptionsUsed[`stocks.${d.on}.lowThreshold`]?.value ?? stock.lowThreshold.value;
    const state = level <= 0 ? 'Empty' : level <= low ? 'Low' : 'Above its low mark';
    return { name: stock.name, state, lost: level <= low };
  }
  throw new Error(`register has nothing called ${d.on}`);
}

/** The input at `path` as the run used it. Throws if the run did not record it. */
function usedInput(timeline: Timeline, path: string): UsedInput {
  const used = timeline.assumptionsUsed[path];
  if (!used) throw new Error(`the run did not record ${path}`);
  return used;
}

/** A run input in hours with its tag, and "changed by you" when the visitor edited it. */
function UsedHours({ used }: { used: UsedInput }) {
  return <Qty value={used.value} kind="hours" display={used.provenance.kind} provenance={used.provenance} overridden={used.overridden} />;
}

/** Eight illustrative trucks (D-099): parked ones khaki with a pause marker. Never a count. */
function FleetRow({ fleet, state }: { fleet: SceneState['fleet']; state: ProcessState }) {
  const trucks = [...Array<'moving'>(fleet.moving).fill('moving'), ...Array<'parked'>(fleet.parked).fill('parked')];
  const label = { normal: 'Fleet running', degraded: 'Fleet rationed', stopped: 'Fleet parked' }[state];
  return (
    <svg className="fleet" data-testid="fleet" viewBox={`0 0 ${trucks.length * 26} 18`} role="img" aria-label={label}>
      {trucks.map((t, i) => (
        <g key={i} data-truck={t} transform={`translate(${i * 26} 0)`}>
          <rect x={1} y={4} width={16} height={9} rx={1.5} fill={t === 'parked' ? 'var(--hivis-parked)' : 'var(--hivis)'} stroke="var(--ink)" />
          <rect x={17} y={7} width={6} height={6} rx={1} fill={t === 'parked' ? 'var(--hivis-parked)' : 'var(--hivis)'} stroke="var(--ink)" />
          <circle cx={6} cy={15} r={2} fill="var(--ink)" />
          <circle cx={18} cy={15} r={2} fill="var(--ink)" />
          {t === 'parked' && <path d="M7 6.5 V10.5 M10.5 6.5 V10.5" stroke="var(--ink)" strokeWidth={1.5} />}
        </g>
      ))}
    </svg>
  );
}

function IndependentCopy({ r, process, variant }: { r: Register; process: Process; variant: Variant }) {
  const copy = independentCopyFor(r, process.id, variant);
  if (!copy.value) return <span data-testid="independent-copy">No</span>;
  if (copy.source === 'register') return <span data-testid="independent-copy">Yes</span>;
  const { control } = copy.source;
  const name = r.controls.find((c) => c.id === control)?.name;
  if (!name) throw new Error(`register has no control ${control}`);
  return <span data-testid="independent-copy">{`Yes, via ${name}`}</span>;
}

function LastRestoreTest({ test }: { test: Process['continuity']['lastRestoreTest'] }) {
  if (!test) return <>None recorded</>;
  // A dated record with provenance: it carries its tag like a quantity does.
  return (
    <span className="qty" data-quantity>
      {test.date}, {test.result === 'pass' ? 'passed' : 'failed'}
      <ProvenanceTag display={test.provenance.kind} provenance={test.provenance} />
    </span>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <li className="panel-row">
      <span className="panel-row-label">{label}</span>
      <span className="panel-row-value">{children}</span>
    </li>
  );
}

/**
 * The selected process (DESIGN.md "Docked Detail Panel"): name and description, the state box, why
 * it stops, what it depends on, and its continuity. Everything is read off the register and the
 * current sample.
 */
export function AreaPanel({ register: r, timeline, sample, variant, processId, onClose }: AreaPanelProps) {
  const ids = useId();
  const process = r.processes.find((p) => p.id === processId);
  if (!process) throw new Error(`register has no process ${processId}`);
  const scene = sceneState(r, sample);
  const area = scene.processes[processId]!;
  const deps = process.dependsOn.map((d) => ({ d, view: dependencyView(r, timeline, sample, d) }));
  const lost = deps.filter(({ view }) => view.lost);
  // Nothing lost yet the area is down: a service it depends on is back up but its post-restore hold
  // still keeps the dependency lost. The engine does not expose the hold window, so list the
  // candidates with their hold length rather than re-deriving it.
  const held =
    lost.length === 0 && area.state !== 'normal'
      ? process.dependsOn.filter((d) => d.afterRestore && sample.services[d.on] === 'up')
      : [];
  const { continuity } = process;

  return (
    <section className="area-panel" aria-label={`Area: ${process.name}`}>
      <header className="area-head">
        <div>
          <h2 className="area-name">{process.name}</h2>
          <p className="area-description">{process.productionConsequence}</p>
          <p className="area-safety">{process.safetyFunction}</p>
        </div>
        <button type="button" className="area-close" aria-label="Close area panel" onClick={onClose}>
          ×
        </button>
      </header>

      <div className="state-box" data-state={area.state}>
        <svg className="state-flag" viewBox="0 0 34 50" aria-hidden="true">
          <FlagGlyph flag={area.flag} x={2} y={1} />
        </svg>
        <div>
          <p className={`state-word${area.state === 'stopped' ? ' is-stopped' : ''}`}>{PROCESS_WORD[area.state]}</p>
          {area.note && <p className="state-note">{area.note}</p>}
          {processId === 'haulage' && <FleetRow fleet={scene.fleet} state={area.state} />}
        </div>
      </div>

      <h3 className="panel-heading" id={`${ids}-why-stops`}>
        Why this stops
      </h3>
      {lost.length ? (
        <ul className="panel-list" aria-labelledby={`${ids}-why-stops`}>
          {lost.map(({ d, view }) => (
            <li key={d.on}>{`${view.name}: ${view.state}`}</li>
          ))}
        </ul>
      ) : held.length ? (
        <ul className="panel-list" aria-labelledby={`${ids}-why-stops`}>
          {held.map((d) => (
            <li key={d.on}>
              {`${dependencyView(r, timeline, sample, d).name}: Back up — ${d.afterRestore!.description}. Held for `}
              <UsedHours used={usedInput(timeline, `processes.${processId}.dependsOn.${d.on}.afterRestore.holdFor`)} />
              {' after each restore.'}
            </li>
          ))}
        </ul>
      ) : (
        <p className="panel-empty">Nothing on this process's dependencies is down at this hour.</p>
      )}

      <h3 className="panel-heading" id={`${ids}-depends-on`}>
        Depends on
      </h3>
      <ul className="panel-rows" aria-labelledby={`${ids}-depends-on`}>
        {deps.map(({ d, view }) => (
          <Row key={d.on} label={view.name}>
            <span className={view.lost ? 'is-lost' : undefined}>{view.state}</span>
            <span className="panel-row-sub">{ON_LOSS_WORD[d.onLoss]}</span>
          </Row>
        ))}
      </ul>

      <h3 className="panel-heading" id={`${ids}-continuity`}>
        Continuity
      </h3>
      <ul className="panel-rows" aria-labelledby={`${ids}-continuity`}>
        <Row label="Maximum tolerable outage">
          <UsedHours used={usedInput(timeline, `processes.${processId}.continuity.maxTolerableOutage`)} />
        </Row>
        <Row label="Recovery target">
          <UsedHours used={usedInput(timeline, `processes.${processId}.continuity.recoveryTarget`)} />
        </Row>
        <Row label="Owner">{continuity.owner}</Row>
        <Row label="Last restore test">
          <LastRestoreTest test={continuity.lastRestoreTest} />
        </Row>
        <Row label="Independent copy">
          <IndependentCopy r={r} process={process} variant={variant} />
        </Row>
      </ul>
    </section>
  );
}
