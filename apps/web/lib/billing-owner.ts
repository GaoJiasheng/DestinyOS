import { randomUUID } from 'node:crypto';
import type { User, Subscription } from '@prisma/client';
import { getDb } from './db';
import { atomicBatch, guard, type SqlStatement } from './db-batch';
import { stateReserve, stateRelease } from './state';
import { ApiError } from './api-error';

/** Serialize provider updates and atomically protect against account deletion or competing writes. */
export async function mutateBillingOwner(
  owner: string,
  prepare: (user: User & { subscription: Subscription | null }) => Promise<SqlStatement[]>,
): Promise<boolean> {
  // DESIGN-GAP: Stripe and RevenueCat share an owner lease; retries fetch current provider state again.
  const key = `stripe:owner:${owner}`,
    token = randomUUID();
  if (!(await stateReserve(key, token, 120)))
    throw new ApiError('E_PAYMENT', 'Billing synchronization in progress; retry', 503);
  try {
    const user = await getDb().user.findUnique({
      where: { id: owner },
      include: { subscription: true },
    });
    if (!user || user.deletedAt) return false;
    const updates = await prepare(user);
    if (!updates.length) return false;
    await atomicBatch([
      ...guard(
        'EXISTS (SELECT 1 FROM "EphemeralState" WHERE key=? AND value=? AND "expiresAt">?)',
        key,
        token,
        Date.now(),
      ),
      ...guard(
        'EXISTS (SELECT 1 FROM "User" WHERE id=? AND "deletedAt" IS NULL AND "updatedAt"=?)',
        owner,
        user.updatedAt.toISOString().replace('Z', '+00:00'),
      ),
      ...updates,
    ]);
    return true;
  } finally {
    await stateRelease(key, token);
  }
}
