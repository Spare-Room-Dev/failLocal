import type { Timeline as Run } from '@faillocal/engine';
import { useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, PointerEvent, RefObject } from 'react';
import { SPEEDS, horizonDays, horizonHours, scrubTo } from '../model/clock.js';
import { actions, appStore, useStore } from '../model/store.js';
import { currentMarker, dayHour, placeLabels, timelineMarkers } from '../model/timelineEvents.js';
import type { Lane, Marker } from '../model/timelineEvents.js';
import { useMediaQuery } from './useMediaQuery.js';
import './chrome.css';
import './timeline.css';

/** Every tick carries its numeral up to this many days; past it, only the six-day ticks do. */
const ALL_NUMERALS_UP_TO_DAYS = 24;
const LONG_TICK_DAYS = 6;

/** The horizon as written: whole days bare, a part day to one decimal. */
const daysText = (d: number): string => (Number.isInteger(d) ? String(d) : d.toFixed(1));

/** Lanes are laid out wherever the strip is wider than a phone's; a phone labels the latest event and lists them all. */
const LANES_QUERY = '(min-width: 761px)';

/**
 * Each label's lane, from the labels' measured widths on the axis as drawn (finish B2). Re-measured when
 * the axis resizes or the events change; none on a phone.
 */
function useLanes(markers: Marker[], axisHours: number): { axis: RefObject<HTMLDivElement | null>; lanes: Lane[] } {
  const axis = useRef<HTMLDivElement>(null);
  const wide = useMediaQuery(LANES_QUERY);
  const [lanes, setLanes] = useState<Lane[]>([]);
  const key = markers.map((m) => `${m.hour}:${m.name}:${m.word}:${m.tag}`).join('|');
  useLayoutEffect(() => {
    const el = axis.current;
    if (!el || !wide) {
      setLanes((prev) => (prev.length ? [] : prev));
      return;
    }
    const measure = () => {
      const width = el.getBoundingClientRect().width;
      const labels = [...el.querySelectorAll<HTMLElement>('.timeline-event-label')];
      const next = placeLabels(
        markers.map((m, i) => ({ x: (Math.min(Math.max(m.hour, 0), axisHours) / axisHours) * width, width: labels[i]?.getBoundingClientRect().width ?? 0 })),
        width,
      );
      setLanes((prev) => (prev.length === next.length && prev.every((l, i) => l === next[i]) ? prev : next));
    };
    measure();
    // The labels' widths change once the web font arrives.
    void document.fonts?.ready.then(measure);
    if (typeof ResizeObserver !== 'function') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
    // `key` stands for `markers`, which is rebuilt each render.
  }, [key, axisHours, wide]);
  return { axis, lanes };
}

/** "Day N of H", with the projection note when the run is one. The timeline shows it; on a phone the summary strip does (finish B4). */
export function DayFigure() {
  const run = useStore(appStore, (s) => s.lastGood);
  const clock = useStore(appStore, (s) => s.clock);
  if (!run) return null;
  const day = Math.floor(Math.floor(Math.min(clock.hour, horizonHours(run))) / 24);
  return (
    <div className="timeline-figure-block">
      <span className="timeline-figure" data-clock>
        Day {day} of {daysText(horizonDays(run))}
      </span>
      {run.projection && (
        <span className="timeline-note">
          A projection,{' '}
          <br />
          not what happened
        </span>
      )}
    </div>
  );
}

/**
 * The day timeline (DESIGN.md "Day Timeline"): play controls, the "Day N of H" figure and the
 * scrubbable axis (`figure={false}` leaves the figure to the phone's summary strip). The site page mounts the playback loop. In guided mode the run drives the clock,
 * so play and scrubbing are disabled.
 */
export function Timeline({ figure = true }: { figure?: boolean }) {
  const run = useStore(appStore, (s) => s.lastGood);
  const clock = useStore(appStore, (s) => s.clock);
  const locked = useStore(appStore, (s) => s.mode === 'guided');
  const markers = run ? timelineMarkers(run) : [];
  const axisHoursForLanes = run ? horizonDays(run) * 24 : 1;
  const { axis, lanes } = useLanes(markers, axisHoursForLanes);
  if (!run) return null;

  const maxHour = horizonHours(run);
  const days = horizonDays(run);
  const axisHours = days * 24;
  const pct = (h: number) => `${(Math.min(Math.max(h, 0), axisHours) / axisHours) * 100}%`;
  const hour = Math.min(clock.hour, maxHour);
  const whole = Math.floor(hour);
  const current = currentMarker(markers, hour);
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
        {figure && <DayFigure />}
      </div>
      <div
        ref={axis}
        className="timeline-axis"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture?.(e.pointerId);
          scrubFromPointer(e);
        }}
        onPointerMove={(e) => {
          if (e.buttons & 1) scrubFromPointer(e);
        }}
      >
        <div className={`timeline-events${lanes.length ? ' has-lanes' : ''}`}>
          {markers.map((m, i) => (
            <button
              key={i}
              type="button"
              className={`timeline-event${i === current ? ' is-current' : ''}`}
              data-event={m.kind}
              data-lane={lanes[i] ?? undefined}
              aria-label={`${m.name} ${m.word}, ${m.tag}`}
              disabled={locked}
              style={{ left: pct(m.hour), '--at': Math.min(Math.max(m.hour / axisHours, 0), 1) } as CSSProperties}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => actions.setClock({ hour: scrubTo(m.hour, maxHour) })}
            >
              <span className="timeline-event-label" aria-hidden="true">
                <span className="timeline-event-name" title={m.name}>
                  {m.name}
                </span>{' '}
                <span className="timeline-event-word">{m.word}</span>{' '}
                <span className="timeline-event-tag">{m.tag}</span>
              </span>
            </button>
          ))}
        </div>
        <div
          className="timeline-track"
          data-clock
          role="slider"
          tabIndex={locked ? -1 : 0}
          aria-disabled={locked || undefined}
          aria-label="Timeline"
          aria-valuemin={0}
          aria-valuemax={maxHour}
          aria-valuenow={whole}
          aria-valuetext={dayHour(whole)}
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
          <button
            key={hps}
            type="button"
            data-clock
            aria-label={`${hps} hours per second`}
            aria-pressed={clock.hoursPerSecond === hps}
            onClick={() => actions.setSpeed(hps)}
          >
            {hps} h per s
          </button>
        ))}
      </div>
    </section>
  );
}
