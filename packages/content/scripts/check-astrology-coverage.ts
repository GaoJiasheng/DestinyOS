import { auditAstrology } from './astrology-coverage';

const { statistics } = await auditAstrology();
console.log(JSON.stringify(statistics, null, 2));
if (statistics.failures.length || statistics.readabilityIssues.length) process.exitCode = 1;
