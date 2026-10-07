import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/** Hash tracked native runtime, shared corpus and catalogs for acceptance evidence freshness.
 * YAML flows have separate hashes; screenshots/store outputs must not invalidate their own run.
 */
export async function launchNativeSourceHash(): Promise<string> {
  const root = resolve(import.meta.dirname, '..');
  const sources = execFileSync(
    'git',
    [
      'ls-files',
      '--cached',
      '--others',
      '--exclude-standard',
      '-z',
      'apps/mobile',
      'packages',
      'apps/web/messages',
      'pnpm-lock.yaml',
    ],
    { encoding: 'utf8', cwd: root },
  )
    .split('\0')
    .filter(
      (file) =>
        file &&
        !file.includes('/test-results/') &&
        !file.includes('/store/') &&
        !file.includes('/maestro/') &&
        file !== 'apps/mobile/scripts/launch-maestro.mts' &&
        /\.(ts|tsx|mts|js|json|yaml|swift|kt)$/.test(file),
    )
    .sort();
  const hash = createHash('sha256');
  for (const source of sources) {
    hash.update(source);
    hash.update(await readFile(resolve(root, source)));
  }
  return hash.digest('hex');
}
