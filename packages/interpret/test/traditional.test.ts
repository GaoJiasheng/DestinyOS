import corpus from '../../content/dist/bazi.zh.json';
import type { KnowledgeBundle } from '@tianji/content';
import { expect, it } from 'vitest';
import { interpret, localizeReport } from '../src';
import { bundle, baziChart } from './fixtures/knowledge';
import type { InterpretInput } from '../src';

it('converts the assembled report without mutating bilingual KUs, IDs, evidence or chart props', () => {
  const knowledge = bundle(corpus as KnowledgeBundle);
  const before = structuredClone(knowledge);
  const input: InterpretInput = {
    system: 'bazi',
    chart: baziChart,
    locale: 'zh',
    knowledge,
    context: { now: '2026-10-05T00:00:00Z', profileHasTime: true },
  };
  const zh = interpret(input);
  const tw = interpret({ ...input, locale: 'zh-TW' });
  expect(tw).toEqual(localizeReport(zh, 'zh-TW'));
  expect(tw.locale).toBe('zh-TW');
  expect(tw.hits).toEqual(zh.hits);
  expect(tw.headline.scores).toEqual(zh.headline.scores);
  expect(tw.sections.map((s) => s.key)).toEqual(zh.sections.map((s) => s.key));
  expect(knowledge).toEqual(before);
  expect(localizeReport(tw, 'zh-TW')).toBe(tw);
  expect(() => localizeReport({ ...zh, locale: 'en' }, 'zh-TW')).toThrow();
  expect(() => localizeReport(zh, 'en')).toThrow();
});
