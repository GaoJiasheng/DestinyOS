import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { parse } from 'yaml';
import {
  LearnSystemsSchema,
  LearnCardsSchema,
  LearnHexagramsSchema,
  type GlossaryEntry,
} from '../src';
import { root } from './load';
/** Validate encyclopedia sources for the content validator and compiler. */
export async function learnSources() {
  return {
    systems: LearnSystemsSchema.parse(
      parse(await readFile(join(root, 'learn/systems.yaml'), 'utf8')) as unknown,
    ),
    cards: LearnCardsSchema.parse(
      parse(await readFile(join(root, 'tarot/cards.yaml'), 'utf8')) as unknown,
    ),
    hexagrams: LearnHexagramsSchema.parse(
      parse(await readFile(join(root, 'iching/hexagrams.yaml'), 'utf8')) as unknown,
    ),
  };
}
/** Compile content-only encyclopedia artifacts so ISR never queries private databases. */
export async function compileLearn(glossary: GlossaryEntry[]) {
  const content = { ...(await learnSources()), glossary };
  const target = join(root, '../../apps/web/resources');
  await mkdir(target, { recursive: true });
  await writeFile(join(target, 'learn.json'), JSON.stringify(content) + '\n');
}
