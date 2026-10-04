import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
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
export const learnContent = cache(async () =>
  schema.parse(JSON.parse(await readFile(resolve(webDirectory(), 'resources/learn.json'), 'utf8'))),
);
/** Escape script-sensitive characters in schema.org JSON without changing content. */
export function structuredJson(value: unknown) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}
