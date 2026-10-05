import { z } from 'zod';
import { BaziChartSchema, PillarKeySchema } from './bazi';
import { ZiweiChartSchema, StarKeySchema } from './ziwei';
import { AstroChartSchema } from './astrology';
import { VedicChartSchema } from './vedic';
import { Aspect, BranchRelationType, Element, Mutagen, Palace, Planet, TenGod } from '../../enums';
export const KootaKeySchema = z.enum([
  'varna',
  'vashya',
  'tara',
  'yoni',
  'graha_maitri',
  'gana',
  'bhakoot',
  'nadi',
]);
const koota = z
  .object({
    key: KootaKeySchema,
    score: z.number().nonnegative().max(8),
    max: z.number().int().min(1).max(8),
    a: z.string(),
    b: z.string(),
  })
  .strict();
export const AshtakootChartSchema = z
  .object({
    total: z.number().min(0).max(36),
    max: z.literal(36),
    kootas: z.array(koota).length(8),
    provisional: z.boolean(),
    moonLongitudes: z.tuple([z.number().min(0).lt(360), z.number().min(0).lt(360)]),
    taraCounts: z.tuple([z.number().int().min(1).max(27), z.number().int().min(1).max(27)]),
    signDistances: z.tuple([z.number().int().min(1).max(12), z.number().int().min(1).max(12)]),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      value.kootas.some(
        (k, i) => k.max !== i + 1 || k.score > k.max || k.key !== KootaKeySchema.options[i],
      ) ||
      Math.abs(value.total - value.kootas.reduce((sum, k) => sum + k.score, 0)) > 1e-8
    )
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid Ashtakoot breakdown' });
  });
export type AshtakootChart = z.infer<typeof AshtakootChartSchema>;
const side = z.enum(['a', 'b']);
const natal = z
  .object({
    bazi: BaziChartSchema,
    ziwei: ZiweiChartSchema.nullable(),
    astrology: AstroChartSchema,
    vedic: VedicChartSchema,
  })
  .strict();
const crossAspect = z
  .object({
    a: z.nativeEnum(Planet),
    b: z.nativeEnum(Planet),
    type: z.nativeEnum(Aspect),
    orb: z.number().finite().nonnegative(),
    separation: z.number().min(0).max(180),
  })
  .strict();
export const SynastryChartSchema = z
  .object({
    a: natal,
    b: natal,
    bazi: z
      .object({
        dayStemRelations: z.array(z.enum(['combine', 'clash'])),
        dayBranchRelations: z.array(z.nativeEnum(BranchRelationType)),
        yearRelations: z.array(z.nativeEnum(BranchRelationType)),
        elementComplementarity: z.number().min(0).max(100),
        favorableSupport: z.tuple([z.number().min(0).max(100), z.number().min(0).max(100)]),
        complementaryElements: z.array(z.nativeEnum(Element)),
        tenGodInteractions: z.array(
          z
            .object({
              observer: side,
              pillar: PillarKeySchema,
              stemGod: z.nativeEnum(TenGod),
              hiddenGods: z.array(z.nativeEnum(TenGod)),
            })
            .strict(),
        ),
        spouseStars: z
          .array(
            z
              .object({
                observer: side,
                expected: z.array(z.nativeEnum(TenGod)),
                matches: z.array(PillarKeySchema),
              })
              .strict(),
          )
          .length(2),
      })
      .strict(),
    ziwei: z
      .object({
        comparisons: z.array(
          z
            .object({
              palace: z.enum(['life', 'spouse']),
              a: z.array(StarKeySchema),
              b: z.array(StarKeySchema),
            })
            .strict(),
        ),
        transformations: z.array(
          z
            .object({
              from: side,
              mutagen: z.nativeEnum(Mutagen),
              star: StarKeySchema,
              target: z.nativeEnum(Palace),
              inLifeTriangle: z.boolean(),
              inSpouseTriangle: z.boolean(),
            })
            .strict(),
        ),
      })
      .strict()
      .nullable(),
    western: z
      .object({
        aspects: z.array(crossAspect),
        intimateAspects: z.array(crossAspect),
        overlays: z.array(
          z
            .object({
              from: side,
              planet: z.nativeEnum(Planet),
              house: z.number().int().min(1).max(12),
            })
            .strict(),
        ),
      })
      .strict(),
    ashtakoot: AshtakootChartSchema,
    availability: z
      .object({
        ziwei: z.boolean(),
        housesA: z.boolean(),
        housesB: z.boolean(),
        complete: z.boolean(),
      })
      .strict(),
  })
  .strict();
export type SynastryChart = z.infer<typeof SynastryChartSchema>;
