import { FREE_PLAY_ID, scenarioAsFree } from '../model/freePlay.js';
import type { FreeCut } from '../model/freePlay.js';
import { register } from '../model/register.js';
import type { RunSpec } from '../model/run.js';
import { SERVICE_GROUPS, serviceName } from '../model/serviceGroups.js';
import { actions, appStore, useStore } from '../model/store.js';
import { parseDraft, useDraft } from './useDraft.js';
import './freePlay.css';

/** Free play runs no longer than the longest horizon `freePlayScenario` allows. */
const MAX_DAYS = 400;
const FREE_PLAY_TITLE = 'Your scenario';
const CUTS_ONLY_NOTE = "Vendor tampering isn't editable in free play; cuts only.";

/** The spec as free-play input: the free spec, or the register scenario the store would seed from (R4). */
function asFree(spec: RunSpec): { cuts: FreeCut[]; workaroundsHold: boolean } {
  return spec.kind === 'free' ? spec : scenarioAsFree(register, spec.scenarioId);
}

/** A cut's name: its service group's, or the service's own when the group has several (vendor A, vendor B). */
function cutLabel(service: string): string {
  const group = SERVICE_GROUPS.find((g) => g.services.includes(service));
  if (!group) throw new Error(`no service group has ${service}`);
  return group.services.length === 1 ? group.name : serviceName(service);
}

interface DayInputProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onCommit: (days: number) => void;
}

/** A day count. Typing keeps its own text; only a finite value within [min, max] reaches the store. */
function DayInput({ label, value, min, max, onCommit }: DayInputProps) {
  const [draft, setDraft] = useDraft(value);
  const inRange = (days: number) => Number.isFinite(days) && days >= min && days <= max;
  return (
    <label className="free-cut-field">
      <span>{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        step={1}
        value={draft}
        aria-invalid={!inRange(parseDraft(draft))}
        onChange={(e) => {
          setDraft(e.target.value);
          const days = parseDraft(e.target.value);
          if (inRange(days)) onCommit(days);
        }}
      />
    </label>
  );
}

function CutRow({ cut, index }: { cut: FreeCut; index: number }) {
  const label = cutLabel(cut.service);
  return (
    <div className="free-cut" role="group" aria-label={`Cut: ${label}`}>
      <span className="free-cut-name">{label}</span>
      <DayInput
        label="Start day"
        value={cut.atDays}
        min={0}
        max={MAX_DAYS - cut.forDays}
        onCommit={(atDays) => actions.updateCut(index, { atDays })}
      />
      <DayInput
        label="Days cut"
        value={cut.forDays}
        min={1}
        max={MAX_DAYS - cut.atDays}
        onCommit={(forDays) => actions.updateCut(index, { forDays })}
      />
      <button type="button" className="free-cut-remove" onClick={() => actions.removeCut(index)}>
        Remove
      </button>
    </div>
  );
}

/**
 * The free-play controls: the scenario picker, the cuts with their start day and length, whether
 * manual workarounds keep going, and a reset. A register scenario's cuts show as its own; the first
 * edit starts free play from them (R4). Free play is cut-only, so a scenario's compromise events are
 * not carried over, and the note says so. Renders only in free play.
 */
export function FreePlay() {
  const mode = useStore(appStore, (s) => s.mode);
  const spec = useStore(appStore, (s) => s.spec);
  if (mode !== 'free') return null;

  const { cuts, workaroundsHold } = asFree(spec);
  const scenario = spec.kind === 'register' ? register.scenarios.find((s) => s.id === spec.scenarioId) : undefined;
  const hasCompromise = scenario?.events.some((e) => e.kind === 'compromise') ?? false;

  return (
    <section className="free-play" aria-label="Free play">
      <label className="free-play-picker">
        <span>Scenario</span>
        <select
          value={spec.kind === 'free' ? FREE_PLAY_ID : spec.scenarioId}
          onChange={(e) => {
            if (e.target.value !== FREE_PLAY_ID) actions.setScenario(e.target.value);
          }}
        >
          {register.scenarios.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
          {spec.kind === 'free' && <option value={FREE_PLAY_ID}>{FREE_PLAY_TITLE}</option>}
        </select>
      </label>
      {hasCompromise && <p className="free-play-note">{CUTS_ONLY_NOTE}</p>}
      <div className="free-cuts">
        {cuts.map((cut, i) => (
          <CutRow key={`${i}:${cut.service}`} cut={cut} index={i} />
        ))}
      </div>
      <label className="free-play-check">
        <input type="checkbox" checked={workaroundsHold} onChange={(e) => actions.setWorkaroundsHold(e.target.checked)} />
        Workarounds keep going
      </label>
      <button
        type="button"
        className="free-play-reset"
        onClick={() => {
          actions.enterFreePlay();
          actions.clearOverrides();
        }}
      >
        Reset
      </button>
    </section>
  );
}
