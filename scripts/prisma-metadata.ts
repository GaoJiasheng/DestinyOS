import { Prisma } from '@prisma/client';
import { writeFile, readFile } from 'node:fs/promises';
import { format } from 'prettier';
// DESIGN-GAP: The engine-free client exposes reduced DMMF; freeze relation types plus scalar defaults from the versioned schema for Workers batch writes.
const schema = await readFile(new URL('../prisma/schema.prisma', import.meta.url), 'utf8');
const models = Prisma.dmmf.datamodel.models.map((model) => {
  const block = schema.match(new RegExp(`model ${model.name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
  return {
    name: model.name,
    fields: model.fields.map((field) => {
      const line = block.split('\n').find((s) => s.trimStart().startsWith(`${field.name} `)) ?? '';
      const primitive = line.match(/@default\(("[^"]*"|true|false|-?\d+)\)/)?.[1];
      return {
        name: field.name,
        kind: field.kind,
        type: field.type,
        isId: line.includes('@id'),
        hasDefaultValue: line.includes('@default('),
        default: primitive ? (JSON.parse(primitive) as string | number | boolean) : null,
      };
    }),
  };
});
await writeFile(
  new URL('../apps/web/lib/prisma-models.json', import.meta.url),
  await format(JSON.stringify(models), { parser: 'json' }),
);
