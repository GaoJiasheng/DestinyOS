import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { parse } from 'yaml';
import { Branch } from '@tianji/shared';
const bilingual = z.object({ zh: z.string().min(10), en: z.string().min(20) }).strict();
export const RectificationFeaturesSchema = z
  .object(Object.fromEntries(Object.values(Branch).map((branch) => [branch, bilingual])))
  .strict();
/** Validate all twelve bilingual hour prompts from the versioned YAML source before compiling next-intl messages. */
export async function loadRectificationFeatures() {
  const source = await readFile(new URL('../rectification/hours.yaml', import.meta.url), 'utf8');
  return RectificationFeaturesSchema.parse(parse(source));
}
