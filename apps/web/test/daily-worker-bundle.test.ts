import { beforeAll, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { brotliDecompressSync } from 'node:zlib';
import { calculateDaily } from '../lib/daily-compute';
import type { DailyWorkerRequest } from '../lib/daily-worker-types';
import type { KnowledgeBundle } from '@tianji/content';
import type { CalendarWorkerRequest } from '../lib/calendar-worker-types';
import { computeDailyRange } from '@tianji/engine/daily';
import { computeCalendarYear } from '@tianji/engine/calendar';
import { BirthInputSchema } from '@tianji/shared';
import birthFixture from '../../../packages/engine/test/fixtures/birth/A.json';

beforeAll(() => {
  execFileSync('pnpm', ['worker:build'], { stdio: 'pipe' });
});

for (const locale of ['zh', 'en', 'zh-TW'] as const)
  it(`${locale}: shipped daily worker preserves the pure-engine report`, () => {
    const input: DailyWorkerRequest = {
      profile: {
        calendar: 'gregorian',
        year: 1990,
        month: 5,
        day: 15,
        hour: 8,
        minute: 30,
        gender: 'male',
        timeUnknown: false,
        place: { name: 'Beijing', lat: 39.9, lng: 116.4, tz: 'Asia/Shanghai' },
      },
      date: '2026-10-04',
      tz: 'Asia/Shanghai',
      seed: 'fixture-daily',
      locale,
    };
    const asset = JSON.parse(readFileSync('apps/web/lib/daily-worker-asset.json', 'utf8')) as {
      url: string;
      traditionalUrl: string;
    };
    const url = locale === 'zh-TW' ? asset.traditionalUrl : asset.url;
    let listener: ((event: { data: DailyWorkerRequest }) => void) | undefined;
    let response: unknown;
    runInNewContext(brotliDecompressSync(readFileSync(`apps/web/public${url}`)).toString('utf8'), {
      TextEncoder,
      TextDecoder,
      structuredClone,
      self: {
        addEventListener(_name: string, handle: (event: { data: DailyWorkerRequest }) => void) {
          listener = handle;
        },
        postMessage(value: unknown) {
          response = value;
        },
      },
    });
    expect(listener).toBeTypeOf('function');
    listener?.({ data: input });
    const knowledge = JSON.parse(
      readFileSync(
        `packages/content/dist/daily.${locale === 'zh-TW' ? 'zh-TW' : 'zh'}.json`,
        'utf8',
      ),
    ) as KnowledgeBundle;
    // Compare serialized public output across realms, including localized prose, chart fields and provenance.
    expect(JSON.parse(JSON.stringify(response))).toEqual({
      ok: true,
      value: calculateDaily(input.profile, input.date, input.tz, input.seed, locale, knowledge),
    });
  });

for (const locale of ['zh', 'en', 'zh-TW'] as const)
  it(`${locale}: shipped calendar worker preserves month scores and annual event dates`, () => {
    const input: CalendarWorkerRequest = {
      profile: BirthInputSchema.parse(birthFixture),
      month: '2026-10',
      tz: 'Asia/Shanghai',
      identity: 'calendar-fixture',
      locale,
    };
    const asset = JSON.parse(readFileSync('apps/web/lib/daily-worker-asset.json', 'utf8')) as {
      calendarUrl: string;
    };
    let listener: ((event: { data: CalendarWorkerRequest }) => void) | undefined;
    let response: unknown;
    runInNewContext(
      brotliDecompressSync(readFileSync(`apps/web/public${asset.calendarUrl}`)).toString('utf8'),
      {
        TextEncoder,
        TextDecoder,
        structuredClone,
        self: {
          addEventListener(
            _name: string,
            handle: (event: { data: CalendarWorkerRequest }) => void,
          ) {
            listener = handle;
          },
          postMessage(value: unknown) {
            response = value;
          },
        },
      },
    );
    listener?.({ data: input });
    expect(JSON.parse(JSON.stringify(response))).toEqual({
      ok: true,
      days: computeDailyRange(
        input.profile,
        '2026-10-01',
        '2026-10-31',
        input.tz,
        input.identity,
        locale,
      ),
      events: computeCalendarYear(input.profile, 2026, input.tz, locale),
    });
    listener?.({ data: { ...input, month: 'private-invalid-month' } });
    expect(response).toEqual({ ok: false, code: 'E_INTERNAL' });
  });
