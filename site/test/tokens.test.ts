import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const read = (relative: string) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

function designColours(): Record<string, string> {
  const frontMatter = /^---\n([\s\S]*?)\n---\n/.exec(read('../../DESIGN.md'));
  if (!frontMatter?.[1]) throw new Error('DESIGN.md has no front matter');
  const { colors } = parse(frontMatter[1]) as { colors: Record<string, string> };
  return colors;
}

describe('tokens.css', () => {
  it('tokens.css defines every DESIGN.md colour', () => {
    const tokens = read('../src/styles/tokens.css');
    const colours = Object.entries(designColours());
    expect(colours.length).toBeGreaterThan(0);
    for (const [name, hex] of colours) {
      expect(tokens).toMatch(new RegExp(`^\\s*--${name}:\\s*${hex};`, 'm'));
    }
  });
});

/** Every stylesheet under src, as paths relative to src. */
function stylesheets(dir = join(dirname(fileURLToPath(import.meta.url)), '../src'), prefix = ''): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? stylesheets(join(dir, e.name), `${prefix}${e.name}/`) : e.name.endsWith('.css') ? [`${prefix}${e.name}`] : [],
  );
}

describe('stylesheets', () => {
  it('no stylesheet but tokens.css writes a raw colour: every colour is a token', () => {
    const sheets = stylesheets().filter((f) => f !== 'styles/tokens.css');
    expect(sheets).toContain('ui/chrome.css');
    const raw = sheets.flatMap((f) =>
      read(`../src/${f}`)
        .split('\n')
        .flatMap((line, i) => (/#[0-9a-f]{3,8}\b|\b(rgba?|hsla?)\(/i.test(line) ? [`${f}:${i + 1}: ${line.trim()}`] : [])),
    );
    expect(raw).toEqual([]);
  });
});
