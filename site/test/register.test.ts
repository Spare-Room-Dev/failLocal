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
