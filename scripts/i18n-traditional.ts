import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
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
