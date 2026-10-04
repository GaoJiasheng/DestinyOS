import { Ajv, type AnySchema } from 'ajv';
import { TAROT_CARDS, TAROT_SPREADS, Trigram } from '@tianji/shared';
import { parseSource, type Diagnostic } from './validation';
const ajv = new Ajv({ allErrors: true });
const text = { type: 'string' };
const nonempty = { type: 'string', minLength: 1 };
const object = (properties: Record<string, AnySchema>) => ({
  type: 'object',
  additionalProperties: false,
  required: Object.keys(properties),
  properties,
});
const bilingual = object({ zh: text, en: text });
const label = object({ zh: nonempty, en: nonempty });
const array = (items: AnySchema, count: number) => ({
  type: 'array',
  minItems: count,
  maxItems: count,
  items,
});
const keywords = {
  type: 'array',
  minItems: 3,
  maxItems: 5,
  uniqueItems: true,
  items: nonempty,
};
const cards = array(
  {
    oneOf: TAROT_CARDS.map((card) =>
      object({
        ...Object.fromEntries(Object.entries(card).map(([key, value]) => [key, { const: value }])),
        name: label,
        keywordsUpright: object({ zh: keywords, en: keywords }),
        keywordsReversed: object({ zh: keywords, en: keywords }),
        meaningUpright: bilingual,
        meaningReversed: bilingual,
        imagery: bilingual,
        advice: bilingual,
        byCategory: object(
          Object.fromEntries(
            ['love', 'career', 'wealth', 'decision', 'self', 'general'].map((key) => [
              key,
              object({ upright: bilingual, reversed: bilingual }),
            ]),
          ),
        ),
      }),
    ),
  },
  78,
);
const spreads = array(
  {
    oneOf: Object.entries(TAROT_SPREADS).map(([key, positions]) =>
      object({
        key: { const: key },
        name: label,
        positions: {
          type: 'array',
          minItems: positions.length,
          maxItems: positions.length,
          items: positions.map((position) =>
            object({
              ...Object.fromEntries(
                Object.entries(position).map(([key, value]) => [key, { const: value }]),
              ),
              name: label,
              meaning: label,
              readingTip: label,
            }),
          ),
        },
      }),
    ),
  },
  8,
);
const hexagrams = array(
  object({
    number: { type: 'integer', minimum: 1, maximum: 64 },
    key: { type: 'string', pattern: '^hexagram_[0-9]{2}$' },
    name: nonempty,
    pinyin: nonempty,
    englishName: nonempty,
    upper: { enum: Object.values(Trigram) },
    lower: { enum: Object.values(Trigram) },
    lines: array({ enum: [0, 1] }, 6),
    judgment: nonempty,
    tuan: nonempty,
    image: nonempty,
    yao: array(
      object({
        position: { type: 'integer', minimum: 1, maximum: 6 },
        original: nonempty,
        image: nonempty,
        meaning: bilingual,
      }),
      6,
    ),
    useNineSix: { anyOf: [object({ original: nonempty, image: nonempty }), { type: 'null' }] },
    meaning: bilingual,
    keywords: array(text, 3),
    guidance: object(
      Object.fromEntries(
        ['career', 'wealth', 'love', 'health', 'study', 'travel', 'decision', 'other'].map(
          (key) => [key, bilingual],
        ),
      ),
    ),
  }),
  64,
);
const sources = object({
  keywords: object({
    source: nonempty,
    license: { const: 'CC0-1.0' },
    sha256: { type: 'string', pattern: '^[a-f0-9]{64}$' },
    usage: nonempty,
  }),
  prose: object({ status: nonempty }),
  images: object({ status: nonempty, deck: nonempty }),
});
// DESIGN-GAP: Documented card/spread/hexagram data tables share system folders with KU arrays.
// Validate their distinct schemas; bilingual draft prose can remain empty until T-23, and is never compiled as published KU.
const validators = new Map([
  ['tarot/cards.yaml', ajv.compile(cards)],
  ['tarot/spreads.yaml', ajv.compile(spreads)],
  ['tarot/sources.yaml', ajv.compile(sources)],
  ['iching/hexagrams.yaml', ajv.compile(hexagrams)],
]);
/** Validates known source tables, returning undefined for files that must pass KU validation. */
export function validateAsset(
  relative: string,
  file: string,
  source: string,
): Diagnostic[] | undefined {
  const validate = validators.get(relative);
  if (!validate) return undefined;
  const parsed = parseSource(file, source);
  const diagnostics = parsed.diagnostics;
  const error = (path: (string | number)[], message: string) =>
    diagnostics.push({ file, ...parsed.locate(path), severity: 'error', message });
  if (diagnostics.length) return diagnostics;
  if (!validate(parsed.data)) {
    for (const issue of validate.errors ?? [])
      error(
        issue.instancePath.split('/').slice(1),
        `Asset schema ${issue.instancePath || '/'}: ${issue.message}`,
      );
    return diagnostics;
  }
  if (Array.isArray(parsed.data)) {
    const seen = new Set<string>();
    parsed.data.forEach((row: unknown, index) => {
      if (!row || typeof row !== 'object' || !('key' in row) || typeof row.key !== 'string') return;
      if (seen.has(row.key)) error([index, 'key'], `Duplicate asset key: ${row.key}`);
      seen.add(row.key);
      if (relative === 'iching/hexagrams.yaml') {
        if (
          !('number' in row) ||
          row.number !== index + 1 ||
          row.key !== `hexagram_${String(index + 1).padStart(2, '0')}`
        )
          error([index], 'Hexagrams must follow King Wen order 1–64');
        if ('yao' in row && Array.isArray(row.yao))
          row.yao.forEach((yao: unknown, i) => {
            if (!yao || typeof yao !== 'object' || !('position' in yao) || yao.position !== i + 1)
              error([index, 'yao', i], 'Yao must follow bottom-to-top order 1–6');
          });
      }
    });
  }
  return diagnostics;
}
