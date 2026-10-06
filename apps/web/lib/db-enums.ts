import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { Plan, Role, Locale, System, Gender, ReadingStatus, KuStatus } from '@tianji/shared';
const plan = z.nativeEnum(Plan),
  role = z.nativeEnum(Role),
  locale = z.nativeEnum(Locale),
  system = z.nativeEnum(System),
  gender = z.nativeEnum(Gender),
  status = z.nativeEnum(ReadingStatus),
  kuStatus = z.nativeEnum(KuStatus);
const relation = z.enum(['self', 'partner', 'family', 'friend', 'other']);
const schemas: Record<string, Record<string, z.ZodType>> = {
  User: { plan, role, locale },
  BirthProfile: { gender, relation },
  Reading: { system, status },
  KnowledgeUnit: { system, status: kuStatus },
  Event: { system: system.nullable(), locale: locale.nullable(), plan: plan.nullable() },
  EventDaily: { system: system.nullable(), locale: locale.nullable(), plan: plan.nullable() },
};
/** SQLite stores enum values as TEXT; validate all application writes without changing their values. */
export function validateDatabaseEnums(model: string, data: Record<string, unknown>) {
  for (const [field, schema] of Object.entries(schemas[model] ?? {})) {
    const value = data[field];
    if (value !== undefined)
      schema.parse(value && typeof value === 'object' && 'set' in value ? value.set : value);
  }
}
/** Narrow persisted TEXT values to validated domain unions on reads. */
export function databaseEnumsExtension() {
  return Prisma.defineExtension({
    name: 'database-enums',
    query: {
      $allModels: {
        async $allOperations({ model, args, query }) {
          const input = args as Record<string, unknown>;
          for (const key of ['data', 'create', 'update']) {
            const rows = Array.isArray(input[key]) ? input[key] : [input[key]];
            for (const row of rows)
              if (row && typeof row === 'object')
                validateDatabaseEnums(model, row as Record<string, unknown>);
          }
          return query(args);
        },
      },
    },
    result: {
      user: {
        plan: { needs: { plan: true }, compute: (r) => plan.parse(r.plan) },
        role: { needs: { role: true }, compute: (r) => role.parse(r.role) },
        locale: { needs: { locale: true }, compute: (r) => locale.parse(r.locale) },
      },
      birthProfile: {
        gender: { needs: { gender: true }, compute: (r) => gender.parse(r.gender) },
        relation: { needs: { relation: true }, compute: (r) => relation.parse(r.relation) },
      },
      reading: {
        system: { needs: { system: true }, compute: (r) => system.parse(r.system) },
        status: { needs: { status: true }, compute: (r) => status.parse(r.status) },
      },
      knowledgeUnit: {
        system: { needs: { system: true }, compute: (r) => system.parse(r.system) },
      },
    },
  });
}
