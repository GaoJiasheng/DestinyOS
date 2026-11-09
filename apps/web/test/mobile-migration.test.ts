import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
// DESIGN-GAP: Pin deployed migration bytes as an append-only baseline; Wrangler records filenames rather than reconciling changed SQL.
const deployed = {
  '0001_cf_native.sql': '789b81270a4fc75fb75b31e690ba9d4b23bd74216ca3395c65a1abe71453cb2d',
  '0002_sqlite_invariants.sql': 'e97c43f6857b77b7d528789678aec43815ed2c14b8e19fdef220f0d020cb812b',
  '0003_strict_sqlite_literals.sql':
    '36121a54425f279d7f5fa094c5bbeceedd740961ec4ea6a5c4cc8afa65471c20',
  '0004_knowledge_chunks.sql': 'e23461951dfce2e7ebebbe652506834d53368f9ee89fc4df2a859dbbc78a73f8',
  '0005_lifetime_billing.sql': '16369936d2588be865befb4ef322bd9c9787be7564b75e41332f649a70e67975',
};
it('preserves deployed 0001–0005 and appends mobile schema without losing accounts, subscriptions, logins or triggers', () => {
  const directory = 'apps/web/migrations';
  const files = readdirSync(directory)
    .filter((name) => name.endsWith('.sql'))
    .sort();
  expect(new Set(files.map((name) => name.split('_')[0])).size).toBe(files.length);
  const additions = files.filter((name) => name > '0005_lifetime_billing.sql');
  expect(additions).toEqual([
    '0006_mobile_api.sql',
    '0007_first_release_profile_quota.sql',
    '0008_push_subscription.sql',
  ]);
  const db = new Database(':memory:');
  db.pragma('foreign_keys=ON');
  try {
    for (const [name, hash] of Object.entries(deployed)) {
      const sql = readFileSync(`${directory}/${name}`);
      expect(createHash('sha256').update(sql).digest('hex')).toBe(hash);
      db.exec(sql.toString());
    }
    db.exec(`INSERT INTO "User" (id,email,plan,lifetime,"createdAt","updatedAt") VALUES ('owner','paid@example.test','pro',1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
      INSERT INTO "Subscription" (id,"userId","stripeCustomerId",status,lifetime,"createdAt","updatedAt") VALUES ('paid','owner','cus_paid','active',1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
      INSERT INTO "Account" (id,"userId",type,provider,"providerAccountId") VALUES ('login','owner','oauth','apple','apple-paid');`);
    const paid = db.prepare('SELECT * FROM "Subscription"').all();
    const login = db.prepare('SELECT * FROM "Account"').all();
    const triggers = db.prepare("SELECT name FROM sqlite_master WHERE type='trigger'").all();
    for (const name of additions) db.exec(readFileSync(`${directory}/${name}`, 'utf8'));
    expect(db.prepare('SELECT * FROM "Subscription"').all()).toEqual(paid);
    expect(db.prepare('SELECT * FROM "Account"').all()).toEqual(login);
    expect(db.prepare('SELECT plan,lifetime,"mobileSettings" FROM "User"').get()).toEqual({
      plan: 'pro',
      lifetime: 1,
      mobileSettings: null,
    });
    expect(db.prepare("SELECT name FROM sqlite_master WHERE type='trigger'").all()).toEqual(
      expect.arrayContaining(triggers),
    );
    expect(
      db.prepare('SELECT "userId",resource,"recordId",deleted FROM "MobileSyncChange"').all(),
    ).toEqual([{ userId: 'owner', resource: 'settings', recordId: 'owner', deleted: 0 }]);
    db.exec("UPDATE \"User\" SET locale='en' WHERE id='owner'");
    expect(db.prepare('SELECT COUNT(*) AS count FROM "MobileSyncChange"').get()).toEqual({
      count: 2,
    });
    expect(db.pragma('foreign_key_check')).toEqual([]);
    expect(db.prepare('SELECT COUNT(*) AS count FROM "MobileSession"').get()).toEqual({ count: 0 });
  } finally {
    db.close();
  }
});
