import { useId } from 'react';
import type { Timeline, Unit, UsedInput } from '@faillocal/engine';
import type { QtyKind } from '../model/format.js';
import { register } from '../model/register.js';
import { actions, appStore, useStore } from '../model/store.js';
import { Qty } from './Qty.js';
import { useMediaQuery } from './useMediaQuery.js';
import { parseDraft, useDraft } from './useDraft.js';
import './editor.css';

const DESKTOP = '(min-width: 761px)';
const PHONE_NOTE = 'Best on a laptop: the assumptions editor needs a wider screen.';

const GROUPS = ['Production', 'Stocks', 'Purchasing hold', 'Workarounds', 'Controls', 'Continuity'] as const;
type Group = (typeof GROUPS)[number];

interface Row {
  path: string;
  group: Group;
  label: string;
  used: UsedInput;
}

/** How each unit the editor shows is formatted, and the input step it gets (every register value is a multiple). */
const UNITS: Partial<Record<Unit, { kind: QtyKind; step: number; max?: number }>> = {
  hours: { kind: 'hours', step: 0.5 },
  days: { kind: 'days', step: 0.125 },
  fraction: { kind: 'fraction', step: 0.01, max: 1 },
  'Mt/a': { kind: 'mtpa', step: 1 },
  'USD/t': { kind: 'usdPerT', step: 0.1 },
};

const STOCK_FIELDS: Record<string, string> = {
  initial: 'level at the start',
  capacity: 'capacity',
  leadTime: 'order lead time',
  lowThreshold: 'counts as low at',
};

const CONTINUITY_FIELDS: Record<string, string> = {
  maxTolerableOutage: 'longest outage it can take',
  recoveryTarget: 'recovery target',
};

function named<T extends { id: string; name: string }>(list: T[], id: string, what: string): string {
  const found = list.find((x) => x.id === id);
  if (!found) throw new Error(`register has no ${what} ${id}`);
  return found.name;
}

const processName = (id: string) => named(register.processes, id, 'process');
/** A dependency target's name: a service or an asset. */
const targetName = (id: string) =>
  register.services.some((s) => s.id === id) ? named(register.services, id, 'service') : named(register.assets, id, 'asset');

function productionLabel(field: string): string {
  if (field === 'annualTonnes') return 'Annual production';
  if (field === 'price') return 'Ore price';
  if (field === 'degradedOutput') return `Shipping while ${processName(register.production.shippingProcess).toLowerCase()} is degraded`;
  throw new Error(`unknown production input ${field}`);
}

function controlLabel(controlId: string, effectIndex: number): string {
  const control = register.controls.find((c) => c.id === controlId);
  const effect = control?.effects[effectIndex];
  if (!control || !effect) throw new Error(`register has no effect ${effectIndex} on control ${controlId}`);
  const service = targetName(effect.service);
  if (effect.kind === 'fallback') return `${control.name}: delay before covering ${service}`;
  if (effect.kind === 'restore') return `${control.name}: time to restore ${service}`;
  if (effect.kind === 'detect-and-revoke') return `${control.name}: time to cut ${service}`;
  throw new Error(`control ${controlId} effect ${effectIndex} has no duration`);
}

/**
 * The editor row for `path`, or null when the editor does not offer it. Workaround durations are
 * offered only for services the run takes down or revokes, and control durations only on a prepared run.
 */
function rowFor(path: string, used: UsedInput, touched: Set<string>, prepared: boolean): Row | null {
  let m: RegExpExecArray | null;
  const row = (group: Group, label: string): Row => ({ path, group, label, used });
  if ((m = /^production\.(\w+)$/.exec(path))) return row('Production', productionLabel(m[1]!));
  if ((m = /^stocks\.([^.]+)\.(initial|capacity|leadTime|lowThreshold)$/.exec(path)))
    return row('Stocks', `${named(register.stocks, m[1]!, 'stock')}: ${STOCK_FIELDS[m[2]!]}`);
  if ((m = /^processes\.([^.]+)\.dependsOn\.([^.]+)\.afterRestore\.holdFor$/.exec(path)))
    return row('Purchasing hold', `${processName(m[1]!)}: held after ${targetName(m[2]!)} returns`);
  if ((m = /^processes\.([^.]+)\.dependsOn\.([^.]+)\.manualWorkaround\.holdsFor$/.exec(path)))
    return touched.has(m[2]!) ? row('Workarounds', `${processName(m[1]!)}: workaround without ${targetName(m[2]!)}`) : null;
  if ((m = /^controls\.([^.]+)\.effects\[(\d+)\]\.(duration|delay)$/.exec(path)))
    return prepared ? row('Controls', controlLabel(m[1]!, Number(m[2]))) : null;
  if ((m = /^processes\.([^.]+)\.continuity\.(\w+)$/.exec(path)))
    return row('Continuity', `${processName(m[1]!)}: ${CONTINUITY_FIELDS[m[2]!]}`);
  return null;
}

/** The services the run takes down or revokes. */
function touchedServices(timeline: Timeline): Set<string> {
  return new Set(timeline.events.filter((e) => e.kind === 'service-down' || e.kind === 'access-revoked').map((e) => e.subject));
}

/** Whether `issue` names `path` itself, not a longer path that starts with it. */
function names(issue: string, path: string): boolean {
  const at = issue.indexOf(path);
  return at >= 0 && !/[\w\-[]/.test(issue.charAt(at + path.length));
}

/**
 * An engine issue on `path` as the visitor reads it: the leading path (and its `.value`) becomes the
 * row's label, so "production.price.value: Number must be…" reads "Ore price: must be…". An issue that
 * does not start with the path is left as it is.
 */
function issueText(issue: string, path: string, label: string): string {
  if (!issue.startsWith(path)) return issue;
  const rest = issue.slice(path.length).replace(/^\.value/, '').replace(/^:\s*(Number\s+)?/, '');
  return `${label}: ${rest}`;
}

interface RowProps {
  row: Row;
  override: number | undefined;
  issues: string[];
  sources: Record<string, string>;
}

function EditorRow({ row, override, issues, sources }: RowProps) {
  const { path, label, used } = row;
  const unit = UNITS[used.unit];
  if (!unit) throw new Error(`the editor has no format for ${used.unit} (${path})`);
  const [draft, setDraft] = useDraft(override ?? used.value);
  const issueId = useId();

  return (
    <div className="editor-row" data-path={path}>
      <label className="editor-label">
        <span>{label}</span>
        <input
          type="number"
          min={0}
          max={unit.max}
          step={unit.step}
          value={draft}
          aria-invalid={issues.length > 0}
          aria-describedby={issues.length > 0 ? issueId : undefined}
          onChange={(e) => {
            setDraft(e.target.value);
            const value = parseDraft(e.target.value);
            if (Number.isFinite(value)) actions.setOverride(path, value);
          }}
        />
      </label>
      <span className="editor-current">
        <Qty value={used.value} kind={unit.kind} display={used.provenance.kind} provenance={used.provenance} overridden={used.overridden} sources={sources} />
      </span>
      {override !== undefined && (
        <button type="button" className="editor-reset" aria-label={`Reset ${label}`} onClick={() => actions.setOverride(path, null)}>
          Reset
        </button>
      )}
      {issues.length > 0 && (
        <p id={issueId} className="editor-issue" role="alert" data-message data-path={path}>
          {issues.map((issue) => issueText(issue, path, label)).join(' ')}
        </p>
      )}
    </div>
  );
}

/**
 * The inputs the current run used, editable (desktop only). Each row shows the value the last good
 * run used, with its tag, beside an input; a value goes to the store once it parses. A value the run
 * refuses stays in the field with its issues beside it (the store's `fieldIssues`), and the site stays
 * on the last good run. Issues on a path with no row, and those of a failed run, show above the rows.
 * Renders only in free play.
 */
export function AssumptionsEditor() {
  const mode = useStore(appStore, (s) => s.mode);
  const timeline = useStore(appStore, (s) => s.lastGood);
  const overrides = useStore(appStore, (s) => s.overrides);
  const issues = useStore(appStore, (s) => s.issues);
  const fieldIssues = useStore(appStore, (s) => s.fieldIssues);
  const desktop = useMediaQuery(DESKTOP);
  if (mode !== 'free' || !timeline) return null;
  if (!desktop) return <p className="editor-phone-note">{PHONE_NOTE}</p>;

  const touched = touchedServices(timeline);
  const rows = Object.entries(timeline.assumptionsUsed).flatMap(([path, used]) => rowFor(path, used, touched, timeline.variant === 'prepared') ?? []);
  const sources = Object.fromEntries(register.sources.map((s) => [s.id, s.title]));
  const rowIssues = (path: string) => [...(fieldIssues[path] ?? []), ...issues.filter((issue) => names(issue, path))];
  const unplaced = [
    ...Object.entries(fieldIssues).flatMap(([path, list]) => (rows.some((r) => r.path === path) ? [] : list)),
    ...issues.filter((issue) => !rows.some((r) => names(issue, r.path))),
  ];

  return (
    <section className="editor" aria-label="Assumptions">
      <div className="editor-head">
        <h2 className="editor-title">Assumptions</h2>
        <button type="button" className="editor-reset-all" onClick={() => actions.clearOverrides()}>
          Reset all
        </button>
      </div>
      {unplaced.length > 0 && (
        <ul className="editor-issue" role="alert" data-message>
          {unplaced.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      )}
      {GROUPS.map((group) => {
        const inGroup = rows.filter((r) => r.group === group);
        if (inGroup.length === 0) return null;
        return (
          <div key={group} className="editor-group">
            <h3 className="editor-group-heading">{group}</h3>
            {inGroup.map((row) => (
              <EditorRow
                key={row.path}
                row={row}
                override={overrides[row.path]}
                issues={rowIssues(row.path)}
                sources={sources}
              />
            ))}
          </div>
        );
      })}
    </section>
  );
}
