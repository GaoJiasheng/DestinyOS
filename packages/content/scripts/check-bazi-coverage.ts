import { auditBaziCoverage } from './bazi-coverage';

const summary = await auditBaziCoverage();
console.log(JSON.stringify(summary, null, 2));
if (summary.failures.length || summary.readabilityIssues.length) process.exitCode = 1;
