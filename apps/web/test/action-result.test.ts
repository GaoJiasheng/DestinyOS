import { expect, it, vi } from 'vitest';
import { z } from 'zod';
import { EngineError } from '@tianji/engine/common';
import { ApiError, actionError, errorResponse } from '../lib/api-error';
import { runAction } from '../lib/action-result';

it('maps domain/validation errors without disclosing exception messages or birth details', async () => {
  const privateDetails = { birth: 'private fixture' };
  for (const [error, code] of [
    [new ApiError('E_FORBIDDEN', 'Private exception', 403, privateDetails), 'E_FORBIDDEN'],
    [
      new EngineError('E_REQUIRES_BIRTH_TIME', 'Private exception', privateDetails),
      'E_REQUIRES_BIRTH_TIME',
    ],
    [new z.ZodError([]), 'E_VALIDATION'],
    [new Error('Private exception'), 'E_INTERNAL'],
    [null, 'E_INTERNAL'],
  ] as const) {
    expect(actionError(error)).toBe(code);
    expect(
      await runAction(async () => {
        throw error;
      }),
    ).toEqual({ ok: false, error: { code } });
  }
});

it('retains success payloads and executes the boundary hook only for failures', async () => {
  const hook = vi.fn(async () => undefined);
  const data = { id: 'reading-id' };
  expect(await runAction(async () => data, hook)).toEqual({ ok: true, data });
  expect(hook).not.toHaveBeenCalled();
  expect(
    await runAction(async () => {
      throw new ApiError('E_AGE_RESTRICTED', 'Age restricted', 403);
    }, hook),
  ).toEqual({ ok: false, error: { code: 'E_AGE_RESTRICTED' } });
  expect(hook).toHaveBeenCalledExactlyOnceWith('E_AGE_RESTRICTED');
});

it('retains the documented HTTP envelope and numeric retry header', async () => {
  const response = errorResponse(
    new ApiError('E_RATE_LIMITED', 'Rate limited', 429, { retryAfter: 42 }),
  );
  expect(response.status).toBe(429);
  expect(response.headers.get('retry-after')).toBe('42');
  expect(await response.json()).toEqual({
    ok: false,
    error: { code: 'E_RATE_LIMITED', message: 'Rate limited', details: { retryAfter: 42 } },
  });
  expect(
    errorResponse(new ApiError('E_INTERNAL', 'Unavailable', 500)).headers.has('retry-after'),
  ).toBe(false);
});
