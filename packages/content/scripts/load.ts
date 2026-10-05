import { readdir, readFile } from 'node:fs/promises';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { System } from '@tianji/shared';
import {
  validateSource,
  validateGlossary,
  validateRelations,
  validateTransitions,
} from './validation';
import type { LocatedUnit, Diagnostic } from './validation';
import type { GlossaryEntry } from '../src';
import { validateAsset } from './assets';
export const root = dirname(dirname(fileURLToPath(import.meta.url)));
/** List matching files recursively in stable path order; missing directories yield an empty list.
 * @param directory Source directory to scan.
 * @param suffix Required filename suffix, including the dot. */
export async function files(directory: string, suffix: string): Promise<string[]> {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    const groups = await Promise.all(
      entries.map((entry) =>
        entry.isDirectory()
          ? files(join(directory, entry.name), suffix)
          : Promise.resolve(entry.name.endsWith(suffix) ? [join(directory, entry.name)] : []),
      ),
    );
    return groups.flat().sort();
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return [];
    throw error;
  }
}
/** Load and validate bilingual source units, glossary, transitions and fixture paths for compilation. */
export async function loadContent() {
  const fixtures: Record<string, unknown[]> = {};
  for (const file of await files(join(root, 'test/fixtures'), '.json')) {
    const value: unknown = JSON.parse(await readFile(file, 'utf8'));
    const system = file.split('/').at(-1)?.split('.')[0];
    if (system) (fixtures[system] ??= []).push(value);
  }
  const units: LocatedUnit[] = [],
    glossary: GlossaryEntry[] = [],
    diagnostics: Diagnostic[] = [];
  for (const system of [...Object.values(System), 'common'])
    for (const file of await files(join(root, system), '.yaml')) {
      if (file.endsWith('/transitions.yaml')) continue;
      const source = await readFile(file, 'utf8');
      const assetDiagnostics = validateAsset(relative(root, file), file, source);
      if (assetDiagnostics) {
        diagnostics.push(...assetDiagnostics);
        continue;
      }
      const result = validateSource(file, source, fixtures);
      units.push(...result.units);
      diagnostics.push(...result.diagnostics);
    }
  // DESIGN-GAP: Large corpora may exceed the JS argument limit; append diagnostics without variadic spread.
  for (const diagnostic of validateRelations(units)) diagnostics.push(diagnostic);
  for (const file of await files(join(root, 'glossary'), '.yaml')) {
    const result = validateGlossary(file, await readFile(file, 'utf8'));
    glossary.push(...result.entries);
    diagnostics.push(...result.diagnostics);
  }
  const keys = new Set<string>();
  for (const entry of glossary) {
    if (keys.has(entry.key))
      diagnostics.push({
        file: 'glossary',
        line: 1,
        column: 1,
        severity: 'error',
        message: `Duplicate glossary key ${entry.key}`,
      });
    keys.add(entry.key);
  }
  const file = join(root, 'common/transitions.yaml');
  const result = validateTransitions(file, await readFile(file, 'utf8'));
  diagnostics.push(...result.diagnostics);
  return {
    units: units.map((item) => item.unit),
    glossary,
    transitions: result.transitions,
    diagnostics,
  };
}
/** Print source-located validation diagnostics to the matching stderr console level.
 * @param diagnostics Schema and editorial issues collected by the source validator. */
export function printDiagnostics(diagnostics: Diagnostic[]) {
  for (const d of diagnostics)
    console[d.severity === 'error' ? 'error' : 'warn'](
      `${d.file}:${d.line}:${d.column}: ${d.severity}: ${d.message}`,
    );
}
