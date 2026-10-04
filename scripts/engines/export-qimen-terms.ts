import { solarTerms } from '../../packages/engine/src/common/divination';
// Shared ephemeris supplies astronomical instants only; all expected panels are generated independently by Python.
process.stdout.write(
  JSON.stringify(
    solarTerms(2026)
      .filter((term) => term.time.year === 2026)
      .map((term) => ({ name: term.name, at: term.time.toString() })),
  ) + '\n',
);
