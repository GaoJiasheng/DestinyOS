import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { toTraditional } from '@tianji/shared/locale';
import { cache } from 'react';
import { z } from 'zod';
import { LearnSystemsSchema, LearnCardsSchema, LearnHexagramsSchema } from '@tianji/content';
import { webDirectory } from './server-resources';
const glossaryText = z.object({
  term: z.string(),
  short: z.string(),
  long: z.string(),
  pinyin: z.string().optional(),
});
const schema = z.object({
  systems: LearnSystemsSchema,
  cards: LearnCardsSchema,
  hexagrams: LearnHexagramsSchema,
  glossary: z.array(
    z.object({ key: z.string(), system: z.string(), zh: glossaryText, en: glossaryText }),
  ),
});
/** Public build artifact only; no Prisma, cookies or authentication can opt these ISR pages into private state. */
const loadLearnContent = cache(async () =>
  schema.parse(JSON.parse(await readFile(resolve(webDirectory(), 'resources/learn.json'), 'utf8'))),
);
/** Convert public Chinese prose at the output boundary while keeping keys and routes stable. */
export const learnContent = cache(async (locale?: string) => {
  const data = await loadLearnContent();
  if (locale !== 'zh-TW') return data;
  return JSON.parse(
    JSON.stringify(data, (_key, value: unknown) =>
      typeof value === 'string' ? toTraditional(value) : value,
    ),
  ) as typeof data;
});
/** Escape script-sensitive characters in schema.org JSON without changing content. */
export function structuredJson(value: unknown) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}
