import { sqliteClient } from './sqlite-test';
/** SQLite-backed KV test helper shared across E2E test processes and the application. */
export class TestCache {
  private db;
  constructor(url?: string) {
    this.db = sqliteClient(url);
  }
  async get(key: string) {
    const r = await this.db.ephemeralState.findUnique({ where: { key: `kv:${key}` } });
    return r && r.expiresAt > Date.now() ? r.value : null;
  }
  async set(key: string, value: string, _mode = 'EX', seconds = 3600) {
    void _mode;
    const data = { value, expiresAt: Date.now() + seconds * 1000 };
    await this.db.ephemeralState.upsert({
      where: { key: `kv:${key}` },
      create: { key: `kv:${key}`, ...data },
      update: data,
    });
    return 'OK';
  }
  async del(...keys: string[]) {
    const r = await this.db.ephemeralState.deleteMany({
      where: { key: { in: keys.flatMap((k) => [k, `kv:${k}`]) } },
    });
    await this.db.rateLimitHit.deleteMany({ where: { key: { in: keys } } });
    return r.count;
  }
  async keys(pattern: string) {
    const regex = new RegExp(
      '^' +
        pattern
          .split('*')
          .map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
          .join('.*') +
        '$',
    );
    return (
      await this.db.ephemeralState.findMany({
        where: { key: { startsWith: 'kv:' }, expiresAt: { gt: Date.now() } },
      })
    )
      .map((r) => r.key.slice(3))
      .filter((k) => regex.test(k));
  }
  async exists(key: string) {
    return Number((await this.get(key)) !== null);
  }
  async ttl(key: string) {
    const r = await this.db.ephemeralState.findUnique({ where: { key: `kv:${key}` } });
    return r ? Math.floor((r.expiresAt - Date.now()) / 1000) : -2;
  }
  async flushall() {
    await this.db.ephemeralState.deleteMany();
    await this.db.rateLimitHit.deleteMany();
  }
  async quit() {
    await this.db.$disconnect();
  }
  disconnect() {
    void this.quit();
  }
}
