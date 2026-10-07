import { redirectSystemPath } from '../app/+native-intent';
it('normalizes only first-party HTTPS magic links and preserves their parameters', () => {
  for (const prefix of ['', 'zh/', 'en/', 'zh-TW/'])
    expect(
      redirectSystemPath({
        path: `https://tianji.gavin.pub/${prefix}auth/verify?email=user%40example.test&token=credential`,
        initial: true,
      }),
    ).toBe('/auth/verify?email=user%40example.test&token=credential');
  expect(redirectSystemPath({ path: 'https://evil.test/auth/verify?token=x', initial: true })).toBe(
    'https://evil.test/auth/verify?token=x',
  );
});

it('excludes provider credentials from Router history while browser auth validates the original callback', () => {
  expect(
    redirectSystemPath({
      path: 'tianji://auth/callback#id_token=secret&state=nonce',
      initial: false,
    }),
  ).toBe('/auth/callback');
});
