import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { parse, stringify } from 'yaml';
import { parseRegister, renderContinuityPack } from '../src/index.js';
import { loadRegisterYaml } from '../src/yaml.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const registerPath = 'register/pilbara-model-site.yaml';
const register = loadRegisterYaml(readFileSync(join(root, registerPath), 'utf8'));
const pack = renderContinuityPack(register, '2026-10-26');

const LABEL_START = /\((sourced|measured|assumed|computed)\b/g;
const QUANTITY = /(?<![\w.-])\d+(\.\d+)?\s*(h|hours?|days?|t|tonnes?|USD|AUD)\b/g;

/** Replaces each display label, including any parentheses inside it, with a marker. */
function maskLabels(segment: string): string {
  let out = '';
  let i = 0;
  for (const m of segment.matchAll(LABEL_START)) {
    if (m.index < i) continue;
    out += segment.slice(i, m.index);
    let depth = 0;
    let j = m.index;
    do {
      if (segment[j] === '(') depth++;
      else if (segment[j] === ')') depth--;
      j++;
    } while (depth > 0 && j < segment.length);
    out += '\u0000';
    i = j;
  }
  return out + segment.slice(i);
}

/**
 * Quantities (hours, days, tonnes, USD) not immediately followed by a display label. Lines are split
 * into table cells on unescaped `|`, and cells into sentences, so a label elsewhere on the line
 * cannot cover a number.
 */
function unlabelledQuantities(text: string): string[] {
  const found: string[] = [];
  for (const line of text.split('\n')) {
    for (const cell of line.split(/(?<!\\)\|/)) {
      for (const sentence of cell.split(/(?<=\.)\s+/)) {
        const masked = maskLabels(sentence);
        for (const m of masked.matchAll(QUANTITY)) {
          if (!/^\s*\u0000/.test(masked.slice(m.index + m[0].length))) found.push(`${m[0]} in: ${line}`);
        }
      }
    }
  }
  return found;
}

function cli(...args: string[]) {
  const run = spawnSync('npx', ['tsx', 'engine/src/cli.ts', ...args], { cwd: root, encoding: 'utf8' });
  return { status: run.status, stdout: run.stdout, stderr: run.stderr };
}

function tempDir(): string {
  return mkdtempSync(join(tmpdir(), 'faillocal-'));
}

describe('renderContinuityPack', () => {
  test('pack lists every process with MTO and owner', () => {
    expect(pack).toContain('Generated 2026-10-26 by FailLocal from register pilbara-model-site.');
    for (const p of register.processes) {
      expect(pack, p.name).toContain(p.name);
      expect(pack, p.id).toContain(p.continuity.owner);
      const mto = p.continuity.maxTolerableOutage.value;
      expect(pack, p.id).toContain(mto === 1 ? '1 hour (' : `${mto} hours (`);
    }
  });

  test('pack puts processes in effective-tier order, high first', () => {
    const order = register.processes.map((p) => pack.indexOf(`## ${p.name}`));
    expect(order.every((i) => i >= 0)).toBe(true);
    const tierOf = (name: string) => /Tier: (high|medium|low)/.exec(pack.slice(pack.indexOf(`## ${name}`)))?.[1];
    const rank = { high: 0, medium: 1, low: 2 } as const;
    const tiers = [...register.processes]
      .sort((a, b) => pack.indexOf(`## ${a.name}`) - pack.indexOf(`## ${b.name}`))
      .map((p) => rank[tierOf(p.name) as keyof typeof rank]);
    expect(tiers).toEqual([...tiers].sort((a, b) => a - b));
  });

  test('pack tags every number with its display label', () => {
    expect(unlabelledQuantities(pack)).toEqual([]);
    expect(pack).toMatch(/\(assumed\)/);
    expect(pack).toMatch(/\(computed\)/);
  });

  test('pack labels a 1-hour limit in the singular', () => {
    const doc = structuredClone(register);
    const process = doc.processes[0]!;
    process.continuity.maxTolerableOutage.value = 1;
    process.continuity.recoveryTarget.value = 1;
    const text = renderContinuityPack(parseRegister(doc), '2026-10-26');
    expect(text).toContain('- Maximum tolerable outage: 1 hour (assumed)');
    expect(text).toContain('- Recovery target: 1 hour (assumed)');
    expect(text).toContain('limit 1 hour (assumed)');
    expect(unlabelledQuantities(text)).toEqual([]);
  });

  test('label checker rejects numbers a later label on the same line would have covered', () => {
    expect(unlabelledQuantities('| 3 hours | 4 hours (assumed) |')).toHaveLength(1);
    expect(unlabelledQuantities('Holds for 3 days, then 4 hours (assumed).')).toHaveLength(1);
    expect(unlabelledQuantities('- Output: 1 hour then 5 t (computed)')).toHaveLength(1);
    expect(unlabelledQuantities('Revenue 12 USD (computed) and 1 hour')).toHaveLength(1);
    expect(unlabelledQuantities('| 1 hour (assumed) | 7 days (sourced: Foo (May 2026)) | 2.5 tonnes (computed) |')).toEqual([]);
  });

  test('pack renders sourced and measured labels with the source title and run', () => {
    const doc = structuredClone(register);
    const source = doc.sources[0]!;
    const process = doc.processes[0]!;
    process.continuity.maxTolerableOutage.provenance = { kind: 'sourced', source: source.id };
    process.continuity.lastRestoreTest = {
      date: '2026-09-01',
      result: 'pass',
      provenance: { kind: 'measured', runId: 'lab-run-7', date: '2026-09-01', evidence: 'restore log' },
    };
    const text = renderContinuityPack(parseRegister(doc), '2026-10-26');
    expect(text).toContain(`${process.continuity.maxTolerableOutage.value} hours (sourced: ${source.title})`);
    expect(text).toContain('pass on 2026-09-01 (measured: lab-run-7, 2026-09-01)');
  });

  test('pack states that the continuity fields describe the baseline site', () => {
    expect(pack).toContain('describe the baseline (unprepared) site');
  });

  test('pack explains that vendor monitoring protects what the vendor can reach', () => {
    expect(pack).toContain('a vendor-monitoring control protects the processes that depend on the assets that vendor can reach');
  });

  test('pack shows the independent copy on the baseline and the prepared site', () => {
    const section = (name: string) => pack.slice(pack.indexOf(`## ${name}\n`)).split('\n## ')[0]!;
    expect(section('Diesel ordering')).toContain(
      '- Independent copy: no on the baseline site; yes on the prepared site (independent-erp-restore, assumed)',
    );
    expect(section('Haulage')).toContain('- Independent copy: no (baseline and prepared)');

    const doc = structuredClone(register);
    doc.processes.find((p) => p.id === 'diesel-ordering')!.continuity.independentCopy = true;
    const text = renderContinuityPack(parseRegister(doc), '2026-10-26');
    expect(text.slice(text.indexOf('## Diesel ordering\n'))).toContain('- Independent copy: yes (baseline and prepared)');
    expect(unlabelledQuantities(text)).toEqual([]);
  });

  test('pack lists each resilience control with its effects, assets and capability', () => {
    const start = pack.indexOf('## Resilience controls (prepared site)');
    expect(start).toBeGreaterThan(pack.indexOf(`## ${register.processes[0]!.name}`));
    const section = pack.slice(start, pack.indexOf('## Asset tiers'));
    expect(register.controls.length).toBeGreaterThan(0);
    for (const c of register.controls) {
      const block = section.slice(section.indexOf(`### ${c.name}\n`)).split('\n### ')[0]!;
      expect(block, c.id).toContain(`- Id: ${c.id}`);
      for (const e of c.effects) {
        expect(block, c.id).toContain(`  - ${e.kind}: `);
        expect(block, c.id).toContain(`[${e.service}]`);
        const time = e.kind === 'fallback' ? e.delay : e.kind === 'reconcile' ? undefined : e.duration;
        if (time) expect(block, c.id).toMatch(new RegExp(`${time.value} hours? \\((assumed|sourced|measured)`));
      }
      for (const a of c.assets ?? []) expect(block, c.id).toContain(`[${a}]`);
      expect(block, c.id).toContain(`- Capability: ${c.capability.works ? 'works' : 'does not work'} (`);
    }
  });

  test('pack shows a post-restore hold and the reconcile control that removes it, with labelled numbers', () => {
    const doc = structuredClone(register);
    const ordering = doc.processes.find((p) => p.id === 'diesel-ordering')!;
    ordering.dependsOn.find((d) => d.on === 'hosted-erp')!.afterRestore = {
      description: 'New purchase orders held while transactions are reconciled by hand',
      holdFor: { value: 24, unit: 'hours', provenance: { kind: 'assumed', reasoning: 'test' } },
    };
    doc.controls = doc.controls.filter((c) => c.id !== 'duplicate-rejection');
    doc.controls.push({
      id: 'duplicate-rejection',
      name: 'Duplicate rejection',
      description: 'Stale and duplicate transactions are rejected automatically.',
      effects: [{ kind: 'reconcile', process: 'diesel-ordering', service: 'hosted-erp' }],
      capability: { works: true, provenance: { kind: 'assumed', reasoning: 'test' }, measurements: [] },
    });
    const text = renderContinuityPack(parseRegister(doc), '2026-10-26');
    expect(text).toContain(
      'New purchase orders held while transactions are reconciled by hand. Held for 24 hours (assumed) after the service is back.',
    );
    expect(text).toContain(
      '  - reconcile: Diesel ordering [diesel-ordering] recovers as soon as Hosted ERP (finance, purchasing, maintenance, payroll) [hosted-erp] is back, without its 24 hours (assumed) post-restore hold.',
    );
    expect(unlabelledQuantities(text)).toEqual([]);
  });

  test('pack states the site is fictional', () => {
    expect(pack).toMatch(/^Fictional model site\. Generated 2026-10-26/m);
  });

  test('pack never calls revenue or production lost', () => {
    expect(pack).not.toMatch(/\blost (revenue|production|tonnes)\b|\b(revenue|production|tonnes) (is |was )?lost\b/i);
  });

  test('pack is deterministic and ends with the sources list', () => {
    expect(renderContinuityPack(register, '2026-10-26')).toBe(pack);
    const sources = pack.slice(pack.indexOf('## Sources'));
    for (const s of register.sources) expect(sources).toContain(s.title);
  });
});

describe('cli', { timeout: 20_000 }, () => {
  test('cli validate exits 0 on the model site', () => {
    const run = cli('validate', registerPath);
    expect(run.status, run.stderr).toBe(0);
  });

  test('cli validate exits 1 and prints each issue on a broken register', () => {
    const doc = parse(readFileSync(join(root, registerPath), 'utf8'));
    doc.processes[0].dependsOn[0].on = 'dangling-one';
    doc.processes[1].dependsOn.push({ on: 'dangling-two', onLoss: 'stop' });
    const file = join(tempDir(), 'broken.yaml');
    writeFileSync(file, stringify(doc));

    const run = cli('validate', file);
    expect(run.status).toBe(1);
    const lines = run.stderr.split('\n');
    expect(lines.filter((l) => l.includes('dangling-one'))).toHaveLength(1);
    expect(lines.filter((l) => l.includes('dangling-two'))).toHaveLength(1);
  });

  test('cli exits 2 with usage on an unknown command', () => {
    const run = cli('frobnicate');
    expect(run.status).toBe(2);
    expect(run.stderr).toMatch(/usage/i);
  });

  test('cli exits 2 with usage when an option has no value', () => {
    const run = cli('simulate', registerPath, '--variant', 'prepared', '--scenario');
    expect(run.status).toBe(2);
    expect(run.stderr).toMatch(/usage/i);
  });

  test('cli simulate --json prints a Timeline', () => {
    const scenarioId = register.scenarios[0]!.id;
    const run = cli('simulate', registerPath, '--scenario', scenarioId, '--variant', 'unprepared', '--json');
    expect(run.status, run.stderr).toBe(0);
    const timeline = JSON.parse(run.stdout);
    expect(timeline.scenarioId).toBe(scenarioId);
    expect(timeline.variant).toBe('unprepared');
    expect(timeline.samples.length).toBeGreaterThan(1);
  });

  test('cli simulate prints a human summary without --json', () => {
    const scenarioId = register.scenarios[0]!.id;
    const run = cli('simulate', registerPath, '--scenario', scenarioId, '--variant', 'prepared');
    expect(run.status, run.stderr).toBe(0);
    expect(run.stdout).toMatch(/^Fictional model site/);
    expect(run.stdout).toContain(scenarioId);
    expect(run.stdout).toContain('prepared');
    expect(run.stdout).toMatch(/revenue at risk/i);
    expect(run.stdout).toMatch(/production deferred/i);
  });

  test('cli simulate exits 1 on an unknown scenario', () => {
    const run = cli('simulate', registerPath, '--scenario', 'no-such-scenario', '--variant', 'prepared');
    expect(run.status).toBe(1);
    expect(run.stderr).toContain('no-such-scenario');
  });

  test('cli pack writes the file', () => {
    const out = join(tempDir(), 'nested', 'pack.md');
    const run = cli('pack', registerPath, '--out', out);
    expect(run.status, run.stderr).toBe(0);
    const written = readFileSync(out, 'utf8');
    expect(written).toMatch(/^# /);
    expect(written).toMatch(/Generated \d{4}-\d{2}-\d{2} by FailLocal from register pilbara-model-site\./);
  });
});
