import { readdir, mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { createTranslator } from 'next-intl';
import { z } from 'zod';
// DESIGN-GAP: WidgetKit uses small PNG thumbnails derived from the existing shared RWS assets;
// The widget extension uses the conventional .widget suffix under the documented Bundle ID.
// SwiftUI Image cannot rely on React Native's WebP decoder. No second card deck is introduced.
const output = resolve('apps/mobile/native/widget/cards');
await mkdir(output, { recursive: true });
for (const file of await readdir(resolve('apps/web/public/tarot/rws'))) {
  if (file.endsWith('.webp'))
    await sharp(resolve('apps/web/public/tarot/rws', file))
      .resize(104, 176, { fit: 'inside' })
      .png()
      .toFile(resolve(output, file.replace('.webp', '.png')));
}
const keys = [
  'mobile.widget.title',
  'mobile.widget.description',
  'mobile.widget.empty',
  'nav.today',
];
const copy: Record<string, Record<string, string>> = {};
for (const locale of ['zh', 'zh-TW', 'en']) {
  const raw: unknown = JSON.parse(
    await readFile(resolve(`apps/web/messages/${locale}.json`), 'utf8'),
  );
  const source = z.record(z.string()).parse(raw);
  const translate = createTranslator({
    locale,
    messages: Object.fromEntries(keys.map((key) => [key.replaceAll('.', '_'), source[key]!])),
  });
  copy[locale] = Object.fromEntries(keys.map((key) => [key, translate(key.replaceAll('.', '_'))]));
  // DESIGN-GAP: Android launcher labels use catalog-generated resources merged from the local Expo module.
  const qualifier = locale === 'en' ? 'values-en' : locale === 'zh-TW' ? 'values-zh-rTW' : 'values';
  const resource = resolve('apps/mobile/modules/widget-storage/android/src/main/res', qualifier);
  await mkdir(resource, { recursive: true });
  const title = copy[locale]!['mobile.widget.title']!.replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll("'", "\\'")
    .replaceAll('"', '&quot;');
  await writeFile(
    resolve(resource, 'strings.xml'),
    `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n  <string name="tianji_widget_title">${title}</string>\n</resources>\n`,
  );
}
await writeFile(
  resolve('apps/mobile/native/widget/assets/copy.json'),
  JSON.stringify(copy, null, 2) + '\n',
);
