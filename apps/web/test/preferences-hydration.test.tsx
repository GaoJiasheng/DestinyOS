// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Providers } from '../components/providers';
import { ThemeSwitch } from '../components/theme-provider';
import { useReducedMotionPreference } from '../components/ui/use-reduced-motion';

const { getSettings } = vi.hoisted(() => ({ getSettings: vi.fn() }));
vi.mock('../app/me/actions', () => ({ getSettingsAction: getSettings }));
vi.mock('../i18n/navigation', () => ({ usePathname: () => '/me/settings' }));
vi.mock('../i18n/use-copy', () => ({ useCopy: () => (key: string) => key }));
vi.mock('sonner', () => ({ Toaster: () => null }));

// DESIGN-GAP: Node 25 exposes a partial native localStorage; isolate a complete Web Storage implementation for jsdom.
beforeEach(() => {
  const values = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => {
      values.delete(key);
    },
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
  vi.stubGlobal('localStorage', storage);
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  delete document.documentElement.dataset.theme;
  delete document.documentElement.dataset.reducedMotion;
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

it('keeps a theme selected while account preferences are still loading', async () => {
  let resolve: (value: {
    theme: string | null;
    reducedMotion: boolean;
    soundOn: boolean;
    tz: string | null;
  }) => void = () => {};
  getSettings.mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  render(
    <Providers>
      <ThemeSwitch />
    </Providers>,
  );
  fireEvent.change(screen.getByRole('combobox', { name: 'nav.theme' }), {
    target: { value: 'west' },
  });
  await waitFor(() => expect(document.documentElement.dataset.theme).toBe('west'));
  await act(async () => resolve({ theme: null, reducedMotion: true, soundOn: false, tz: null }));
  expect(document.documentElement.dataset.theme).toBe('west');
  expect(localStorage.getItem('tianji-theme')).toBe('west');
  expect(document.documentElement.dataset.reducedMotion).toBe('true');
});

it('restores a saved account theme when no preference was edited', async () => {
  getSettings.mockResolvedValue({ theme: 'east', reducedMotion: false, soundOn: false, tz: null });
  render(
    <Providers>
      <ThemeSwitch />
    </Providers>,
  );
  await waitFor(() => expect(document.documentElement.dataset.theme).toBe('east'));
});

it('honors either motion preference, reacts to both updates and releases its media listener', () => {
  let matches = false;
  const listeners = new Set<() => void>();
  vi.stubGlobal('matchMedia', () => ({
    get matches() {
      return matches;
    },
    addEventListener: (_event: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_event: string, listener: () => void) => listeners.delete(listener),
  }));
  const { result, unmount } = renderHook(useReducedMotionPreference);
  expect(result.current).toBe(false);
  act(() => {
    localStorage.setItem('tianji-reduced-motion', 'true');
    window.dispatchEvent(new Event('tianji-settings'));
  });
  expect(result.current).toBe(true);
  act(() => {
    localStorage.removeItem('tianji-reduced-motion');
    matches = true;
    for (const listener of listeners) listener();
  });
  expect(result.current).toBe(true);
  act(() => {
    matches = false;
    for (const listener of listeners) listener();
  });
  expect(result.current).toBe(false);
  unmount();
  expect(listeners.size).toBe(0);
});
