import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import type { ModuleInfos } from 'license-checker';
const require = createRequire(import.meta.url);
const checker: typeof import('license-checker') = require('license-checker-rseidelsohn');
// DESIGN-GAP: Permit permissive software/data licenses and MPL-2.0 for axe/lightningcss; reviewed BSD-only metadata belongs to parse-cache-control.
const allowed = new Set([
  'Unlicense',
  'MIT',
  'MIT-0',
  'ISC',
  'Apache-2.0',
  // B-09: opencc-js code is MIT; its bundled OpenCC dictionaries are Apache-2.0 (reviewed THIRD_PARTY_LICENSES.md).
  'MIT AND Apache-2.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  '0BSD',
  'BlueOak-1.0.0',
  'MPL-2.0',
  'Python-2.0',
  'CC0-1.0',
  'CC-BY-3.0',
  'CC-BY-4.0',
  'OFL-1.1',
  '(MIT AND CC-BY-3.0)',
  '(MIT OR CC0-1.0)',
]);
/** Scan every pnpm workspace including development dependencies; deny unknown and copyleft licenses by default. */
export async function checkLicenses(): Promise<number> {
  const workspace = [
    '.',
    'apps/web',
    'packages/shared',
    'packages/config',
    'packages/engine',
    'packages/content',
    'packages/interpret',
  ];
  const modules: ModuleInfos = {};
  for (const start of workspace) {
    const result = await new Promise<ModuleInfos>((accept, reject) =>
      checker.init({ start: resolve(start) }, (error, data) =>
        error ? reject(error) : accept(data),
      ),
    );
    Object.assign(modules, result);
  }
  const failures: string[] = [];
  for (const [name, data] of Object.entries(modules)) {
    const licenses = Array.isArray(data.licenses) ? data.licenses : [data.licenses ?? 'UNKNOWN'];
    if (licenses.every((license) => allowed.has(license))) continue;
    if (
      (name === 'sentry@0.45.0' && licenses[0] === 'Apache*') ||
      (name === 'webgl-constants@1.1.1' && licenses[0] === 'MIT*')
    )
      continue;
    if (licenses.length === 1 && licenses[0] === 'BSD' && name.startsWith('parse-cache-control@'))
      continue;
    if (licenses.length === 1 && licenses[0] === 'UNLICENSED' && data.path) {
      const manifest: unknown = JSON.parse(
        await readFile(resolve(data.path, 'package.json'), 'utf8'),
      );
      if (
        typeof manifest === 'object' &&
        manifest !== null &&
        'private' in manifest &&
        manifest.private === true &&
        (name.startsWith('@tianji/') || name.startsWith('destiny-os@'))
      )
        continue;
    }
    failures.push(`${name}: ${licenses.join(' / ')}`);
  }
  if (failures.length) throw new Error(`Unapproved dependency licenses:\n${failures.join('\n')}`);
  return Object.keys(modules).length;
}
console.log(
  `License allowlist passed for ${await checkLicenses()} packages (including dev dependencies).`,
);
