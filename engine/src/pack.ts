import type { DisplayKind, Provenance, Quantity } from './quantity.js';
import { assessReadiness } from './readiness.js';
import type { ReadinessRow } from './readiness.js';
import type { Control, ControlEffect, Process, Register, Tier } from './schema.js';
import { deriveAssetTiers, effectiveProcessTiers } from './tiers.js';

const TIER_ORDER: Tier[] = ['high', 'medium', 'low'];

/**
 * The continuity pack as Markdown. Pure and deterministic: `generatedOn` (yyyy-mm-dd) is a parameter.
 * Every number is followed by its display label: sourced, measured, assumed, or computed for
 * anything the engine derives. PDF output is Plan 4.
 */
export function renderContinuityPack(r: Register, generatedOn: string): string {
  const sourceTitle = new Map(r.sources.map((s) => [s.id, s.title]));
  const scenarioById = new Map(r.scenarios.map((s) => [s.id, s]));
  const processById = new Map(r.processes.map((p) => [p.id, p]));
  const effective = effectiveProcessTiers(r);
  const readiness = assessReadiness(r);

  const label = (kind: Provenance | Extract<DisplayKind, 'computed'>): string => {
    if (kind === 'computed') return '(computed)';
    switch (kind.kind) {
      case 'sourced':
        return `(sourced: ${sourceTitle.get(kind.source) ?? kind.source})`;
      case 'measured':
        return `(measured: ${kind.runId}, ${kind.date})`;
      case 'assumed':
        return '(assumed)';
    }
  };
  const unitName = (value: number, unit: string): string =>
    value === 1 && (unit === 'hours' || unit === 'days') ? unit.slice(0, -1) : unit;
  const hours = (value: number): string => `${value} ${unitName(value, 'hours')}`;
  const shown = (q: Pick<Quantity, 'value' | 'unit' | 'provenance'>): string =>
    `${q.value} ${unitName(q.value, q.unit)} ${label(q.provenance)}`;
  const cell = (text: string): string => text.replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ');
  const table = (head: string[], rows: string[][]): string[] => [
    `| ${head.join(' | ')} |`,
    `| ${head.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map(cell).join(' | ')} |`),
  ];

  const describe = (id: string): { name: string; kind: string } => {
    const process = processById.get(id);
    if (process) return { name: process.name, kind: 'process' };
    const service = r.services.find((x) => x.id === id);
    if (service) return { name: service.name, kind: `service (${service.kind})` };
    const asset = r.assets.find((x) => x.id === id);
    if (asset) return { name: asset.name, kind: `asset (${asset.type})` };
    return { name: r.stocks.find((x) => x.id === id)?.name ?? id, kind: 'stock' };
  };

  const dependencyRows = (p: Process): string[][] =>
    p.dependsOn.map((d) => {
      const target = describe(d.on);
      return [
        d.on,
        target.name,
        target.kind,
        d.onLoss === 'stop' ? 'stops' : 'degrades',
        d.manualWorkaround
          ? `${d.manualWorkaround.description.replace(/\.?\s*$/, '.')} Holds for ${shown(d.manualWorkaround.holdsFor)}.`
          : 'none',
        d.afterRestore
          ? `${d.afterRestore.description.replace(/\.?\s*$/, '.')} Held for ${shown(d.afterRestore.holdFor)} after the service is back.`
          : 'none',
      ];
    });

  const readinessRows = (p: Process, rows: ReadinessRow[]): string[][] =>
    rows.map((row) => {
      const scenario = scenarioById.get(row.scenarioId);
      const against = (ok: boolean, limit: Process['continuity']['maxTolerableOutage']): string =>
        `${ok ? '✓' : '✗'} limit ${hours(limit.value)} ${label(limit.provenance)}`;
      return [
        `${scenario?.title ?? row.scenarioId}${scenario?.projection ? ' (projection)' : ''}`,
        row.variant,
        `${hours(row.longestOutageHours)} ${label('computed')}`,
        against(row.withinTolerance, p.continuity.maxTolerableOutage),
        against(row.withinRecoveryTarget, p.continuity.recoveryTarget),
      ];
    });

  const processSection = (p: Process): string[] => {
    const c = p.continuity;
    const tier =
      effective[p.id] === p.tier
        ? p.tier
        : `${effective[p.id]} (own tier ${p.tier}, raised because higher-tier work relies on it)`;
    const test = c.lastRestoreTest
      ? `${c.lastRestoreTest.result} on ${c.lastRestoreTest.date} ${label(c.lastRestoreTest.provenance)}`
      : 'none recorded';
    return [
      `## ${p.name}`,
      '',
      `- Tier: ${tier}`,
      `- Safety function: ${p.safetyFunction}`,
      `- Production consequence: ${p.productionConsequence}`,
      `- Maximum tolerable outage: ${shown(c.maxTolerableOutage)}`,
      `- Recovery target: ${shown(c.recoveryTarget)}`,
      `- Owner: ${c.owner}`,
      `- Independent copy: ${c.independentCopy ? 'yes' : 'no'}`,
      `- Last restore test: ${test}`,
      '',
      '### Dependencies',
      '',
      ...(p.dependsOn.length
        ? table(['Id', 'Name', 'Kind', 'On loss', 'Workaround', 'After restore'], dependencyRows(p))
        : ['This process depends on nothing else in the model.']),
      '',
      '### Readiness',
      '',
      ...table(
        ['Scenario', 'Variant', 'Longest outage', 'Against maximum tolerable outage', 'Against recovery target'],
        readinessRows(
          p,
          readiness.filter((row) => row.processId === p.id),
        ),
      ),
      '',
    ];
  };

  const named = (id: string): string => `${describe(id).name} [${id}]`;

  const effectLine = (e: ControlEffect): string => {
    switch (e.kind) {
      case 'restore':
        return `  - restore: ${named(e.service)} is back ${shown(e.duration)} after its outage starts.`;
      case 'fallback':
        return `  - fallback: ${named(e.process)} keeps running, degraded, without ${named(e.service)}, taking over ${
          e.delay ? `${shown(e.delay)} after the outage starts` : 'at once'
        }.`;
      case 'reconcile': {
        const hold = processById.get(e.process)?.dependsOn.find((d) => d.on === e.service)?.afterRestore?.holdFor;
        return `  - reconcile: ${named(e.process)} recovers as soon as ${named(e.service)} is back, without ${
          hold ? `its ${shown(hold)} post-restore hold` : 'a post-restore hold'
        }.`;
      }
      case 'detect-and-revoke':
        return `  - detect-and-revoke: a compromise via ${named(e.service)} is detected and that access cut ${shown(e.duration)} after it starts.`;
    }
  };

  const controlSection = (c: Control): string[] => [
    `### ${c.name}`,
    '',
    `- Id: ${c.id}`,
    '- Effects:',
    ...c.effects.map(effectLine),
    `- Relies on assets: ${c.assets?.length ? c.assets.map(named).join(', ') : 'none'}`,
    `- Capability: ${c.capability.works ? 'works' : 'does not work'} ${label(c.capability.provenance)}`,
    '',
  ];

  const ordered = TIER_ORDER.flatMap((tier) => r.processes.filter((p) => effective[p.id] === tier));
  const assetTiers = deriveAssetTiers(r);
  const orderedAssets = TIER_ORDER.flatMap((tier) => r.assets.filter((a) => assetTiers[a.id] === tier));

  return [
    `# Continuity pack: ${r.site.name}`,
    '',
    `Fictional model site. Generated ${generatedOn} by FailLocal from register ${r.site.id}.`,
    '',
    r.site.description,
    '',
    'Every number is followed by where it comes from: sourced (a published source), measured (a lab run), assumed (a modelling choice, recorded in the decision log) or computed (worked out by the simulation).',
    'Readiness compares the longest time a process was not running normally in each scenario with its limits. Each scenario is run unprepared (no continuity controls) and prepared (controls applied).',
    'The continuity fields of each process (maximum tolerable outage, recovery target, owner, independent copy, last restore test) describe the baseline (unprepared) site. The controls the prepared site adds are listed under Resilience controls.',
    '',
    ...ordered.flatMap(processSection),
    '## Resilience controls (prepared site)',
    '',
    'The prepared run applies each control whose capability works, and only while the assets it relies on are up. The unprepared run applies none of them.',
    '',
    ...(r.controls.length ? r.controls.flatMap(controlSection) : ['The register has no resilience controls.', '']),
    '## Asset tiers',
    '',
    'An asset takes the highest tier of any process that depends on it, or that a control relying on it protects.',
    '',
    ...table(
      ['Id', 'Name', 'Type', 'Zone', 'Tier'],
      orderedAssets.map((a) => [a.id, a.name, a.type, a.zone, assetTiers[a.id] as string]),
    ),
    '',
    '## Sources',
    '',
    ...r.sources.map((s) => `- ${s.title}. ${s.url} (accessed ${s.accessed})`),
    '',
  ].join('\n');
}
