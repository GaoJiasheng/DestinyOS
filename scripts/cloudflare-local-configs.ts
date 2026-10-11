import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
/** Generate isolated local configurations; these mock values never enter deployment files. */
export async function localWorkerConfigs(port: number): Promise<string[]> {
  const web = resolve(import.meta.dirname, '../apps/web');
  const directory = resolve(web, '.wrangler/multi-smoke');
  await mkdir(directory, { recursive: true });
  const variables = {
    PLATFORM: 'cloudflare',
    AUTH_SECRET: 'isolated-cf-smoke-secret',
    AUTH_URL: `http://localhost:${port}`,
    AUTH_TRUST_HOST: 'true',
    AUTH_GOOGLE_ID: 'mock-google',
    AUTH_GOOGLE_SECRET: 'mock-secret',
    FIELD_ENCRYPTION_KEYS: `v1:${Buffer.alloc(32, 1).toString('base64')}`,
    CRON_SECRET: 'isolated-cron',
    FEATURE_ADS: 'false',
    FEATURE_WEB_PAYMENTS: 'false',
    CF_ANALYTICS_TOKEN: '',
    ADMIN_EMAILS: 'smoke-admin@example.test',
    NEXT_PUBLIC_SITE_URL: `http://localhost:${port}`,
  };
  const configs = [];
  for (const [name, source, main] of [
    ['main', 'wrangler.toml', 'test/cloudflare-main-worker.ts'],
    ['compute', 'wrangler.compute.toml', 'test/cloudflare-runtime-worker.ts'],
    ['media', 'wrangler.media.toml', '.media/worker.js'],
  ] as const) {
    let config = await readFile(resolve(web, source), 'utf8');
    // DESIGN-GAP: Local hosts must not inherit production custom-domain forwarding, which would fail Server Action origin validation.
    config = config.replace(/\[\[routes\]\][\s\S]*?(?=\n\[|$)/g, '');
    config = config
      .replace(/^main = .*$/m, `main = ${JSON.stringify(resolve(web, main))}`)
      .replace(
        /^directory = .*$/m,
        `directory = ${JSON.stringify(resolve(web, '.open-next/assets'))}`,
      )
      .replace(
        /^migrations_dir = .*$/m,
        `migrations_dir = ${JSON.stringify(resolve(web, 'migrations'))}`,
      );
    for (const key of Object.keys(variables))
      config = config.replace(new RegExp(`^${key} = .*\n`, 'm'), '');
    config = config.replace(
      '[vars]',
      `[vars]\n${Object.entries(variables)
        .map(([key, value]) => `${key} = ${JSON.stringify(value)}`)
        .join('\n')}`,
    );
    const file = resolve(directory, `${name}.toml`);
    await writeFile(file, config);
    configs.push(file);
  }
  return configs;
}
