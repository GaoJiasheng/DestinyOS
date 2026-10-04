import { Temporal } from '@js-temporal/polyfill';
import { Solar } from 'lunar-typescript';
import { MoonPhase } from 'astronomy-engine';
import { BirthInputSchema, type BirthInput } from '@tianji/shared';
import { normalizeBirth } from '@tianji/engine/common';
import { computeBazi } from '@tianji/engine/bazi';
import { computeAstrology } from '@tianji/engine/astrology';
import { computeDaily, dailyDateAt } from '@tianji/engine/daily';
const phases = [
  'new_moon',
  'waxing_crescent',
  'first_quarter',
  'waxing_gibbous',
  'full_moon',
  'waning_gibbous',
  'last_quarter',
  'waning_crescent',
];
const stems = ['jia', 'yi', 'bing', 'ding', 'wu', 'ji', 'geng', 'xin', 'ren', 'gui'];
const branches = [
  'zi',
  'chou',
  'yin',
  'mao',
  'chen',
  'si',
  'wu',
  'wei',
  'shen',
  'you',
  'xu',
  'hai',
];
const terms = [
  'dong_zhi',
  'xiao_han',
  'da_han',
  'li_chun',
  'yu_shui',
  'jing_zhe',
  'chun_fen',
  'qing_ming',
  'gu_yu',
  'li_xia',
  'xiao_man',
  'mang_zhong',
  'xia_zhi',
  'xiao_shu',
  'da_shu',
  'li_qiu',
  'chu_shu',
  'bai_lu',
  'qiu_fen',
  'han_lu',
  'shuang_jiang',
  'li_dong',
  'xiao_xue',
  'da_xue',
];
const termNames = [
  '冬至',
  '小寒',
  '大寒',
  '立春',
  '雨水',
  '惊蛰',
  '春分',
  '清明',
  '谷雨',
  '立夏',
  '小满',
  '芒种',
  '夏至',
  '小暑',
  '大暑',
  '立秋',
  '处暑',
  '白露',
  '秋分',
  '寒露',
  '霜降',
  '立冬',
  '小雪',
  '大雪',
];
/** Home astronomical snapshot and deterministic daily preview, using an explicit instant and IANA zone. */
export function computeHomeInsights(rawBirth: BirthInput | undefined, instant: string, tz: string) {
  const date = Temporal.Instant.from(instant).toZonedDateTimeISO(tz);
  const lunar = Solar.fromYmdHms(
    date.year,
    date.month,
    date.day,
    date.hour,
    date.minute,
    date.second,
  ).getLunar();
  const termIndex = termNames.indexOf(lunar.getPrevJieQi(false).getName());
  const sky = {
    phase: phases[Math.floor(((MoonPhase(new Date(instant)) + 22.5) % 360) / 45)]!,
    stem: stems[lunar.getDayGanIndexExact()]!,
    branch: branches[lunar.getDayZhiIndexExact()]!,
    term: terms[termIndex] ?? 'dong_zhi',
  };
  if (!rawBirth) return { sky, daily: null };
  const profile = BirthInputSchema.parse(rawBirth),
    birth = normalizeBirth(profile);
  const baziChart = computeBazi(birth, { now: instant }),
    astroChart = computeAstrology(birth);
  // DESIGN-GAP: Until T-39 supplies its server cache, the home preview computes locally with a stable date seed and no Vedic natal chart.
  const daily = computeDaily({
    birth,
    baziChart,
    astroChart,
    vedicChart: null,
    date: dailyDateAt(instant, tz),
    seed: `home:${birth.local.year}:${birth.local.month}:${birth.local.day}:${date.toPlainDate().toString()}`,
  });
  return { sky, daily };
}
