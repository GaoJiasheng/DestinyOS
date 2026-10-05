import { readFileSync, writeFileSync } from 'node:fs';
import { computeAstrology, normalizeBirth } from '../../src';
// DESIGN-GAP: Integration provenance snapshots of engine outputs live in content/test; refresh only these seven snapshots after a verified numerical fix.
for (const id of ['A', 'B', 'C', 'D', 'E', 'F', 'G']) {
  const input: unknown = JSON.parse(
    readFileSync(new URL(`../fixtures/birth/${id}.json`, import.meta.url), 'utf8'),
  );
  const chart = computeAstrology(normalizeBirth(input));
  writeFileSync(
    new URL(`../../../content/test/fixtures/astrology.${id}.json`, import.meta.url),
    JSON.stringify(chart, null, 2) + '\n',
  );
}
