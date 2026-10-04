/** Probe independent dependencies, returning only availability and public version identifiers. */
export async function checkHealth(
  probes: { db: () => Promise<unknown>; redis: () => Promise<boolean> },
  versions: { knowledgeVersion: string; engineVersion: string },
) {
  // DESIGN-GAP: Bound health probes to three seconds and use 503 for a degraded dependency.
  function timed<T>(work: Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Health probe timeout')), 3000);
      work.then(resolve, reject).finally(() => clearTimeout(timer));
    });
  }
  const [db, redis] = await Promise.allSettled([
    timed(Promise.resolve().then(probes.db)),
    timed(Promise.resolve().then(probes.redis)),
  ]);
  const dbOk = db.status === 'fulfilled';
  const redisOk = redis.status === 'fulfilled' && redis.value;
  return { ok: dbOk && redisOk, db: dbOk, redis: redisOk, ...versions };
}
