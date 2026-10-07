import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { toTraditional } from './traditional-converter';
import { z } from 'zod';
import {
  LearnArticlesSchema,
  LearnSystemsSchema,
  LearnCardsSchema,
  LearnHexagramsSchema,
} from '../packages/content/src/index';
/** Generate Taiwan catalogs from zh values only; dotted keys and ICU parameters never change. */
for (const file of ['.json', '/glossary.json', '/interpretation.json', '/tarot.json']) {
  const source: Record<string, string> = JSON.parse(
    await readFile(resolve(`apps/web/messages/zh${file}`), 'utf8'),
  );
  const target = resolve(`apps/web/messages/zh-TW${file}`);
  await mkdir(resolve('apps/web/messages/zh-TW'), { recursive: true });
  await writeFile(
    target,
    JSON.stringify(
      Object.fromEntries(Object.entries(source).map(([key, value]) => [key, toTraditional(value)])),
      null,
      2,
    ) + '\n',
  );
}

console.log('Generated zh-TW UI catalogs.');
const common = await readFile(resolve('scripts/resources/common-3500.txt'), 'utf8');
await writeFile(resolve('scripts/resources/common-3500-tw.txt'), toTraditional(common));

// DESIGN-GAP: Public article/card titles can use traditional glyphs outside the UI subset; retain only the unique public characters needed by the OG font builder.
const publicEditorial = await readFile(resolve('apps/web/resources/learn.json'), 'utf8');
// DESIGN-GAP: Middleware needs only published learning URLs, keeping prose out of its bundle and preserving HTTP 404 before loading boundaries stream.
const editorial = z
  .object({
    systems: LearnSystemsSchema,
    cards: LearnCardsSchema,
    hexagrams: LearnHexagramsSchema,
    articles: LearnArticlesSchema,
    glossary: z.array(z.object({ key: z.string() })),
  })
  .parse(JSON.parse(publicEditorial));
await writeFile(
  resolve('apps/web/lib/learn-paths-generated.json'),
  JSON.stringify(
    [
      '/learn',
      '/learn/glossary',
      ...editorial.systems.map((system) => `/learn/${system.key}`),
      ...editorial.cards.map((card) => `/learn/tarot/${card.key}`),
      ...editorial.hexagrams.map((hexagram) => `/learn/iching/${hexagram.key}`),
      ...editorial.glossary.map((term) => `/learn/glossary/${term.key}`),
      ...editorial.articles.map((article) => `/learn/${article.system}/articles/${article.slug}`),
    ].sort(),
    null,
    2,
  ) + '\n',
);
await writeFile(
  resolve('scripts/resources/og-public-tw.txt'),
  [...new Set(toTraditional(publicEditorial))].sort().join('') + '\n',
);

// DESIGN-GAP: Audit the actual converted report and editorial corpus, not only common/UI characters; the subset builder must cover every CJK glyph used by new pages.
console.log('Generated public editorial font corpus.');
const { readdir } = await import('node:fs/promises');
let screenCorpus = toTraditional(publicEditorial);
for (const file of await readdir(resolve('packages/content/dist'))) {
  if (file.endsWith('.zh.json'))
    screenCorpus += toTraditional(await readFile(resolve('packages/content/dist', file), 'utf8'));
}
await writeFile(
  resolve('scripts/resources/screen-tw.txt'),
  [...new Set(screenCorpus)]
    .filter((char) => /[\u3000-\u9fff]/u.test(char))
    .sort()
    .join('') + '\n',
);

console.log('Generated traditional report font corpus.');
// DESIGN-GAP: Version public glossary caches by their exact compiled bytes, including traditional conversion changes.
const glossaryVersions: Record<string, string> = {};
for (const locale of ['zh', 'en', 'zh-TW'])
  glossaryVersions[locale] = createHash('sha256')
    .update(await readFile(resolve(`apps/web/messages/${locale}/glossary.json`)))
    .digest('hex');
await writeFile(
  resolve('apps/web/i18n/glossary-versions.json'),
  JSON.stringify(glossaryVersions, null, 2) + '\n',
);

// DESIGN-GAP: Pre-generate complete traditional knowledge shards and public editorial data; runtime only reads immutable artifacts.
for (const file of await readdir(resolve('packages/content/dist'))) {
  if (!file.endsWith('.zh.json')) continue;
  const source = JSON.parse(
    await readFile(resolve('packages/content/dist', file), 'utf8'),
  ) as unknown;
  const converted = JSON.stringify(source, (_key, value: unknown) =>
    typeof value === 'string' ? toTraditional(value) : value,
  );
  await writeFile(
    resolve('packages/content/dist', file.replace('.zh.json', '.zh-TW.json')),
    converted + '\n',
  );
}
await writeFile(
  resolve('apps/web/resources/learn.zh-TW.json'),
  JSON.stringify(JSON.parse(publicEditorial), (_key, value: unknown) =>
    typeof value === 'string' ? toTraditional(value) : value,
  ) + '\n',
);
console.log('Generated traditional knowledge/editorial shards.');
await import('./traditional-vocabulary');

// DESIGN-GAP: Exact preconverted UI/templates preserve OpenCC phrase segmentation; no conversion SDK is shipped.
const uiPairs = new Map<string, string>();
for (const file of ['.json', '/interpretation.json']) {
  const source: Record<string, string> = JSON.parse(
    await readFile(resolve(`apps/web/messages/zh${file}`), 'utf8'),
  );
  for (const value of Object.values(source)) {
    const converted = toTraditional(value);
    if (converted !== value) uiPairs.set(value, converted);
  }
}
await writeFile(
  resolve('packages/shared/src/traditional-ui-generated.json'),
  JSON.stringify([...uiPairs]) + '\n',
);
