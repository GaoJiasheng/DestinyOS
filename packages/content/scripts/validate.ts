import { loadRectificationFeatures } from './rectification';
import { learnSources } from './learn';
import { loadContent, printDiagnostics } from './load';
import { checkScoringOutputs } from './scoring-output';
const result = await loadContent();
if (result.scoring) result.diagnostics.push(...(await checkScoringOutputs(result.scoring)));
printDiagnostics(result.diagnostics);
if (result.diagnostics.some((d) => d.severity === 'error')) process.exitCode = 1;
else
  console.log(
    `Validated ${result.units.length} KUs and ${result.glossary.length} glossary entries.`,
  );

await learnSources();

await loadRectificationFeatures();
