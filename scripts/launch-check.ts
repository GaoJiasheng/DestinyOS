import { checkLaunchReports } from './launch-report-check';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { brotliDecompressSync } from 'node:zlib';
import { cp, readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { z } from 'zod';
import {
  BirthInputSchema,
  BaziChartSchema,
  AstroChartSchema,
  VedicChartSchema,
  type System,
} from '../packages/shared/src';
import { compute, normalizeBirth } from '../packages/engine/src';
import type { KnowledgeBundle } from '../packages/content/src';
import { encryptField, decryptField } from '../apps/web/lib/crypto';
import { createLogger } from '../apps/web/lib/logger';
import { beforeSend } from '../apps/web/lib/sentry';

// DESIGN-GAP: Record local/Owner evidence scope plus runtime, mode and timestamps so quick fixture checks cannot be mistaken for full release acceptance.
type Result = { id: string; passed: boolean; detail: string; scope: 'local' | 'external' };
const results: Result[] = [];
const startedAt = new Date().toISOString();
async function check(id: string, probe: () => string | Promise<string>) {
  try {
    results.push({ id, passed: true, detail: await probe(), scope: 'local' });
  } catch (error) {
    results.push({
      id,
      passed: false,
      detail: error instanceof Error ? error.message : String(error),
      scope: 'local',
    });
  }
}
const birth = BirthInputSchema.parse(
  JSON.parse(await readFile('packages/engine/test/fixtures/birth/A.json', 'utf8')),
);
const normalized = normalizeBirth(birth);
const now = '2026-10-04T00:00:00Z';
const systems: System[] = [
  'bazi',
  'ziwei',
  'iching',
  'qimen',
  'tarot',
  'astrology',
  'vedic',
  'numerology',
];
await check('I18N/glossary', async () => {
  for (const locale of ['zh', 'en'] as const) {
    const catalog = z
      .record(z.string())
      .parse(JSON.parse(await readFile(`apps/web/messages/${locale}.json`, 'utf8')));
    for (const target of ['zh', 'en', 'zh-TW']) {
      const label = catalog[`nav.locale.${target}`];
      assert.ok(label, `Missing ${locale} language name for ${target}`);
      assert.ok(
        locale === 'en' ? !/\p{Script=Han}/u.test(label) : !/[A-Za-z]{2,}/.test(label),
        `Untranslated ${locale} language name: ${label}`,
      );
    }
  }
  const entries = new Map<string, KnowledgeBundle['glossary'][number]>();
  for (const system of [...systems, 'daily']) {
    const bundle = JSON.parse(
      await readFile(`packages/content/dist/${system}.zh.json`, 'utf8'),
    ) as KnowledgeBundle;
    for (const entry of bundle.glossary) entries.set(entry.key, entry);
  }
  assert.ok(entries.size >= 600);
  for (const entry of entries.values()) {
    for (const field of ['term', 'short', 'long'] as const) {
      assert.ok(!/[A-Za-z]{2,}/.test(entry.zh[field]), `English glossary ${entry.key}.${field}`);
      assert.ok(!/\p{Script=Han}/u.test(entry.en[field]), `Chinese glossary ${entry.key}.${field}`);
    }
  }
  return `${entries.size} bilingual term/short/long definitions and localized language names checked`;
});
await check('VISUAL/config', async () => {
  const config = await readFile('playwright.config.ts', 'utf8');
  assert.ok(config.includes('{arg}-{projectName}{ext}'));
  assert.ok(config.includes("'polish.spec.ts'"), 'Polish must use its isolated service harness');
  const scripts = z
    .object({ scripts: z.record(z.string()) })
    .parse(JSON.parse(await readFile('package.json', 'utf8'))).scripts;
  assert.ok(scripts['test:e2e']?.includes('pnpm test:polish'), 'Full E2E must run polish checks');
  assert.ok(
    scripts['test:numerology:e2e']?.startsWith('pnpm build &&'),
    'Production numerology must rebuild after the chat dev suite',
  );
  // DESIGN-GAP: Dedicated service suites must be registered in the full command and excluded from the credential-free dev run; inspect every literal testMatch to catch newly merged suites.
  for (const file of (await readdir('.')).filter((name) =>
    /^playwright\..+\.config\.ts$/.test(name),
  )) {
    const suite = await readFile(file, 'utf8');
    const matches = suite.match(/testMatch:\s*(?:\[[\s\S]*?\]|'[^']+')/)?.[0];
    assert.ok(matches, `Missing explicit testMatch in ${file}`);
    for (const match of matches.matchAll(/'([^']+\.spec\.ts)'/g))
      assert.ok(config.includes(`'${match[1]}'`), `${match[1]} must be excluded from dev suite`);
    assert.ok(
      Object.entries(scripts).some(
        ([name, command]) =>
          command.includes(`--config ${file}`) && scripts['test:e2e']?.includes(`pnpm ${name}`),
      ),
      `${file} must run in test:e2e`,
    );
  }
  const snapshots = (await readdir('apps/web/e2e', { recursive: true })).filter((p) =>
    p.endsWith('.png'),
  );
  assert.ok(snapshots.length > 0);
  assert.ok(!snapshots.some((p) => /-(darwin|linux|win32)\.png$/.test(p)));
  return `${snapshots.length} baselines share names across macOS/Ubuntu; rendering remains covered by E2E`;
});
await checkLaunchReports({ systems, birth, normalized, now, check });
await check('PRD-2', () => {
  const unknown = normalizeBirth({
    ...birth,
    timeUnknown: true,
    hour: undefined,
    minute: undefined,
  });
  const bazi = BaziChartSchema.parse(compute({ system: 'bazi', birth: unknown, now }).chart);
  assert.equal(bazi.pillars.hour, null);
  assert.throws(() => compute({ system: 'ziwei', birth: unknown, now }), /E_REQUIRES_BIRTH_TIME/);
  const astro = AstroChartSchema.parse(compute({ system: 'astrology', birth: unknown, now }).chart);
  const vedic = VedicChartSchema.parse(compute({ system: 'vedic', birth: unknown, now }).chart);
  assert.equal(astro.houses, null);
  assert.equal(vedic.lagna, null);
  assert.equal(vedic.houses, null);
  assert.ok(vedic.moon.rashi);
  return 'Three pillars / Ziwei rejected / no astrology houses / Vedic unknown-time flag';
});
await check('PRD-5 + SEC-1', () => {
  const key = `v1:${randomBytes(32).toString('base64')}`;
  for (const aad of ['BirthProfile.encBirth', 'BirthProfile.encPlace', 'Reading.encInput']) {
    const plain = JSON.stringify(birth),
      encrypted = encryptField(plain, aad, 'launch-fixture', key);
    assert.ok(!encrypted.includes('1990'));
    assert.equal(decryptField(encrypted, aad, 'launch-fixture', key), plain);
    assert.throws(() => decryptField(encrypted, 'Other.encBirth', 'launch-fixture', key));
    assert.throws(() => decryptField(encrypted, aad, 'another-owner', key));
  }
  return 'AES-GCM roundtrip and cross-column/cross-owner rejection; actual DB ciphertext also covered by E2E';
});
await check('SEC-2', () => {
  const lines: string[] = [];
  const logger = createLogger({
    write: (line: string) => {
      lines.push(line);
    },
  });
  for (let i = 0; i < 1000; i++)
    logger.info(
      {
        birth,
        email: 'fixture@example.invalid',
        question: 'private-question-marker',
        req: { body: birth },
      },
      '1990-05-15 fixture@example.invalid',
    );
  assert.equal(lines.length, 1000);
  assert.ok(!/1990-05-15|fixture@example.invalid|private-question-marker/.test(lines.join('')));
  return '1000 actual pino output lines contain no seeded date/email/question';
});
await check('SEC-3', () => {
  const event = beforeSend({
    type: undefined,
    user: { id: 'fixture', email: 'fixture@example.invalid' },
    request: { data: birth, headers: { cookie: 'private' } },
    extra: { birth, question: 'private-question-marker' },
    message: '1990-05-15 fixture@example.invalid',
  });
  assert.ok(
    !/1990-05-15|fixture@example.invalid|private-question-marker|Beijing/.test(
      JSON.stringify(event),
    ),
  );
  return 'Sentry beforeSend removes PII from seeded event';
});
// DESIGN-GAP: Vercel uses apps/web as project root; deployment resources must be present in Next.js file traces, and cron config must live at that app root.
await check('DEPLOY/config', async () => {
  const worker = z
    .object({
      url: z.string().regex(/^\/workers\/br\/daily-[a-f0-9]{16}\.js$/),
      traditionalUrl: z.string().regex(/^\/workers\/br\/daily-[a-f0-9]{16}\.js$/),
    })
    .parse(JSON.parse(await readFile('apps/web/lib/daily-worker-asset.json', 'utf8')));
  for (const url of [worker.url, worker.traditionalUrl]) {
    const compressed = await readFile(`apps/web/public${url}`);
    const bytes = brotliDecompressSync(compressed);
    assert.deepEqual(bytes, await readFile(`apps/web/public${url.replace('/br/', '/')}`));
    assert.ok(compressed.byteLength < bytes.byteLength);
    assert.ok(url.includes(createHash('sha256').update(bytes).digest('hex').slice(0, 16)));
  }
  const config = z
    .object({
      crons: z.array(z.object({ path: z.string(), schedule: z.string() })),
      buildCommand: z.string(),
    })
    .parse(JSON.parse(await readFile('apps/web/vercel.json', 'utf8')));
  assert.ok(config.buildCommand.includes('pnpm db:deploy && pnpm build'));
  assert.ok(
    config.crons.some(
      (cron) => cron.path === '/api/v1/cron/daily-maintenance' && cron.schedule === '0 3 * * *',
    ),
  );
  const traceFile = 'apps/web/.next/server/app/[locale]/(app)/[system]/r/[id]/page.js.nft.json';
  const trace = z
    .object({ files: z.array(z.string()) })
    .parse(JSON.parse(await readFile(traceFile, 'utf8')));
  const files = new Set(trace.files.map((file) => resolve(dirname(traceFile), file)));
  for (const system of systems)
    for (const locale of ['zh', 'en'])
      assert.ok(
        files.has(resolve(`packages/content/dist/${system}.${locale}.json`)),
        `Missing deployed ${system}.${locale} knowledge`,
      );
  return 'Workspace knowledge traced; hashed daily worker present; app-root cron and migration-before-build configured';
});
// DESIGN-GAP: Browser-dependent checklist items execute the real-app suites; a quick run never claims their evidence.
const browserGates = [
  [
    'PRD-3',
    'All public route templates and seven report/technical views: language residue and axe scans',
  ],
  ['PRD-4', 'Downloaded share PNG privacy/OCR checks'],
  ['PRD-6', 'Reduced-motion workflows, keyboard and WebGL fallback'],
  ['PRD-7', 'Signed Stripe subscription/cancel/expiry restores free ads'],
  ['SEC-4', 'Level-zero public page and PNG omit private birth fields'],
  ['SEC-5', 'Eight-day deleted user is purged by authenticated cron with PII-free audit'],
  ['SEC-7', 'Rate limits and idempotent readings/webhooks/cron'],
  ['SEC-8', 'Under-13 input blocked and cookie prevents re-entry'],
  ['SEC-9/pages', 'Bilingual privacy/terms/disclaimer exist and are reachable from home'],
] as const;
if (process.argv.includes('--full')) {
  for (const command of ['test:e2e', 'perf:ci'] as const) {
    await check(command === 'test:e2e' ? 'BROWSER' : 'LIGHTHOUSE', async () => {
      const child = spawn('pnpm', [command], { stdio: 'inherit', env: process.env });
      child.on('error', (error) => console.error(error.message));
      const code = await new Promise<number | null>((resolve) => child.on('close', resolve));
      // DESIGN-GAP: Lighthouse's prerequisite Playwright run clears test-results; preserve failed E2E screenshots/traces before collecting independent performance evidence.
      if (command === 'test:e2e' && code !== 0) {
        await mkdir('.launch-check', { recursive: true });
        const directory = `.launch-check/browser-failure-${Date.now()}`;
        await cp('test-results', directory, { recursive: true })
          .then(() => console.log(`E2E failure screenshots and traces preserved in ${directory}`))
          .catch(() =>
            console.warn('E2E artifacts could not be copied; inspect the Playwright output.'),
          );
      }
      assert.equal(code, 0, `${command} exited ${code}`);
      return `${command} passed; see Playwright/Lighthouse artifacts`;
    });
  }
}
const browserPassed = results.find((result) => result.id === 'BROWSER')?.passed === true;
for (const [id, detail] of browserGates)
  results.push({
    id,
    passed: browserPassed,
    detail: browserPassed ? detail : `Unverified: ${detail}; run pnpm launch:check --full`,
    scope: 'local',
  });
results.push({
  id: 'PRD-8',
  passed: false,
  detail: `Local account deletion/session revocation: ${browserPassed ? 'verified by E2E' : 'unverified'}; real Google re-login as a new user requires production OAuth credentials`,
  scope: 'external',
});
results.push({
  id: 'SEC-9/OAuth',
  passed: false,
  detail: 'Owner must verify production OAuth consent policy links match the deployed legal pages',
  scope: 'external',
});
results.push({
  id: 'SEC-6',
  passed: false,
  detail:
    'CSP remains Report-Only; production AdSense/CMP/Stripe observation and zero violations required before enforce',
  scope: 'external',
});
results.push({
  id: 'OWNER',
  passed: false,
  detail:
    'OAuth consent, real Google re-login, service credentials, AdSense approval, backups, Sentry alerts and production CSP observation require Owner evidence; see LAUNCH.md',
  scope: 'external',
});
await mkdir('.launch-check', { recursive: true });
await writeFile(
  '.launch-check/results.json',
  JSON.stringify(
    {
      startedAt,
      checkedAt: new Date().toISOString(),
      nodeVersion: process.version,
      mode: process.argv.includes('--full') ? 'full' : 'quick',
      release: process.argv.includes('--release'),
      results,
    },
    null,
    2,
  ) + '\n',
);
for (const result of results)
  console.log(`${result.passed ? '通过' : '未通过'} ${result.id}: ${result.detail}`);
// External gates are reported separately; --release requires every manual gate as well.
if (
  results.some(
    (r) =>
      !r.passed &&
      (process.argv.includes('--release') ||
        ![
          'SEC-6',
          'OWNER',
          'PRD-8',
          'SEC-9/OAuth',
          ...(!process.argv.includes('--full') ? browserGates.map(([id]) => id) : []),
        ].includes(r.id)),
  )
)
  process.exitCode = 1;
