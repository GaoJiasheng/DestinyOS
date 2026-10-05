import { Prisma } from '@prisma/client';
import { writeFile } from 'node:fs/promises';
import { format } from 'prettier';
// DESIGN-GAP: Prisma.dmmf is absent in workerd; freeze relation metadata during Prisma generation so nested encryption remains identical on both platforms.
const models = Prisma.dmmf.datamodel.models.map((model) => ({
  name: model.name,
  fields: model.fields
    .filter((field) => field.kind === 'object')
    .map((field) => ({ name: field.name, kind: field.kind, type: field.type })),
}));
await writeFile(
  new URL('../apps/web/lib/prisma-models.json', import.meta.url),
  await format(JSON.stringify(models), { parser: 'json' }),
);
