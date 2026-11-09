import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { localWorkerConfigs } from './cloudflare-local-configs';
const configs = await localWorkerConfigs(8787);
const child = spawn(
  'pnpm',
  [
    'exec',
    'wrangler',
    'dev',
    ...configs.flatMap((config) => ['--config', config]),
    '--port',
    '8787',
    '--local',
    '--persist-to',
    resolve(import.meta.dirname, '../apps/web/.wrangler/state'),
  ],
  {
    cwd: resolve(import.meta.dirname, '../apps/web'),
    stdio: 'inherit',
    // DESIGN-GAP: Per-segment assets exceed macOS's fd limit for Wrangler's per-file asset watcher, which then fails spawn with EBADF; these local servers poll instead, and deployment is unaffected.
    env: {
      ...process.env,
      WRANGLER_SEND_METRICS: 'false',
      CHOKIDAR_USEPOLLING: 'true',
      CHOKIDAR_INTERVAL: '600000',
    },
  },
);
// DESIGN-GAP: The local smoke server runs until stopped; an operator-requested shutdown is successful, while unexpected startup/runtime exits keep their failure status.
let stopping = false;
process.on('SIGTERM', () => {
  stopping = true;
  child.kill('SIGTERM');
});
process.on('SIGINT', () => {
  stopping = true;
  child.kill('SIGINT');
});
child.on('exit', (code) => {
  process.exit(stopping ? 0 : (code ?? 1));
});
