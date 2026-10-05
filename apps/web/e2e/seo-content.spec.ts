import { test, expect, type Page } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { z } from 'zod';
import { LearnArticlesSchema } from '@tianji/content';
import { toTraditional } from '@tianji/shared/locale';

const article = z.object({
  '@type': z.literal('Article'),
  headline: z.string(),
  inLanguage: z.string(),
  mainEntityOfPage: z.string(),
});
const faqSchema = z.object({
  '@type': z.literal('FAQPage'),
  inLanguage: z.string(),
  mainEntity: z.array(
    z.object({ name: z.string(), acceptedAnswer: z.object({ text: z.string() }) }),
  ),
});

async function verifySeo(page: Page, locale: string, path: string) {
  await expect(page.locator('html')).toHaveAttribute('lang', locale);
  await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute(
    'content',
    locale === 'zh-TW' ? 'zh_TW' : locale === 'en' ? 'en_US' : 'zh_CN',
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    `https://tianji.gavin.pub/${locale}${path}`,
  );
  for (const language of ['zh', 'zh-TW', 'en'])
    await expect(page.locator(`link[rel="alternate"][hreflang="${language}"]`)).toHaveAttribute(
      'href',
      `https://tianji.gavin.pub/${language}${path}`,
    );
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index, follow');
  await expect(page.locator('main h1')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
}
async function verifyArticle(page: Page, locale: string, path: string) {
  const data: unknown = JSON.parse(
    await page.locator('main script[type="application/ld+json"]').innerText(),
  );
  const schema = article.parse(data);
  expect(schema.inLanguage).toBe(locale);
  expect(schema.mainEntityOfPage).toBe(`https://tianji.gavin.pub/${locale}${path}`);
  expect(schema.headline).toBe(await page.locator('main h1').innerText());
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('tianji-disclaimer-v1', 'accepted'));
});

const samples = [
  { locale: 'zh', path: '/learn/bazi/articles/four-pillars', text: '日主' },
  { locale: 'en', path: '/learn/numerology/articles/life-path', text: '1990-05-15' },
  { locale: 'zh-TW', path: '/learn/synastry/articles/comparison-basics', text: '雙向' },
] as const;
for (const sample of samples)
  test(`${sample.locale}: long tutorial, internal links, Article and public OG`, async ({
    page,
    request,
  }, testInfo) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (/MISSING_MESSAGE|INVALID_MESSAGE/.test(message.text())) errors.push(message.text());
    });
    const response = await page.goto(`/${sample.locale}${sample.path}`);
    expect(response?.status()).toBe(200);
    await verifySeo(page, sample.locale, sample.path);
    await verifyArticle(page, sample.locale, sample.path);
    await expect(page.locator('[data-tutorial-body]')).toContainText(sample.text);
    const paragraphs = await page.locator('[data-tutorial-body] p').allTextContents();
    const prose = paragraphs.join('\n');
    const length =
      sample.locale === 'en'
        ? (prose.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu)?.length ?? 0)
        : [...prose.replace(/\s/g, '')].length;
    expect(length).toBeGreaterThanOrEqual(1500);
    expect(length).toBeLessThanOrEqual(2500);
    if (sample.locale === 'zh-TW') {
      // DESIGN-GAP: Contextual OpenCC conversion is not idempotent for valid phrases such as 獲准; compare each rendered paragraph against one conversion of its original source.
      const artifact: unknown = JSON.parse(await readFile('apps/web/resources/learn.json', 'utf8'));
      const source = z.object({ articles: LearnArticlesSchema }).parse(artifact).articles;
      const original = source.find(
        (entry) => `/learn/${entry.system}/articles/${entry.slug}` === sample.path,
      );
      expect(original).toBeDefined();
      expect(paragraphs).toEqual(
        original!.zh.sections.flatMap((section) => section.paragraphs.map(toTraditional)),
      );
    }
    expect(errors).toEqual([]);
    const sibling = page.locator('main nav').last().locator('a[href*="/articles/"]').first();
    const destination = await sibling.getAttribute('href');
    expect(destination).toMatch(new RegExp(`^/${sample.locale}/learn/`));
    const next = await request.get(destination!);
    expect(next.status()).toBe(200);
    const ogUrl = await page.locator('meta[property="og:image"]').getAttribute('content');
    expect(ogUrl).toContain('/api/og/public?');
    const parsed = new URL(ogUrl!);
    expect(parsed.searchParams.get('locale')).toBe(sample.locale);
    expect(parsed.searchParams.get('path')).toBe(sample.path);
    const og = await request.get(parsed.pathname + parsed.search);
    expect(og.status()).toBe(200);
    expect(og.headers()['content-type']).toContain('image/png');
    const png = await og.body();
    expect(png.readUInt32BE(16)).toBe(1200);
    expect(png.readUInt32BE(20)).toBe(630);
    await writeFile(testInfo.outputPath('public-og.png'), png);
    await page.screenshot({ path: testInfo.outputPath('tutorial.png') });
  });

test('en: twenty visible FAQ answers match structured data, with About and privacy links', async ({
  page,
  request,
}) => {
  await page.goto('/en/faq');
  await verifySeo(page, 'en', '/faq');
  const details = page.locator('[data-public-faq] details');
  await expect(details).toHaveCount(20);
  const data: unknown = JSON.parse(
    await page.locator('main script[type="application/ld+json"]').innerText(),
  );
  const schema = faqSchema.parse(data);
  expect(schema.inLanguage).toBe('en');
  expect(schema.mainEntity).toHaveLength(20);
  for (let index = 0; index < 20; index++) {
    expect(await details.nth(index).locator('summary').innerText()).toBe(
      schema.mainEntity[index]!.name,
    );
    await details.nth(index).locator('summary').click();
    await expect(details.nth(index).locator('p')).toHaveText(
      schema.mainEntity[index]!.acceptedAnswer.text,
    );
  }
  await page.locator('main a[href="/en/about"]').click();
  await verifySeo(page, 'en', '/about');
  await expect(page.locator('main')).toContainText('Default runtime readings do not call AI');
  await expect(page.locator('main')).toContainText('Team introduction placeholder');
  expect((await request.get('/en/privacy')).status()).toBe(200);
});

test('zh: card history, hexagram history, grouped glossary and sitemap remain public', async ({
  page,
  request,
}) => {
  const path = '/learn/tarot/major_00_fool';
  await page.goto(`/zh${path}`);
  await verifySeo(page, 'zh', path);
  await verifyArticle(page, 'zh', path);
  await expect(page.getByRole('heading', { name: '历史与象征', exact: true })).toBeVisible();
  await expect(page.locator('main')).toContainText('Rider–Waite–Smith');
  await page.goto('/zh/learn/iching/hexagram_01');
  await verifySeo(page, 'zh', '/learn/iching/hexagram_01');
  await expect(page.getByRole('heading', { name: '历史与象征', exact: true })).toBeVisible();
  await expect(page.locator('main')).toContainText('文王卦序');
  await page.goto('/zh/learn/glossary');
  await verifySeo(page, 'zh', '/learn/glossary');
  await page.locator('main nav a[href="#system-bazi"]').click();
  await expect(page).toHaveURL(/#system-bazi$/);
  const term = page.locator('#system-bazi a').first();
  const href = await term.getAttribute('href');
  await term.click();
  await expect(page).toHaveURL(new RegExp(`${href!.replaceAll('.', '\\.')}$$`));
  await expect(page.locator('main a[href="/zh/learn/glossary#system-bazi"]')).toBeVisible();
  const sitemap = await request.get('/sitemap.xml');
  expect(sitemap.status()).toBe(200);
  const xml = await sitemap.text();
  for (const language of ['zh', 'zh-TW', 'en']) {
    expect(xml).toContain(`/${language}/learn/synastry/articles/comparison-basics`);
    expect(xml).toContain(`/${language}/faq`);
    expect(xml).toContain(`hreflang="${language}"`);
  }
  for (const privatePath of ['/me/birth', '/synastry/r/', '/bazi/r/'])
    expect(xml).not.toContain(privatePath);
  for (const query of [
    { locale: 'en', path: '/me/birth' },
    { locale: 'en', path: '/bazi/r/private' },
    { locale: 'ja', path: '/learn' },
  ])
    expect((await request.get(`/api/og/public?${new URLSearchParams(query)}`)).status()).toBe(404);
  expect((await request.get('/zh/learn/bazi/articles/unknown-tutorial')).status()).toBe(404);
});
