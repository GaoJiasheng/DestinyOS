import { z } from 'zod';
export const KnowledgeVersionSchema = z
  .string()
  .regex(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/);
/** Shared M04/M09 signature envelope; the trust anchor is configured separately from downloaded data. */
export const MobileKnowledgeEnvelopeSchema = z
  .object({
    payload: z.string().max(16384),
    signature: z.string().regex(/^[a-f0-9]{128}$/),
    keyId: z.string().min(1).max(100),
  })
  .strict();
export const MobileKnowledgeManifestSchema = z
  .object({
    knowledgeVersion: KnowledgeVersionSchema,
    // DESIGN-GAP: 0.0.0 marks a complete snapshot; all other bases require an exact installed version.
    baseKnowledgeVersion: KnowledgeVersionSchema,
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    compressedSize: z
      .number()
      .int()
      .positive()
      .max(8 * 1024 * 1024),
    decodedSize: z
      .number()
      .int()
      .positive()
      .max(32 * 1024 * 1024),
  })
  .strict();
/** Numeric semver ordering prevents lexical mistakes and knowledge rollback. */
export function compareKnowledgeVersion(left: string, right: string): number {
  KnowledgeVersionSchema.parse(left);
  KnowledgeVersionSchema.parse(right);
  const a = left.split('.').map(Number),
    b = right.split('.').map(Number);
  for (let index = 0; index < 3; index++) if (a[index] !== b[index]) return a[index]! - b[index]!;
  return 0;
}
