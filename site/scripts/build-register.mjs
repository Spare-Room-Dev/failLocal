/**
 * Compiles the model site's register to JSON before dev, build, test and typecheck, so the browser
 * bundle never carries a YAML parser. Validates with the engine's real loader (`loadRegisterYaml`)
 * and fails on a RegisterError. Writes the parsed register to `src/generated/register.json`
 * (gitignored); `src/model/register.ts` validates it again at runtime with `parseRegister`.
 *
 * The engine is TypeScript with no build step, imported with `.js` specifiers that name `.ts` files.
 * Node's type stripping does not rewrite those specifiers, so the loader runs through Vite's
 * `runnerImport`, which resolves and transforms the engine the way the site build does.
 *
 * Usage: node scripts/build-register.mjs [register.yaml] [out.json]
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runnerImport } from 'vite';

const siteDir = fileURLToPath(new URL('..', import.meta.url));
const input = resolve(process.argv[2] ?? fileURLToPath(new URL('../../register/pilbara-model-site.yaml', import.meta.url)));
const output = resolve(process.argv[3] ?? fileURLToPath(new URL('../src/generated/register.json', import.meta.url)));

/** @type {{ module: typeof import('@faillocal/engine/yaml') }} */
const { module: engine } = await runnerImport('@faillocal/engine/yaml', { configFile: false, root: siteDir, logLevel: 'error' });

let register;
try {
  register = engine.loadRegisterYaml(readFileSync(input, 'utf8'));
} catch (error) {
  // RegisterError sets its name; the class itself lives in the runner's module graph, not this one.
  if (error instanceof Error && error.name === 'RegisterError') {
    console.error(`build-register: ${input} is not a valid register:\n${error.message.replace(/^/gm, '  - ')}`);
    process.exit(1);
  }
  throw error;
}

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify(register, null, 2)}\n`);
console.log(`build-register: wrote ${output}`);
