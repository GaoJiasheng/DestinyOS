import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse, stringify } from 'yaml';
import { validateAsset } from '../scripts/assets';
import { loadContent, root } from '../scripts/load';

const source = (file: string) => readFile(join(root, file), 'utf8');
describe('source tables and KU integration', () => {
  it.each([
    'tarot/cards.yaml',
    'tarot/spreads.yaml',
    'tarot/sources.yaml',
    'iching/hexagrams.yaml',
  ])('validates the distinct schema for %s', async (file) => {
    expect(validateAsset(file, file, await source(file))).toEqual([]);
  });
  it('rejects corrupt and incomplete bilingual tables with source locations', async () => {
    const file = 'tarot/cards.yaml';
    const cards: unknown = parse(await source(file));
    if (!Array.isArray(cards)) throw new Error('Expected card array');
    cards[1] = cards[0];
    expect(validateAsset(file, file, stringify(cards))).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: 'error',
          message: expect.stringContaining('Duplicate asset key'),
        }),
      ]),
    );
    cards[0] = { key: 'major_00_fool', name: { zh: '愚人' } };
    const diagnostics = validateAsset(file, file, stringify(cards));
    expect(diagnostics?.some((d) => d.severity === 'error' && d.line >= 1 && d.column >= 1)).toBe(
      true,
    );
    expect(validateAsset(file, file, '[invalid')).toEqual(
      expect.arrayContaining([expect.objectContaining({ severity: 'error' })]),
    );
  });
  it('keeps unknown YAML in KU validation and excludes source tables from published units', async () => {
    expect(validateAsset('tarot/reading.yaml', 'tarot/reading.yaml', '[]')).toBeUndefined();
    const result = await loadContent();
    expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(result.units.filter((unit) => unit.system === 'common').map((unit) => unit.id)).toEqual([
      'common.disclaimer',
    ]);
    expect(result.units.filter((unit) => unit.system === 'bazi')).toHaveLength(346);
    expect(result.units.map((unit) => unit.id)).toContain('ziwei.fallback.overview');
    expect(result.glossary.length).toBeGreaterThan(400);
  });
});
