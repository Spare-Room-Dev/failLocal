#!/usr/bin/env -S npx tsx
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { parseArgs } from 'node:util';
import { renderContinuityPack } from './pack.js';
import { simulate } from './simulate.js';
import type { Timeline, Variant } from './simulate.js';
import { loadRegisterYaml, RegisterError } from './validate.js';
import type { Register } from './schema.js';

const USAGE = `Usage:
  faillocal validate <register.yaml>
  faillocal simulate <register.yaml> --scenario <id> --variant <unprepared|prepared> [--json]
  faillocal pack <register.yaml> --out <file.md>`;

class UsageError extends Error {}

function load(file: string | undefined): Register {
  if (!file) throw new UsageError('missing <register.yaml>');
  return loadRegisterYaml(readFileSync(file, 'utf8'));
}

function summarise(t: Timeline, r: Register): string {
  const name = (id: string): string => r.processes.find((p) => p.id === id)?.name ?? id;
  const firstStop = new Map<string, number>();
  for (const e of t.events) {
    if (e.kind === 'process-state' && e.to === 'stopped' && !firstStop.has(e.subject)) firstStop.set(e.subject, e.hour);
  }
  const lines = [
    `Fictional model site: ${r.site.name}`,
    `Scenario: ${t.scenarioId}${t.projection ? ' (projection)' : ''}`,
    `Variant: ${t.variant}`,
    `Production deferred: ${Math.round(t.totals.tonnesDeferred).toLocaleString('en-US')} t (computed)`,
    `Revenue at risk: USD ${Math.round(t.totals.revenueAtRisk).toLocaleString('en-US')} (computed)`,
    'First stop per process:',
  ];
  if (firstStop.size === 0) lines.push('  none');
  for (const [id, hour] of firstStop) lines.push(`  ${name(id)}: hour ${hour}`);
  return lines.join('\n');
}

function run(argv: string[]): void {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      scenario: { type: 'string' },
      variant: { type: 'string' },
      json: { type: 'boolean', default: false },
      out: { type: 'string' },
    },
  });
  const [command, file, ...extra] = positionals;
  if (extra.length) throw new UsageError(`unexpected argument '${extra[0]}'`);

  switch (command) {
    case 'validate': {
      load(file);
      console.log('Register is valid.');
      return;
    }
    case 'simulate': {
      if (!values.scenario) throw new UsageError('simulate needs --scenario <id>');
      if (values.variant !== 'unprepared' && values.variant !== 'prepared') {
        throw new UsageError('simulate needs --variant <unprepared|prepared>');
      }
      const r = load(file);
      const timeline = simulate(r, values.scenario, values.variant as Variant);
      console.log(values.json ? JSON.stringify(timeline) : summarise(timeline, r));
      return;
    }
    case 'pack': {
      if (!values.out) throw new UsageError('pack needs --out <file.md>');
      const r = load(file);
      mkdirSync(dirname(values.out), { recursive: true });
      writeFileSync(values.out, renderContinuityPack(r, new Date().toISOString().slice(0, 10)));
      console.log(`Wrote ${values.out}`);
      return;
    }
    default:
      throw new UsageError(command ? `unknown command '${command}'` : 'missing command');
  }
}

try {
  run(process.argv.slice(2));
} catch (error) {
  const parseArgsError = (error as NodeJS.ErrnoException).code?.startsWith('ERR_PARSE_ARGS_');
  if (error instanceof UsageError || parseArgsError) {
    console.error(`${(error as Error).message}\n${USAGE}`);
    process.exitCode = 2;
  } else if (error instanceof RegisterError) {
    console.error(error.issues.join('\n'));
    process.exitCode = 1;
  } else {
    console.error((error as Error).message);
    process.exitCode = 1;
  }
}
