import { readFileSync, writeFileSync } from 'node:fs';
import { Solar } from 'lunar-typescript';
import { normalizeBirth, computeBazi } from '../src';
import { birthClock, toSolar, termFrame } from '../src/bazi/calendar';
// Run explicitly with pnpm exec tsx; golden fixtures are never rewritten by the test runner.
for (const id of ['A', 'B', 'C', 'D', 'E', 'G']) {
  const input: unknown = JSON.parse(
    readFileSync(new URL(`./fixtures/birth/${id}.json`, import.meta.url), 'utf8'),
  );
  const birth = normalizeBirth(input);
  const time = birthClock(birth, true),
    lib = toSolar(time).getLunar().getEightChar();
  const fixed = termFrame(birthClock(birth, false), birth.local.tz).getLunar().getEightChar();
  lib.setSect(1);
  const next = lib.getDay();
  lib.setSect(2);
  const civil = lib.getDay();
  const nextCivil = Solar.fromYmd(time.year, time.month, time.day)
    .next(1)
    .getLunar()
    .getDayInGanZhi();
  console.log(
    id,
    time.toString(),
    fixed.getYear(),
    fixed.getMonth(),
    civil,
    next,
    lib.getTime(),
    'next civil',
    nextCivil,
  );
  for (const school of ['zi_unified', 'zi_split'] as const) {
    if (school === 'zi_split' && id !== 'B' && id !== 'G') continue;
    const chart = computeBazi(birth, { now: '2026-10-04T00:00:00Z', school: { ziHour: school } });
    writeFileSync(
      new URL(
        `./fixtures/bazi/${id}${school === 'zi_split' ? '-split' : ''}.json`,
        import.meta.url,
      ),
      JSON.stringify(
        {
          input,
          now: '2026-10-04T00:00:00Z',
          school,
          reference: {
            year: fixed.getYear(),
            month: fixed.getMonth(),
            day: school === 'zi_unified' ? next : civil,
            hour: birth.timeUnknown ? null : lib.getTime(),
            civilDay: civil,
            nextCivilDay: nextCivil,
          },
          chart,
        },
        null,
        2,
      ) + '\n',
    );
  }
}

// Fixture B's actual apparent correction crosses midnight; preserve additional civil-clock variants to exercise late zi.
for (const school of ['zi_unified', 'zi_split'] as const) {
  const input: unknown = JSON.parse(
    readFileSync(new URL('./fixtures/birth/B.json', import.meta.url), 'utf8'),
  );
  const birth = normalizeBirth(input);
  const chart = computeBazi(birth, {
    now: '2026-10-04T00:00:00Z',
    school: { ziHour: school, useApparentSolarTime: false },
  });
  writeFileSync(
    new URL(
      `./fixtures/bazi/B-clock${school === 'zi_split' ? '-split' : ''}.json`,
      import.meta.url,
    ),
    JSON.stringify(
      { input, now: '2026-10-04T00:00:00Z', school, useApparentSolarTime: false, chart },
      null,
      2,
    ) + '\n',
  );
}

// Additional independently checkable clock/term/direction cases bring the golden corpus beyond 20 charts.
const inputs = [
  ...[39, 40, 41].map((minute) => ({
    calendar: 'gregorian',
    year: 2000,
    month: 2,
    day: 4,
    hour: 20,
    minute,
    timeUnknown: false,
    gender: 'male',
    place: { name: 'Guangzhou', lat: 23.13, lng: 113.26, tz: 'Asia/Shanghai' },
  })),
  ...[2, 3].flatMap((day) =>
    ['zi_unified', 'zi_split'].map((school) => ({
      calendar: 'gregorian',
      year: 1985,
      month: 11,
      day,
      hour: 23,
      minute: 40,
      timeUnknown: false,
      gender: 'female',
      school,
    })),
  ),
  ...[1990, 1985].flatMap((year) =>
    ['male', 'female'].map((gender) => ({
      calendar: 'gregorian',
      year,
      month: 5,
      day: 15,
      hour: 8,
      minute: 30,
      timeUnknown: false,
      gender,
    })),
  ),
  {
    calendar: 'gregorian',
    year: 1900,
    month: 1,
    day: 1,
    hour: 0,
    minute: 0,
    timeUnknown: false,
    gender: 'male',
  },
  {
    calendar: 'gregorian',
    year: 2100,
    month: 12,
    day: 31,
    hour: 23,
    minute: 59,
    timeUnknown: false,
    gender: 'female',
  },
];
const edges = inputs.map((raw, index) => {
  const { school, ...values } = raw as typeof raw & { school?: 'zi_unified' | 'zi_split' };
  const birth = normalizeBirth(values),
    ziHour = school ?? 'zi_unified';
  const lib = toSolar(birthClock(birth, false)).getLunar().getEightChar();
  // Independent library sect here follows its actual semantics; wrapper keeps the task's declared mapping.
  lib.setSect(ziHour === 'zi_unified' ? 1 : 2);
  const chart = computeBazi(birth, {
    now: '2026-10-04T00:00:00Z',
    school: { ziHour, useApparentSolarTime: false },
  });
  return {
    id: `edge-${index + 1}`,
    input: values,
    now: '2026-10-04T00:00:00Z',
    school: ziHour,
    useApparentSolarTime: false,
    reference: {
      year: lib.getYear(),
      month: lib.getMonth(),
      day: lib.getDay(),
      hour: lib.getTime(),
    },
    chart: {
      pillars: chart.pillars,
      dayMaster: chart.dayMaster,
      strength: chart.strength,
      luck: {
        direction: chart.luck.direction,
        startAge: chart.luck.startAge,
        startDate: chart.luck.startDate,
      },
      solarTerms: chart.solarTerms,
    },
  };
});
writeFileSync(
  new URL('./fixtures/bazi/edges.json', import.meta.url),
  JSON.stringify(edges, null, 2) + '\n',
);
