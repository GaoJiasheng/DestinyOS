import { z } from 'zod';
import type { StarKey } from './charts/ziwei';
import type { TenGod } from '../enums';

export const RectificationPeriodSchema = z.enum([
  'dawn',
  'morning',
  'noon',
  'afternoon',
  'evening',
  'night',
  'late_night',
  'uncertain',
]);
export const RectificationAnswerSchema = z.enum(['a', 'b', 'c', 'unsure']);
export const RECTIFICATION_QUESTION_KEYS = [
  'decisions',
  'work',
  'social',
  'learning',
  'changes',
  'responsibility',
  'conflict',
] as const;
export const RectificationAnswersSchema = z
  .object({
    period: RectificationPeriodSchema,
    answers: z.array(RectificationAnswerSchema).length(7),
  })
  .strict();
export type RectificationAnswers = z.infer<typeof RectificationAnswersSchema>;
type Affinity = { stars: readonly StarKey[]; gods: readonly TenGod[] };
// DESIGN-GAP: Seven symbolic personality/experience prompts use equal star/ten-god weights; these are transparent heuristics, not empirically calibrated birth-time probabilities.
export const RECTIFICATION_AFFINITIES: readonly (readonly Affinity[])[] = [
  [
    { stars: ['zi_wei', 'wu_qu', 'qi_sha'], gods: ['zheng_guan', 'qi_sha'] },
    { stars: ['tian_ji', 'ju_men', 'tai_yin'], gods: ['pian_yin', 'zheng_yin'] },
    { stars: ['tian_tong', 'tan_lang', 'po_jun'], gods: ['shi_shen', 'shang_guan'] },
  ],
  [
    { stars: ['wu_qu', 'tian_fu', 'tian_xiang'], gods: ['zheng_cai', 'zheng_guan'] },
    { stars: ['tan_lang', 'po_jun', 'tian_ji'], gods: ['pian_cai', 'shang_guan'] },
    { stars: ['tai_yang', 'tian_liang', 'tian_tong'], gods: ['zheng_yin', 'shi_shen'] },
  ],
  [
    { stars: ['tai_yang', 'tan_lang', 'zi_wei'], gods: ['jie_cai', 'pian_cai'] },
    { stars: ['tai_yin', 'tian_ji', 'ju_men'], gods: ['pian_yin', 'zheng_yin'] },
    { stars: ['tian_xiang', 'tian_tong', 'tian_liang'], gods: ['shi_shen', 'zheng_guan'] },
  ],
  [
    { stars: ['tai_yin', 'tian_liang', 'tian_fu'], gods: ['zheng_yin', 'zheng_guan'] },
    { stars: ['tian_ji', 'ju_men', 'lian_zhen'], gods: ['pian_yin', 'shang_guan'] },
    { stars: ['qi_sha', 'po_jun', 'wu_qu'], gods: ['bi_jian', 'qi_sha'] },
  ],
  [
    { stars: ['po_jun', 'qi_sha', 'tan_lang'], gods: ['pian_cai', 'qi_sha'] },
    { stars: ['tian_fu', 'tian_tong', 'tai_yin'], gods: ['zheng_cai', 'zheng_yin'] },
    { stars: ['tian_ji', 'tian_xiang', 'ju_men'], gods: ['shang_guan', 'shi_shen'] },
  ],
  [
    { stars: ['zi_wei', 'tai_yang', 'tian_liang'], gods: ['zheng_guan', 'zheng_yin'] },
    { stars: ['wu_qu', 'tian_fu', 'tian_xiang'], gods: ['zheng_cai', 'bi_jian'] },
    { stars: ['tan_lang', 'po_jun', 'tian_tong'], gods: ['jie_cai', 'shi_shen'] },
  ],
  [
    { stars: ['qi_sha', 'wu_qu', 'lian_zhen'], gods: ['qi_sha', 'bi_jian'] },
    { stars: ['ju_men', 'tian_ji', 'po_jun'], gods: ['shang_guan', 'pian_yin'] },
    { stars: ['tian_tong', 'tian_xiang', 'tai_yin'], gods: ['shi_shen', 'zheng_yin'] },
  ],
];
