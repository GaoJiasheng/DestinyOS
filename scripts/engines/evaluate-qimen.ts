import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { generateChartByDatetime, chartToObject } from 'qimen-dunjia';
import { z } from 'zod';
const path = 'packages/engine/test/fixtures/qimen-baseline';
const fixtureSchema = z.object({
  at: z.string(),
  raw: z.record(z.unknown()),
  documented: z.object({ ju: z.number() }),
});
const npmSchema = z
  .object({
    局數: z.number(),
    方位: z.array(z.string()),
    地盤: z.array(z.string()),
    天盤: z.array(z.string()),
    九星: z.array(z.string()),
    天門: z.array(z.string()),
    八神: z.array(z.string()),
  })
  .passthrough();
const stars: Record<string, string> = {
  蓬: '天蓬',
  任: '天任',
  沖: '天沖',
  輔: '天輔',
  英: '天英',
  禽: '天芮',
  芮: '天芮',
  柱: '天柱',
  心: '天心',
};
const deities: Record<string, string> = {
  符: '值符',
  蛇: '騰蛇',
  陰: '太陰',
  合: '六合',
  虎: '白虎',
  玄: '玄武',
  地: '九地',
  天: '九天',
};
const results = readdirSync(path)
  .filter((f) => f.endsWith('.json'))
  .map((file) => {
    const fixture = fixtureSchema.parse(JSON.parse(readFileSync(`${path}/${file}`, 'utf8')));
    const at = fixture.at.replaceAll('-', '').replace('T', '').slice(0, 10);
    const npm = npmSchema.parse(chartToObject(generateChartByDatetime(at, { 定局法: '拆補' })));
    const palaces = npm['方位'];
    const mismatch: string[] = [];
    const layers: readonly [
      keyof Pick<typeof npm, '地盤' | '天盤' | '九星' | '天門' | '八神'>,
      string,
      (v: string) => string | undefined,
    ][] = [
      ['地盤', '地盤', (v) => v],
      ['天盤', '天盤', (v) => v],
      ['九星', '星', (v) => stars[v]],
      ['天門', '門', (v) => v + '門'],
      ['八神', '神', (v) => deities[v]],
    ];
    for (const [field, rawField, normalize] of layers) {
      const raw = z.record(z.string()).parse(fixture.raw[rawField]);
      if (
        npm[field].some((value, i) => palaces[i] !== '中' && value !== normalize(raw[palaces[i]!]!))
      )
        mismatch.push(field);
    }
    const canonicalStars = ['天蓬', '天任', '天沖', '天輔', '天英', '天芮', '天柱', '天心'];
    const ring = ['坎', '艮', '震', '巽', '離', '坤', '兌', '乾'];
    const sequence = ring.map((p) => npm['九星'][palaces.indexOf(p)]);
    const rotating = canonicalStars.some((_, offset) =>
      sequence.every((star, i) => star === canonicalStars[(i + offset) % 8]),
    );
    if (!rotating) mismatch.push('not_rotating');
    return {
      file,
      at: fixture.at,
      npmJu: npm['局數'],
      pythonJu: fixture.raw['排局'],
      documentedJu: fixture.documented.ju,
      rotating,
      mismatch,
      npm,
    };
  });
const fullRawMatches = results.filter((r) => !r.mismatch.length).length;
writeFileSync(
  'packages/engine/test/fixtures/qimen-npm-evaluation.json',
  JSON.stringify(
    {
      package: 'qimen-dunjia',
      version: '3.1.0',
      license: 'MIT',
      decision: `npm satisfies the rotating-ring invariant; full five-layer kinqimen agreement: ${fullRawMatches}/30. Implement docs §3 independently; retain all discrepancies.`,
      cases: results,
    },
    null,
    2,
  ) + '\n',
);
process.stdout.write(
  JSON.stringify({
    cases: results.length,
    rotating: results.filter((r) => r.rotating).length,
    fullRawMatches,
  }) + '\n',
);
