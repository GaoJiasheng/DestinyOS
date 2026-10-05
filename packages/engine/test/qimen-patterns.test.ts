import { describe, expect, it } from 'vitest';
import { STEMS } from '../src/common/ganzhi';
import { PATTERN_RULES, detectPatterns, matchesPattern, type PatternContext } from '../src/qimen';
import { palace } from './qimen-fixtures';

describe('40 explicit Qimen pattern predicates', () => {
  it('keeps independently checked classical predicates and concealed Jia handling', () => {
    const context: PatternContext = {
      palace: { ...palace, skyStem: 'geng', earthStem: 'yi' },
      zhiShiPalace: 1,
      dayStem: 'yi',
      hourStem: 'bing',
      yi: 'wu_stem',
    };
    expect(detectPatterns(context)).toContain('fu_gan_ge');
    expect(detectPatterns(context)).not.toContain('fei_gan_ge');
    expect(
      detectPatterns({ ...context, palace: { ...palace, skyStem: 'yi', earthStem: 'geng' } }),
    ).toContain('fei_gan_ge');
    expect(
      detectPatterns({ ...context, palace: { ...palace, skyStem: 'ding', index: 7 } }),
    ).toContain('san_qi_sheng_dian_ding');
    expect(
      detectPatterns({ ...context, palace: { ...palace, skyStem: 'ding', index: 9 } }),
    ).not.toContain('san_qi_sheng_dian_ding');
    expect(detectPatterns({ ...context, palace: { ...palace, earthStem: 'ding' } })).toContain(
      'yu_nv_shou_men',
    );
    expect(
      detectPatterns({
        ...context,
        dayStem: 'jia',
        palace: { ...palace, skyStem: 'geng', earthStem: 'wu_stem' },
      }),
    ).toContain('fu_gan_ge');
  });
  it('contains exactly forty unique named configurations', () => {
    expect(PATTERN_RULES).toHaveLength(40);
    expect(new Set(PATTERN_RULES.map((r) => r.key)).size).toBe(40);
  });
  it.each(PATTERN_RULES)('matches positive and rejects negative conditions for $key', (rule) => {
    const c = rule.condition;
    const context: PatternContext = {
      palace: {
        ...palace,
        ...(c.sky ? { skyStem: c.sky } : {}),
        ...(c.earth ? { earthStem: typeof c.earth === 'string' ? c.earth : c.earth[0]! } : {}),
        ...(c.gate ? { gate: c.gate } : {}),
        ...(c.deity ? { deity: c.deity } : {}),
        ...(c.index ? { index: c.index } : {}),
      },
      zhiShiPalace: c.index ?? 1,
      dayStem: 'yi',
      hourStem: 'bing',
      yi: 'wu_stem',
    };
    if (c.dayEarth) context.palace.earthStem = context.dayStem;
    if (c.daySky) context.palace.skyStem = context.dayStem;
    if (c.xunEarth) context.palace.earthStem = context.yi;
    if (c.xunSky) context.palace.skyStem = context.yi;
    if (c.fiveMismatch) {
      context.dayStem = 'jia';
      context.hourStem = 'geng';
    }
    expect(matchesPattern(rule, context)).toBe(true);
    expect(detectPatterns(context)).toContain(rule.key);
    // Independently break every required predicate, ensuring no accidental OR or omitted condition.
    if (c.sky)
      expect(
        matchesPattern(rule, {
          ...context,
          palace: { ...context.palace, skyStem: STEMS.find((s) => s !== c.sky)! },
        }),
      ).toBe(false);
    if (c.earth)
      expect(
        matchesPattern(rule, {
          ...context,
          palace: {
            ...context.palace,
            earthStem: STEMS.find((s) =>
              typeof c.earth === 'string' ? s !== c.earth : !c.earth?.includes(s),
            )!,
          },
        }),
      ).toBe(false);
    if (c.gate)
      expect(matchesPattern(rule, { ...context, palace: { ...context.palace, gate: null } })).toBe(
        false,
      );
    if (c.deity)
      expect(matchesPattern(rule, { ...context, palace: { ...context.palace, deity: null } })).toBe(
        false,
      );
    if (c.index)
      expect(
        matchesPattern(rule, {
          ...context,
          palace: { ...context.palace, index: c.index === 1 ? 2 : 1 },
        }),
      ).toBe(false);
    if (c.zhiShi) expect(matchesPattern(rule, { ...context, zhiShiPalace: 9 })).toBe(false);
    if (c.dayEarth) expect(matchesPattern(rule, { ...context, dayStem: 'gui' })).toBe(false);
    if (c.daySky) expect(matchesPattern(rule, { ...context, dayStem: 'gui' })).toBe(false);
    if (c.xunEarth || c.xunSky) expect(matchesPattern(rule, { ...context, yi: 'gui' })).toBe(false);
    if (c.fiveMismatch) expect(matchesPattern(rule, { ...context, hourStem: 'jia' })).toBe(false);
  });
});
