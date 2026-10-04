import { Ajv, type AnySchema } from 'ajv';
import { TAROT_CARDS, TAROT_SPREADS, Trigram } from '@tianji/shared';
import { banned, parseSource, type Diagnostic } from './validation';
import { enWords, zhChars } from '../src/text';
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
        meaningUpright: label,
        meaningReversed: label,
        imagery: label,
        advice: label,
        byCategory: object(
          Object.fromEntries(
            ['love', 'career', 'wealth', 'decision', 'self', 'general'].map((key) => [
              key,
              object({ upright: label, reversed: label }),
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
// Both completed editorial tables must pass nonempty, length and prohibited-language checks.
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
    if (relative === 'tarot/cards.yaml') {
      // This structural type is used only after the exhaustive card asset schema succeeds.
      const rows = parsed.data as Array<{
        meaningUpright: { zh: string; en: string };
        meaningReversed: { zh: string; en: string };
        imagery: { zh: string; en: string };
        advice: { zh: string; en: string };
        byCategory: Record<string, Record<string, { zh: string; en: string }>>;
      }>;
      rows.forEach((row, index) => {
        const prose = (
          value: { zh: string; en: string },
          path: (string | number)[],
          range?: readonly [number, number],
        ) => {
          for (const locale of ['zh', 'en'] as const) {
            const body = value[locale];
            const size = (locale === 'zh' ? zhChars : enWords)(body);
            if (!body.trim()) error([...path, locale], 'Empty tarot editorial prose');
            if (range && (size < range[0] || size > range[1]))
              error([...path, locale], `Editorial length ${size} outside ${range.join('–')}`);
            for (const word of banned[locale])
              if (
                locale === 'zh'
                  ? body.includes(word)
                  : new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(
                      body,
                    )
              )
                error([...path, locale], `Banned editorial phrase: ${word}`);
          }
        };
        // DESIGN-GAP: English lengths count words, matching 05 §2; the approximate 80-unit
        // imagery target allows 75–110. Canonical names (e.g. Death) are metadata, not prose.
        prose(row.meaningUpright, [index, 'meaningUpright'], [120, 180]);
        prose(row.meaningReversed, [index, 'meaningReversed'], [120, 180]);
        prose(row.imagery, [index, 'imagery'], [75, 110]);
        prose(row.advice, [index, 'advice']);
        for (const [category, orientations] of Object.entries(row.byCategory))
          for (const [orientation, text] of Object.entries(orientations))
            prose(text, [index, 'byCategory', category, orientation], [40, 60]);
      });
    }
    if (relative === 'iching/hexagrams.yaml') {
      // This structural type is safe only after the distinct asset schema succeeds above.
      const rows = parsed.data as Array<{
        meaning: { zh: string; en: string };
        yao: Array<{ meaning: { zh: string; en: string } }>;
        keywords: string[];
        guidance: Record<string, { zh: string; en: string }>;
      }>;
      rows.forEach((row, index) => {
        const prose = (
          value: { zh: string; en: string },
          path: (string | number)[],
          line: boolean,
        ) => {
          for (const locale of ['zh', 'en'] as const) {
            const size = (locale === 'zh' ? zhChars : enWords)(value[locale]);
            // DESIGN-GAP: §5 gives approximate prose lengths; use 140–180 characters/words
            // for the 150 target and 55–90 characters/words for the 60 target.
            const [min, max] = line ? [55, 90] : [140, 180];
            if (size < min || size > max)
              error([...path, locale], `Editorial length ${size} outside ${min}–${max}`);
          }
        };
        prose(row.meaning, [index, 'meaning'], false);
        row.yao.forEach((line, j) => prose(line.meaning, [index, 'yao', j, 'meaning'], true));
        // Classical originals intentionally remain untouched, including historical language.
        const scan = (value: { zh: string; en: string }, path: (string | number)[]) => {
          for (const locale of ['zh', 'en'] as const)
            for (const word of banned[locale])
              if (
                locale === 'zh'
                  ? value[locale].includes(word)
                  : new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(
                      value[locale],
                    )
              )
                error([...path, locale], `Banned editorial phrase: ${word}`);
        };
        scan(row.meaning, [index, 'meaning']);
        row.yao.forEach((line, j) => scan(line.meaning, [index, 'yao', j, 'meaning']));
        for (const [category, guidance] of Object.entries(row.guidance)) {
          for (const locale of ['zh', 'en'] as const)
            if (!guidance[locale].trim())
              error([index, 'guidance', category, locale], 'Empty guidance');
          scan(guidance, [index, 'guidance', category]);
        }
        if (new Set(row.keywords).size !== 3 || row.keywords.some((word) => !word.trim()))
          error([index, 'keywords'], 'Require three distinct nonempty keywords');
      });
    }
  }
  return diagnostics;
}
