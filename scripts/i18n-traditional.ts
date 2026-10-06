import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { toTraditional } from '../packages/shared/src/locale';
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

const common = await readFile(resolve('scripts/resources/common-3500.txt'), 'utf8');
await writeFile(resolve('scripts/resources/common-3500-tw.txt'), toTraditional(common));

// DESIGN-GAP: Public article/card titles can use traditional glyphs outside the UI subset; retain only the unique public characters needed by the OG font builder.
const publicEditorial = await readFile(resolve('apps/web/resources/learn.json'), 'utf8');
await writeFile(
  resolve('scripts/resources/og-public-tw.txt'),
  [...new Set(toTraditional(publicEditorial))].sort().join('') + '\n',
);

// DESIGN-GAP: Audit the actual converted report and editorial corpus, not only common/UI characters; the subset builder must cover every CJK glyph used by new pages.
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
