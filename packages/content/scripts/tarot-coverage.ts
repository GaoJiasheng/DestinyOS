import { auditTarot } from './check-tarot-coverage';
const { statistics, coverageErrors } = await auditTarot();
console.log(JSON.stringify(statistics, null, 2));
if (
  coverageErrors.length ||
  Object.values(statistics.emptySections).some((n) => n > 0) ||
  Object.keys(statistics.readabilityIssues).length
) {
  console.error(coverageErrors);
  process.exitCode = 1;
}
