import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assertTtfbBudget, p75 } from './perf-ttfb-support';
const run = promisify(execFile);
// DESIGN-GAP: Curl's time_starttransfer includes DNS/TCP/TLS and measures first-byte latency, unlike fetch's response-header completion time.
if (process.env.PERF_TTFB_SKIP === 'true') {
  console.log('TTFB budget check skipped via PERF_TTFB_SKIP=true');
} else {
  const base = new URL(process.env.PERF_TTFB_URL || 'https://tianji.gavin.pub');
  const routes: [string, number][] = [
    ['/zh', 300],
    ['/en', 300],
    ['/zh/tarot', 300],
    ['/zh/qimen', 300],
    ['/zh/learn', 300],
    ['/zh/privacy', 300],
    ['/api/auth/session', 600],
    ['/api/v1/health', 150],
  ];
  if (process.env.PERF_TTFB_COOKIE) routes.push(['/zh/me', 600]);
  const temporary = await mkdtemp(join(tmpdir(), 'destiny-ttfb-'));
  const headerFile = join(temporary, 'headers');
  const results = [];
  let failed = false;
  for (const [path, budgetMs] of routes) {
    const samples: { ttfbMs: number; status: number; bytes: number; cache: string }[] = [];
    for (let index = 0; index < 10; index++) {
      const args = [
        '--silent',
        '--show-error',
        '--max-time',
        '20',
        '--output',
        '/dev/null',
        '--write-out',
        '%{time_starttransfer} %{http_code} %{size_download}',
        '--dump-header',
        headerFile,
        '--header',
        'Accept: text/html',
      ];
      if (process.env.PERF_TTFB_COOKIE && ['/zh/me', '/api/auth/session'].includes(path))
        args.push('--cookie', process.env.PERF_TTFB_COOKIE);
      try {
        const { stdout } = await run('curl', [...args, new URL(path, base).href]);
        const [seconds, status, bytes] = stdout.trim().split(' ').map(Number);
        samples.push({
          ttfbMs: (seconds ?? NaN) * 1000,
          status: status ?? 0,
          bytes: bytes ?? 0,
          cache:
            (await readFile(headerFile, 'utf8')).match(/^x-destiny-cache:\s*(\w+)/im)?.[1] ?? '',
        });
      } catch {
        samples.push({ ttfbMs: 20_000, status: 0, bytes: 0, cache: '' });
      }
    }
    let error: string | undefined;
    try {
      assertTtfbBudget(samples, budgetMs);
      if (budgetMs === 300 && samples.filter((sample) => sample.cache === 'HIT').length < 8)
        throw new Error('Public TTFB requires at least eight edge cache hits');
      if ((path === '/zh' || path === '/en') && samples.some((sample) => sample.bytes > 120_000))
        throw new Error('Homepage HTML exceeds 120,000 bytes');
    } catch (cause) {
      error = cause instanceof Error ? cause.message : 'TTFB check failed';
      failed = true;
    }
    const result = {
      path,
      budgetMs,
      p75Ms: p75(samples.map((sample) => sample.ttfbMs)),
      samples,
      ...(error ? { error } : {}),
    };
    results.push(result);
    console.log(
      `${path}: P75=${result.p75Ms.toFixed(1)}ms / ${budgetMs}ms${error ? ` FAILED: ${error}` : ' passed'}`,
    );
  }
  if (!process.env.PERF_TTFB_COOKIE)
    console.log(
      'Authenticated /zh/me probe omitted: set PERF_TTFB_COOKIE for a dedicated test session.',
    );
  await mkdir('.test-data', { recursive: true });
  await writeFile(
    '.test-data/perf-ttfb.json',
    JSON.stringify({ origin: base.origin, results }, null, 2) + '\n',
  );
  await rm(temporary, { recursive: true, force: true });
  if (failed) process.exitCode = 1;
}
