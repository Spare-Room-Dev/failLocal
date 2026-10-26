import type { DisplayKind, Provenance, Quantity } from './quantity.js';
import { assessReadiness } from './readiness.js';
import type { ReadinessRow } from './readiness.js';
import type { Process, Register, Tier } from './schema.js';
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
  const hours = (value: number): string => `${value} ${value === 1 ? 'hour' : 'hours'}`;
  const shown = (q: Pick<Quantity, 'value' | 'unit' | 'provenance'>): string =>
    `${q.value} ${q.unit} ${label(q.provenance)}`;
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
        ? table(['Id', 'Name', 'Kind', 'On loss', 'Workaround'], dependencyRows(p))
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
    '',
    ...ordered.flatMap(processSection),
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
