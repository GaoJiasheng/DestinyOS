import { compute, computeIching, hashSeed } from '@tianji/engine';
import { IchingChartSchema, TarotChartSchema } from '@tianji/shared';
import {
  automaticPicks,
  createShakeGate,
  parseNumbers,
  ritualClock,
  throwCoins,
} from '../lib/rituals/model';
const clock = '2026-10-04T12:00:00+08:00[Asia/Shanghai]';
it('preserves civil timezone and validates every number, including an optional third value', () => {
  expect(ritualClock('Asia/Singapore', '2026-10-04T04:00:00Z')).toBe(
    '2026-10-04T12:00:00+08:00[Asia/Singapore]',
  );
  expect(parseNumbers(['3', '5', ''])).toEqual([3, 5]);
  expect(parseNumbers(['3', '5', '999'])).toEqual([3, 5, 999]);
  for (const values of [
    ['', '5', ''],
    ['0', '5', ''],
    ['3', '5', '1.2'],
    ['3', '5', '1000'],
    ['3x', '5', ''],
  ])
    expect(parseNumbers(values)).toBeNull();
});
it('shake threshold re-arms at rest and enforces the documented 800ms debounce', () => {
  const gate = createShakeGate();
  expect(gate({ x: 0, y: 0, z: 1 }, 0)).toBe(false);
  expect(gate({ x: 2.5, y: 0, z: 1 }, 1000)).toBe(true);
  expect(gate({ x: 3, y: 0, z: 1 }, 2000)).toBe(false);
  expect(gate({ x: 0, y: 0, z: 1 }, 2200)).toBe(false);
  expect(gate({ x: 3, y: 0, z: 1 }, 2400)).toBe(true);
  gate({ x: 0, y: 0, z: 1 }, 2500);
  expect(gate({ x: 3, y: 0, z: 1 }, 2600)).toBe(false);
  expect(gate({ x: 3, y: 0, z: 1 }, 3200)).toBe(true);
});
it('physical coin throws replay from round and instant and remain true three-coin counts', () => {
  const replay = Array.from({ length: 1200 }, (_, i) => throwCoins('M07', i, 1728000000000 + i));
  expect(replay).toEqual(
    Array.from({ length: 1200 }, (_, i) => throwCoins('M07', i, 1728000000000 + i)),
  );
  const tally = [0, 1, 2, 3].map((n) => replay.filter((v) => v === n).length);
  expect(tally[1]!).toBeGreaterThan(tally[0]! * 2);
  expect(tally[2]!).toBeGreaterThan(tally[3]! * 2);
  expect(hashSeed(replay.join(','))).not.toBe(hashSeed(replay.slice().reverse().join(',')));
});
it('automatic draws retain manual choices, cover all 13 slots without duplicates, and replay selections', () => {
  const picks = automaticPicks('M07', 'year_ahead', [0, 77]);
  expect(picks.slice(0, 2)).toEqual([0, 77]);
  expect(picks).toHaveLength(13);
  expect(new Set(picks).size).toBe(13);
  expect(picks).toEqual(automaticPicks('M07', 'year_ahead', [0, 77]));
  const a = TarotChartSchema.parse(
    compute({
      system: 'tarot',
      now: clock,
      seed: 'M07',
      spread: 'year_ahead',
      pickedIndices: picks,
    }).chart,
  );
  const b = TarotChartSchema.parse(
    compute({
      system: 'tarot',
      now: clock,
      seed: 'M07',
      spread: 'year_ahead',
      pickedIndices: picks.slice().reverse(),
    }).chart,
  );
  expect(a.cards).not.toEqual(b.cards);
});
it('documented Liuyao golden coin sequence is the same through the native uniform dispatch', () => {
  const throws = [3, 1, 2, 2, 1, 0] as const;
  const chart = IchingChartSchema.parse(
    compute({
      system: 'iching',
      now: clock,
      seed: 'M07',
      question: { method: 'liuyao', category: 'other', liuyao: { throws: [...throws] } },
    }).chart,
  );
  expect(chart.primary.number).toBe(60);
  expect(chart.changing?.number).toBe(59);
  expect(chart.movingLines).toEqual([1, 6]);
  expect(chart).toEqual(
    computeIching(
      { method: 'liuyao', category: 'other', seed: 'M07', liuyao: { throws: [...throws] } },
      clock,
    ),
  );
});
