import { z } from 'zod';
import { Aspect, HouseSystem, Planet, Sign } from '../../enums';
const degree = z.number().finite().min(0).lt(360);
const house = z.number().int().min(1).max(12);
export const AstroAspectSchema = z
  .object({
    a: z.nativeEnum(Planet),
    b: z.nativeEnum(Planet),
    type: z.nativeEnum(Aspect),
    orb: z.number().finite().nonnegative(),
    applying: z.boolean(),
    major: z.boolean(),
  })
  .strict();
export const AstroChartSchema = z
  .object({
    noonChart: z.boolean(),
    jdUT: z.number().finite(),
    obliquity: degree,
    houseSystem: z.nativeEnum(HouseSystem),
    bodies: z.array(
      z
        .object({
          key: z.nativeEnum(Planet),
          lon: degree,
          lat: z.number().finite().min(-90).max(90),
          sign: z.nativeEnum(Sign),
          degInSign: degree.lt(30),
          retro: z.boolean(),
          speed: z.number().finite(),
          house: house.nullable(),
          nearCusp: z.boolean().optional(),
          anaretic: z.boolean().optional(),
          approximate: z.boolean().optional(),
          uncertaintyDegrees: z.number().optional(),
        })
        .strict(),
    ),
    angles: z.object({ asc: degree, mc: degree, dsc: degree, ic: degree }).strict().nullable(),
    houses: z
      .array(
        z
          .object({
            index: house,
            cusp: degree,
            sign: z.nativeEnum(Sign),
            ruler: z.nativeEnum(Planet),
          })
          .strict(),
      )
      .length(12)
      .nullable(),
    aspects: z.array(AstroAspectSchema),
    stats: z
      .object({
        elements: z
          .object({ fire: z.number(), earth: z.number(), air: z.number(), water: z.number() })
          .strict(),
        modalities: z
          .object({ cardinal: z.number(), fixed: z.number(), mutable: z.number() })
          .strict(),
        polarity: z.object({ positive: z.number(), negative: z.number() }).strict(),
        hemispheres: z
          .object({
            upper: z.number(),
            lower: z.number(),
            eastern: z.number(),
            western: z.number(),
          })
          .strict()
          .nullable(),
        quadrants: z.array(z.number()).length(4).nullable(),
        stelliums: z.array(
          z
            .object({
              sign: z.nativeEnum(Sign).optional(),
              house: house.optional(),
              bodies: z.array(z.nativeEnum(Planet)),
            })
            .strict(),
        ),
      })
      .strict(),
    rulers: z
      .object({
        chartRuler: z.nativeEnum(Planet).nullable(),
        mutualReceptions: z.array(z.tuple([z.nativeEnum(Planet), z.nativeEnum(Planet)])),
      })
      .strict(),
    moonPhase: z.object({ name: z.string(), angle: degree }).strict(),
    // DESIGN-GAP: Extend the illustrative chart with latitude, approximation/uncertainty flags and detected aspect patterns required by §2/§7.
    patterns: z.array(
      z
        .object({
          key: z.enum(['grand_trine', 't_square', 'grand_cross', 'kite', 'yod']),
          bodies: z.array(z.nativeEnum(Planet)),
        })
        .strict(),
    ),
  })
  .strict();
export const AstrologyChartSchema = AstroChartSchema;
export type AstroChart = z.infer<typeof AstroChartSchema>;
export type AstrologyChart = AstroChart;
export type AstroAspect = z.infer<typeof AstroAspectSchema>;
