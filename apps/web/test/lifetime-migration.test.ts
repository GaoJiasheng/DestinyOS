import { readFileSync, readdirSync } from 'node:fs';
import Database from 'better-sqlite3';
import { expect, it } from 'vitest';

it('adds lifetime defaults while preserving existing paid accounts, subscriptions, logins and invariant triggers', () => {
  const db = new Database(':memory:');
  db.pragma('foreign_keys=ON');
  try {
    const directory = 'apps/web/migrations';
    for (const file of readdirSync(directory)
      .filter((f) => f.endsWith('.sql') && f < '0005')
      .sort())
      db.exec(readFileSync(`${directory}/${file}`, 'utf8'));
    db.exec(`INSERT INTO "User" (id,email,plan,"createdAt","updatedAt") VALUES ('owner','paid@example.test','pro',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
      INSERT INTO "Subscription" (id,"userId","stripeCustomerId","stripeSubscriptionId",status,"createdAt","updatedAt") VALUES ('sub','owner','cus_paid','sub_paid','active',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
      INSERT INTO "Account" (id,"userId",type,provider,"providerAccountId") VALUES ('login','owner','oauth','google','google-paid');`);
    const triggers = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='trigger' AND tbl_name IN ('User','Subscription') ORDER BY name",
      )
      .all();
    db.exec(readFileSync(`${directory}/0005_lifetime_billing.sql`, 'utf8'));
    expect(
      db.prepare('SELECT plan,lifetime,"revenuecatProUntil" FROM "User" WHERE id=?').get('owner'),
    ).toEqual({ plan: 'pro', lifetime: 0, revenuecatProUntil: null });
    expect(
      db
        .prepare(
          'SELECT status,lifetime,"stripeCheckoutSessionId","stripeSubscriptionId" FROM "Subscription" WHERE id=?',
        )
        .get('sub'),
    ).toEqual({
      status: 'active',
      lifetime: 0,
      stripeCheckoutSessionId: null,
      stripeSubscriptionId: 'sub_paid',
    });
    expect(db.prepare('SELECT "userId" FROM "Account" WHERE id=?').get('login')).toEqual({
      userId: 'owner',
    });
    expect(
      db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='trigger' AND tbl_name IN ('User','Subscription') ORDER BY name",
        )
        .all(),
    ).toEqual(triggers);
    expect(() => db.exec('UPDATE "User" SET lifetime=2')).toThrow();
    expect(() => db.exec('UPDATE "Subscription" SET lifetime=2')).toThrow();
  } finally {
    db.close();
  }
});
