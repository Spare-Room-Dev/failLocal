import { parse } from 'yaml';
import type { Register } from './schema.js';
import { parseRegister } from './validate.js';

/**
 * Parses register YAML and validates it with `parseRegister`. Kept out of the package barrel so a
 * browser bundle that imports `@faillocal/engine` never pulls in the YAML parser; import it from
 * `@faillocal/engine/yaml`.
 */
export function loadRegisterYaml(text: string): Register {
  return parseRegister(parse(text));
}
