import {
  BirthInputSchema,
  Branch,
  RectificationAnswersSchema,
  RECTIFICATION_AFFINITIES,
  type BirthInput,
  type Locale,
  type RectificationAnswers,
  type StarKey,
  type TenGod,
  type Stem,
} from '@tianji/shared';
import { normalizeBirth } from '../common/normalize-birth';
import { EngineError } from '../common/error';
import { computeBazi } from '../bazi';
import { computeZiwei } from '../ziwei';

const branches = Object.values(Branch);
// DESIGN-GAP: Approximate civil-time bands overlap at their borders; prior adds three points and never excludes other candidates.
const periods: Record<RectificationAnswers['period'], readonly Branch[]> = {
  dawn: ['yin', 'mao'],
  morning: ['chen', 'si'],
  noon: ['si', 'wu'],
  afternoon: ['wei', 'shen'],
  evening: ['you', 'xu'],
  night: ['xu', 'hai'],
  late_night: ['zi', 'chou'],
  uncertain: [],
};
export type RectificationCandidate = {
  branch: Branch;
  hour: number;
  lifeStars: StarKey[];
  hourPillar: { stem: Stem; branch: Branch; tenGod: TenGod };
  birth: BirthInput;
};
export type RankedRectificationCandidate = RectificationCandidate & {
  score: number;
  questionnaireScore: number;
  priorScore: number;
  confidence: number;
};
/** Rank candidate chart features by seven symbolic answers plus a soft civil-time prior; stable ties use branch order. */
export function scoreRectification(
  candidates: readonly RectificationCandidate[],
  rawAnswers: RectificationAnswers,
): RankedRectificationCandidate[] {
  const parsed = RectificationAnswersSchema.safeParse(rawAnswers);
  if (!parsed.success) throw new EngineError('E_INVALID_INPUT');
  const { period, answers } = parsed.data;
  return candidates
    .map((candidate) => {
      const questionnaireScore = answers.reduce((sum, answer, index) => {
        if (answer === 'unsure') return sum;
        const affinity = RECTIFICATION_AFFINITIES[index]![['a', 'b', 'c'].indexOf(answer)]!;
        return (
          sum +
          (candidate.lifeStars.some((star) => affinity.stars.includes(star)) ? 2 : 0) +
          (affinity.gods.includes(candidate.hourPillar.tenGod) ? 2 : 0)
        );
      }, 0);
      const priorScore = periods[period].includes(candidate.branch) ? 3 : 0;
      const score = questionnaireScore + priorScore;
      // DESIGN-GAP: Similarity divides by all seven questions (28 points) plus the possible prior (3); unsure answers add no evidence and never inflate confidence.
      return { ...candidate, questionnaireScore, priorScore, score, confidence: score / 31 };
    })
    .sort((a, b) => b.score - a.score || branches.indexOf(a.branch) - branches.indexOf(b.branch));
}
/** Compute twelve civil two-hour midpoint trials using the existing default solar-time schools; now is an explicit ISO instant. */
export function rectifyBirth(
  rawBirth: BirthInput,
  answers: RectificationAnswers,
  now: string,
  locale: Locale = 'zh',
): RankedRectificationCandidate[] {
  const parsed = BirthInputSchema.safeParse(rawBirth);
  if (!parsed.success) throw new EngineError('E_INVALID_INPUT');
  const candidates = branches.map((branch, index): RectificationCandidate => {
    // DESIGN-GAP: Zi is represented by 00:00 on the supplied birthday; late Zi and within-hour/DST ambiguity require manual verification. Solar correction may change the chart's hour branch, shown separately in results.
    const birth: BirthInput = {
      ...parsed.data,
      hour: index * 2,
      minute: 0,
      timeUnknown: false,
      timeSource: undefined,
      rectificationConfidence: undefined,
    };
    const normalized = normalizeBirth(birth, locale);
    const bazi = computeBazi(normalized, { now, yearsAround: 0 });
    const ziwei = computeZiwei({ birth: normalized, now });
    const pillar = bazi.pillars.hour!;
    if (pillar.tenGod === 'day_master') throw new EngineError('E_ENGINE_INTERNAL');
    const life = ziwei.palaces.find((palace) => palace.key === 'life')!;
    // DESIGN-GAP: An empty life palace borrows opposite-palace major stars, following the existing Zi Wei report convention.
    const lifeStars = (
      life.majorStars.length
        ? life
        : ziwei.palaces.find((palace) => palace.index === (life.index + 6) % 12)!
    ).majorStars.map((star) => star.key);
    return {
      branch,
      hour: birth.hour!,
      birth,
      lifeStars,
      hourPillar: { stem: pillar.stem, branch: pillar.branch, tenGod: pillar.tenGod },
    };
  });
  return scoreRectification(candidates, answers);
}
