import { z } from 'zod';
import { Stem, Branch, Element, Trigram } from '../../enums';
export const PillarSchema = z
  .object({ stem: z.nativeEnum(Stem), branch: z.nativeEnum(Branch) })
  .strict();
export const VerdictSchema = z.enum([
  'auspicious',
  'favorable',
  'neutral',
  'unfavorable',
  'inauspicious',
]);
export const HexagramSchema = z
  .object({
    number: z.number().int().min(1).max(64),
    key: z.string(),
    lines: z.tuple([
      z.literal(0).or(z.literal(1)),
      z.literal(0).or(z.literal(1)),
      z.literal(0).or(z.literal(1)),
      z.literal(0).or(z.literal(1)),
      z.literal(0).or(z.literal(1)),
      z.literal(0).or(z.literal(1)),
    ]),
    upper: z.nativeEnum(Trigram),
    lower: z.nativeEnum(Trigram),
  })
  .strict();
// DESIGN-GAP: SixRelative/SixSpirit/UseGodState were not enumerated; use conventional pinyin and explicit state keys.
export const SixRelativeSchema = z.enum(['xiong_di', 'fu_mu', 'zi_sun', 'qi_cai', 'guan_gui']);
export const SixSpiritSchema = z.enum([
  'qing_long',
  'zhu_que',
  'gou_chen',
  'teng_she',
  'bai_hu',
  'xuan_wu',
]);
export const UseGodStateSchema = z.enum([
  'strong',
  'weak',
  'neutral',
  'void',
  'hidden',
  'absent',
  'moving',
  'return_generated',
  'return_controlled',
]);
export const RelationSchema = z.enum([
  'use_generates_body',
  'body_generates_use',
  'use_controls_body',
  'body_controls_use',
  'same',
]);
export const StrengthSchema = z.enum(['prosperous', 'strong', 'resting', 'trapped', 'dead']);
export const LineStemSchema = z
  .object({
    stem: z.nativeEnum(Stem),
    branch: z.nativeEnum(Branch),
    element: z.nativeEnum(Element),
    relative: SixRelativeSchema,
  })
  .strict();
export type SixRelative = z.infer<typeof SixRelativeSchema>;
export type SixSpirit = z.infer<typeof SixSpiritSchema>;
export type Hexagram = z.infer<typeof HexagramSchema>;
export type Verdict = z.infer<typeof VerdictSchema>;
