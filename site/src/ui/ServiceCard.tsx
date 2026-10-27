import type { ServiceState, Timeline } from '@faillocal/engine';
import type { ReactNode } from 'react';
import { serviceName } from '../model/serviceGroups.js';
import type { ServiceGroup } from '../model/serviceGroups.js';
import { actions, appStore, useStore } from '../model/store.js';
import './chrome.css';

/** A free-play cut starts on the current day and runs for this many days. */
const DEFAULT_CUT_DAYS = 12;

/** The sample at `hour`, or the last one when the clock sits past a shortened horizon. */
function stateAt(timeline: Timeline | null, service: string, hour: number): ServiceState {
  if (!timeline) return 'up';
  const samples = timeline.samples;
  const sample = samples[Math.min(Math.max(0, Math.floor(hour)), samples.length - 1)];
  return sample?.services[service] ?? 'up';
}

/** "Up", "Access revoked", "Down via <cause>" or "Cut since day N", from the run's events. */
function statusLine(timeline: Timeline | null, service: string, state: ServiceState, hour: number): ReactNode {
  if (state === 'up') return 'Up';
  if (state === 'revoked') return 'Access revoked';
  const down = (timeline?.events ?? []).filter((e) => e.kind === 'service-down' && e.subject === service && e.hour <= Math.max(hour, 0));
  const start = down.at(-1);
  if (start?.from) return `Down via ${serviceName(start.from)}`;
  return (
    <>
      Cut since day <span data-clock>{Math.floor((start?.hour ?? 0) / 24)}</span>
    </>
  );
}

function ServiceRow({ service, label }: { service: string; label: string }) {
  const timeline = useStore(appStore, (s) => s.lastGood);
  const hour = useStore(appStore, (s) => s.clock.hour);
  const mode = useStore(appStore, (s) => s.mode);
  const spec = useStore(appStore, (s) => s.spec);

  const state = stateAt(timeline, service, hour);
  const pressed = spec.kind === 'free' && spec.cuts.some((c) => c.service === service);
  const onClick = () => {
    if (spec.kind === 'free' && pressed) {
      // From the end, so the earlier indices stay valid as each cut goes.
      for (let i = spec.cuts.length - 1; i >= 0; i--) if (spec.cuts[i]!.service === service) actions.removeCut(i);
      return;
    }
    actions.addCut({ service, atDays: Math.floor(hour / 24), forDays: DEFAULT_CUT_DAYS });
  };

  return (
    <div className="service-row" data-cut={state !== 'up'}>
      <div className="service-row-text">
        <span className="service-row-name">{label}</span>
        <span className="service-row-status">
          {state !== 'up' && <BreakGlyph />}
          {statusLine(timeline, service, state, hour)}
        </span>
      </div>
      <button
        type="button"
        className={`service-button${pressed ? ' is-restore' : ''}`}
        aria-pressed={pressed}
        aria-label={`${pressed ? 'Restore' : 'Cut'} ${label}`}
        disabled={mode !== 'free'}
        onClick={onClick}
      >
        {pressed ? <JoinGlyph /> : <ScissorsGlyph />}
        {pressed ? 'Restore' : 'Cut'}
      </button>
    </div>
  );
}

/**
 * One outside service on the stage (DESIGN.md "Service Card"). A card with several services, such as
 * vendor remote access, has a row per service, each with its own status line and Cut/Restore button.
 * Only free play edits cuts; elsewhere the buttons are disabled.
 */
export function ServiceCard({ group }: { group: ServiceGroup }) {
  const timeline = useStore(appStore, (s) => s.lastGood);
  const hour = useStore(appStore, (s) => s.clock.hour);
  const cut = group.services.some((id) => stateAt(timeline, id, hour) !== 'up');
  const single = group.services.length === 1;
  return (
    <section className="service-card" role="group" aria-label={group.name} data-service-group={group.id} data-cut={cut}>
      <ServiceIcon cut={cut} />
      <div className="service-card-body">
        {!single && <span className="service-card-name">{group.name}</span>}
        {group.services.map((id) => (
          <ServiceRow key={id} service={id} label={single ? group.name : serviceName(id)} />
        ))}
      </div>
    </section>
  );
}

function ServiceIcon({ cut }: { cut: boolean }) {
  return (
    <svg className="service-icon" viewBox="0 0 30 30" aria-hidden="true">
      <rect x={4} y={7} width={22} height={14} rx={2} fill="none" stroke="var(--ink)" strokeWidth={1.5} />
      <path d="M15 21 V26 M9 26 H21" stroke="var(--ink)" strokeWidth={1.5} fill="none" />
      {cut && <path d="M4 27 L26 3" stroke="var(--stop-red)" strokeWidth={2.5} />}
    </svg>
  );
}

function BreakGlyph() {
  return (
    <svg className="service-glyph" viewBox="0 0 14 14" aria-hidden="true">
      <path d="M2 3 H12 M2 11 H12" stroke="currentColor" strokeWidth={1.5} />
      <circle cx={7} cy={7} r={2.2} fill="none" stroke="currentColor" strokeWidth={1.5} />
    </svg>
  );
}

function ScissorsGlyph() {
  return (
    <svg className="service-glyph" viewBox="0 0 14 14" aria-hidden="true">
      <circle cx={3.5} cy={10.5} r={2} fill="none" stroke="currentColor" strokeWidth={1.3} />
      <circle cx={10.5} cy={10.5} r={2} fill="none" stroke="currentColor" strokeWidth={1.3} />
      <path d="M5 9 L11 2 M9 9 L3 2" stroke="currentColor" strokeWidth={1.3} />
    </svg>
  );
}

function JoinGlyph() {
  return (
    <svg className="service-glyph" viewBox="0 0 14 14" aria-hidden="true">
      <path d="M1 7 H5 M9 7 H13" stroke="currentColor" strokeWidth={1.5} />
      <rect x={5} y={4.5} width={4} height={5} rx={1} fill="currentColor" />
    </svg>
  );
}
