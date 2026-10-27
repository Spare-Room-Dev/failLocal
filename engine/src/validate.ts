import { parse } from 'yaml';
import type { z } from 'zod';
import { ID_PATTERN, registerSchema, scenarioSchema } from './schema.js';
import type { Register, Scenario } from './schema.js';

export class RegisterError extends Error {
  constructor(public issues: string[]) {
    super(issues.join('\n'));
    this.name = 'RegisterError';
  }
}

type Kind = 'process' | 'asset' | 'service' | 'stock';

interface Index {
  kinds: Map<string, Kind>;
  sources: Set<string>;
  /** The declared `reaches` of each service that has one. */
  reaches: Map<string, string[]>;
  duplicates: string[];
}

/**
 * How the list entry `item` at index `i` appears in a path, as paths.ts names it: by its id (a
 * dependency by its target), or by index when it has none or the id is not path-safe.
 */
function entryKey(item: unknown, i: number): string {
  const entry = item as { id?: unknown; on?: unknown } | null | undefined;
  const key = typeof entry?.id === 'string' ? entry.id : typeof entry?.on === 'string' ? entry.on : undefined;
  return key !== undefined && ID_PATTERN.test(key) ? `.${key}` : `[${i}]`;
}

/** The id-keyed path of a zod issue, read against the `input` that was parsed. */
function issuePath(input: unknown, path: PropertyKey[], prefix: string): string {
  let where = prefix;
  let node = input;
  for (const p of path) {
    if (typeof p === 'number') where += Array.isArray(node) ? entryKey(node[p], p) : `[${p}]`;
    else where = where ? `${where}.${String(p)}` : String(p);
    node = node && typeof node === 'object' ? (node as Record<PropertyKey, unknown>)[p] : undefined;
  }
  return where;
}

function zodIssues(error: z.ZodError, input: unknown, prefix = ''): string[] {
  return error.issues.map((i) => `${issuePath(input, i.path, prefix) || '(register)'}: ${i.message}`);
}

/** Depth-first order with dependencies first, plus every cycle found as an id path that closes on itself. */
function dependencyOrder(ids: string[], deps: (id: string) => string[]): { order: string[]; cycles: string[][] } {
  const members = new Set(ids);
  const state = new Map<string, 'open' | 'done'>();
  const stack: string[] = [];
  const order: string[] = [];
  const cycles: string[][] = [];
  const visit = (node: string): void => {
    state.set(node, 'open');
    stack.push(node);
    for (const dep of deps(node).filter((d) => members.has(d))) {
      const s = state.get(dep);
      if (s === 'open') cycles.push([...stack.slice(stack.indexOf(dep)), dep]);
      else if (!s) visit(dep);
    }
    stack.pop();
    state.set(node, 'done');
    order.push(node);
  };
  for (const node of ids) if (!state.has(node)) visit(node);
  return { order, cycles };
}

function processGraph(r: Register) {
  const byId = new Map(r.processes.map((p) => [p.id, p]));
  return dependencyOrder(
    r.processes.map((p) => p.id),
    (id) => (byId.get(id)?.dependsOn ?? []).map((d) => d.on),
  );
}

function serviceGraph(r: Register) {
  const byId = new Map(r.services.map((s) => [s.id, s]));
  return dependencyOrder(
    r.services.map((s) => s.id),
    (id) => byId.get(id)?.requires ?? [],
  );
}

function buildIndex(r: Register): Index {
  const duplicates: string[] = [];
  const kinds = new Map<string, Kind>();
  const claim = (kind: Kind, items: { id: string }[]) => {
    for (const { id } of items) {
      const prior = kinds.get(id);
      if (prior) duplicates.push(`duplicate id '${id}': used by a ${prior} and a ${kind}`);
      else kinds.set(id, kind);
    }
  };
  claim('process', r.processes);
  claim('asset', r.assets);
  claim('service', r.services);
  claim('stock', r.stocks);

  // These have their own namespaces, but their ids key paths too.
  const unique = (label: string, items: { id: string }[]) => {
    const seen = new Set<string>();
    for (const { id } of items) {
      if (seen.has(id)) duplicates.push(`duplicate ${label} id '${id}'`);
      seen.add(id);
    }
  };
  unique('source', r.sources);
  unique('control', r.controls);
  unique('scenario', r.scenarios);
  const reaches = new Map(r.services.flatMap((s) => (s.reaches ? [[s.id, s.reaches] as const] : [])));
  return { kinds, sources: new Set(r.sources.map((s) => s.id)), reaches, duplicates };
}

function refAny(ix: Index, issues: string[], where: string, id: string): void {
  if (!ix.kinds.has(id)) issues.push(`${where}: unknown id '${id}'`);
}

const article = (kind: Kind): string => (kind === 'asset' ? 'an' : 'a');

function ref(ix: Index, issues: string[], where: string, id: string, expected: Kind): void {
  const found = ix.kinds.get(id);
  if (!found) issues.push(`${where}: unknown ${expected} '${id}'`);
  else if (found !== expected) issues.push(`${where}: '${id}' is ${article(found)} ${found}, expected ${article(expected)} ${expected}`);
}

/** Every provenance in the register sits under a `provenance` key; check each `sourced` one cites a listed source. */
function checkSourcedProvenance(node: unknown, where: string, ix: Index, issues: string[]): void {
  if (Array.isArray(node)) {
    node.forEach((item, i) => checkSourcedProvenance(item, `${where}${entryKey(item, i)}`, ix, issues));
  } else if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      const path = where ? `${where}.${key}` : key;
      const p = value as { kind?: unknown; source?: unknown } | null;
      if (key === 'provenance' && p?.kind === 'sourced') {
        if (typeof p.source === 'string' && !ix.sources.has(p.source)) {
          issues.push(`${path}: cites unknown source '${p.source}'`);
        }
      } else {
        checkSourcedProvenance(value, path, ix, issues);
      }
    }
  }
}

function checkScenarioRefs(s: Scenario, where: string, ix: Index, issues: string[]): void {
  for (const src of s.basis) {
    if (!ix.sources.has(src)) issues.push(`${where}.basis: unknown source '${src}'`);
  }
  s.events.forEach((e, i) => {
    const at = `${where}.events[${i}]`;
    if (e.kind === 'cut-service') {
      ref(ix, issues, `${at}.service`, e.service, 'service');
    } else {
      ref(ix, issues, `${at}.via`, e.via, 'service');
      ref(ix, issues, `${at}.target`, e.target, 'asset');
      const reach = ix.reaches.get(e.via);
      if (reach && !reach.includes(e.target)) issues.push(`${at}.target: '${e.via}' cannot reach '${e.target}'`);
    }
  });
  checkSourcedProvenance(s, where, ix, issues);
}

function semanticIssues(r: Register): string[] {
  const ix = buildIndex(r);
  const issues: string[] = [...ix.duplicates];

  for (const p of r.processes) {
    const seen = new Set<string>();
    p.dependsOn.forEach((d) => {
      const where = `processes.${p.id}.dependsOn.${d.on}`;
      if (seen.has(d.on)) issues.push(`${where}: duplicate dependency`);
      seen.add(d.on);
      refAny(ix, issues, where, d.on);
      if (d.manualWorkaround && ix.kinds.has(d.on) && ix.kinds.get(d.on) !== 'service') {
        issues.push(`${where}: a manual workaround is only allowed on a service dependency`);
      }
      if (d.afterRestore && ix.kinds.has(d.on) && ix.kinds.get(d.on) !== 'service') {
        issues.push(`${where}: a post-restore hold is only allowed on a service dependency`);
      }
    });
  }

  for (const s of r.services) {
    for (const req of s.requires ?? []) ref(ix, issues, `services.${s.id}.requires`, req, 'service');
    for (const a of s.reaches ?? []) ref(ix, issues, `services.${s.id}.reaches`, a, 'asset');
  }

  for (const s of r.stocks) {
    ref(ix, issues, `stocks.${s.id}.replenishedBy`, s.replenishedBy, 'process');
    for (const c of s.consumedBy) ref(ix, issues, `stocks.${s.id}.consumedBy`, c, 'process');
    if (s.initial.value > s.capacity.value) {
      issues.push(`stocks.${s.id}.initial: initial (${s.initial.value}) exceeds capacity (${s.capacity.value})`);
    }
    if (s.lowThreshold.value > s.capacity.value) {
      issues.push(`stocks.${s.id}.lowThreshold: low threshold (${s.lowThreshold.value}) exceeds capacity (${s.capacity.value})`);
    }
  }

  for (const c of r.controls) {
    c.effects.forEach((e, i) => {
      const at = `controls.${c.id}.effects[${i}]`;
      ref(ix, issues, `${at}.service`, e.service, 'service');
      if (e.kind === 'fallback' || e.kind === 'reconcile') ref(ix, issues, `${at}.process`, e.process, 'process');
    });
    for (const a of c.assets ?? []) ref(ix, issues, `controls.${c.id}.assets`, a, 'asset');
  }

  for (const s of r.scenarios) checkScenarioRefs(s, `scenarios.${s.id}`, ix, issues);

  ref(ix, issues, 'production.shippingProcess', r.production.shippingProcess, 'process');

  // Sourced provenance outside scenarios (those were checked above).
  const { scenarios: _scenarios, ...rest } = r;
  checkSourcedProvenance(rest, '', ix, issues);

  for (const c of processGraph(r).cycles) issues.push(`dependency cycle: ${c.join(' -> ')}`);
  for (const c of serviceGraph(r).cycles) issues.push(`service requires cycle: ${c.join(' -> ')}`);
  return issues;
}

/** Validates the shape (zod), then every cross-reference, provenance citation, stock bound and cycle; throws one RegisterError listing all issues. */
export function parseRegister(input: unknown): Register {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) throw new RegisterError(zodIssues(parsed.error, input));
  const issues = semanticIssues(parsed.data);
  if (issues.length) throw new RegisterError(issues);
  return parsed.data;
}

export function loadRegisterYaml(text: string): Register {
  return parseRegister(parse(text));
}

/** Process ids with dependencies first. Stock-mediated loops are fine: they read the previous step's levels. */
export function processOrder(r: Register): string[] {
  const { order, cycles } = processGraph(r);
  if (cycles.length) throw new RegisterError(cycles.map((c) => `dependency cycle: ${c.join(' -> ')}`));
  return order;
}

/** Scenario-level checks (shape, §5.3, references) for a scenario that is not in the register. */
export function checkScenario(r: Register, s: Scenario): void {
  const where = `scenarios.${s?.id ?? '(unnamed)'}`;
  const parsed = scenarioSchema.safeParse(s);
  if (!parsed.success) throw new RegisterError(zodIssues(parsed.error, s, where));
  const issues: string[] = [];
  const ix = buildIndex(r);
  checkScenarioRefs(parsed.data, where, ix, issues);
  if (issues.length) throw new RegisterError(issues);
}
