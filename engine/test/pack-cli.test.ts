import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { parse, stringify } from 'yaml';
import { loadRegisterYaml, parseRegister, renderContinuityPack } from '../src/index.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const registerPath = 'register/pilbara-model-site.yaml';
const register = loadRegisterYaml(readFileSync(join(root, registerPath), 'utf8'));
const pack = renderContinuityPack(register, '2026-10-26');

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
      expect(pack, p.id).toContain(`${p.continuity.maxTolerableOutage.value} hours`);
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
    const unlabelled = pack
      .split('\n')
      .filter((line) => /\d+(\.\d+)?\s*(h|hours|days)\b(?!.*\((sourced|measured|assumed|computed))/.test(line));
    expect(unlabelled).toEqual([]);
    expect(pack).toMatch(/\(assumed\)/);
    expect(pack).toMatch(/\(computed\)/);
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

describe('cli', () => {
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
