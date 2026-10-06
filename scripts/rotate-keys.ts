import { PrismaClient } from '@prisma/client';
import { localAdapter } from '../apps/web/lib/db-local';
import { pathToFileURL } from 'node:url';
import { decryptField, encryptField } from '../apps/web/lib/crypto';

// DESIGN-GAP: Rotation intentionally uses a raw client; extension writes would encrypt twice.
// Rows are re-read inside each transaction to avoid overwriting concurrent application edits.
/** Rotate owner-bound fields in serializable batches of 500; a failed batch rolls back for safe reruns. */
export async function rotateKeys(db: PrismaClient): Promise<void> {
  let cursor: string | undefined;
  while (true) {
    const rows: { id: string }[] = await db.birthProfile.findMany({
      take: 500,
      orderBy: { id: 'asc' },
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: { id: true },
    });
    if (!rows.length) break;
    await db.$transaction(
      async (tx) => {
        for (const { id } of rows) {
          const row = await tx.birthProfile.findUnique({ where: { id } });
          if (!row) continue;
          const rotate = (field: 'encBirth' | 'encPlace' | 'encName' | 'label') =>
            row[field] === null
              ? null
              : encryptField(
                  decryptField(row[field], `BirthProfile.${field}`, row.userId),
                  `BirthProfile.${field}`,
                  row.userId,
                );
          await tx.birthProfile.update({
            where: { id },
            data: {
              encBirth: rotate('encBirth') ?? '',
              encPlace: rotate('encPlace'),
              encName: rotate('encName'),
              label: rotate('label'),
            },
          });
        }
      },
      { isolationLevel: 'Serializable', timeout: 60_000 },
    );
    cursor = rows.at(-1)?.id;
  }
  cursor = undefined;
  while (true) {
    const rows: { id: string }[] = await db.reading.findMany({
      take: 500,
      orderBy: { id: 'asc' },
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: { id: true },
    });
    if (!rows.length) break;
    await db.$transaction(
      async (tx) => {
        for (const { id } of rows) {
          const row = await tx.reading.findUnique({ where: { id } });
          if (!row) continue;
          if (!row.userId) throw new Error('Encrypted reading has no owner');
          const encInput = encryptField(
            decryptField(row.encInput, 'Reading.encInput', row.userId),
            'Reading.encInput',
            row.userId,
          );
          await tx.reading.update({ where: { id }, data: { encInput } });
        }
      },
      { isolationLevel: 'Serializable', timeout: 60_000 },
    );
    cursor = rows.at(-1)?.id;
  }
  cursor = undefined;
  while (true) {
    const rows: { id: string }[] = await db.journalEntry.findMany({
      take: 500,
      orderBy: { id: 'asc' },
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: { id: true },
    });
    if (!rows.length) break;
    await db.$transaction(
      async (tx) => {
        for (const { id } of rows) {
          const row = await tx.journalEntry.findUnique({ where: { id } });
          if (!row) continue;
          await tx.journalEntry.update({
            where: { id },
            data: {
              text: encryptField(
                decryptField(row.text, 'JournalEntry.text', row.userId),
                'JournalEntry.text',
                row.userId,
              ),
            },
          });
        }
      },
      { isolationLevel: 'Serializable', timeout: 60_000 },
    );
    cursor = rows.at(-1)?.id;
  }
}

// DESIGN-GAP: Export the real rotation operation for database regression tests; only direct CLI execution runs it.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const db = new PrismaClient({ adapter: localAdapter() });
  try {
    await rotateKeys(db);
  } finally {
    await db.$disconnect();
  }
}
