import { it, expect } from 'vitest';
import { POST } from '../app/auth/mobile/apple/route';
it('relays only bounded Apple form posts into a native fragment without issuing any sessions', async () => {
  const state = '9fba18f5-429b-463e-9d9a-55072d4c76c1';
  const response = await POST(
    new Request('https://tianji.gavin.pub/auth/mobile/apple', {
      method: 'POST',
      body: new URLSearchParams({ state, id_token: 'identity', redirect_uri: 'https://evil.test' }),
    }),
  );
  expect(response.status).toBe(303);
  expect(response.headers.get('Location')).toBe(
    `tianji://auth/callback#state=${state}&id_token=identity`,
  );
  expect(response.headers.get('Cache-Control')).toBe('no-store');
  expect(
    (
      await POST(
        new Request('https://tianji.gavin.pub/auth/mobile/apple', {
          method: 'POST',
          body: 'state=evil&id_token=x',
        }),
      )
    ).status,
  ).toBe(400);
});

import { GET as googleRelay } from '../app/auth/mobile/google/route';
it('relays Google codes only to the fixed native callback, preserving state in the fragment', async () => {
  const response = await googleRelay(
    new Request(
      'https://tianji.gavin.pub/auth/mobile/google?state=9fba18f5-429b-463e-9d9a-55072d4c76c1&code=provider-code&redirect_uri=https://evil.test',
    ),
  );
  expect(response.status).toBe(303);
  expect(response.headers.get('Location')).toBe(
    'tianji://auth/callback#state=9fba18f5-429b-463e-9d9a-55072d4c76c1&code=provider-code',
  );
  expect(
    (
      await googleRelay(
        new Request('https://tianji.gavin.pub/auth/mobile/google?state=evil&code=provider-code'),
      )
    ).status,
  ).toBe(400);
});
