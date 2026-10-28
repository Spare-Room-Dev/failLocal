import tokensCss from '../styles/tokens.css?raw';

/** A colour token's `#rrggbb` value, read from tokens.css so the scene never carries its own copy. */
export function token(name: string): string {
  const match = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`).exec(tokensCss);
  if (!match?.[1]) throw new Error(`tokens.css has no colour --${name}`);
  return match[1].toLowerCase();
}
