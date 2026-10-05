import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import {
  BaziChartSchema,
  BirthInputSchema,
  type System,
  type BirthInput,
  type NormalizedBirth,
} from '../packages/shared/src';
import { compute, normalizeBirth, ENGINE_VERSION } from '../packages/engine/src';
import { interpret, systemConfigs, expandTerms } from '../packages/interpret/src';
import type { KnowledgeBundle } from '../packages/content/src';
import { banned } from '../packages/content/scripts/validation';
import { projectShare } from '../apps/web/lib/share-projection';
/** Verify deterministic bilingual fixture reports and privacy projection for launch evidence.
 * @param context Explicit fixture input, ISO clock and result recorder.
 */
export async function checkLaunchReports({
  systems,
  birth,
  normalized,
  now,
  check,
}: {
  systems: System[];
  birth: BirthInput;
  normalized: NormalizedBirth;
  now: string;
  check: (id: string, probe: () => string | Promise<string>) => Promise<void>;
}) {
  // DESIGN-GAP: Newly merged synastry reports pair Fixture A with the documented Fixture B while retaining the same deterministic acceptance clock.
  const partnerBirth = normalizeBirth(
    BirthInputSchema.parse(
      JSON.parse(await readFile('packages/engine/test/fixtures/birth/B.json', 'utf8')),
    ),
  );
  // DESIGN-GAP: Divination has no birth dependency; fix the clock, Beijing location, number cast and seed for repeatable Fixture A acceptance.
  for (const system of systems)
    for (const locale of ['zh', 'en'] as const) {
      await check(`PRD-1/${system}/${locale}`, async () => {
        const knowledge = JSON.parse(
          await readFile(`packages/content/dist/${system}.${locale}.json`, 'utf8'),
        ) as KnowledgeBundle;
        const chart = compute({
          system,
          birth: normalized,
          ...(system === 'synastry' ? { partnerBirth } : {}),
          now,
          seed: 'fixture-A',
          spread: 'celtic_cross',
          ...(system === 'iching'
            ? {
                question: {
                  method: 'meihua',
                  category: 'career',
                  meihua: { castBy: 'numbers', numbers: [1, 8, 1], at: `${now}[UTC]` },
                },
              }
            : {}),
          ...(system === 'qimen'
            ? {
                question: {
                  at: `${now}[UTC]`,
                  place: { lng: birth.place!.lng, tz: birth.place!.tz },
                  category: 'general',
                },
              }
            : {}),
        }).chart;
        if (system === 'bazi') {
          const pillars = BaziChartSchema.parse(chart).pillars;
          assert.deepEqual(
            Object.values(pillars).map((p) => p && [p.stem, p.branch]),
            [
              ['geng', 'wu'],
              ['xin', 'si'],
              ['geng', 'chen'],
              ['geng', 'chen'],
            ],
          );
        }
        const report = interpret({
          system,
          chart,
          locale,
          knowledge,
          context: { now, profileHasTime: true, engineVersion: ENGINE_VERSION },
        });
        // DESIGN-GAP: Retain generated acceptance reports outside tracked source so failed checks remain inspectable without storing user data.
        await mkdir('.launch-check/reports', { recursive: true });
        await writeFile(
          `.launch-check/reports/A-${system}-${locale}.json`,
          JSON.stringify(report, null, 2) + '\n',
        );
        const prose = [
          report.headline.persona,
          ...report.headline.keywords,
          ...(report.doDont?.do ?? []),
          ...(report.doDont?.dont ?? []),
          ...report.sections.flatMap((section) => [
            section.title,
            section.lead,
            ...section.blocks.flatMap((block) =>
              block.type === 'paragraph' || block.type === 'transition'
                ? [block.text]
                : block.type === 'advice'
                  ? block.items
                  : block.type === 'evidence'
                    ? block.items.flatMap((item) => [item.label, item.value])
                    : [],
            ),
          ]),
        ].join('\n');
        const expanded = expandTerms(prose, knowledge.glossary, locale).replace(
          /\[([^\]]+)\]\([^)]*\)/g,
          '$1',
        );
        const forbidden = banned[locale].filter((word) =>
          locale === 'zh'
            ? expanded.includes(word)
            : new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(
                expanded,
              ),
        );
        assert.equal(forbidden.length, 0, `Banned phrases: ${forbidden.join(', ')}`);
        assert.ok(!expanded.includes('{{'), 'Unresolved placeholder');
        assert.deepEqual(
          report.sections.map((s) => s.key),
          [
            ...systemConfigs[system].sectionPlan.map((s) => s.key),
            ...(systemConfigs[system].sectionPlan.some(
              (section) => section.key === 'summary_actions',
            )
              ? []
              : ['summary_actions']),
          ],
        );
        for (const section of report.sections)
          assert.ok(
            section.blocks.some((b) => b.type === 'paragraph'),
            `Empty chapter: ${section.key}`,
          );
        // DESIGN-GAP: Language scanning excludes glossary IDs before expansion and classical sources; technical acronyms are checked in browser translation tests.
        if (locale === 'en')
          assert.ok(
            !/\p{Script=Han}/u.test(expanded),
            `Chinese in English prose: ${expanded
              .match(/.{0,40}\p{Script=Han}.{0,40}/gu)
              ?.slice(0, 15)
              .join(' | ')}`,
          );
        else
          assert.ok(
            !/[A-Za-z]{2,}/.test(expanded.replace(/DestinyOS/g, '')),
            `English in Chinese prose: ${expanded
              .match(/.{0,60}[A-Za-z]{2,}.{0,60}/g)
              ?.slice(0, 15)
              .join(', ')}`,
          );
        assert.ok(report.readability.passed, JSON.stringify(report.readability));
        const divination = ['iching', 'qimen', 'tarot'].includes(system);
        assert.ok(
          locale === 'zh'
            ? report.readability.zhChars >= (divination ? 1200 : 2500)
            : report.readability.enWords >= (divination ? 900 : 1800),
          'Report must meet docs/05 §7 minimum independently of readability.passed',
        );
        const share = JSON.stringify(projectShare(system, chart, report, 'chart', 0));
        assert.ok(
          !/1990-05-15|08:30|39\.9|116\.4|Beijing/.test(share),
          'Private birth in public projection',
        );
        if (system === 'synastry')
          assert.ok(
            !/1985-11-02|23:40|Shanghai/.test(share),
            'Partner birth data in level-0 share',
          );
        return `${report.readability.zhChars} chars / ${report.readability.enWords} words; ${report.sections.length} populated chapters; level 0 private fields absent`;
      });
    }
}
