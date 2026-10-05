import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { BirthInputSchema, type System } from '../packages/shared/src';
import { compute, normalizeBirth } from '../packages/engine/src';
import { expandTerms, interpret, systemConfigs } from '../packages/interpret/src';
import type { KnowledgeBundle } from '../packages/content/src';
import { banned } from '../packages/content/scripts/validation';

const systems: Exclude<System, 'daily'>[] = [
  'bazi',
  'ziwei',
  'iching',
  'qimen',
  'tarot',
  'astrology',
  'vedic',
];
const results: {
  fixture: string;
  system: System;
  method: string;
  locale: string;
  chapters: number;
  size: number;
  issues: string[];
}[] = [];
// DESIGN-GAP: Fixed clock, numbers and seed make divination quality audits reproducible across all birth fixtures.
const now = '2026-10-04T00:00:00Z';
for (const fixture of ['A', 'B', 'D', 'E']) {
  const birth = BirthInputSchema.parse(
    JSON.parse(await readFile(`packages/engine/test/fixtures/birth/${fixture}.json`, 'utf8')),
  );
  for (const mode of [...systems, 'liuyao' as const]) {
    const system = mode === 'liuyao' ? 'iching' : mode;
    if (system === 'ziwei' && birth.timeUnknown) {
      assert.throws(
        () => compute({ system, birth: normalizeBirth(birth), now }),
        /E_REQUIRES_BIRTH_TIME/,
      );
      continue;
    }
    const chart = compute({
      system,
      birth: normalizeBirth(birth),
      now,
      seed: 'fixture-A',
      spread: 'celtic_cross',
      ...(mode === 'liuyao'
        ? {
            question: {
              method: 'liuyao',
              category: 'career',
              liuyao: { throws: [3, 1, 2, 2, 1, 0] },
            },
          }
        : {}),
      ...(system === 'iching' && mode !== 'liuyao'
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
    for (const locale of ['zh', 'en'] as const) {
      const knowledge = JSON.parse(
        await readFile(`packages/content/dist/${system}.${locale}.json`, 'utf8'),
      ) as KnowledgeBundle;
      const report = interpret({
        system,
        chart,
        locale,
        knowledge,
        context: { now, profileHasTime: !birth.timeUnknown },
      });
      const issues: string[] = [...report.readability.issues];
      const expected = [
        ...systemConfigs[system].sectionPlan.map((s) => s.key),
        ...(['iching', 'qimen', 'tarot'].includes(system) ? ['summary_actions'] : []),
      ];
      if (JSON.stringify(report.sections.map((s) => s.key)) !== JSON.stringify(expected))
        issues.push('chapter-plan');
      const transitions: string[] = [];
      const prose = [
        report.headline.persona,
        ...report.headline.keywords,
        ...report.sections.flatMap((section) => {
          if (!section.lead.trim()) issues.push(`missing-lead:${section.key}`);
          if (!section.blocks.some((b) => b.type === 'paragraph' && b.text.trim()))
            issues.push(`empty:${section.key}`);
          return [
            section.title,
            section.lead,
            ...section.blocks.flatMap((block) => {
              if (block.type === 'transition') {
                transitions.push(block.text);
                return [block.text];
              }
              if (block.type === 'paragraph') return [block.text];
              if (block.type === 'advice') return block.items;
              if (block.type === 'evidence') return block.items.flatMap((i) => [i.label, i.value]);
              return [];
            }),
          ];
        }),
      ].join('\n');
      if (new Set(transitions).size !== transitions.length) issues.push('repeated-transition');
      if (
        locale === 'en' &&
        /\[\[term:branch\.you\]\]\s+(?:can|may|might|have|are|will|could|should|tend|often)\b/i.test(
          prose,
        )
      )
        issues.push('pronoun-marked-as-branch');
      if (locale === 'en' && /\[\[term:branch\.yin\]\]\s+dun\b/i.test(prose))
        issues.push('escape-marked-as-branch');
      if (
        locale === 'en' &&
        /\[\[term:hexagram\.\d+\]\]\s+(?:this reading|for access|it to the whole)/.test(prose)
      )
        issues.push('ordinary-verb-marked-as-hexagram');
      const expanded = expandTerms(prose, knowledge.glossary, locale).replace(
        /\[([^\]]+)\]\([^)]*\)/g,
        '$1',
      );
      if (expanded.includes('{{')) issues.push('placeholder');
      for (const word of banned[locale]) {
        if (
          locale === 'zh'
            ? expanded.includes(word)
            : new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(expanded)
        )
          issues.push(`banned:${word}`);
      }
      if (
        locale === 'en'
          ? /\p{Script=Han}/u.test(expanded)
          : /[A-Za-z]{2,}/.test(expanded.replace(/DestinyOS/g, ''))
      ) {
        issues.push('language-residue');
      }
      const row = {
        fixture,
        system,
        method: mode,
        locale,
        chapters: report.sections.length,
        size: locale === 'zh' ? report.readability.zhChars : report.readability.enWords,
        issues,
      };
      results.push(row);
      await mkdir('test-results/polish/reports', { recursive: true });
      await writeFile(
        `test-results/polish/reports/${fixture}-${mode}-${locale}.json`,
        JSON.stringify(report, null, 2),
      );
      console.log(
        `${fixture}/${mode}/${locale}: ${row.size} ${locale === 'zh' ? 'chars' : 'words'}, ${row.chapters} chapters${issues.length ? ` FAIL ${issues.join(', ')}` : ' PASS'}`,
      );
    }
  }
}
await writeFile('test-results/polish/content-audit.json', JSON.stringify(results, null, 2));
assert.equal(
  results.filter((r) => r.issues.length).length,
  0,
  'Content audit failed; see test-results/polish/content-audit.json',
);
