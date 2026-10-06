import { pathToFileURL } from 'node:url';
import { z } from 'zod';
const api = 'https://api.cloudflare.com/client/v4';
const reference = 'destinyos_ip_60_per_10s';
/** Exact dynamic-host rule; renderer/API URLs are deliberately not exempted by file suffix. */
export function wafRule() {
  // DESIGN-GAP: Cloudflare requires cf.colo.id alongside IP; counters are per edge location, not a globally atomic per-IP budget.
  return {
    ref: reference,
    description: 'DestinyOS: block IP above 60 dynamic requests / 10 seconds',
    expression:
      '(http.host eq "tianji.gavin.pub" and not (starts_with(http.request.uri.path, "/_next/static/") or starts_with(http.request.uri.path, "/fonts/") or starts_with(http.request.uri.path, "/images/") or starts_with(http.request.uri.path, "/icons/") or starts_with(http.request.uri.path, "/tarot/") or starts_with(http.request.uri.path, "/workers/") or starts_with(http.request.uri.path, "/_data/") or starts_with(http.request.uri.path, "/offline/") or http.request.uri.path in {"/favicon.ico" "/manifest.webmanifest" "/robots.txt" "/sw.js" "/stars.bin" "/stars-source.json"}))',
    action: 'block',
    enabled: true,
    ratelimit: {
      characteristics: ['cf.colo.id', 'ip.src'],
      period: 10,
      requests_per_period: 60,
      mitigation_timeout: 10,
    },
  };
}
const envelope = z.object({ success: z.boolean(), result: z.unknown() });
const rulesetSchema = z.object({
  id: z.string(),
  rules: z.array(z.object({ id: z.string(), ref: z.string().optional() })).default([]),
});
/** Create or update only our rule, preserving all other zone rules. Dry run performs no API calls. */
export async function configureWaf({
  token,
  dryRun = false,
  fetcher = fetch,
}: {
  token?: string;
  dryRun?: boolean;
  fetcher?: typeof fetch;
}) {
  const rule = wafRule();
  if (dryRun) return { dryRun: true, zone: 'gavin.pub', phase: 'http_ratelimit', rule };
  if (!token) throw new Error('CLOUDFLARE_API_TOKEN is required');
  async function request(path: string, method = 'GET', body?: unknown): Promise<unknown | null> {
    const response = await fetcher(`${api}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(15000),
    });
    if (method === 'GET' && path.includes('/phases/') && response.status === 404) return null;
    if (!response.ok)
      throw new Error(
        `Cloudflare API failed (${response.status}); check zone permissions and rate-limiting plan support`,
      );
    const parsed = envelope.parse(await response.json());
    if (!parsed.success) throw new Error('Cloudflare rejected the rule');
    return parsed.result;
  }
  const zones = z
    .array(z.object({ id: z.string(), name: z.literal('gavin.pub') }))
    .length(1)
    .parse(
      process.env.CLOUDFLARE_ZONE_ID
        ? { result: [{ id: process.env.CLOUDFLARE_ZONE_ID, name: 'gavin.pub' }] }
        : await request('/zones?name=gavin.pub&status=active'),
    );
  const base = `/zones/${zones[0]!.id}`;
  const current = await request(`${base}/rulesets/phases/http_ratelimit/entrypoint`);
  if (!current)
    await request(`${base}/rulesets`, 'POST', {
      name: 'DestinyOS rate limits',
      kind: 'zone',
      phase: 'http_ratelimit',
      rules: [rule],
    });
  else {
    const ruleset = rulesetSchema.parse(current);
    const existing = ruleset.rules.find((item) => item.ref === reference);
    await request(
      `${base}/rulesets/${ruleset.id}/rules${existing ? `/${existing.id}` : ''}`,
      existing ? 'PATCH' : 'POST',
      rule,
    );
  }
  return { result: 'configured', zone: 'gavin.pub', ref: reference };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== '--dry-run'))
    throw new Error('Usage: pnpm exec tsx scripts/cf-waf-ratelimit.ts [--dry-run]');
  configureWaf({ token: process.env.CLOUDFLARE_API_TOKEN, dryRun: args.includes('--dry-run') })
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch(() => {
      console.error(
        'WAF configuration failed. Check token permissions and supported rate-limiting parameters.',
      );
      process.exitCode = 1;
    });
}
