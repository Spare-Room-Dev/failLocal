import type { ServiceState, Timeline } from '@faillocal/engine';
import type { ReactNode } from 'react';
import { sampleAt } from '../model/clock.js';
import { scenarioAsFree } from '../model/freePlay.js';
import type { FreeCut } from '../model/freePlay.js';
import { register } from '../model/register.js';
import type { RunSpec } from '../model/run.js';
import { SERVICE_GROUPS, serviceName } from '../model/serviceGroups.js';
import type { ServiceGroup } from '../model/serviceGroups.js';
import { actions, appStore, useStore } from '../model/store.js';
import { ServiceIcon } from './glyphs.js';
import './chrome.css';

/** A free-play cut starts on the current day and runs for this many days. */
const DEFAULT_CUT_DAYS = 12;

/** The service's state at `hour` (see `sampleAt`), or up when there is no run yet. */
function stateAt(timeline: Timeline | null, service: string, hour: number): ServiceState {
  if (!timeline) return 'up';
  return sampleAt(timeline, hour).services[service] ?? 'up';
}

/** The cuts the current spec makes: the free-play cuts, or a register scenario's `cut-service` events. */
function specCuts(spec: RunSpec): FreeCut[] {
  return spec.kind === 'free' ? spec.cuts : scenarioAsFree(register, spec.scenarioId).cuts;
}

/** The card name for a service: its group's display name. */
function groupName(service: string): string {
  const group = SERVICE_GROUPS.find((g) => g.services.includes(service));
  if (!group) throw new Error(`no service group has ${service}`);
  return group.name;
}

/** "day N", N a clock value, kept on one line. */
function Day({ hour }: { hour: number }) {
  return (
    <span className="service-row-day">
      day <span data-clock>{Math.floor(hour / 24)}</span>
    </span>
  );
}

/**
 * A service's status from the run's events: "Up", "Access revoked", "Down via <cause>" or "Cut since
 * day N" while it is out; with a cut of its own that has not started, "Cut from day N"; once that cut
 * has ended, "Restored day N" (its own restore: an inherited outage's end is not its cut's). `quiet` is true for a plain "Up".
 */
function status(timeline: Timeline | null, service: string, state: ServiceState, hour: number, cut: boolean): { text: ReactNode; quiet: boolean } {
  const events = timeline?.events ?? [];
  const now = Math.max(hour, 0);
  if (state === 'revoked') return { text: 'Access revoked', quiet: false };
  if (state === 'down') {
    const start = events.filter((e) => e.kind === 'service-down' && e.subject === service && e.hour <= now).at(-1);
    // The engine gives every outage a service-down event at its start, so a down sample always has one.
    if (!start) throw new Error(`${service} is down at hour ${hour} with no service-down event`);
    if (start.from) return { text: `Down via ${groupName(start.from)}`, quiet: false };
    return { text: <>Cut since <Day hour={start.hour} /></>, quiet: false };
  }
  if (cut) {
    // Its own restore: the last service-up whose outage began with its own cut, not one inherited from
    // another service (the engine marks the inherited outage's service-down with `from`; its service-up carries none).
    const own = events.filter((e) => e.subject === service && (e.kind === 'service-down' || e.kind === 'service-up'));
    const restored = own.filter((e, i) => e.kind === 'service-up' && !e.from && e.hour <= now && own[i - 1]?.kind === 'service-down' && !own[i - 1]!.from).at(-1);
    if (restored) return { text: <>Restored <Day hour={restored.hour} /></>, quiet: false };
    const upcoming = events.find((e) => e.kind === 'service-down' && e.subject === service && !e.from && e.hour > now);
    if (upcoming) return { text: <>Cut from <Day hour={upcoming.hour} /></>, quiet: false };
  }
  return { text: 'Up', quiet: true };
}

interface ServiceView {
  id: string;
  /** Names it to assistive technology and in tooltips: the register's name, or the group's for a lone service. */
  label: string;
  state: ServiceState;
  /** Whether the spec cuts it. */
  cut: boolean;
  status: { text: ReactNode; quiet: boolean };
}

function useServiceViews(group: ServiceGroup): ServiceView[] {
  const timeline = useStore(appStore, (s) => s.lastGood);
  const hour = useStore(appStore, (s) => s.clock.hour);
  const spec = useStore(appStore, (s) => s.spec);
  const cuts = specCuts(spec);
  const single = group.services.length === 1;
  return group.services.map((id) => {
    const state = stateAt(timeline, id, hour);
    const cut = cuts.some((c) => c.service === id);
    return { id, label: single ? group.name : serviceName(id), state, cut, status: status(timeline, id, state, hour, cut) };
  });
}

/**
 * A service's Cut button. With a cut in the spec it is pressed, and names what a press does: "Restore"
 * while the cut holds the service down, "Remove cut" when the cut has not started or has ended (the
 * service is up either way). `keyLetter` marks one of several buttons on a card.
 */
function CutButton({ view, keyLetter }: { view: ServiceView; keyLetter?: string }) {
  const hour = useStore(appStore, (s) => s.clock.hour);
  const mode = useStore(appStore, (s) => s.mode);
  const spec = useStore(appStore, (s) => s.spec);
  const restores = view.cut && view.state !== 'up';
  const verb = !view.cut ? 'Cut' : restores ? 'Restore' : 'Remove cut';
  const onClick = () => {
    if (view.cut) {
      // From the end, so the earlier indices stay valid as each cut goes. A register scenario's cuts
      // share their indices with the free spec the store seeds from them (R4).
      const cuts = specCuts(spec);
      for (let i = cuts.length - 1; i >= 0; i--) if (cuts[i]!.service === view.id) actions.removeCut(i);
      return;
    }
    actions.addCut({ service: view.id, atDays: Math.floor(hour / 24), forDays: DEFAULT_CUT_DAYS });
  };
  return (
    <button
      type="button"
      className={`service-button${restores ? ' is-restore' : ''}${view.cut && !restores ? ' is-remove' : ''}${keyLetter ? ' is-keyed' : ''}`}
      aria-pressed={view.cut}
      aria-label={verb === 'Remove cut' ? `Remove cut: ${view.label}` : `${verb} ${view.label}`}
      title={keyLetter ? view.label : undefined}
      disabled={mode !== 'free'}
      onClick={onClick}
    >
      {restores ? <JoinGlyph /> : view.cut ? <UndoGlyph /> : <ScissorsGlyph />}
      {keyLetter ? <span className="service-button-key">{keyLetter}</span> : <span className="service-button-text">{verb}</span>}
    </button>
  );
}

function StatusLine({ view, prefix }: { view: ServiceView; prefix?: string }) {
  return (
    <span className="service-row-status" data-cut={view.state !== 'up'}>
      {view.state !== 'up' && <BreakGlyph />}
      {prefix && (
        <span className="service-status-key" title={view.label}>
          {prefix}
        </span>
      )}
      {prefix && ' '}
      <span>{view.status.text}</span>
    </span>
  );
}

/**
 * One outside service on the stage (DESIGN.md "Service Card"): its icon, its name, then its status
 * beside its Cut/Restore button. A card with several services, such as vendor remote access, keeps the
 * same shape: one status ("Up" while every service is quietly up, else a line per service) and a
 * compact keyed button per service, each named for its service. Only free play edits cuts; elsewhere
 * the buttons are disabled.
 */
export function ServiceCard({ group }: { group: ServiceGroup }) {
  const views = useServiceViews(group);
  const cut = views.some((v) => v.state !== 'up');
  const single = views.length === 1;
  return (
    <section className="service-card" role="group" aria-label={group.name} data-service-group={group.id} data-cut={cut}>
      <ServiceIcon group={group.id} cut={cut} />
      <div className="service-card-body">
        <span className="service-card-name" title={group.name}>
          {group.name}
        </span>
        <div className="service-card-foot">
          <span className="service-card-status">
            {single ? (
              <StatusLine view={views[0]!} />
            ) : views.every((v) => v.status.quiet) ? (
              <span className="service-row-status">Up</span>
            ) : (
              views.map((v) => <StatusLine key={v.id} view={v} prefix={group.rowLabels?.[v.id] ?? v.label} />)
            )}
          </span>
          <span className="service-card-buttons">
            {views.map((v) => (
              <CutButton key={v.id} view={v} keyLetter={single ? undefined : (group.buttonKeys?.[v.id] ?? v.label)} />
            ))}
          </span>
        </div>
      </div>
    </section>
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

/** "Remove cut": a cross, the cut taken off the plan. */
function UndoGlyph() {
  return (
    <svg className="service-glyph" viewBox="0 0 14 14" aria-hidden="true">
      <path d="M3.5 3.5 L10.5 10.5 M10.5 3.5 L3.5 10.5" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" />
    </svg>
  );
}
