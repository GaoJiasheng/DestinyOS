import { z } from 'zod';
import { Stem, Branch, Trigram, SolarTerm } from '../../enums';
import { PillarSchema, VerdictSchema } from './divination';
// DESIGN-GAP: Star/Gate/Deity/Direction keys were unspecified; use glossary pinyin and compass names.
export const StarSchema = z.enum([
  'tian_peng',
  'tian_rui',
  'tian_chong',
  'tian_fu',
  'tian_qin',
  'tian_xin',
  'tian_zhu',
  'tian_ren',
  'tian_ying',
]);
export const GateSchema = z.enum(['xiu', 'si', 'shang', 'du', 'kai', 'jing', 'sheng', 'jing_view']);
export const DeitySchema = z.enum([
  'zhi_fu',
  'teng_she',
  'tai_yin',
  'liu_he',
  'bai_hu',
  'xuan_wu',
  'jiu_di',
  'jiu_tian',
]);
export const DirectionSchema = z.enum([
  'north',
  'southwest',
  'east',
  'southeast',
  'center',
  'northwest',
  'west',
  'northeast',
  'south',
]);
export const QimenFlagSchema = z.enum([
  'void',
  'horse',
  'fu_yin',
  'fan_yin',
  'gate_forced',
  'gate_controlled',
  'ji_xing',
  'ru_mu',
]);
export const QimenCategorySchema = z.enum([
  'career',
  'wealth',
  'love',
  'health',
  'travel',
  'exam',
  'lost',
  'general',
]);
export const QimenPalaceSchema = z
  .object({
    index: z.number().int().min(1).max(9),
    trigram: z.nativeEnum(Trigram).nullable(),
    direction: DirectionSchema,
    earthStem: z.nativeEnum(Stem),
    skyStem: z.nativeEnum(Stem),
    star: StarSchema,
    gate: GateSchema.nullable(),
    deity: DeitySchema.nullable(),
    hiddenStem: z.nativeEnum(Stem).optional(),
    flags: z.array(QimenFlagSchema),
    patterns: z.array(z.string()),
  })
  .strict();
export const QimenChartSchema = z
  .object({
    castAt: z
      .object({ local: z.string(), tz: z.string(), adjusted: z.string().optional() })
      .strict(),
    pillars: z
      .object({ year: PillarSchema, month: PillarSchema, day: PillarSchema, hour: PillarSchema })
      .strict(),
    dun: z.enum(['yang', 'yin']),
    ju: z.number().int().min(1).max(9),
    solarTerm: z
      .object({ name: z.nativeEnum(SolarTerm), yuan: z.enum(['upper', 'middle', 'lower']) })
      .strict(),
    xunShou: z
      .object({ stem: z.literal('jia'), branch: z.nativeEnum(Branch), yi: z.nativeEnum(Stem) })
      .strict(),
    zhiFu: z
      .object({
        star: StarSchema,
        palaceEarth: z.number().int().min(1).max(9),
        palaceSky: z.number().int().min(1).max(9),
      })
      .strict(),
    zhiShi: z
      .object({
        gate: GateSchema,
        palaceEarth: z.number().int().min(1).max(9),
        palaceSky: z.number().int().min(1).max(9),
      })
      .strict(),
    palaces: z.array(QimenPalaceSchema).length(9),
    useGods: z.array(
      z
        .object({
          key: z.string(),
          palaceIndex: z.number().int().min(1).max(9),
          state: z.array(z.string()),
        })
        .strict(),
    ),
    verdict: VerdictSchema,
    score: z.number().min(0).max(100),
    favorableDirections: z.array(DirectionSchema),
    timing: z.object({ favorableHours: z.array(z.nativeEnum(Branch)) }).strict(),
    findings: z.array(z.string()),
  })
  .strict();
export type QimenChart = z.infer<typeof QimenChartSchema>;
export type QimenPalace = z.infer<typeof QimenPalaceSchema>;
export type StarKey = z.infer<typeof StarSchema>;
export type GateKey = z.infer<typeof GateSchema>;
export type DeityKey = z.infer<typeof DeitySchema>;
export type Direction = z.infer<typeof DirectionSchema>;
