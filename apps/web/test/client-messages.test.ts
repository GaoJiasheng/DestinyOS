import { expect, it } from 'vitest';
import { createTranslator } from 'next-intl';
import { shellMessages } from '../i18n/client-messages';
import { toMessages } from '../i18n/catalog';
import { systems } from '../lib/system-links';
import zh from '../messages/zh.json';
import en from '../messages/en.json';
for (const [locale, catalog] of [
  ['zh', zh],
  ['en', en],
] as const) {
  it(`${locale}: shell keeps navigation and personal preview keys while excluding private feature prose`, () => {
    const messages = shellMessages(toMessages(catalog));
    const t = createTranslator({ locale, messages });
    for (const system of systems) {
      expect(t(`${system}.placeholder`)).toBe(catalog[`${system}.placeholder`]);
      expect(t(`nav.${system}`)).toBe(catalog[`nav.${system}`]);
    }
    expect(t('synastry.requiresTwo')).toBe(catalog['synastry.requiresTwo']);
    expect(t('daily.color.teal')).toBe(catalog['daily.color.teal']);
    expect(t('bazi.stems.jia')).toBe(catalog['bazi.stems.jia']);
    expect(messages.glossary).toBeUndefined();
    expect(messages.rectification).toBeUndefined();
    expect(messages.charts).toBeUndefined();
    expect(Buffer.byteLength(JSON.stringify(messages))).toBeLessThan(60000);
  });
}
