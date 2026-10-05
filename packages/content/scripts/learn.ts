import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { parse } from 'yaml';
import {
  LearnSystemsSchema,
  LearnCardsSchema,
  LearnHexagramsSchema,
  LearnArticlesSchema,
  PublicEditorialSchema,
  zhChars,
  enWords,
  type GlossaryEntry,
} from '../src';
import { root } from './load';
import { banned } from './validation';

/** Scan editorial prose with the documented bans; English tokens use word boundaries. */
export function assertPublicProse(text: string, locale: 'zh' | 'en', context: string) {
  if (text.includes('{{')) throw new Error(`${context}: unresolved placeholder`);
  for (const word of [
    ...banned[locale],
    ...(locale === 'zh' ? ['震惊', '必看'] : ['ancient Chinese secret']),
  ]) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // DESIGN-GAP: English bans match whole words so neutral words such as "secure" do not match "cure".
    if ((locale === 'en' ? new RegExp(`\\b${escaped}\\b`, 'i') : new RegExp(escaped)).test(text))
      throw new Error(`${context}: banned phrase ${word}`);
  }
}
/** Validate encyclopedia sources for the content validator and compiler. */
export async function learnSources() {
  const content = {
    systems: LearnSystemsSchema.parse(
      parse(await readFile(join(root, 'learn/systems.yaml'), 'utf8')) as unknown,
    ),
    cards: LearnCardsSchema.parse(
      parse(await readFile(join(root, 'tarot/cards.yaml'), 'utf8')) as unknown,
    ),
    hexagrams: LearnHexagramsSchema.parse(
      parse(await readFile(join(root, 'iching/hexagrams.yaml'), 'utf8')) as unknown,
    ),
    articles: LearnArticlesSchema.parse(
      parse(await readFile(join(root, 'learn/articles.yaml'), 'utf8')) as unknown,
    ),
    editorial: PublicEditorialSchema.parse(
      parse(await readFile(join(root, 'learn/public.yaml'), 'utf8')) as unknown,
    ),
  };
  const keys = new Set<string>();
  for (const article of content.articles) {
    const key = `${article.system}/${article.slug}`;
    if (keys.has(key)) throw new Error(`Duplicate tutorial ${key}`);
    keys.add(key);
    for (const locale of ['zh', 'en'] as const) {
      const data = article[locale];
      const body = data.sections
        .flatMap((section) => [section.heading, ...section.paragraphs])
        .join('\n');
      // DESIGN-GAP: Tutorial length uses Chinese non-whitespace characters and English words, matching existing metrics; section headings count, navigation does not.
      const count = locale === 'zh' ? zhChars(body) : enWords(body);
      if (count < 1500 || count > 2500)
        throw new Error(`${key}.${locale}: length ${count}, expected 1500–2500`);
      assertPublicProse(
        [
          data.title,
          data.description,
          ...data.sections.flatMap((section) => [section.heading, ...section.paragraphs]),
        ].join('\n'),
        locale,
        `${key}.${locale}`,
      );
    }
  }
  for (const system of content.systems)
    if (content.articles.filter((article) => article.system === system.key).length !== 3)
      throw new Error(`Expected three tutorials for ${system.key}`);
  for (const locale of ['zh', 'en'] as const) {
    for (const [index, item] of content.editorial.faq.entries())
      assertPublicProse(
        `${item.question[locale]}\n${item.answer[locale]}`,
        locale,
        `faq.${index}.${locale}`,
      );
    assertPublicProse(JSON.stringify(content.editorial.about[locale]), locale, `about.${locale}`);
    for (const item of [...content.cards, ...content.hexagrams])
      assertPublicProse(item.historySymbolism[locale], locale, `history.${item.key}.${locale}`);
  }
  return content;
}
/** Compile content-only encyclopedia artifacts so ISR never queries private databases. */
export async function compileLearn(glossary: GlossaryEntry[]) {
  const content = { ...(await learnSources()), glossary };
  const destinations = new Set([
    '/faq',
    '/learn/glossary',
    ...content.systems.map((system) => `/learn/${system.key}`),
    ...content.glossary.map((entry) => `/learn/glossary/${entry.key}`),
    ...content.cards.map((card) => `/learn/tarot/${card.key}`),
    ...content.hexagrams.map((hexagram) => `/learn/iching/${hexagram.key}`),
    ...content.articles.map((article) => `/learn/${article.system}/articles/${article.slug}`),
  ]);
  for (const article of content.articles)
    for (const link of article.links)
      if (!destinations.has(link.href)) throw new Error(`Invalid tutorial link ${link.href}`);
  const target = join(root, '../../apps/web/resources');
  await mkdir(target, { recursive: true });
  await writeFile(join(target, 'learn.json'), JSON.stringify(content) + '\n');
}
