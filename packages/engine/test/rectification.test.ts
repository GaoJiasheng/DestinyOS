import { describe, expect, it } from 'vitest';
import {
  BirthInputSchema,
  Branch,
  RECTIFICATION_QUESTION_KEYS,
  RECTIFICATION_AFFINITIES,
  type BirthInput,
  type RectificationAnswers,
} from '@tianji/shared';
import {
  rectifyBirth,
  scoreRectification,
  type RectificationCandidate,
} from '../src/rectification';
import { EngineError } from '../src/common/error';
import { computeBazi } from '../src/bazi';
import { computeZiwei } from '../src/ziwei';
import { normalizeBirth } from '../src/common/normalize-birth';
const birth: BirthInput = {
  calendar: 'gregorian',
  year: 1990,
  month: 5,
  day: 15,
  timeUnknown: true,
  gender: 'male',
};
const now = '2026-10-05T00:00:00Z';
const unsure: RectificationAnswers = { period: 'uncertain', answers: Array(7).fill('unsure') };
const candidate = (
  branch: Branch,
  stars: RectificationCandidate['lifeStars'],
  god: RectificationCandidate['hourPillar']['tenGod'],
): RectificationCandidate => ({
  branch,
  hour: 0,
  birth,
  lifeStars: stars,
  hourPillar: { stem: 'jia', branch, tenGod: god },
});
describe('rectification scoring', () => {
  it('adds star and ten-god weights once per question, retaining an explainable score', () => {
    const ranks = scoreRectification(
      [
        candidate('zi', ['zi_wei', 'wu_qu'], 'qi_sha'),
        candidate('chou', ['zi_wei'], 'shi_shen'),
        candidate('yin', ['tai_yin'], 'qi_sha'),
        candidate('mao', ['tian_tong'], 'zheng_cai'),
      ],
      { ...unsure, answers: ['a', ...Array(6).fill('unsure')] },
    );
    expect(ranks.map((r) => r.score)).toEqual([4, 2, 2, 0]);
    expect(ranks[0]!.confidence).toBeCloseTo(4 / 31);
    expect(ranks.map((r) => r.branch)).toEqual(['zi', 'chou', 'yin', 'mao']);
  });
  it.each(['a', 'b', 'c'] as const)(
    'uses documented affinities for every question, option %s',
    (answer) => {
      expect(RECTIFICATION_QUESTION_KEYS).toHaveLength(7);
      RECTIFICATION_AFFINITIES.forEach((options, index) => {
        const affinity = options[['a', 'b', 'c'].indexOf(answer)]!;
        const answers = [...unsure.answers];
        answers[index] = answer;
        const rank = scoreRectification([candidate('zi', [...affinity.stars], affinity.gods[0]!)], {
          ...unsure,
          answers,
        });
        expect(rank[0]!.questionnaireScore).toBe(4);
      });
    },
  );
  it.each([
    ['dawn', ['yin', 'mao']],
    ['morning', ['chen', 'si']],
    ['noon', ['si', 'wu']],
    ['afternoon', ['wei', 'shen']],
    ['evening', ['you', 'xu']],
    ['night', ['xu', 'hai']],
    ['late_night', ['zi', 'chou']],
    ['uncertain', []],
  ] as const)('applies the soft %s prior without dropping candidates', (period, expected) => {
    const ranks = scoreRectification(
      Object.values(Branch).map((b) => candidate(b, [], 'bi_jian')),
      { ...unsure, period },
    );
    expect(ranks).toHaveLength(12);
    expect(ranks.filter((r) => r.priorScore === 3).map((r) => r.branch)).toEqual(expected);
    expect(ranks.filter((r) => r.priorScore === 0).every((r) => r.confidence === 0)).toBe(true);
  });
  it('all unsure is zero evidence with deterministic ties; inputs are not mutated', () => {
    const candidates = [candidate('hai', [], 'bi_jian'), candidate('zi', [], 'zheng_yin')];
    const before = JSON.stringify(candidates);
    expect(scoreRectification(candidates, unsure).map((r) => [r.branch, r.confidence])).toEqual([
      ['zi', 0],
      ['hai', 0],
    ]);
    expect(JSON.stringify(candidates)).toBe(before);
  });
  it('rejects incomplete or invalid questionnaire answers', () => {
    expect(() => scoreRectification([], { ...unsure, answers: [] })).toThrow(EngineError);
    expect(() =>
      scoreRectification([], { ...unsure, period: 'invalid' } as unknown as RectificationAnswers),
    ).toThrow(EngineError);
  });
});
describe('twelve trial charts', () => {
  it.each(['zh', 'en'] as const)(
    'matches both existing engines and retains twelve trials in %s',
    (locale) => {
      const ranks = rectifyBirth(birth, unsure, now, locale);
      expect(ranks.map((r) => r.branch)).toEqual(Object.values(Branch));
      expect(ranks.map((r) => r.hour)).toEqual(Array.from({ length: 12 }, (_, i) => i * 2));
      for (const rank of ranks) {
        const normalized = normalizeBirth(rank.birth, locale);
        const bazi = computeBazi(normalized, { now, yearsAround: 0 });
        const ziwei = computeZiwei({ birth: normalized, now });
        const life = ziwei.palaces.find((p) => p.key === 'life')!;
        const expected = life.majorStars.length
          ? life.majorStars
          : ziwei.palaces[(life.index + 6) % 12]!.majorStars;
        expect(rank.lifeStars).toEqual(expected.map((s) => s.key));
        expect(rank.hourPillar).toEqual({
          stem: bazi.pillars.hour!.stem,
          branch: bazi.pillars.hour!.branch,
          tenGod: bazi.pillars.hour!.tenGod,
        });
        expect(rank.birth.timeSource).toBeUndefined();
      }
      expect(birth.timeUnknown).toBe(true);
    },
  );
  it('supports leap lunar dates and western DST/solar-time correction without pruning trials', () => {
    const lunar = rectifyBirth(
      { ...birth, calendar: 'lunar', year: 1993, month: 3, isLeapMonth: true },
      unsure,
      now,
    );
    expect(lunar).toHaveLength(12);
    const ny = rectifyBirth(
      {
        ...birth,
        month: 7,
        place: { name: 'New York', lat: 40.71, lng: -74.01, tz: 'America/New_York' },
      },
      unsure,
      now,
    );
    expect(ny).toHaveLength(12);
    expect(ny.every((r) => r.lifeStars.length > 0 && Number.isFinite(r.confidence))).toBe(true);
  });
  it('validates birth input, explicit now, and provenance at the input boundary', () => {
    expect(() => rectifyBirth({ ...birth, year: 1800 }, unsure, now)).toThrow(EngineError);
    expect(() => rectifyBirth(birth, unsure, 'bad')).toThrow(EngineError);
    expect(
      BirthInputSchema.safeParse({
        ...birth,
        timeSource: 'rectified',
        rectificationConfidence: 0.3,
      }).success,
    ).toBe(false);
    expect(
      BirthInputSchema.safeParse({
        ...birth,
        timeUnknown: false,
        hour: 8,
        minute: 0,
        timeSource: 'rectified',
        rectificationConfidence: 0.3,
      }).success,
    ).toBe(true);
    expect(BirthInputSchema.safeParse({ ...birth, rectificationConfidence: 0.3 }).success).toBe(
      false,
    );
  });
});
