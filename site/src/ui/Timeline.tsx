import type { Timeline as Run } from '@faillocal/engine';
import type { KeyboardEvent, PointerEvent } from 'react';
import { SPEEDS, horizonDays, horizonHours, scrubTo } from '../model/clock.js';
import { register } from '../model/register.js';
import { serviceLabel } from '../model/serviceGroups.js';
import { actions, appStore, useStore } from '../model/store.js';
import './chrome.css';
import './timeline.css';

/** Every tick carries its numeral up to this many days; past it, only the six-day ticks do. */
const ALL_NUMERALS_UP_TO_DAYS = 24;
const LONG_TICK_DAYS = 6;

interface Marker {
  hour: number;
  kind: 'service-down' | 'service-up' | 'process-stopped';
  name: string;
  word: string;
}

function processName(id: string): string {
  const process = register.processes.find((p) => p.id === id);
  if (!process) throw new Error(`register has no process ${id}`);
  return process.name;
}

/** Hairlines for every service outage start and end, and the first stop of each process. */
function markers(t: Run): Marker[] {
  const stopped = new Set<string>();
  const out: Marker[] = [];
  for (const e of t.events) {
    if (e.kind === 'service-down') out.push({ hour: e.hour, kind: e.kind, name: serviceLabel(e.subject), word: 'down' });
    else if (e.kind === 'service-up') out.push({ hour: e.hour, kind: e.kind, name: serviceLabel(e.subject), word: 'up' });
    else if (e.kind === 'process-state' && e.to === 'stopped' && !stopped.has(e.subject)) {
      stopped.add(e.subject);
      out.push({ hour: e.hour, kind: 'process-stopped', name: processName(e.subject), word: 'stopped' });
    }
  }
  return out;
}

/** The horizon as written: whole days bare, a part day to one decimal. */
const daysText = (d: number): string => (Number.isInteger(d) ? String(d) : d.toFixed(1));

/**
 * The day timeline (DESIGN.md "Day Timeline"): play controls, the "Day N of H" figure and the
 * scrubbable axis. The site page mounts the playback loop. In guided mode the run drives the clock,
 * so play and scrubbing are disabled.
 */
export function Timeline() {
  const run = useStore(appStore, (s) => s.lastGood);
  const clock = useStore(appStore, (s) => s.clock);
  const locked = useStore(appStore, (s) => s.mode === 'guided');
  if (!run) return null;

  const maxHour = horizonHours(run);
  const days = horizonDays(run);
  const axisHours = days * 24;
  const pct = (h: number) => `${(Math.min(Math.max(h, 0), axisHours) / axisHours) * 100}%`;
  const hour = Math.min(clock.hour, maxHour);
  const whole = Math.floor(hour);
  const day = Math.floor(whole / 24);
  const ticks = Array.from({ length: Math.floor(days) }, (_, i) => i + 1);

  const togglePlay = () => {
    if (clock.playing) actions.setClock({ playing: false });
    else actions.setClock(hour >= maxHour ? { hour: 0, playing: true } : { playing: true });
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (locked) return;
    const step = e.shiftKey ? 24 : 1;
    const to = { ArrowRight: whole + step, ArrowUp: whole + step, ArrowLeft: whole - step, ArrowDown: whole - step, Home: 0, End: maxHour }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    actions.setClock({ hour: scrubTo(to, maxHour) });
  };

  const scrubFromPointer = (e: PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    if (locked || box.width === 0) return;
    actions.setClock({ hour: scrubTo(((e.clientX - box.left) / box.width) * axisHours, maxHour) });
  };

  return (
    <section className="timeline" aria-label="Day timeline">
      <div className="timeline-controls">
        <button type="button" className="timeline-play" aria-label={clock.playing ? 'Pause' : 'Play'} disabled={locked} onClick={togglePlay}>
          <svg viewBox="0 0 16 16" aria-hidden="true">
            {clock.playing ? <path d="M4 3h3v10H4zM9 3h3v10H9z" /> : <path d="M5 3l8 5-8 5z" />}
          </svg>
        </button>
        <div className="timeline-figure-block">
          <span className="timeline-figure" data-clock>
            Day {day} of {daysText(days)}
          </span>
          {run.projection && (
            <span className="timeline-note">
              A projection,
              <br />
              not what happened
            </span>
          )}
        </div>
      </div>
      <div
        className="timeline-axis"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture?.(e.pointerId);
          scrubFromPointer(e);
        }}
        onPointerMove={(e) => {
          if (e.buttons & 1) scrubFromPointer(e);
        }}
      >
        <div className="timeline-events">
          {markers(run).map((m, i) => (
            <div
              key={i}
              className={`timeline-event${i % 2 ? ' is-below' : ''}`}
              data-event={m.kind}
              style={{ left: pct(m.hour) }}
            >
              <span className="timeline-event-label">
                <span className="timeline-event-name" title={m.name}>
                  {m.name}
                </span>{' '}
                <span className="timeline-event-word">{m.word}</span>
              </span>
            </div>
          ))}
        </div>
        <div
          className="timeline-track"
          role="slider"
          tabIndex={locked ? -1 : 0}
          aria-disabled={locked || undefined}
          aria-label="Timeline"
          aria-valuemin={0}
          aria-valuemax={maxHour}
          aria-valuenow={whole}
          aria-valuetext={`Day ${day}, hour ${whole % 24}`}
          onKeyDown={onKeyDown}
        >
          <div className="timeline-elapsed" style={{ width: pct(hour) }} />
          <div className={`timeline-remaining${run.projection ? ' is-projection' : ''}`} style={{ left: pct(hour) }} />
          {ticks.map((d) => (
            <div key={d} className={`timeline-tick${d % LONG_TICK_DAYS === 0 ? ' is-long' : ''}`} data-tick style={{ left: pct(d * 24) }}>
              {(days <= ALL_NUMERALS_UP_TO_DAYS || d % LONG_TICK_DAYS === 0) && (
                <span className="timeline-tick-numeral" data-clock>
                  {d}
                </span>
              )}
            </div>
          ))}
          <div className="timeline-now" style={{ left: pct(hour) }} />
        </div>
      </div>
      <div className="segmented timeline-speeds" role="group" aria-label="Playback speed">
        {SPEEDS.map((hps) => (
          <button key={hps} type="button" aria-pressed={clock.hoursPerSecond === hps} onClick={() => actions.setSpeed(hps)}>
            <span data-clock>{hps} h/s</span>
          </button>
        ))}
      </div>
    </section>
  );
}
