import { expect, it } from 'vitest';
import { dailyExcerpt } from '../lib/daily-excerpt';

for (const locale of ['zh', 'en', 'zh-TW'] as const) {
  const term = locale === 'en' ? 'close relationships' : locale === 'zh' ? '亲密关系' : '親密關係';
  it(`${locale}: daily prose displays the localized glossary name`, () => {
    const source =
      locale === 'en' ? 'Reflect on [[term:love]] today.' : '今天可以思考[[term:love]]。';
    const result = dailyExcerpt(source, locale, () => term);
    expect(result).toContain(term);
    expect(result).not.toMatch(/\[\[|term:|\]\]/);
  });
  it(`${locale}: excerpt limits count translated prose without clipping a term marker`, () => {
    const source =
      locale === 'en'
        ? `${'reflection '.repeat(64)}[[term:love]] ${'reflection '.repeat(8)}`
        : `${'思'.repeat(94)}[[term:love]]${'考'.repeat(20)}`;
    const result = dailyExcerpt(source, locale, () => term);
    expect(result).toContain(term);
    expect(result).not.toMatch(/\[\[|term:|\]\]/);
    expect(locale === 'en' ? result.split(/\s+/).length : Array.from(result).length).toBe(
      locale === 'en' ? 70 : 100,
    );
  });
}
