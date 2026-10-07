import * as Sentry from '@sentry/react-native';
import { beforeSend, captureMetric } from '../lib/monitoring';
it('drops sensitive payloads, arbitrary text, nested local variables and encoded authentication URLs', () => {
  const event = beforeSend({
    type: undefined,
    message: '出生上海 1990-05-15 question=私人问题',
    request: { data: { birth: '1990-05-15' }, headers: { authorization: 'Bearer secret' } },
    user: { email: 'user@example.com', ip_address: '127.0.0.1' },
    breadcrumbs: [{ message: '私人日记', data: { text: '私人问题' } }],
    contexts: { custom: { birth: '1990-05-15' } },
    extra: { question: '私人问题', accessToken: 'secret', location: '上海' },
    exception: {
      values: [
        {
          value: '出生上海',
          type: 'Error',
          stacktrace: {
            frames: [
              {
                filename: 'tianji:///auth/verify%253Ftoken%253Dsecret',
                function: 'render',
                vars: { birth: '1990-05-15' },
                lineno: 14,
              },
            ],
          },
        },
      ],
    },
  });
  const serialized = JSON.stringify(event);
  for (const value of [
    '上海',
    '1990-05-15',
    'secret',
    'example.com',
    '私人',
    'authorization',
    'breadcrumbs',
    'vars',
  ])
    expect(serialized).not.toContain(value);
  expect(event.exception?.values?.[0]?.stacktrace?.frames?.[0]).toMatchObject({
    function: 'render',
    lineno: 14,
    filename: 'tianji:///auth/verify',
  });
});
it('allows only finite metric aggregates and configures privacy for native and JS paths', () => {
  const options = jest.mocked(Sentry.init).mock.calls[0]?.[0];
  expect(options).toMatchObject({
    sendDefaultPii: false,
    maxBreadcrumbs: 0,
    attachScreenshot: false,
    attachViewHierarchy: false,
    enableAutoBreadcrumbTracking: false,
    enableNetworkBreadcrumbs: false,
    enableLogs: false,
  });
  expect(options?.beforeSendTransaction?.({ type: 'transaction' }, {})).toBeNull();
  captureMetric('starfield.fps', 60);
  expect(Sentry.captureEvent).toHaveBeenCalledWith({
    level: 'info',
    extra: { metric: 'starfield.fps', value: 60 },
  });
  jest.mocked(Sentry.captureEvent).mockClear();
  captureMetric('starfield.fps', NaN);
  expect(Sentry.captureEvent).not.toHaveBeenCalled();
  expect(
    beforeSend({ type: undefined, extra: { metric: 'question', value: 60 } }).extra,
  ).toBeUndefined();
});
