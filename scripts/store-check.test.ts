import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkMetadata } from './store-check';
import { storeRoot, locales, characters } from './store-spec';

async function sample(locale = 'en-US') {
  return JSON.parse(
    await readFile(path.join(storeRoot, `metadata/${locale}.json`), 'utf8'),
  ) as unknown;
}
describe('App Store metadata boundaries', () => {
  it('accepts all exported localizations', async () => {
    for (const locale of locales) {
      const data = await sample(locale);
      expect(() => checkMetadata(data)).not.toThrow();
    }
  });
  it('counts full Unicode code points and separators', () => {
    expect(characters('天機,stars\n🌟')).toBe(10);
  });
  it.each(['over-limit', 'stale-count', 'duplicate', 'title-word', 'missing-field'])(
    'rejects %s even when JSON is parseable',
    async (mode) => {
      const data = await sample();
      if (!data || typeof data !== 'object' || !('fields' in data))
        throw new Error('Invalid fixture');
      const record = data as {
        fields: Record<string, { value: string; characters: number; limit: number }>;
      };
      const name = record.fields.name,
        keywords = record.fields.keywords;
      if (!name || !keywords) throw new Error('Missing fixture fields');
      if (mode === 'over-limit') {
        name.value = 'X'.repeat(31);
        name.characters = 31;
      }
      if (mode === 'stale-count') name.characters = 0;
      if (mode === 'duplicate') {
        keywords.value = 'stars,stars';
        keywords.characters = 11;
      }
      if (mode === 'title-word') {
        keywords.value = 'tarot';
        keywords.characters = 5;
      }
      if (mode === 'missing-field') delete record.fields.subtitle;
      expect(() => checkMetadata(data)).toThrow();
    },
  );
});
