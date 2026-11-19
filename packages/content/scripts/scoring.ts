import { Ajv } from 'ajv';
import { Palace, ZIWEI_MAJOR_STARS } from '@tianji/shared';
import schema from '../schema/scoring.schema.json';
import { banned, parseSource, positioningBanned, type Diagnostic } from './validation';
import type {
  CompiledScoringCopy,
  CompiledScoringRules,
  CompiledScoringRule,
  Dim,
  GlossaryEntry,
  ScoringLevelKey,
  ScoringLocaleCopy,
  ScoringMeasure,
  ScoringRuleCopy,
} from '../src';
const ajv = new Ajv({ allErrors: true });
/** Every stored score is an integer count of eighths (0.125); 0.375 and halved borrowed stars need it. */
export const SCORING_UNIT = 8;
type Bilingual = { zh: string; en: string };
type Variant = 'positive' | 'zero' | 'negative';
type SourceRule = Omit<CompiledScoringRule, 'measure'> & {
  note: string;
  measure: ScoringMeasure;
  copy: Partial<Record<Variant, Bilingual & { advice?: Bilingual }>>;
};
type LevelCopy = Record<ScoringLevelKey, Bilingual>;
type SourceScoring = Omit<CompiledScoringRules, 'unit' | 'rules'> & {
  calibration: Record<string, unknown>;
  rules: SourceRule[];
  copy: {
    title: Bilingual;
    levels: LevelCopy;
    dims: Record<string, { label: Bilingual; inline: Bilingual }>;
    sentences: Record<string, LevelCopy>;
    overview: Record<'two' | 'one' | 'none', Bilingual>;
    footnotes: Record<'disclaimer' | 'health' | 'crossSystem' | 'brightness', Bilingual>;
  };
};
const checkScoring = ajv.compile<SourceScoring>(schema);
/** Two-locale copy before the zh-TW conversion step. */
export type SourceScoringCopy = Omit<CompiledScoringCopy, 'locales'> & {
  locales: Record<'zh' | 'en', ScoringLocaleCopy>;
};
export type CompiledScoring = { rules: CompiledScoringRules; copy: SourceScoringCopy };
const placeholdersOf = (text: string) =>
  [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1] ?? '').sort();
const allowedPlaceholders = (measure: ScoringMeasure): string[] => [
  'palace',
  ...(measure.from === 'opposite' ? ['opposite'] : []),
  ...(measure.kind === 'brightness'
    ? ['stars', 'starsBrightness']
    : measure.kind === 'mutagen'
      ? ['star', 'mutagen']
      : ['stars']),
];
/** Sign of every delta a measure can produce, which decides the copy variants it needs. */
function variantsOf(measure: ScoringMeasure, scale: Record<string, number>): Set<Variant> {
  const sign = (value: number): Variant =>
    value > 0 ? 'positive' : value < 0 ? 'negative' : 'zero';
  if (measure.kind === 'brightness') return new Set(Object.values(scale).map(sign));
  if (measure.kind === 'mutagen') return new Set(Object.values(measure.deltas).map(sign));
  if (measure.kind === 'stars') return new Set([sign(measure.each ?? measure.once ?? 0)]);
  return new Set([sign(measure.delta)]);
}
/** Validate the reviewable scoring table and compile integer rules plus locale-keyed copy. */
export function validateScoring(
  file: string,
  source: string,
  glossary: GlossaryEntry[],
): { diagnostics: Diagnostic[]; compiled?: CompiledScoring } {
  const parsed = parseSource(file, source);
  const { diagnostics } = parsed;
  const error = (path: (string | number)[], message: string) =>
    diagnostics.push({ file, ...parsed.locate(path), severity: 'error', message });
  if (diagnostics.length) return { diagnostics };
  if (!checkScoring(parsed.data)) {
    for (const issue of checkScoring.errors ?? [])
      error(
        issue.instancePath.split('/').slice(1),
        `Scoring schema ${issue.instancePath || '/'}: ${issue.message}`,
      );
    return { diagnostics };
  }
  const data = parsed.data;
  const units = (value: number, path: (string | number)[]) => {
    const scaled = value * SCORING_UNIT;
    if (!Number.isInteger(scaled)) error(path, `Score ${value} must be a multiple of 0.125`);
    return Math.round(scaled);
  };
  const terms = new Map(
    glossary.filter((g) => g.system === 'ziwei').map((g) => [g.key, g] as const),
  );
  const term = (key: string, path: (string | number)[]) => {
    if (!terms.has(key)) error(path, `Missing Zi Wei glossary term ${key}`);
  };
  const palaces = new Set<string>(Object.values(Palace));
  for (const [dim, palace] of Object.entries(data.palaceOf))
    if (!palaces.has(palace)) error(['palaceOf', dim], `Unknown palace ${palace}`);
  for (const dim of data.dims)
    if (!data.palaceOf[dim]) error(['dims'], `Dimension ${dim} has no target palace`);
  for (const dim of data.omitted)
    if (data.dims.includes(dim))
      error(['omitted'], `Dimension ${dim} cannot be both scored and omitted`);
  const clamp = units(data.clamp, ['clamp']);
  const cutpoints = data.cutpoints.map((c, n) => units(c, ['cutpoints', n]));
  if (cutpoints.some((c, n) => n > 0 && c <= cutpoints[n - 1]!))
    error(['cutpoints'], 'Cutpoints must be strictly increasing');
  if (cutpoints.some((c) => c <= -clamp || c > clamp))
    error(['cutpoints'], 'Cutpoints must lie inside the clamp range');
  const brightnessScale = Object.fromEntries(
    Object.entries(data.brightnessScale).map(([key, value]) => [
      key,
      units(value, ['brightnessScale', key]),
    ]),
  ) as CompiledScoringRules['brightnessScale'];
  for (const key of Object.keys(brightnessScale))
    term(`brightness.${key}`, ['brightnessScale', key]);
  const groups = Object.fromEntries(
    Object.entries(data.groups).map(([name, group]) => {
      const cap = units(group.cap, ['groups', name, 'cap']);
      if (cap === 0) error(['groups', name, 'cap'], 'A group cap cannot be zero');
      return [name, { cap }];
    }),
  );
  const ids = new Set<string>();
  const rules: CompiledScoringRule[] = [];
  const ruleCopy: Record<'zh' | 'en', Record<string, ScoringRuleCopy>> = { zh: {}, en: {} };
  data.rules.forEach((rule, index) => {
    const at = (...path: (string | number)[]) => ['rules', index, ...path];
    if (ids.has(rule.id)) error(at('id'), `Duplicate scoring rule ${rule.id}`);
    ids.add(rule.id);
    for (const dim of rule.dims ?? [])
      if (!data.dims.includes(dim)) error(at('dims'), `Rule dimension ${dim} is not scored`);
    const m = rule.measure;
    let measure: ScoringMeasure;
    if (m.kind === 'brightness') {
      // Average of one or two major stars times the factor must stay on the integer grid.
      for (const a of Object.values(brightnessScale))
        for (const b of [undefined, ...Object.values(brightnessScale)]) {
          const value = (b === undefined ? a : (a + b) / 2) * m.factor;
          if (!Number.isInteger(value))
            error(at('measure', 'factor'), `Factor ${m.factor} leaves a fractional eighth`);
        }
      measure = m;
    } else if (m.kind === 'mutagen') {
      measure = {
        ...m,
        deltas: Object.fromEntries(
          Object.entries(m.deltas).map(([key, value]) => [
            key,
            units(value, at('measure', 'deltas', key)),
          ]),
        ),
      };
    } else if (m.kind === 'stars') {
      for (const [n, key] of m.keys.entries()) term(`star.${key}`, at('measure', 'keys', n));
      measure = {
        ...m,
        ...(m.each !== undefined ? { each: units(m.each, at('measure', 'each')) } : {}),
        ...(m.once !== undefined ? { once: units(m.once, at('measure', 'once')) } : {}),
      };
    } else {
      for (const [n, key] of [...m.all, ...m.any].entries())
        if (!key.startsWith('mutagen:'))
          term(`star.${key}`, at('measure', n < m.all.length ? 'all' : 'any'));
      measure = { ...m, delta: units(m.delta, at('measure', 'delta')) };
    }
    const deltas = variantsOf(measure, brightnessScale);
    if (rule.group !== undefined) {
      const cap = groups[rule.group]?.cap;
      if (cap === undefined) error(at('group'), `Unknown scoring group ${rule.group}`);
      else if ([...deltas].some((v) => v !== (cap > 0 ? 'positive' : 'negative')))
        error(at('group'), `Group ${rule.group} cap sign must match every member delta`);
    }
    const allowed = allowedPlaceholders(measure);
    for (const variant of ['positive', 'zero', 'negative'] as const) {
      const copy = rule.copy[variant];
      if (deltas.has(variant) !== Boolean(copy)) {
        error(
          at('copy', variant),
          copy ? `Rule never yields a ${variant} delta` : `Missing ${variant} copy`,
        );
        continue;
      }
      if (!copy) continue;
      const zh = placeholdersOf(copy.zh);
      if (zh.join() !== placeholdersOf(copy.en).join())
        error(at('copy', variant), 'zh and en templates must use the same placeholders');
      for (const name of zh)
        if (!allowed.includes(name))
          error(at('copy', variant), `Placeholder {${name}} is not available for this rule`);
      if (
        copy.advice &&
        (placeholdersOf(copy.advice.zh).length || placeholdersOf(copy.advice.en).length)
      )
        error(at('copy', variant, 'advice'), 'Advice must not use placeholders');
      for (const locale of ['zh', 'en'] as const)
        ruleCopy[locale][rule.id] = {
          ...ruleCopy[locale][rule.id],
          [variant]: copy[locale],
          ...(copy.advice ? { advice: copy.advice[locale] } : {}),
        };
    }
    rules.push({
      id: rule.id,
      code: rule.code,
      reliability: rule.reliability,
      ...(rule.dims ? { dims: rule.dims } : {}),
      ...(rule.gate ? { gate: rule.gate } : {}),
      ...(rule.group ? { group: rule.group } : {}),
      measure,
    });
  });
  for (const dim of data.dims) {
    if (!data.copy.dims[dim]) error(['copy', 'dims'], `Missing dimension copy for ${dim}`);
    if (!data.copy.sentences[dim])
      error(['copy', 'sentences'], `Missing level sentences for ${dim}`);
  }
  const overviewSlots = { two: 'first,second', one: 'first', none: '' } as const;
  for (const [key, slots] of Object.entries(overviewSlots))
    for (const locale of ['zh', 'en'] as const)
      if (placeholdersOf(data.copy.overview[key as 'two'][locale]).join() !== slots)
        error(['copy', 'overview', key, locale], `Overview ${key} must use {${slots}}`);
  checkProse(data, error);
  if (diagnostics.length) return { diagnostics };
  const termKeys = [
    ...Object.values(Palace).map((p) => `palace.${p}`),
    ...ZIWEI_MAJOR_STARS.map((s) => `star.${s}`),
    ...rules.flatMap((r) =>
      r.measure.kind === 'stars'
        ? r.measure.keys.map((k) => `star.${k}`)
        : r.measure.kind === 'combo'
          ? [...r.measure.all, ...r.measure.any]
              .filter((k) => !k.startsWith('mutagen:'))
              .map((k) => `star.${k}`)
          : [],
    ),
    ...['lu', 'quan', 'ke', 'ji'].map((k) => `mutagen.${k}`),
    ...Object.keys(brightnessScale).map((k) => `brightness.${k}`),
  ];
  for (const key of termKeys) term(key, []);
  if (diagnostics.length) return { diagnostics };
  const locale = (lang: 'zh' | 'en'): ScoringLocaleCopy => {
    const pick = (value: Bilingual) => value[lang];
    const levels = (value: LevelCopy) =>
      Object.fromEntries(
        (['2', '3', '4', '5'] as const).map((level) => [level, value[level][lang]]),
      ) as Record<ScoringLevelKey, string>;
    return {
      title: pick(data.copy.title),
      levels: levels(data.copy.levels),
      dims: Object.fromEntries(
        data.dims.map((dim) => {
          const copy = data.copy.dims[dim]!;
          return [dim, { label: copy.label[lang], inline: copy.inline[lang] }];
        }),
      ),
      sentences: Object.fromEntries(
        data.dims.map((dim) => [dim, levels(data.copy.sentences[dim]!)]),
      ),
      overview: {
        two: pick(data.copy.overview.two),
        one: pick(data.copy.overview.one),
        none: pick(data.copy.overview.none),
      },
      footnotes: {
        disclaimer: pick(data.copy.footnotes.disclaimer),
        health: pick(data.copy.footnotes.health),
        crossSystem: pick(data.copy.footnotes.crossSystem),
        brightness: pick(data.copy.footnotes.brightness),
      },
      rules: Object.fromEntries(
        [...rules].sort(byId).map((r) => [r.id, ruleCopy[lang][r.id] ?? {}]),
      ),
      terms: Object.fromEntries(
        [...new Set(termKeys)].sort().map((key) => [key, terms.get(key)![lang].term]),
      ),
    };
  };
  return {
    diagnostics,
    compiled: {
      rules: {
        system: data.system,
        scoringVersion: data.scoringVersion,
        unit: SCORING_UNIT,
        dims: data.dims as Dim[],
        omitted: data.omitted as Dim[],
        palaceOf: data.palaceOf,
        clamp,
        cutpoints,
        brightnessScale,
        groups,
        rules: rules.sort(byId),
      },
      copy: {
        system: data.system,
        scoringVersion: data.scoringVersion,
        locales: { zh: locale('zh'), en: locale('en') },
      },
    },
  };
}
const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
/** Banned promises, positioning claims and half-width zh punctuation across all reader copy. */
function checkProse(
  data: SourceScoring,
  error: (path: (string | number)[], message: string) => void,
) {
  const walk = (value: unknown, path: (string | number)[]): void => {
    if (typeof value === 'string') {
      const locale = path.at(-1);
      if (locale !== 'zh' && locale !== 'en') return;
      for (const word of [...banned[locale], ...positioningBanned[locale]])
        if (
          locale === 'zh'
            ? value.includes(word)
            : new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(value)
        )
          error(path, `Banned emphasis phrase: ${word}`);
      if (locale === 'zh' && /[,;:!?()]/.test(value.replace(/\{\w+\}/g, '')))
        error(path, 'Chinese emphasis copy must use full-width punctuation');
      return;
    }
    if (value && typeof value === 'object')
      for (const [key, child] of Object.entries(value)) walk(child, [...path, key]);
  };
  data.rules.forEach((rule, index) => walk(rule.copy, ['rules', index, 'copy']));
  walk(data.copy, ['copy']);
}
