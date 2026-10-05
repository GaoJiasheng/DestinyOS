import { z } from 'zod';
import {
  Aspect,
  Angle,
  Branch,
  BranchRelationType,
  Element,
  Planet,
  Sign,
  SolarTerm,
  TenGod,
} from '../../enums';
import { GanZhiSchema } from '../birth';
import { CardKeySchema } from './tarot';
import { PanchangSchema } from './vedic';
import { PillarKeySchema } from './bazi';
const score = z.number().finite().min(15).max(95);
const elements = z
  .object({
    wood: z.number(),
    fire: z.number(),
    earth: z.number(),
    metal: z.number(),
    water: z.number(),
  })
  .strict();
export const DailyChartSchema = z
  .object({
    date: z
      .object({
        local: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        tz: z.string(),
        ganZhi: z.object({ year: GanZhiSchema, month: GanZhiSchema, day: GanZhiSchema }).strict(),
        lunar: z
          .object({
            year: z.number().int(),
            month: z.number().int().min(1).max(12),
            day: z.number().int().min(1).max(30),
            isLeap: z.boolean(),
          })
          .strict(),
        solarTerm: z
          .object({ name: z.nativeEnum(SolarTerm), at: z.string() })
          .strict()
          .optional(),
      })
      .strict(),
    bazi: z
      .object({
        dayMasterRelation: z.nativeEnum(TenGod),
        branchRelation: z.union([z.nativeEnum(BranchRelationType), z.literal('none')]),
        elementBalance: elements,
        favorable: z.array(z.nativeEnum(Element)),
        unfavorable: z.array(z.nativeEnum(Element)),
        todayElement: z.nativeEnum(Element),
        luckyColor: z.array(z.string()).length(1),
        luckyNumbers: z.array(z.number().int().min(1).max(10)).length(2),
        luckyDirection: z.string(),
        goodHours: z
          .array(
            z
              .object({
                branch: z.nativeEnum(Branch),
                from: z.string().regex(/^\d{2}:\d{2}$/),
                to: z.string().regex(/^\d{2}:\d{2}$/),
              })
              .strict(),
          )
          .length(2),
        almanac: z.object({ yi: z.array(z.string()), ji: z.array(z.string()) }).strict(),
        // DESIGN-GAP: Additional evidence/indicator fields expose requirements absent from 04's illustrative schema; zodiac allies use shared branch IDs.
        favorableHit: z.boolean(),
        unfavorableHit: z.boolean(),
        branchRelations: z.array(
          z.object({ pillar: PillarKeySchema, type: z.nativeEnum(BranchRelationType) }).strict(),
        ),
        secondaryRelations: z.array(
          z
            .object({
              target: z.enum(['luck', 'year']),
              kind: z.enum(['stem', 'branch']),
              type: z.enum(['clash', 'combine']),
            })
            .strict(),
        ),
        luckyColorHex: z.string().regex(/^#[\da-fA-F]{6}$/),
        luckyColorElement: z.nativeEnum(Element),
        nobleZodiac: z.array(z.nativeEnum(Branch)),
      })
      .strict(),
    astro: z
      .object({
        moonSign: z.nativeEnum(Sign),
        moonPhase: z.object({ name: z.string(), angle: z.number().min(0).lt(360) }).strict(),
        sunSign: z.nativeEnum(Sign),
        transits: z
          .array(
            z
              .object({
                transiting: z.nativeEnum(Planet),
                natal: z.union([z.nativeEnum(Planet), z.enum([Angle.asc, Angle.mc])]),
                aspect: z.nativeEnum(Aspect),
                orb: z.number().finite().nonnegative(),
                applying: z.boolean(),
              })
              .strict(),
          )
          .max(3),
        voidOfCourse: z.boolean().optional(),
        // DESIGN-GAP: Degree, ingress and collective event evidence extend the abbreviated astro schema; ASC/MC remain angle IDs rather than renamed planets.
        moonDegree: z.number().min(0).lt(30),
        moonChangesSign: z.boolean(),
        moonIngress: z
          .object({ sign: z.nativeEnum(Sign), at: z.string().datetime() })
          .strict()
          .optional(),
        retrogrades: z.array(z.enum(['mercury', 'venus', 'mars'])),
        lunation: z.enum(['new_moon', 'full_moon']).nullable(),
      })
      .strict(),
    // DESIGN-GAP: TarotCard is not defined in 04; use the existing shared RWS CardKey rather than copying deck metadata.
    tarot: z.object({ card: CardKeySchema, reversed: z.boolean() }).strict(),
    vedic: PanchangSchema.optional(),
    numerology: z
      .object({ personalDay: z.number().int().min(1).max(9) })
      .strict()
      .optional(),
    scores: z
      .object({
        career: score,
        wealth: score,
        love: score,
        health: score,
        social: score,
        overall: score,
      })
      .strict(),
    findings: z.array(z.string()),
    doDont: z.object({ do: z.array(z.string()).max(3), dont: z.array(z.string()).max(3) }).strict(),
    oneLiner: z.string().regex(/^daily\.oneliner\.(great|good|mixed|careful)\.[a-z_]+$/),
  })
  .strict();
export type DailyChart = z.infer<typeof DailyChartSchema>;
export type DailyTransit = DailyChart['astro']['transits'][number];
