import { auditVedicCoverage } from './vedic-coverage';

const { statistics, coverageErrors } = await auditVedicCoverage();
console.log(JSON.stringify(statistics, null, 2));
if (
  coverageErrors.length ||
  Object.values(statistics.emptySections).some((n) => n > 0) ||
  Object.keys(statistics.readabilityIssues).length
) {
  console.error(coverageErrors);
  process.exitCode = 1;
}
