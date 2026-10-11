// @vitest-environment jsdom
import { act, cleanup, render, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ pathname: '/iching/cast', importer: vi.fn(() => null) }));
vi.mock('next/dynamic', () => ({
  default: (loader: () => Promise<unknown>) =>
    loader.toString().includes('anonymous-import') ? state.importer : () => null,
}));
vi.mock('../i18n/navigation', () => ({ usePathname: () => state.pathname }));
vi.mock('../i18n/use-copy', () => ({ useCopy: () => () => 'Notifications' }));
vi.mock('../app/me/actions', () => ({ getSettingsAction: async () => null }));
vi.mock('../components/theme-provider', () => ({
  ThemeProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('motion/react', () => ({
  MotionConfig: ({ children }: { children: ReactNode }) => children,
}));
import { Providers } from '../components/providers';
afterEach(() => {
  cleanup();
  document.cookie = 'anon_import=; Max-Age=0; Path=/';
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it('keeps offline reports visible when saving sets the import cookie, then loads the importer after reconnection', async () => {
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn(), removeItem: vi.fn() });
  const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  const page = render(
    <Providers>
      <p>Local report</p>
    </Providers>,
  );
  document.cookie = 'anon_import=1; Path=/';
  state.pathname = '/iching/r/local/reading';
  page.rerender(
    <Providers>
      <p>Local report</p>
    </Providers>,
  );
  expect(state.importer).not.toHaveBeenCalled();
  expect(page.getByText('Local report')).toBeTruthy();
  online.mockReturnValue(true);
  act(() => window.dispatchEvent(new Event('online')));
  await waitFor(() => expect(state.importer).toHaveBeenCalled());
  online.mockReturnValue(false);
  act(() => window.dispatchEvent(new Event('offline')));
  const calls = state.importer.mock.calls.length;
  page.rerender(
    <Providers>
      <p>Local report</p>
    </Providers>,
  );
  expect(state.importer).toHaveBeenCalledTimes(calls);
  expect(page.getByText('Local report')).toBeTruthy();
});
