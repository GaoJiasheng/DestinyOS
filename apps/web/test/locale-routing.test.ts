import { expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import middleware from '../middleware';

it('remembers foreground zh-TW navigation but ignores old-locale prefetch cookies', () => {
  const foreground = middleware(
    new NextRequest('https://example.com/zh-TW', {
      headers: { cookie: 'NEXT_LOCALE=zh' },
    }),
  );
  expect(foreground.headers.get('set-cookie')).toContain('NEXT_LOCALE=zh-TW');
  for (const [name, value] of [
    ['next-router-prefetch', '1'],
    ['purpose', 'prefetch'],
  ] as const) {
    const response = middleware(
      new NextRequest('https://example.com/zh/astrology', {
        headers: { cookie: 'NEXT_LOCALE=zh-TW', [name]: value },
      }),
    );
    expect(response.headers.get('set-cookie')).toBeNull();
  }
});
