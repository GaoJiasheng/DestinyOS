import { describe, expect, it } from 'vitest';
import { toTraditional, localeText, sourceLocale } from '../src/locale';
import { simplifiedResidue } from './traditional-check';
import zh from '../../../apps/web/messages/zh.json';
import tw from '../../../apps/web/messages/zh-TW.json';
import { normalizeBirth } from '../../engine/src';
import { fromDbLocale, toDbLocale } from '../../../apps/web/lib/db-locale';

describe('B-09 Taiwan locale', () => {
  it('uses Taiwan vocabulary and canonical metaphysical spellings', () => {
    expect(toTraditional('软件、体系、数据、信息、默认、登录、乾坤、乾卦、罗睺、裏面、里面')).toBe(
      '軟體、體系、資料、資訊、預設、登入、乾坤、乾卦、羅睺、裡面、裡面',
    );
    expect(localeText('资料', 'zh')).toBe('资料');
    expect(localeText('data', 'en')).toBe('data');
    expect(localeText('资料', 'zh-TW')).toBe('資料');
    expect(sourceLocale('zh-TW')).toBe('zh');
    expect(sourceLocale('en')).toBe('en');
    expect(fromDbLocale(toDbLocale('zh-TW'))).toBe('zh-TW');
    expect(fromDbLocale(toDbLocale('zh'))).toBe('zh');
  });
  it('preserves ICU variables, term keys and link destinations, including Chinese destinations', () => {
    expect(
      toTraditional(
        '报告 {name}：[[term:乾卦]] [资料](/zh/learn/资料) {count, plural, one {一份报告} other {# 份报告}}',
      ),
    ).toBe(
      '報告 {name}：[[term:乾卦]] [資料](/zh/learn/资料) {count, plural, one {一份報告} other {# 份報告}}',
    );
  });
  it('preserves astronomical 斗 and distance units while normalizing locative 里', () => {
    expect(toTraditional('紫微斗数、生日里、公里、里程碑、姓名表、里加、塔里木、万里')).toBe(
      '紫微斗數、生日裡、公里、里程碑、姓名表、里加、塔里木、萬里',
    );
    expect(simplifiedResidue('紫微斗數、生日裡、公里、里程碑')).toEqual([]);
    expect(simplifiedResidue('生日里')).toContain('里');
  });
  it('converts standalone ICU plural branch text', () => {
    expect(toTraditional('{count, plural, one {一份报告} other {# 份报告}}')).toBe(
      '{count, plural, one {一份報告} other {# 份報告}}',
    );
  });
  it('generates exactly the source keys and detects deliberately injected simplified residue', () => {
    expect(Object.keys(tw)).toEqual(Object.keys(zh));
    for (const key of Object.keys(zh) as (keyof typeof zh)[])
      expect(tw[key]).toBe(toTraditional(zh[key]));
    expect(simplifiedResidue('報告資料體系羅睺乾坤')).toEqual([]);
    expect(simplifiedResidue('报告资料体系')).toContain('报');
  });
  it('keeps a bounded cache useful after eviction and skips oversized input', () => {
    for (let i = 0; i < 2050; i++) toTraditional(`测试${i}`);
    expect(toTraditional('测试2049')).toBe('測試2049');
    expect(toTraditional('测试2049')).toBe('測試2049');
    expect(toTraditional('a'.repeat(100001))).toHaveLength(100001);
  });
  it('accepts zh-TW at the birth normalization boundary without changing Chinese defaults', () => {
    const birth = {
      calendar: 'gregorian',
      year: 1990,
      month: 5,
      day: 15,
      timeUnknown: true,
      gender: 'unspecified',
    };
    expect(normalizeBirth(birth, 'zh-TW')).toEqual(normalizeBirth(birth, 'zh'));
  });
});
