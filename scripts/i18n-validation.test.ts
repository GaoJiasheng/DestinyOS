import { describe, expect, it } from 'vitest';
import { checkCatalogs } from './i18n-validation';
import zh from '../apps/web/messages/zh.json';
import en from '../apps/web/messages/en.json';
describe('i18n acceptance guard', () => {
  it('validates the delivered bilingual catalogs', () => expect(checkCatalogs(zh, en)).toEqual([]));
  it('rejects missing and additional keys in either language', () =>
    expect(checkCatalogs({ a: '你好' }, { b: 'Hello' })).toEqual([
      'en: missing a',
      'zh: missing b',
    ]));
  it('rejects malformed ICU and plurals without other', () => {
    expect(checkCatalogs({ a: '{count, plural, one {one}}' }, { a: 'Hello {' })).toHaveLength(2);
  });
  it('accepts valid ICU variables and plurals', () =>
    expect(
      checkCatalogs(
        { a: '{count, plural, one {一份} other {# 份}}' },
        { a: '{count, plural, one {one} other {# readings}}' },
      ),
    ).toEqual([]));
});
