import { testDatabaseUrl, sqliteClient } from '../../../scripts/sqlite-test';
import { expect, type Page, type APIRequestContext } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { randomUUID } from 'node:crypto';
import { generateReading, json } from '../lib/reading-service';
import { encryptField } from '../lib/crypto';
import { BirthInputSchema, type System } from '@tianji/shared';
import zh from '../messages/zh.json' with { type: 'json' };
import en from '../messages/en.json' with { type: 'json' };
export const db = sqliteClient(testDatabaseUrl(57552));
export const copies = { zh, en };
export const birth = BirthInputSchema.parse({
  calendar: 'gregorian',
  year: 1990,
  month: 5,
  day: 15,
  hour: 8,
  minute: 30,
  timeUnknown: false,
  gender: 'male',
  place: { name: 'Beijing', lat: 39.9, lng: 116.4, tz: 'Asia/Shanghai' },
});
process.env.FIELD_ENCRYPTION_KEYS = `v1:${Buffer.alloc(32, 1).toString('base64')}`;
/** Sign in through real email delivery/confirmation; fetching the verification page alone cannot authenticate. */
export async function login(
  page: Page,
  request: APIRequestContext,
  locale: 'zh' | 'en',
  email = `m5-${randomUUID()}@example.test`,
) {
  const copy = copies[locale];
  await page.goto(`/${locale}/auth/login`);
  const signOut = page.getByRole('button', { name: copy['auth.login.signOut'], exact: true });
  if (await signOut.isVisible()) await signOut.click();
  await page.getByLabel(copy['auth.login.email']).fill(email);
  await page.getByRole('button', { name: copy['auth.login.send'], exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: email })).toBeVisible();
  const link = await mailLink(request, email);
  await page.goto(link);
  await expect(
    page.getByRole('button', { name: copy['auth.verify.confirm'], exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: copy['auth.verify.confirm'], exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/${locale}$`));
  return db.user.findUniqueOrThrow({ where: { email } });
}
/** Retrieve only the newest test email's link from the isolated loopback sink. */
export async function mailLink(request: APIRequestContext, email: string) {
  const outbox = (await (
    await request.get(process.env.TEST_MAIL_URL ?? 'http://127.0.0.1:60201/mail')
  ).json()) as {
    to: string;
    text: string;
  }[];
  const link = outbox
    .filter((mail) => mail.to === email)
    .at(-1)
    ?.text.match(/http:\/\/[^\s]+/)?.[0];
  if (!link) throw new Error('Missing isolated test mail link');
  return link;
}
/** Scan the entire current document without exclusions or disabled rules; include selectors in failures. */
export async function audit(page: Page, soft = false) {
  await page.locator('main').waitFor();
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.race([
      new Promise<void>((resolve) => setTimeout(resolve, 1000)),
      Promise.all(
        document
          .getAnimations()
          .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
          .map((animation) => animation.finished.catch(() => undefined)),
      ),
    ]);
  });
  const result = await new AxeBuilder({ page }).analyze();
  const violations = result.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );
  const check = soft ? expect.soft : expect;
  check(
    violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
    })),
    `axe: ${page.url()}`,
  ).toEqual([]);
  return result;
}
/** Exercise the real birth form rather than injecting application/browser storage. */
export async function fillBirth(page: Page, locale: 'zh' | 'en') {
  const copy = copies[locale];
  await page.getByLabel(copy['form.birth.year'], { exact: true }).fill('1990');
  await page.getByLabel(copy['form.birth.month'], { exact: true }).fill('5');
  await page.getByLabel(copy['form.birth.day'], { exact: true }).fill('15');
  await page.getByLabel(copy['form.birth.precise'], { exact: true }).check();
  await page.getByLabel(copy['form.birth.time'], { exact: true }).fill('08:30');
  await page.getByRole('button', { name: copy['form.birth.next'], exact: true }).click();
  await expect(
    page.getByRole('heading', { name: copy['form.birth.placeGender'], exact: true }),
  ).toBeFocused();
  await page.getByLabel(copy['form.birth.city'], { exact: true }).fill('Beijing');
  await page.getByRole('option').filter({ hasText: 'Asia/Shanghai' }).first().click();
  await page.getByLabel(copy['form.birth.gender'], { exact: true }).selectOption('male');
}
/** Seed encrypted snapshots through actual engine/interpretation results for route-wide accessibility scans. */
export async function seedReading(
  userId: string,
  system: Exclude<System, 'daily'>,
  locale: 'zh' | 'en',
) {
  const request = {
    system,
    locale,
    birth,
    idempotencyKey: randomUUID(),
    seed: 'm5-golden',
    ...(system === 'tarot' ? { spread: 'three_ppf' as const } : {}),
    ...(system === 'qimen'
      ? {
          question: {
            at: '2026-10-04T12:00:00Z[UTC]',
            place: { lng: birth.place!.lng, tz: birth.place!.tz },
            category: 'general',
          },
        }
      : {}),
    ...(system === 'iching'
      ? { method: 'meihua' as const, numbers: [8, 5, 3] as [number, number, number] }
      : {}),
  };
  const result = await generateReading(request, '2026-10-04T00:00:00Z');
  return db.reading.create({
    data: {
      userId,
      system,
      encInput: encryptField(JSON.stringify(request), 'Reading.encInput', userId),
      chart: json(result.chart),
      reportZh: locale === 'zh' ? json(result.report) : undefined,
      reportEn: locale === 'en' ? json(result.report) : undefined,
      schoolUsed: json(result.meta.schoolUsed),
      engineVersion: result.report.engineVersion,
      interpretVersion: result.report.interpretVersion,
      knowledgeVersion: result.report.knowledgeVersion,
      createdAt: new Date('2026-10-04T00:00:00Z'),
    },
  });
}

// DESIGN-GAP: Language-switch autonyms, the exact DELETE confirmation token, code, classical quotations, user input and documented proper names retain their original form; audit the remaining visible prose.
/** Check rendered language after hydration, including labels on chart and technical views. */
export async function auditLocale(page: Page, locale: 'zh' | 'en') {
  const text = await page.evaluate((language) => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const parts: string[] = [];
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const parent = node.parentElement;
      if (
        !parent ||
        parent.closest(
          'script, style, select, option, code, pre, .source-fold, [lang="zh-Latn"], nextjs-portal',
        )
      )
        continue;
      // DESIGN-GAP: The documented bilingual glossary heading marks each name with its own language.
      if (
        parent.closest('.term-popover') &&
        parent.closest(language === 'en' ? '[lang="zh"]' : '[lang="en"]')
      )
        continue;
      if (language === 'en' && parent.closest('[lang="zh"]')) continue;
      if (!parent.getClientRects().length || getComputedStyle(parent).visibility === 'hidden')
        continue;
      parts.push(node.textContent ?? '');
    }
    return parts.join(' ');
  }, locale);
  // DESIGN-GAP: §12 explicitly keeps first-mention Chinese/pinyin glosses; exempt only the eight canonical trigram names used by the new learning prose.
  let prose = text;
  if (locale === 'en')
    for (const name of [
      'Qian (乾, qián — Heaven)',
      'Kun (坤, kūn — Earth)',
      'Zhen (震, zhèn — Thunder)',
      'Xun (巽, xùn — Wind)',
      'Kan (坎, kǎn — Water)',
      'Li (离, lí — Fire)',
      'Gen (艮, gèn — Mountain)',
      'Dui (兑, duì — Lake)',
    ])
      prose = prose.replaceAll(name, '');
  const normalized = prose
    .replace(/https?:\/\/[^\s）)]+/g, '')
    // DESIGN-GAP: Deployment contact addresses and the documented Owner's name are identifiers, not translatable prose.
    .replace(/[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '')
    .replace(/\bGavin\b/g, '')
    .replace(
      /(?<![A-Za-z])(?:天机|DestinyOS|DELETE|ASC|MC|DSC|IC|Cookie|Noto Serif SC|Cinzel|Cormorant Garamond|Yale Bright Star Catalogue|AI|Safari|PDF|US|Apple Pay|Pay|AES|GCM|URL|openid|email|profile|Vercel|Cloudflare Email Service|Cloudflare|Workers|KV|R2|SCC|DPF|ID|IANA|GA4|Meta Pixel|Inter|LXGW WenKai|Fontsource|Pamela Colman Smith|Arthur Edward Waite|Rider–Waite–Smith|Commons|CDS|CI|AGPL|GPL|Google|Stripe|GeoNames|Wikimedia|OpenStreetMap|AdSense|Auth\.js|Next\.js|Neon|Upstash|Sentry|OAuth|JSON|PNG|SVG|PWA|UTC|GMT|DST|RWS|Placidus|Whole Sign|Lahiri|D1|D9|TCF|CMP|GDPR|CCPA|GPC|RDP|CC BY|CC0|OFL|SIL|MIT|Apache|English|Beijing|Asia\/Shanghai|Asia\/Singapore|—)(?![A-Za-z])/g,
      '',
    );
  const residues =
    locale === 'en'
      ? normalized.match(/.{0,30}\p{Script=Han}.{0,30}/gu)
      : normalized.match(/.{0,30}[A-Za-z]{2,}.{0,30}/g);
  expect(residues, `${locale} visible language residues at ${page.url()}`).toBeNull();
}
