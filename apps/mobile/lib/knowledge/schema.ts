import Ajv from 'ajv';
import { z } from 'zod';
import type { KnowledgeUnit } from '@tianji/content';
import { System } from '@tianji/shared';
import unitSchema from '../../../../packages/content/schema/ku.schema.json';
const validateUnit = new Ajv({ strict: false }).compile<KnowledgeUnit>(unitSchema);
const UnitSchema = z.custom<KnowledgeUnit>(
  (value) => validateUnit(value) && value.meta.status === 'published',
);
export const KnowledgeVersionSchema = z
  .string()
  .regex(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/);
const text = z.string().min(1);
const system = z.union([z.nativeEnum(System), z.literal('common')]);
const GlossaryTextSchema = z
  .object({
    term: text,
    short: text,
    long: text,
    pinyin: z.string().optional(),
    colors: z.string().optional(),
  })
  .strict();
const GlossarySchema = z
  .object({
    key: text,
    system,
    zh: GlossaryTextSchema,
    en: GlossaryTextSchema,
    aliases: z.array(text),
  })
  .strict();
const TemplatesSchema = z
  .object({
    continuation: z.array(text).min(1),
    concession: z.array(text).min(1),
    evidence: z.array(text).min(1),
    advice: z.array(text).min(1),
    low_confidence: z.array(text).min(1),
  })
  .strict();
const TransitionsSchema = z.object({ zh: TemplatesSchema, en: TemplatesSchema }).strict();
export const KnowledgeSchema = z
  .object({
    knowledgeVersion: KnowledgeVersionSchema,
    units: z.array(UnitSchema),
    glossary: z.array(GlossarySchema),
    transitions: TransitionsSchema,
  })
  .strict()
  .superRefine((bundle, context) => {
    if (
      new Set(bundle.units.map((unit) => unit.id)).size !== bundle.units.length ||
      new Set(bundle.glossary.map((entry) => entry.key)).size !== bundle.glossary.length
    )
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'E_KNOWLEDGE_DUPLICATE' });
  });
// DESIGN-GAP: M09 wire format: gzip JSON delta of published bilingual units (upsert/remove),
// optional full glossary/transitions replacement. Signed manifest binds exact version/base/hash.
export const DeltaSchema = z
  .object({
    knowledgeVersion: KnowledgeVersionSchema,
    baseKnowledgeVersion: KnowledgeVersionSchema,
    upsert: z.array(UnitSchema),
    remove: z.array(text),
    glossary: z.array(GlossarySchema).optional(),
    transitions: TransitionsSchema.optional(),
  })
  .strict();
/** Numeric semver ordering prevents lexical mistakes and rollback to a stale release. */
export function compareKnowledgeVersion(left: string, right: string): number {
  KnowledgeVersionSchema.parse(left);
  KnowledgeVersionSchema.parse(right);
  const a = left.split('.').map(Number),
    b = right.split('.').map(Number);
  for (let index = 0; index < 3; index++) if (a[index] !== b[index]) return a[index]! - b[index]!;
  return 0;
}
