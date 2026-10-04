import { getDb } from '@/lib/db';
import { pingRedis } from '@/lib/redis';
import { checkHealth } from '@/lib/health';
import engine from '../../../../../../packages/engine/package.json';
import manifest from '../../../../../../packages/content/version.json';

export const dynamic = 'force-dynamic';

/** Public service status; never exposes credentials, exception messages, or personal data. */
export async function GET(): Promise<Response> {
  const data = await checkHealth(
    { db: () => getDb().$queryRaw`SELECT 1`, redis: pingRedis },
    { engineVersion: engine.version, knowledgeVersion: manifest.knowledgeVersion },
  );
  return Response.json(data, {
    status: data.ok ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}
