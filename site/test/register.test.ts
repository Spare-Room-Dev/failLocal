// @vitest-environment node
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { parseRegister } from '@faillocal/engine';
import { loadRegisterYaml } from '@faillocal/engine/yaml';
import json from '../src/generated/register.json' with { type: 'json' };
import { register } from '../src/model/register.js';

const yamlRegister = loadRegisterYaml(readFileSync(new URL('../../register/pilbara-model-site.yaml', import.meta.url), 'utf8'));

test('json register equals the yaml register', () => {
  expect(parseRegister(json)).toEqual(yamlRegister);
  expect(register).toEqual(yamlRegister);
});

/** Every `reasoning` string in the register, with where it sits. */
function reasonings(o: unknown, path = ''): [string, string][] {
  if (Array.isArray(o)) return o.flatMap((v, i) => reasonings(v, `${path}[${i}]`));
  if (!o || typeof o !== 'object') return [];
  const own: [string, string][] = typeof (o as { reasoning?: unknown }).reasoning === 'string' ? [[path, (o as { reasoning: string }).reasoning]] : [];
  return [...own, ...Object.entries(o).flatMap(([k, v]) => reasonings(v, `${path}.${k}`))];
}

// R-u: a popover's reasoning is the only text the untagged-number scan exempts, so each one must cite its decision.
test('every reasoning a provenance popover can show cites a decision (D-nnn)', () => {
  const all = reasonings(register);
  expect(all.length).toBeGreaterThan(0);
  expect(all.filter(([, r]) => !/\bD-\d{3}\b/.test(r))).toEqual([]);
});
