import { expect, it, vi } from 'vitest';
import { createTranslator } from 'next-intl';
import { writeFile } from 'node:fs/promises';
import { toMessages } from '../i18n/catalog';
import zh from '../messages/zh.json';
import en from '../messages/en.json';
import tw from '../messages/zh-TW.json';
import type { PublicShare } from '../lib/share-projection';
vi.mock('../lib/auth', () => ({ auth: async () => null }));
// DESIGN-GAP: Local CPU profiling excludes DB/network quota latency; verification, layout, fonts and PNG rendering use the real route implementations.
vi.mock('../lib/ratelimit', () => ({
  ratelimit: async () => ({ success: true }),
  assertRateLimit: () => {},
}));
vi.mock('../lib/share-copy', () => ({
  shareCopy: async (locale: 'zh' | 'zh-TW' | 'en') =>
    createTranslator({
      locale,
      messages: toMessages(locale === 'en' ? en : locale === 'zh-TW' ? tw : zh),
    }),
}));
const card: PublicShare = {
  locale: 'zh',
  system: 'bazi',
  template: 'chart',
  revealLevel: 1,
  headline: '从一个习惯认识自己',
  keywords: ['日主', '事业', '感情'],
  scores: { career: 3, wealth: 3, love: 3, health: 3, social: 3 },
  diagram: {
    kind: 'pillars',
    items: ['year', 'month', 'day', 'hour'].map((label) => ({
      label: `bazi.chart.${label}`,
      value: 'bazi.stems.geng|bazi.branches.wu',
    })),
  },
};
vi.mock('../lib/share-service', async (original) => ({
  ...(await original<typeof import('../lib/share-service')>()),
  publicShare: async (_token: string, locale: 'zh' | 'en' | 'zh-TW') => ({ ...card, locale }),
}));
import { GET as shareImage } from '../app/api/v1/og/share/[token]/route';
import { GET as dailyImage } from '../app/api/v1/og/daily/route';
import { signDailyCard } from '../lib/share-service';
/** Opt-in 100-request samples of the actual image handlers, using local CPU microseconds rather than elapsed latency. */
it.skipIf(process.env.RUN_CF_CPU_BENCHMARK !== '1')(
  'profiles CPU P99 for the heaviest in-Worker image rendering routes',
  async () => {
    vi.stubEnv('AUTH_SECRET', 'isolated-cpu-profile-secret');
    const routes = [
      {
        path: '/api/v1/og/share/[token]?format=story',
        execute: (locale: 'zh' | 'en' | 'zh-TW') =>
          shareImage(
            new Request(
              `https://example.test/api/v1/og/share/0123456789ABCDEFGHIJKL?locale=${locale}&format=story`,
            ),
            { params: Promise.resolve({ token: '0123456789ABCDEFGHIJKL' }) },
          ),
      },
      {
        path: '/api/v1/og/share/[token]?format=landscape',
        execute: (locale: 'zh' | 'en' | 'zh-TW') =>
          shareImage(
            new Request(
              `https://example.test/api/v1/og/share/0123456789ABCDEFGHIJKL?locale=${locale}&format=landscape`,
            ),
            { params: Promise.resolve({ token: '0123456789ABCDEFGHIJKL' }) },
          ),
      },
      {
        path: '/api/v1/og/daily',
        execute: (locale: 'zh' | 'en' | 'zh-TW') => {
          const signed = signDailyCard({
            locale,
            date: '2026-10-06',
            headline: locale === 'en' ? 'One steady habit' : '从一个习惯认识自己',
            stars: 3,
            color: 'Gold',
            numbers: [1, 6],
            do: ['Focus'],
            dont: ['Rush'],
          });
          return dailyImage(
            new Request(`https://example.test/api/v1/og/daily?${new URLSearchParams(signed)}`),
          );
        },
      },
    ];
    const result: { path: string; samples: number; p99CpuMs: number; maximumCpuMs: number }[] = [];
    try {
      for (const route of routes) {
        const samples: number[] = [];
        for (let i = 0; i < 100; i++) {
          const before = process.cpuUsage();
          const response = await route.execute((['zh', 'zh-TW', 'en'] as const)[i % 3]!);
          expect(response.status).toBe(200);
          expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(10000);
          const cpu = process.cpuUsage(before);
          samples.push((cpu.user + cpu.system) / 1000);
        }
        samples.sort((a, b) => a - b);
        result.push({
          path: route.path,
          samples: samples.length,
          p99CpuMs: samples[Math.ceil(samples.length * 0.99) - 1]!,
          maximumCpuMs: samples.at(-1)!,
        });
      }
      await writeFile('/tmp/destinyos-route-cpu.json', JSON.stringify(result, null, 2));
      console.log(JSON.stringify(result));
    } finally {
      vi.unstubAllEnvs();
    }
  },
  300000,
);
