import { auditDaily } from './check-daily-coverage';

const { statistics, coverageErrors } = await auditDaily();
console.log(JSON.stringify(statistics, null, 2));
if (
  coverageErrors.length ||
  Object.values(statistics.emptySections).some((count) => count > 0) ||
  Object.keys(statistics.readabilityIssues).length
) {
  console.error(coverageErrors);
  process.exitCode = 1;
}
