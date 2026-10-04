import { mkdir, readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { format, resolveConfig } from 'prettier';
import { pathToFileURL } from 'node:url';
import { createTranslator } from 'next-intl';
import { brand } from '@tianji/shared/brand';
import { toMessages } from '../i18n/catalog';
async function main() {
  const root = pathToFileURL(process.cwd() + '/public/');
  const formatting = (await resolveConfig(process.cwd() + '/scripts/pwa-assets.ts')) ?? {};
  await mkdir(new URL('icons/', root), { recursive: true });
  await mkdir(new URL('offline/', root), { recursive: true });
  // DESIGN-GAP: A vector armillary-sphere mark keeps icons original and the maskable safe area clear.
  const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="96" fill="#05070f"/><g fill="none" stroke="#d4af6a" stroke-width="10"><circle cx="256" cy="256" r="138"/><ellipse cx="256" cy="256" rx="64" ry="138" transform="rotate(35 256 256)"/><ellipse cx="256" cy="256" rx="138" ry="64" transform="rotate(35 256 256)"/></g><path d="M256 211l12 33 33 12-33 12-12 33-12-33-33-12 33-12z" fill="#e8d3a3"/></svg>`;
  for (const [name, size] of [
    ['icon-192', 192],
    ['icon-512', 512],
    ['maskable-512', 512],
    ['apple-touch-icon', 180],
  ] as const) {
    await sharp(Buffer.from(icon))
      .resize(size, size)
      .png()
      .toFile(new URL(`icons/${name}.png`, root).pathname);
  }
  const escape = (value: string) =>
    value.replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
    );
  for (const locale of ['zh', 'en'] as const) {
    const catalog = JSON.parse(
      await readFile(pathToFileURL(process.cwd() + `/messages/${locale}.json`), 'utf8'),
    ) as Record<string, string>;
    const translator = createTranslator({ locale, messages: toMessages(catalog) });
    const t = (key: string) => escape(translator(key));
    const systems = ['bazi', 'ziwei', 'iching', 'qimen', 'tarot', 'astrology', 'vedic'];
    await writeFile(
      new URL(`offline/${locale}.html`, root),
      `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#05070f"><title>${escape(brand.nameZh)} · ${escape(brand.nameEn)}</title><link rel="icon" href="/icons/icon-192.png"><link rel="stylesheet" href="/fonts/fonts.css"><link rel="stylesheet" href="/offline/style.css"></head><body><main><section class="hero"><p>${t('home.eyebrow')}</p><h1>${escape(brand.nameZh)}<small>${escape(brand.nameEn)}</small></h1><p>${t('brand.tagline')}</p><aside role="status"><h2>${t('pwa.offline.title')}</h2><p>${t('pwa.offline.body')}</p><a href="/${locale}">${t('pwa.offline.retry')}</a></aside><a href="#systems">${t('home.cta.start')} ↓</a></section><section id="systems"><h2>${t('home.cards.title')}</h2><div class="cards">${systems.map((system) => `<a href="/${locale}/${system}"><h3>${t('nav.' + system)}</h3><p>${t(system + '.placeholder')}</p></a>`).join('')}</div></section><section><h2>${t('home.how.title')}</h2><ol>${['chart', 'knowledge', 'report'].map((step) => `<li><h3>${t('home.how.' + step + '.title')}</h3><p>${t('home.how.' + step + '.body')}</p></li>`).join('')}</ol></section></main><footer><p>${t('report.disclaimer.short')}</p><a href="/${locale === 'zh' ? 'en' : 'zh'}">${t(locale === 'zh' ? 'nav.locale.en' : 'nav.locale.zh')}</a></footer></body></html>`,
    );
  }
  await writeFile(
    new URL('offline/style.css', root),
    `*{box-sizing:border-box}body{margin:0;background:radial-gradient(ellipse at 30% 20%,#0d1330 0%,#05070f 60%);color:#f3f1ea;font:16px/1.75 'Noto Serif SC',serif}main,footer{max-width:1120px;margin:auto;padding:24px}h1{font:64px 'LXGW WenKai',serif;color:#d4af6a}small{display:block;font:24px Georgia,serif}h2{font-size:28px}p{color:#b8b5ac}a{color:#e8d3a3;display:inline-block;padding:12px;min-height:44px}a:focus-visible{outline:2px solid #e8d3a3}.hero{text-align:center;min-height:90vh;padding-top:80px}aside,.cards>a{background:#111628;border:1px solid rgba(255,255,255,.16);border-radius:20px;padding:24px}aside{max-width:560px;margin:48px auto}.cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.cards>a{text-decoration:none}footer{border-top:1px solid rgba(255,255,255,.16)}@media(min-width:768px){.cards{grid-template-columns:repeat(3,minmax(0,1fr))}}`,
  );
  // DESIGN-GAP: Version the public cache from generated shell/font bytes so font updates invalidate old offline CSS.
  for (const [file, parser] of [
    ['offline/zh.html', 'html'],
    ['offline/en.html', 'html'],
    ['offline/style.css', 'css'],
  ] as const) {
    const path = new URL(file, root);
    await writeFile(path, await format(await readFile(path, 'utf8'), { ...formatting, parser }));
  }
  const version = createHash('sha256');
  for (const file of [
    'offline/zh.html',
    'offline/en.html',
    'offline/style.css',
    'fonts/fonts.css',
    'fonts/fonts-body.css',
    'fonts/budget.json',
    'fonts/selection.json',
  ])
    version.update(await readFile(new URL(file, root)));
  const worker = new URL('sw.js', root);
  await writeFile(
    worker,
    await format(
      (await readFile(worker, 'utf8')).replace(
        /const CACHE = '[^']+';/,
        `const CACHE = 'tianji-public-shell-${version.digest('hex').slice(0, 12)}';`,
      ),
      { ...formatting, parser: 'babel' },
    ),
  );
  console.log('Generated bilingual public offline shells and four PWA icons.');
}
void main();
