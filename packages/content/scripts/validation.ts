import { Ajv } from 'ajv';
import { LineCounter, parseDocument } from 'yaml';
import { resolvePath, textGrams, zhChars, enWords } from '../src';
import type { KnowledgeUnit, GlossaryEntry, Transitions } from '../src';
import schema from '../schema/ku.schema.json';
const ajv = new Ajv({ allErrors: true });
const checkUnit = ajv.compile<KnowledgeUnit>(schema);
const textSchema = { type: 'string', minLength: 1 };
const glossaryText = {
  type: 'object',
  additionalProperties: false,
  required: ['term', 'short', 'long'],
  properties: {
    term: textSchema,
    short: textSchema,
    long: textSchema,
    pinyin: textSchema,
    colors: textSchema,
  },
};
const checkGlossary = ajv.compile<GlossaryEntry>({
  type: 'object',
  additionalProperties: false,
  required: ['key', 'system', 'zh', 'en', 'aliases'],
  properties: {
    key: { type: 'string', pattern: '^[a-z0-9_]+(?:\\.[a-z0-9_]+)*$' },
    system: schema.properties.system,
    zh: glossaryText,
    en: glossaryText,
    aliases: { type: 'array', items: textSchema },
  },
});
const checkTransitions = ajv.compile<Transitions>({
  type: 'object',
  additionalProperties: false,
  required: ['zh', 'en'],
  properties: Object.fromEntries(
    ['zh', 'en'].map((locale) => [
      locale,
      {
        type: 'object',
        additionalProperties: false,
        required: ['continuation', 'concession', 'evidence', 'advice', 'low_confidence'],
        properties: Object.fromEntries(
          ['continuation', 'concession', 'evidence', 'advice', 'low_confidence'].map((key) => [
            key,
            { type: 'array', minItems: 1, uniqueItems: true, items: textSchema },
          ]),
        ),
      },
    ]),
  ),
});
export type Diagnostic = {
  file: string;
  line: number;
  column: number;
  severity: 'error' | 'warning';
  message: string;
};
export type LocatedUnit = {
  unit: KnowledgeUnit;
  locate: (path: (string | number)[]) => { line: number; column: number };
  file: string;
};
export const banned = {
  zh: [
    '必有大灾',
    '注定',
    '克死',
    '短命',
    '离婚',
    '破产',
    '死亡',
    '绝症',
    '必然',
    '100%',
    '神准',
    '治愈',
    '根治',
    '稳赚',
    '必涨',
    '保证',
  ],
  // DESIGN-GAP: English also blocks direct equivalents of the Chinese promises and threats.
  en: [
    'doomed',
    'will die',
    'guaranteed',
    'cure',
    '100% accurate',
    'certain disaster',
    'destined',
    'divorce',
    'bankrupt',
    'death',
    'terminal illness',
    'infallible',
    'sure profit',
    'will rise',
  ],
};
/** Parse a YAML source with locations and accumulate syntax diagnostics.
 * @param file Source filename used in diagnostics.
 * @param source Raw UTF-8 YAML content. */
export function parseSource(file: string, source: string) {
  const lines = new LineCounter();
  const doc = parseDocument(source, { lineCounter: lines, uniqueKeys: true });
  const locate = (path: (string | number)[]) => {
    let node = doc.getIn(path, true);
    while (!node && path.length) node = doc.getIn((path = path.slice(0, -1)), true);
    const offset =
      node && typeof node === 'object' && 'range' in node && Array.isArray(node.range)
        ? node.range[0]
        : 0;
    const pos = lines.linePos(typeof offset === 'number' ? offset : 0);
    return { line: pos.line, column: pos.col };
  };
  const diagnostics: Diagnostic[] = doc.errors.map((error) => ({
    file,
    ...locate([]),
    severity: 'error',
    message: error.message,
  }));
  let data: unknown;
  if (!diagnostics.length) {
    try {
      data = doc.toJS({ maxAliasCount: 100 });
    } catch (error) {
      diagnostics.push({ file, ...locate([]), severity: 'error', message: String(error) });
    }
  }
  return { data, locate, diagnostics };
}
/** Validate KU schema, bilingual prose and trigger paths against representative charts.
 * @param file Source filename used in diagnostics.
 * @param source Raw UTF-8 YAML content.
 * @param fixtures Representative charts grouped by system. */
export function validateSource(
  file: string,
  source: string,
  fixtures: Record<string, unknown[]>,
): { units: LocatedUnit[]; diagnostics: Diagnostic[] } {
  const parsed = parseSource(file, source);
  const { diagnostics } = parsed;
  const units: LocatedUnit[] = [];
  const error = (index: number, field: (string | number)[], message: string) =>
    diagnostics.push({ file, ...parsed.locate([index, ...field]), severity: 'error', message });
  if (!Array.isArray(parsed.data)) {
    if (!diagnostics.length)
      diagnostics.push({
        file,
        ...parsed.locate([]),
        severity: 'error',
        message: 'Expected a KU array',
      });
    return { units, diagnostics };
  }
  parsed.data.forEach((value: unknown, index) => {
    if (!checkUnit(value)) {
      for (const issue of checkUnit.errors ?? []) {
        const path = issue.instancePath
          .split('/')
          .slice(1)
          .map((s) => s.replace(/~1/g, '/').replace(/~0/g, '~'));
        error(index, path, `Schema ${issue.instancePath || '/'}: ${issue.message}`);
      }
      return;
    }
    const unit = value;
    units.push({ unit, file, locate: (path) => parsed.locate([index, ...path]) });
    if (!unit.id.startsWith(`${unit.system}.`)) error(index, ['id'], 'id prefix must match system');
    const locateConditions = (
      when: import('../src').When,
      trail: (string | number)[],
    ): { condition: import('../src').Condition; trail: (string | number)[] }[] => {
      if ('all' in when)
        return when.all.flatMap((c, n) => locateConditions(c, [...trail, 'all', n]));
      if ('any' in when)
        return when.any.flatMap((c, n) => locateConditions(c, [...trail, 'any', n]));
      if ('not' in when) return locateConditions(when.not, [...trail, 'not']);
      return [{ condition: when, trail: [...trail, 'path'] }];
    };
    for (const { condition, trail } of locateConditions(unit.when, ['when'])) {
      try {
        if (unit.system === 'common') resolvePath({}, condition.path);
        else if (
          !(fixtures[unit.system] ?? []).some(
            (chart) => resolvePath(chart, condition.path, true).length > 0,
          )
        )
          error(index, trail, `Unresolvable when.path: ${condition.path}`);
      } catch (issue) {
        error(index, trail, String(issue));
      }
    }
    for (const locale of ['zh', 'en'] as const) {
      const text = unit[locale];
      const count = locale === 'zh' ? zhChars : enWords;
      const min = locale === 'zh' ? (unit.section === 'overview' ? 120 : 200) : 120;
      const max = locale === 'zh' ? (unit.section === 'overview' ? 200 : 450) : 300;
      if (count(text.body) < min || count(text.body) > max)
        error(index, [locale, 'body'], `body length ${count(text.body)} outside ${min}–${max}`);
      if (count(text.summary) > (locale === 'zh' ? 60 : 35))
        error(index, [locale, 'summary'], 'summary too long');
      for (const key of ['do', 'dont'] as const)
        text[key].forEach((item, n) => {
          if (count(item) > (locale === 'zh' ? 6 : 3))
            error(index, [locale, key, n], `${key} item too long`);
        });
      const scan = (value: unknown, path: (string | number)[]) => {
        if (typeof value === 'string') {
          for (const word of banned[locale]) {
            const found =
              locale === 'zh'
                ? value.includes(word)
                : new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(
                    value,
                  );
            if (found) error(index, [locale, ...path], `Banned phrase: ${word}`);
          }
        } else if (Array.isArray(value)) value.forEach((item, n) => scan(item, [...path, n]));
        else if (value && typeof value === 'object')
          Object.entries(value).forEach(([key, item]) => scan(item, [...path, key]));
      };
      scan(text, []);
      if (
        !text.advice.some((item) => text.body.includes(item)) &&
        !(
          locale === 'zh' ? /建议|可以|试试|不妨/ : /\b(try|consider|suggest|you can|it helps)\b/i
        ).test(text.body)
      )
        error(index, [locale, 'body'], 'body needs an actionable suggestion');
      if (
        unit.polarity === 'negative' &&
        !(
          locale === 'zh'
            ? /不过|可以通过|建议/
            : /\b(that said|still|however|you can|consider|try)\b/i
        ).test(text.body)
      )
        error(index, [locale, 'body'], 'negative body needs a buffering sentence');
    }
  });
  return { units, diagnostics };
}
/** Check global KU identifiers, reciprocal exclusions and suspicious prose similarity.
 * @param units Validated units with their source locations. */
export function validateRelations(units: LocatedUnit[]): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const ids = new Map<string, LocatedUnit>();
  const add = (item: LocatedUnit, field: string, severity: 'error' | 'warning', message: string) =>
    diagnostics.push({ file: item.file, ...item.locate([field]), severity, message });
  for (const item of units) {
    if (ids.has(item.unit.id)) add(item, 'id', 'error', `Duplicate id: ${item.unit.id}`);
    ids.set(item.unit.id, item);
  }
  for (const item of units)
    for (const otherId of item.unit.exclusive_with) {
      const other = ids.get(otherId)?.unit;
      if (
        !other ||
        otherId === item.unit.id ||
        other.system !== item.unit.system ||
        other.topic !== item.unit.topic ||
        !other.exclusive_with.includes(item.unit.id)
      )
        add(item, 'exclusive_with', 'error', `Invalid or nonreciprocal exclusivity: ${otherId}`);
    }
  // Precompute once per body so a full editorial corpus can be checked without
  // repeatedly normalizing the same text for every pair. The threshold is unchanged.
  const grams = new Map(
    units.map(({ unit }) => [
      unit.id,
      { zh: textGrams(unit.zh.body), en: textGrams(unit.en.body) },
    ]),
  );
  // DESIGN-GAP: Full editorial corpora outgrew pairwise Set lookups. An inverted
  // index counts the exact same shared trigrams; Dice scores and the 0.6 threshold
  // remain unchanged, including duplicate-ID diagnostics and warning order.
  const groups = new Map<string, LocatedUnit[]>();
  for (const item of units) {
    const group = groups.get(item.unit.system) ?? [];
    group.push(item);
    groups.set(item.unit.system, group);
  }
  const comparisons = new Map<
    string,
    {
      size: number;
      lengths: Record<'zh' | 'en', number[]>;
      overlaps: Record<'zh' | 'en', Uint32Array>;
    }
  >();
  const positions = new Map<LocatedUnit, number>();
  for (const [system, group] of groups) {
    const size = group.length;
    const lengths = { zh: [] as number[], en: [] as number[] };
    const overlaps = { zh: new Uint32Array(size * size), en: new Uint32Array(size * size) };
    group.forEach((item, index) => positions.set(item, index));
    for (const locale of ['zh', 'en'] as const) {
      const postings = new Map<string, number[]>();
      group.forEach((item, index) => {
        const fingerprint = grams.get(item.unit.id)![locale];
        lengths[locale].push(fingerprint.size);
        for (const gram of fingerprint) {
          const posting = postings.get(gram);
          if (posting) posting.push(index);
          else postings.set(gram, [index]);
        }
      });
      for (const posting of postings.values())
        for (let a = 0; a < posting.length; a++) {
          const row = posting[a]! * size;
          for (let b = a + 1; b < posting.length; b++) {
            const at = row + posting[b]!;
            overlaps[locale][at] = overlaps[locale][at]! + 1;
          }
        }
    }
    comparisons.set(system, { size, lengths, overlaps });
  }
  for (let i = 0; i < units.length; i++)
    for (const b of units.slice(i + 1)) {
      const a = units[i];
      if (!a || a.unit.system !== b.unit.system) continue;
      const comparison = comparisons.get(a.unit.system)!;
      const left = positions.get(a)!;
      const right = positions.get(b)!;
      for (const locale of ['zh', 'en'] as const)
        if (
          left === right ||
          (2 *
            comparison.overlaps[locale][
              Math.min(left, right) * comparison.size + Math.max(left, right)
            ]!) /
            (comparison.lengths[locale][left]! + comparison.lengths[locale][right]! || 1) >
            0.6
        )
          add(b, locale, 'warning', `Similar 3-grams: ${a.unit.id} / ${b.unit.id} (${locale})`);
    }
  return diagnostics;
}
/** Validate glossary YAML and return located diagnostics with parsed entries.
 * @param file Source filename used in diagnostics.
 * @param source Raw UTF-8 YAML content. */
export function validateGlossary(file: string, source: string) {
  const parsed = parseSource(file, source);
  const entries: GlossaryEntry[] = [];
  if (!Array.isArray(parsed.data))
    parsed.diagnostics.push({
      file,
      ...parsed.locate([]),
      severity: 'error',
      message: 'Expected glossary array',
    });
  else
    parsed.data.forEach((value: unknown, index) => {
      if (checkGlossary(value)) entries.push(value);
      else
        for (const issue of checkGlossary.errors ?? [])
          parsed.diagnostics.push({
            file,
            ...parsed.locate([index, ...issue.instancePath.split('/').slice(1)]),
            severity: 'error',
            message: `Glossary ${issue.instancePath}: ${issue.message}`,
          });
    });
  return { entries, diagnostics: parsed.diagnostics };
}
/** Validate bilingual transition templates and return parsed groups plus diagnostics.
 * @param file Source filename used in diagnostics.
 * @param source Raw UTF-8 YAML content. */
export function validateTransitions(file: string, source: string) {
  const parsed = parseSource(file, source);
  if (!checkTransitions(parsed.data))
    parsed.diagnostics.push({
      file,
      ...parsed.locate([]),
      severity: 'error',
      message: `Invalid transitions: ${ajv.errorsText(checkTransitions.errors)}`,
    });
  return {
    transitions: checkTransitions(parsed.data) ? parsed.data : undefined,
    diagnostics: parsed.diagnostics,
  };
}
export { checkCoverage } from './coverage';
