import { format, resolveConfig } from 'prettier';
import { fileURLToPath } from 'node:url';
import { writeFile } from 'node:fs/promises';
import { designTokens, desktopTokens } from '../tokens/index';
const formatting = await resolveConfig(
  fileURLToPath(new URL('../tokens/tokens.css', import.meta.url)),
);
const { base, east, west, vedic, spacing, radii, typography, motion, extra } = designTokens;
const neutral = {
  accent: 'var(--gold)',
  'accent-2': 'var(--gold-soft)',
  'accent-glow': 'rgba(212, 175, 106, 0.25)',
};
const mobileType = Object.fromEntries(
  Object.entries(typography).map(([key, value]) => [key, value.split(' / ')[0] ?? value]),
);
const desktopType = Object.fromEntries(
  Object.entries(typography)
    .filter(([key]) => key.startsWith('size-'))
    .map(([key, value]) => [key, value.split(' / ')[1] ?? value]),
);
const rules: [string, Record<string, string>][] = [
  [
    ':root',
    {
      ...base,
      ...east,
      ...west,
      ...spacing,
      ...radii,
      ...mobileType,
      ...motion,
      ...extra,
      ...neutral,
    },
  ],
  ["[data-theme='neutral']", neutral],
  ["[data-theme='east']", east],
  ["[data-theme='west'], [data-theme='vedic']", west],
  ["[data-theme='vedic']", vedic],
];
function rule(selector: string, values: Record<string, string>): string {
  return `${selector} {\n${Object.entries(values)
    .map(([key, value]) => `--${key}: ${value};`)
    .join('\n')}\n}`;
}
const desktop = rule(':root', {
  ...desktopType,
  'button-height': desktopTokens['button-height'],
  'card-padding': desktopTokens['card-padding'],
});
// DESIGN-GAP: Generate CSS at build time so Web and native consume the same DOM-free constants.
await writeFile(
  new URL('../tokens/tokens.css', import.meta.url),
  await format(
    '/* Generated from shared designTokens. */\n' +
      rule('@theme inline', {
        'ease-out': motion['ease-out'],
        'ease-in-out': motion['ease-in-out'],
      }) +
      '\n' +
      rules.map(([selector, values]) => rule(selector, values)).join('\n') +
      `\n@media (min-width: ${desktopTokens.minWidth}px) {\n${desktop}\n}\n`,
    { ...formatting, parser: 'css' },
  ),
);
