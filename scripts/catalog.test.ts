import { describe, expect, it } from 'vitest';
import { toMessages, runtimeKey } from '../apps/web/i18n/catalog';
import { brand } from '../packages/shared/src/brand';
import zh from '../apps/web/messages/zh.json';
import en from '../apps/web/messages/en.json';
describe('documented catalog contracts', () => {
  it('preserves the exact parent message and help key regardless of insertion order', () => {
    const input = { 'form.birth.timeUnknown.help': 'Help', 'form.birth.timeUnknown': 'Label' };
    expect(toMessages(input)).toEqual({
      form: { birth: { timeUnknown: { help: 'Help', __value: 'Label' } } },
    });
    expect(runtimeKey('form.birth.timeUnknown', input)).toBe('form.birth.timeUnknown.__value');
    expect(runtimeKey('form.birth.timeUnknown.help', input)).toBe('form.birth.timeUnknown.help');
  });
  it('keeps the shared taglines consistent with both source catalogs', () => {
    expect(zh['brand.tagline']).toBe(brand.tagline.zh);
    expect(en['brand.tagline']).toBe(brand.tagline.en);
  });
  it('keeps the lightweight runtime namespace table in sync with both catalogs', () => {
    for (const catalog of [zh, en])
      for (const key of Object.keys(catalog))
        expect(runtimeKey(key)).toBe(runtimeKey(key, catalog));
  });
});
