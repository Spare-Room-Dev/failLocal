import { readFileSync } from 'node:fs';
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
