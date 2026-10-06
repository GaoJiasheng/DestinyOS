import { writeFile } from 'node:fs/promises';
import { URL } from 'node:url';
import { fixtureChart, fixtureReport, reportSignature, systems } from '../lib/diagnostics/fixture';
const reference = Object.fromEntries(
  systems.map((system) => [
    system,
    Object.fromEntries(
      (['zh', 'en'] as const).map((locale) => {
        const start = performance.now();
        const { report } = fixtureReport(system, locale);
        console.log(system, locale, Math.round(performance.now() - start), report.readability);
        return [locale, reportSignature(report)];
      }),
    ),
  ]),
);
await writeFile(
  new URL('../lib/diagnostics/fixture-reference.json', import.meta.url),
  JSON.stringify(reference, null, 2) + '\n',
);

await writeFile(
  new URL('../lib/diagnostics/chart-reference.json', import.meta.url),
  JSON.stringify(
    Object.fromEntries(systems.map((system) => [system, fixtureChart(system)])),
    null,
    2,
  ) + '\n',
);
