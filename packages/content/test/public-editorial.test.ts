import { describe, expect, it } from 'vitest';
import { learnSources, assertPublicProse } from '../scripts/learn';
import { enWords, zhChars } from '../src';

const content = await learnSources();

describe('public editorial acceptance', () => {
  it('provides three substantial bilingual lessons for each of the nine systems', () => {
    for (const system of content.systems) {
      const articles = content.articles.filter((article) => article.system === system.key);
      expect(articles).toHaveLength(3);
      for (const article of articles) {
        for (const locale of ['zh', 'en'] as const) {
          const text = article[locale].sections
            .flatMap((section) => [section.heading, ...section.paragraphs])
            .join('\n');
          const count = locale === 'zh' ? zhChars(text) : enWords(text);
          expect(count, `${system.key}/${article.slug}.${locale}`).toBeGreaterThanOrEqual(1500);
          expect(count).toBeLessThanOrEqual(2500);
          expect(text).not.toContain('{{');
        }
        const examples = article.en.sections.flatMap((section) => section.knowledgeUnitId ?? []);
        expect(new Set(examples).size).toBe(examples.length);
        expect(
          article.links.some((link) => link.href.startsWith(`/learn/${article.system}/articles/`)),
        ).toBe(true);
      }
    }
  });

  it('rejects unsafe editorial language in either locale without banning neutral English substrings', () => {
    expect(() => assertPublicProse('secure information', 'en', 'test')).not.toThrow();
    for (const text of [
      'You are destined to win.',
      'A GUARANTEED result.',
      'An ancient Chinese secret.',
    ])
      expect(() => assertPublicProse(text, 'en', 'test')).toThrow('banned phrase');
    for (const text of ['必然成功', '震惊的发现', '你的人生注定如此'])
      expect(() => assertPublicProse(text, 'zh', 'test')).toThrow('banned phrase');
    expect(() => assertPublicProse('{{privateInput}}', 'en', 'test')).toThrow('placeholder');
  });

  it('covers twenty questions and bilingual history for all cards and hexagrams', () => {
    expect(content.editorial.faq).toHaveLength(20);
    expect(new Set(content.editorial.faq.map((item) => item.question.en)).size).toBe(20);
    for (const entry of [...content.cards, ...content.hexagrams])
      for (const locale of ['zh', 'en'] as const) {
        expect(entry.historySymbolism[locale].length).toBeGreaterThan(100);
        expect(() =>
          assertPublicProse(entry.historySymbolism[locale], locale, entry.key),
        ).not.toThrow();
      }
    expect(content.editorial.about.zh.sections.map((section) => section.heading)).toContain(
      '方法论：排盘—知识库—组文',
    );
    expect(
      content.editorial.about.en.sections.flatMap((section) => section.paragraphs).join(' '),
    ).toContain('Default runtime readings do not call AI');
  });
});
