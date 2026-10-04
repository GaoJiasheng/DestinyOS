import { parse } from '@formatjs/icu-messageformat-parser';
import type { Catalog } from '../apps/web/i18n/catalog';
/** Reject non-string catalogs, missing/extra keys, and malformed ICU messages. */
export function checkCatalogs(zh: unknown, en: unknown): string[] {
  const errors: string[] = [];
  function validate(value: unknown, locale: string): Catalog {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      errors.push(`${locale}: expected a message object`);
      return {};
    }
    const catalog: Catalog = {};
    for (const [key, message] of Object.entries(value)) {
      if (typeof message !== 'string' || !message.trim()) {
        errors.push(`${locale}.${key}: expected a nonempty string`);
        continue;
      }
      catalog[key] = message;
      try {
        parse(message, { requiresOtherClause: true });
      } catch (error) {
        errors.push(`${locale}.${key}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    return catalog;
  }
  const a = validate(zh, 'zh');
  const b = validate(en, 'en');
  for (const key of Object.keys(a)) if (!(key in b)) errors.push(`en: missing ${key}`);
  for (const key of Object.keys(b)) if (!(key in a)) errors.push(`zh: missing ${key}`);
  return errors;
}
