import { z } from 'zod';
import { Branch, Element, Stem, Trigram } from '../../enums';
import {
  HexagramSchema,
  PillarSchema,
  VerdictSchema,
  SixRelativeSchema,
  SixSpiritSchema,
  UseGodStateSchema,
  RelationSchema,
  StrengthSchema,
  LineStemSchema,
} from './divination';
export const IchingCategorySchema = z.enum([
  'career',
  'wealth',
  'love',
  'health',
  'study',
  'travel',
  'decision',
  'other',
]);
export const IchingChartSchema = z
  .object({
    method: z.enum(['meihua', 'liuyao']),
    category: IchingCategorySchema,
    castAt: z
      .object({
        local: z.string(),
        tz: z.string(),
        lunar: z.object({
          year: z.number().int(),
          month: z.number().int(),
          day: z.number().int(),
          isLeap: z.boolean(),
        }),
        dayGanZhi: PillarSchema,
        monthBranch: z.nativeEnum(Branch),
      })
      .strict(),
    primary: HexagramSchema,
    changing: HexagramSchema.nullable(),
    mutual: HexagramSchema.optional(),
    movingLines: z.array(z.number().int().min(1).max(6)),
    meihua: z
      .object({
        numbers: z
          .object({
            upper: z.number(),
            lower: z.number(),
            moving: z.number(),
            source: z.array(z.number()),
          })
          .strict(),
        body: z.nativeEnum(Trigram),
        use: z.nativeEnum(Trigram),
        relation: RelationSchema,
        seasonalStrength: StrengthSchema,
        mutualRelation: RelationSchema,
        changingRelation: RelationSchema,
      })
      .strict()
      .optional(),
    liuyao: z
      .object({
        throws: z
          .array(z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]))
          .length(6),
        lines: z
          .array(
            LineStemSchema.extend({
              position: z.number().int().min(1).max(6),
              yang: z.boolean(),
              moving: z.boolean(),
              spirit: SixSpiritSchema,
              isShi: z.boolean(),
              isYing: z.boolean(),
              changedTo: LineStemSchema.optional(),
            }).strict(),
          )
          .length(6),
        palace: z.nativeEnum(Trigram),
        palaceElement: z.nativeEnum(Element),
        hidden: z.array(
          z
            .object({
              relative: SixRelativeSchema,
              stem: z.nativeEnum(Stem),
              branch: z.nativeEnum(Branch),
              underLine: z.number().int().min(1).max(6),
            })
            .strict(),
        ),
        useGod: z
          .object({
            relative: SixRelativeSchema,
            lines: z.array(z.number().int().min(1).max(6)),
            state: UseGodStateSchema,
          })
          .strict(),
        voidBranches: z.array(z.nativeEnum(Branch)).length(2),
        findings: z.array(z.string()),
      })
      .strict()
      .optional(),
    verdict: VerdictSchema,
    score: z.number().min(0).max(100),
  })
  .strict()
  .superRefine((chart, ctx) => {
    if (
      chart.method === 'meihua'
        ? !chart.meihua || !chart.mutual || chart.liuyao !== undefined
        : !chart.liuyao || chart.meihua !== undefined || chart.mutual !== undefined
    )
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid method chart' });
  });
export type IchingChart = z.infer<typeof IchingChartSchema>;
