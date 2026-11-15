import { expect, it } from 'vitest';
import { createTranslator, type AbstractIntlMessages } from 'next-intl';
import format, { type CompiledMessage } from 'icu-minify/format';
import { precompileMessages } from '../i18n/precompile';
import { toMessages, type RuntimeMessages } from '../i18n/catalog';
import errorMessages from '../i18n/error-messages.json';
import zh from '../messages/zh.json';
import en from '../messages/en.json';
import tw from '../messages/zh-TW.json';
import zhTarot from '../messages/zh/tarot.json';
import enTarot from '../messages/en/tarot.json';
import twTarot from '../messages/zh-TW/tarot.json';
import zhInterpretation from '../messages/zh/interpretation.json';
import enInterpretation from '../messages/en/interpretation.json';
import twInterpretation from '../messages/zh-TW/interpretation.json';

type FormatValues = Record<string, string | number | Date>;
const formatters = {
  getDateTimeFormat: (...args: ConstructorParameters<typeof Intl.DateTimeFormat>) =>
    new Intl.DateTimeFormat(...args),
  getNumberFormat: (...args: ConstructorParameters<typeof Intl.NumberFormat>) =>
    new Intl.NumberFormat(...args),
  getPluralRules: (...args: ConstructorParameters<typeof Intl.PluralRules>) =>
    new Intl.PluralRules(...args),
};
const plural = new Set([2, 3]);
const temporal = new Set([5, 6]);

/** Derive a value for every argument a compiled message references, by its ICU type. */
function sampleValues(message: unknown, values: FormatValues = {}): FormatValues {
  if (!Array.isArray(message)) return values;
  const [head, type, ...rest] = message;
  if (typeof head === 'string' && (type === undefined || typeof type === 'number')) {
    values[head] =
      type === undefined || type === 1
        ? 'Sample'
        : plural.has(type) || type === 4
          ? 3
          : temporal.has(type)
            ? new Date(Date.UTC(2026, 10, 15, 8, 30))
            : 'Sample';
    for (const part of rest) {
      if (part && typeof part === 'object' && !Array.isArray(part))
        for (const branch of Object.values(part)) sampleValues(branch, values);
      else sampleValues(part, values);
    }
    return values;
  }
  for (const part of message) sampleValues(part, values);
  return values;
}

function leaves(messages: AbstractIntlMessages, prefix = ''): Array<[string, string]> {
  return Object.entries(messages).flatMap(([key, value]) =>
    typeof value === 'string'
      ? [[prefix + key, value] as [string, string]]
      : leaves(value, `${prefix}${key}.`),
  );
}

for (const [locale, catalogs] of [
  ['zh', [zh, zhTarot, zhInterpretation]],
  ['en', [en, enTarot, enInterpretation]],
  ['zh-TW', [tw, twTarot, twInterpretation]],
] as const) {
  it(`${locale}: precompiled catalogs format exactly like the full ICU parser`, () => {
    const raw = toMessages(Object.assign({}, ...catalogs));
    const compiled = precompileMessages(raw);
    const t = createTranslator<RuntimeMessages>({ locale, messages: raw, timeZone: 'UTC' });
    let checked = 0;
    for (const [key, source] of leaves(raw)) {
      const message = key.split('.').reduce<unknown>(
        (node, part) => (node as Record<string, unknown>)[part],
        compiled,
      ) as CompiledMessage;
      // React Server Components only serialize plain objects across the client boundary.
      expect(JSON.parse(JSON.stringify(message)), key).toStrictEqual(message);
      const values = sampleValues(message);
      expect(format(message, locale, values, { formatters, timeZone: 'UTC' }), key).toBe(
        t(key, values),
      );
      // Plain text must cross the boundary untouched so Flight payloads do not grow.
      if (!/[{}'<]/.test(source)) expect(message, key).toBe(source);
      checked++;
    }
    expect(checked).toBeGreaterThan(1000);
  });
}

it('keeps the provider-less global error catalog parser-free', () => {
  for (const catalog of Object.values(errorMessages))
    for (const [key, value] of leaves(catalog as AbstractIntlMessages))
      expect(precompileMessages({ value }).value, key).toBe(value);
});

it('reuses compiled subtrees so Flight can deduplicate catalogs shared by nested providers', () => {
  const common = { retry: 'Retry {count}' };
  const shell = precompileMessages({ common, nav: { today: 'Today' } });
  const feature = precompileMessages({ common });
  expect(feature.common).toBe(shell.common);
});
