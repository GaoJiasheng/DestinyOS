import { learnSources } from './learn';
import { loadContent, printDiagnostics } from './load';
const result = await loadContent();
printDiagnostics(result.diagnostics);
if (result.diagnostics.some((d) => d.severity === 'error')) process.exitCode = 1;
else
  console.log(
    `Validated ${result.units.length} KUs and ${result.glossary.length} glossary entries.`,
  );

await learnSources();
