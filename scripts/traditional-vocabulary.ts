import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(resolve('packages/shared/package.json'));
const opencc = resolve(require.resolve('opencc-js/cn2t'), '../../esm-lib/dict');
const fragments = new Set<string>();
// DESIGN-GAP: Include source templates and tests as well as published prose so dynamic engine labels retain canonical spellings.
for (const root of [
  'apps/web/messages',
  'packages/shared',
  'packages/engine/src',
  'packages/interpret/src',
  'packages/content/dist',
  'apps/web/resources',
]) {
  for (const name of await readdir(root, { recursive: true })) {
    if (
      /node_modules|traditional-generated|\/dist\/.*\.(js|d\.ts)$/.test(name) ||
      !/\.(ts|tsx|json)$/.test(name)
    )
      continue;
    const source = await readFile(resolve(root, name), 'utf8');
    for (const match of source.matchAll(
      /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]+/gu,
    ))
      fragments.add(match[0]);
  }
}
let corpus = [...fragments].join('\n');
console.log(`Selecting vocabulary from ${corpus.length} unique published characters.`);
const groups = [
  ['CJK_Compatibility_Ideographs'],
  ['STPhrases', 'STPhrases_GeneratedFromRegionalPhrases', 'STCharacters'],
  ['TWPhrases', 'TWVariantsPhrases', 'TWVariants'],
];
const chains: [string, string][][] = [];
for (const names of groups) {
  const entries = new Map<string, string>();
  for (const name of names) {
    const dictionary = (await import(resolve(opencc, `${name}.js`))) as { default: string };
    for (const pair of dictionary.default.split('|')) {
      const [from, to] = pair.split(' ');
      if (from && to && !entries.has(from) && corpus.includes(from)) entries.set(from, to);
    }
  }
  chains.push([...entries]);
  // Later conversion stages match intermediate traditional spellings, not only the final Taiwan corpus.
  const tokens = [...entries.keys()]
    .sort((a, b) => b.length - a.length)
    .map((value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (tokens.length)
    corpus +=
      '\n' + corpus.replace(new RegExp(tokens.join('|'), 'gu'), (key) => entries.get(key) ?? key);
}
await writeFile(
  resolve('packages/shared/src/traditional-generated.json'),
  JSON.stringify(chains) + '\n',
);
console.log(
  `Generated ${chains.reduce((sum, group) => sum + group.length, 0)} published-prose vocabulary entries; OpenCC is build-only.`,
);
