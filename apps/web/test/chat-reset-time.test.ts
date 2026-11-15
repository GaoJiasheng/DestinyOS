import { afterEach, expect, it, vi } from 'vitest';
import { localResetTime } from '../components/report/chat-panel-support';
afterEach(() => vi.unstubAllEnvs());
it('names the UTC midnight reset in the reader time zone', () => {
  vi.stubEnv('TZ', 'Asia/Shanghai');
  expect(localResetTime('zh', new Date('2026-11-15T20:00:00Z'))).toBe('08:00');
  vi.stubEnv('TZ', 'UTC');
  expect(localResetTime('en', new Date('2026-11-15T20:00:00Z'))).toBe('00:00');
});
