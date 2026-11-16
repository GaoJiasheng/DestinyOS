import { expect, it, vi } from 'vitest';
const calls = vi.hoisted(() => [] as string[]);
vi.mock('sonner', () => ({
  toast: Object.assign(
    (message: string) => {
      calls.push(`info:${message}`);
    },
    {
      success: (message: string) => {
        calls.push(`success:${message}`);
      },
    },
  ),
}));

it('routes confirmations to the matching toast kind', async () => {
  const { notifyInfo, notifySuccess } = await import('../lib/notify');
  notifySuccess('saved');
  await vi.waitFor(() => expect(calls).toEqual(['success:saved']));
  notifyInfo('heads up');
  await vi.waitFor(() => expect(calls).toEqual(['success:saved', 'info:heads up']));
});
