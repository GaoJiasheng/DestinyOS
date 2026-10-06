import type { KnowledgeBundle } from '@tianji/content';
import type { LocalDatabase } from '../data/database';
import { KnowledgeSchema, compareKnowledgeVersion } from './schema';

/** Immutable bundled fallback plus a single atomically committed encrypted downloaded release. */
export class KnowledgeCache {
  constructor(
    readonly database: LocalDatabase,
    readonly bundled: KnowledgeBundle,
  ) {}
  /** No network is required; malformed persisted cache falls back to the shipped knowledge. */
  async load(): Promise<KnowledgeBundle> {
    return this.database.read(async (sql) => {
      const row = await sql.getFirstAsync<{ data: string }>(
        'SELECT data FROM KnowledgeCache WHERE id=1',
      );
      if (row) {
        try {
          const cached = KnowledgeSchema.parse(JSON.parse(row.data));
          if (compareKnowledgeVersion(cached.knowledgeVersion, this.bundled.knowledgeVersion) >= 0)
            return cached;
        } catch {
          /* Public knowledge may be discarded; personal data is never reset. */
        }
      }
      return this.bundled;
    });
  }
  /** Compare-and-swap prevents a racing update from overwriting a newer accepted release. */
  async replace(baseVersion: string, candidate: KnowledgeBundle): Promise<void> {
    const next = KnowledgeSchema.parse(candidate);
    await this.database.write(async (sql) => {
      const row = await sql.getFirstAsync<{ data: string }>(
        'SELECT data FROM KnowledgeCache WHERE id=1',
      );
      let current = this.bundled;
      if (row) {
        try {
          const cached = KnowledgeSchema.parse(JSON.parse(row.data));
          if (compareKnowledgeVersion(cached.knowledgeVersion, current.knowledgeVersion) >= 0)
            current = cached;
        } catch {
          /* Same fallback as load(). */
        }
      }
      if (
        current.knowledgeVersion !== baseVersion ||
        compareKnowledgeVersion(next.knowledgeVersion, baseVersion) <= 0
      )
        throw new Error('E_KNOWLEDGE_CONFLICT');
      await sql.runAsync(
        'INSERT INTO KnowledgeCache(id,knowledgeVersion,data) VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET knowledgeVersion=excluded.knowledgeVersion,data=excluded.data',
        next.knowledgeVersion,
        JSON.stringify(next),
      );
    });
  }
}
