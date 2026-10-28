import type { Register, Timeline } from '@faillocal/engine';
import { useEffect, useMemo, useRef, useState } from 'react';
import { DWELL_SECONDS, TRAVEL_HOURS_PER_SECOND, comparison, guidedSteps, travelHours } from '../model/guided.js';
import type { CaptionParts, GuidedStep } from '../model/guided.js';
import { register as defaultRegister } from '../model/register.js';
import { deriveRun } from '../model/run.js';
import { actions, appStore, useStore } from '../model/store.js';
import { timeScale } from '../model/timeScale.js';
import { AssumptionCaveat } from './AssumptionCaveat.js';
import { Qty } from './Qty.js';
import './chrome.css';
import './guided.css';

/** A step's hold, in unscaled milliseconds; the e2e time scale divides it when a timer is set (R9). */
const DWELL_MS = DWELL_SECONDS * 1000;
/** How often the clock moves while the run travels between steps. */
const TRAVEL_TICK_MS = 50;

type Sources = Record<string, string>;

export interface GuidedRunProps {
  register?: Register;
}

/** The guided run, while the site is in guided mode. Leaving guided mode unmounts it, which clears its timers. */
export function GuidedRun({ register = defaultRegister }: GuidedRunProps) {
  const active = useStore(appStore, (s) => s.mode === 'guided');
  return active ? <GuidedSession register={register} /> : null;
}

/** Puts the store on a step: its scenario, its variant, its hour, paused. */
function show(step: GuidedStep): void {
  actions.setScenario(step.scenarioId);
  actions.setVariant(step.variant);
  actions.setClock({ hour: step.hour, playing: false });
}

function stepRun(register: Register, step: GuidedStep): Timeline {
  const result = deriveRun(register, { spec: { kind: 'register', scenarioId: step.scenarioId }, variant: step.variant, overrides: {} });
  if (!result.ok) throw new Error(`guided run: ${step.scenarioId} does not run`);
  return result.timeline;
}

/**
 * One pass through the guided steps. It drives the store clock itself with `setTimeout` (never
 * `clock.playing`, so the site page's playback loop stays idle): within a segment it moves the hour
 * forward at TRAVEL_HOURS_PER_SECOND, then holds DWELL_SECONDS on the step; between segments it
 * jumps. After the last step it shows the comparison card and stops.
 */
function GuidedSession({ register }: { register: Register }) {
  const steps = useMemo(() => guidedSteps(register), [register]);
  const [index, setIndex] = useState(0);
  const [captionIndex, setCaptionIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phase = useRef<'arrive' | 'travel' | 'dwell'>('arrive');
  const dwellLeft = useRef(DWELL_MS);
  const dwellStart = useRef(0);

  const clear = () => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  };

  useEffect(() => {
    if (paused || index >= steps.length) return;
    const step = steps[index]!;

    const dwell = () => {
      phase.current = 'dwell';
      setCaptionIndex(index);
      dwellStart.current = Date.now();
      timer.current = setTimeout(() => {
        timer.current = null;
        phase.current = 'arrive';
        dwellLeft.current = DWELL_MS;
        setIndex(index + 1);
      }, dwellLeft.current / timeScale());
    };

    const travel = () => {
      phase.current = 'travel';
      let last = Date.now();
      const tick = () => {
        const now = Date.now();
        const hour = Math.min(appStore.get().clock.hour + ((now - last) / 1000) * TRAVEL_HOURS_PER_SECOND * timeScale(), step.hour);
        last = now;
        actions.setClock({ hour, playing: false });
        timer.current = null;
        if (hour >= step.hour) dwell();
        else timer.current = setTimeout(tick, TRAVEL_TICK_MS);
      };
      timer.current = setTimeout(tick, TRAVEL_TICK_MS);
    };

    if (phase.current === 'travel') travel();
    else if (phase.current === 'dwell') dwell();
    else {
      const prev = steps[index - 1];
      if (prev && travelHours(prev, step) > 0) travel();
      else {
        show(step);
        dwell();
      }
    }

    return () => {
      if (phase.current === 'dwell') dwellLeft.current = Math.max(0, dwellLeft.current - (Date.now() - dwellStart.current) * timeScale());
      clear();
    };
  }, [paused, index, steps]);

  const skip = () => {
    clear();
    actions.enterFreePlay();
  };

  const done = index >= steps.length;
  const step = steps[Math.min(captionIndex, steps.length - 1)]!;
  const sources: Sources = Object.fromEntries(register.sources.map((s) => [s.id, s.title]));
  const scenario = register.scenarios.find((s) => s.id === step.scenarioId);

  return (
    <section className="guided" aria-label="Guided run" data-step={done ? 'comparison' : captionIndex}>
      <header className="guided-head">
        {step.segment === 'as-reported' && !done && <p className="guided-kicker">What really happened</p>}
        <h2 className="guided-title">{scenario?.title ?? step.scenarioId}</h2>
        {!done && <span className="guided-variant">{step.variant === 'prepared' ? 'Prepared' : 'Unprepared'}</span>}
      </header>
      {done ? (
        <ComparisonCard register={register} sources={sources} />
      ) : (
        <div className="guided-captions">
          <span className="draft-marker">Draft copy</span>
          <p className="guided-caption" aria-live="polite">
            <Caption parts={step.caption(stepRun(register, step))} sources={sources} />
          </p>
        </div>
      )}
      <div className="guided-controls">
        {!done && (
          <button type="button" onClick={() => setPaused((p) => !p)}>
            {paused ? 'Resume' : 'Pause'}
          </button>
        )}
        {!done && (
          <button type="button" onClick={skip}>
            Skip
          </button>
        )}
      </div>
    </section>
  );
}

function Caption({ parts, sources }: { parts: CaptionParts; sources: Sources }) {
  return (
    <>
      {parts.map((part, i) => {
        if (typeof part === 'string') return <span key={i}>{part}</span>;
        if ('date' in part)
          return (
            <time key={i} dateTime={part.date}>
              {part.text}
            </time>
          );
        return <Qty key={i} {...part.qty} sources={sources} />;
      })}
    </>
  );
}

/** The closing card: the projection's revenue at risk, unprepared against prepared, and the assumptions it rests on. */
function ComparisonCard({ register, sources }: { register: Register; sources: Sources }) {
  const c = useMemo(() => comparison(register), [register]);
  return (
    <div className="guided-card">
      <div className="guided-captions guided-draft-region">
        <span className="draft-marker">Draft copy</span>
        <dl className="guided-totals">
          <div>
            <dt>Revenue at risk, unprepared</dt>
            <dd>
              <Qty value={c.unprepared} kind="usd" computed />
            </dd>
          </div>
          <div>
            <dt>Revenue at risk, prepared</dt>
            <dd>
              <Qty value={c.prepared} kind="usd" computed />
            </dd>
          </div>
          <div>
            <dt>Being prepared protected</dt>
            <dd>
              <Qty value={c.protected} kind="usd" computed />
            </dd>
          </div>
        </dl>
        <AssumptionCaveat assumptionsUsed={c.assumptionsUsed} sources={sources} />
      </div>
      <button type="button" className="guided-explore" onClick={() => actions.enterFreePlay()}>
        Explore it yourself
      </button>
    </div>
  );
}
