import { z } from 'zod';
import {
  Stem,
  Branch,
  Element,
  YinYang,
  TenGod,
  NaYin,
  LifeStage,
  BranchRelationType,
  SolarTerm,
} from '../../enums';
// DESIGN-GAP: Supporting types omitted by §6 use explicit keys and pillar references; no display text is stored.
export const PillarKeySchema = z.enum(['year', 'month', 'day', 'hour']);
export const PatternKeySchema = z.enum([
  'zheng_guan',
  'qi_sha',
  'zheng_cai',
  'pian_cai',
  'shi_shen',
  'shang_guan',
  'zheng_yin',
  'pian_yin',
  'jian_lu',
  'yue_ren',
]);
export const ShenShaNameSchema = z.enum([
  'tian_yi_gui_ren',
  'tai_ji_gui_ren',
  'tian_de_gui_ren',
  'yue_de_gui_ren',
  'wen_chang_gui_ren',
  'xue_tang',
  'ci_guan',
  'guo_yin',
  'yi_ma',
  'hua_gai',
  'tao_hua',
  'hong_yan',
  'jiang_xing',
  'jin_yu',
  'yang_ren',
  'fei_ren',
  'lu_shen',
  'tian_luo_di_wang',
  'gu_chen_gua_su',
  'kui_gang',
]);
const stem = z.nativeEnum(Stem),
  branch = z.nativeEnum(Branch),
  element = z.nativeEnum(Element),
  god = z.nativeEnum(TenGod);
const finite = z.number().finite();
const elements = z
  .object({ wood: finite, fire: finite, earth: finite, metal: finite, water: finite })
  .strict();
export const PillarSchema = z
  .object({
    stem,
    branch,
    stemElement: element,
    branchElement: element,
    hiddenStems: z
      .array(z.object({ stem, role: z.enum(['main', 'middle', 'residual']), tenGod: god }).strict())
      .min(1)
      .max(3),
    tenGod: z.union([god, z.literal('day_master')]),
    naYin: z.nativeEnum(NaYin),
    lifeStage: z.nativeEnum(LifeStage),
    isVoid: z.boolean(),
  })
  .strict();
export const ContributionSchema = z
  .object({
    pillar: PillarKeySchema,
    source: z.enum(['stem', 'main', 'middle', 'residual', 'month_bonus']),
    stem,
    element,
    weight: finite.nonnegative(),
  })
  .strict();
export const StrengthDetailSchema = z
  .object({
    pillar: PillarKeySchema,
    source: z.enum(['season', 'stem', 'main', 'middle', 'residual']),
    element,
    score: finite,
  })
  .strict();
export const BranchRelationSchema = z
  .object({
    type: z.nativeEnum(BranchRelationType),
    pillars: z.array(z.string()).min(2).max(3),
    branches: z.array(branch).min(2).max(3),
    complete: z.boolean(),
  })
  .strict();
export const StemRelationSchema = z
  .object({
    type: z.enum(['combine', 'clash']),
    pillars: z.array(PillarKeySchema).length(2),
    stems: z.array(stem).length(2),
  })
  .strict();
export const ShenShaHitSchema = z
  .object({
    name: ShenShaNameSchema,
    basedOn: z.enum(['day_stem', 'year_branch', 'day_branch', 'month_branch']),
    hitsPillar: z.array(PillarKeySchema).min(1),
  })
  .strict();
export const BaziFeaturesSchema = z
  .object({
    bi_jian_heavy: z.boolean(),
    jie_cai_heavy: z.boolean(),
    guan_sha_hun_za: z.boolean(),
    cai_duo_shen_ruo: z.boolean(),
    shi_shang_sheng_cai: z.boolean(),
    shang_guan_jian_guan: z.boolean(),
    sha_yin_xiang_sheng: z.boolean(),
    yin_xing_heavy: z.boolean(),
    cai_xing_heavy: z.boolean(),
    has_root: z.boolean(),
    suspected_cong: z.boolean(),
    san_he_huo_ju: z.boolean(),
    san_he_shui_ju: z.boolean(),
    san_he_mu_ju: z.boolean(),
    san_he_jin_ju: z.boolean(),
    has_clash: z.boolean(),
    has_punishment: z.boolean(),
    has_tao_hua: z.boolean(),
    has_yi_ma: z.boolean(),
    missing_element: z.boolean(),
    tiao_hou_needed: z.boolean(),
    day_branch_void: z.boolean(),
    month_main_exposed: z.boolean(),
  })
  .strict();
const term = z.object({ name: z.nativeEnum(SolarTerm), at: z.string() }).strict();
export const BaziChartSchema = z
  .object({
    pillars: z
      .object({
        year: PillarSchema,
        month: PillarSchema,
        day: PillarSchema,
        hour: PillarSchema.nullable(),
      })
      .strict(),
    dayMaster: z.object({ stem, element, yinYang: z.nativeEnum(YinYang) }).strict(),
    elements: z
      .object({
        raw: elements,
        pct: elements.extend({
          wood: finite.min(0).max(100),
          fire: finite.min(0).max(100),
          earth: finite.min(0).max(100),
          metal: finite.min(0).max(100),
          water: finite.min(0).max(100),
        }),
        contributions: z.array(ContributionSchema),
      })
      .strict(),
    strength: z
      .object({
        score: finite,
        level: z.enum(['strong', 'balanced', 'weak']),
        details: z.array(StrengthDetailSchema),
        confidence: finite.min(0).max(1),
      })
      .strict(),
    useGod: z
      .object({
        favorable: z.array(element),
        unfavorable: z.array(element),
        group: z.enum(['support', 'drain', 'balance']),
        tiaoHou: element.optional(),
        rationale: z.array(z.string()),
      })
      .strict(),
    pattern: z
      .object({ name: PatternKeySchema, viaStem: z.boolean(), notes: z.array(z.string()) })
      .strict(),
    relations: z
      .object({ stems: z.array(StemRelationSchema), branches: z.array(BranchRelationSchema) })
      .strict(),
    voidBranches: z.array(branch).length(2),
    shenSha: z.array(ShenShaHitSchema),
    luck: z
      .object({
        direction: z.enum(['forward', 'backward']),
        startAge: z
          .object({
            years: finite.int().nonnegative(),
            months: finite.int().min(0).max(11),
            days: finite.int().min(0).max(29),
          })
          .strict(),
        startDate: z.string(),
        periods: z
          .array(
            z
              .object({
                index: finite.int().min(1).max(10),
                stem,
                branch,
                fromYear: finite.int(),
                toYear: finite.int(),
                fromAge: finite.nonnegative(),
                toAge: finite.nonnegative(),
                tenGod: god,
                branchTenGod: god,
                isCurrent: z.boolean(),
              })
              .strict(),
          )
          .length(10),
      })
      .strict(),
    // DESIGN-GAP: §3.5 requires luck relations omitted from §6; expose relationsToLuck alongside natal relations.
    years: z.array(
      z
        .object({
          year: finite.int(),
          stem,
          branch,
          tenGod: god,
          relationsToNatal: z.array(BranchRelationSchema),
          relationsToLuck: z.array(BranchRelationSchema),
          isCurrent: z.boolean(),
        })
        .strict(),
    ),
    months: z
      .array(
        z
          .object({
            index: finite.int().min(1).max(12),
            stem,
            branch,
            fromDate: z.string(),
            toDate: z.string(),
          })
          .strict(),
      )
      .length(12),
    solarTerms: z.object({ prevJie: term, nextJie: term }).strict(),
    solarTimeAdjust: z
      .object({
        enabled: z.boolean(),
        offsetMinutes: finite.nullable(),
        original: z.string(),
        adjusted: z.string().nullable(),
      })
      .strict(),
    features: BaziFeaturesSchema,
  })
  .strict();
export type BaziChart = z.infer<typeof BaziChartSchema>;
export type Pillar = z.infer<typeof PillarSchema>;
export type PillarKey = z.infer<typeof PillarKeySchema>;
export type Contribution = z.infer<typeof ContributionSchema>;
export type StrengthDetail = z.infer<typeof StrengthDetailSchema>;
export type BranchRelation = z.infer<typeof BranchRelationSchema>;
export type StemRelation = z.infer<typeof StemRelationSchema>;
export type ShenShaHit = z.infer<typeof ShenShaHitSchema>;
export type ShenShaName = z.infer<typeof ShenShaNameSchema>;
export type BaziFeatures = z.infer<typeof BaziFeaturesSchema>;
