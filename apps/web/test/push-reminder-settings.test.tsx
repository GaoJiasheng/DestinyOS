// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toMessages } from '../i18n/catalog';
import zh from '../messages/zh.json';

const server = vi.hoisted(() => ({
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
  status: vi.fn(),
}));
vi.mock('../app/me/push-actions', () => ({
  subscribePushAction: server.subscribe,
  unsubscribePushAction: server.unsubscribe,
  pushStatusAction: server.status,
}));
vi.mock('../i18n/navigation', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
  usePathname: () => '/me/settings',
}));

const PUBLIC_KEY = 'B'.repeat(87);
vi.stubEnv('NEXT_PUBLIC_VAPID_PUBLIC_KEY', PUBLIC_KEY);
const { PushReminderSettings } = await import('../components/me/push-reminder-settings');

type Fake = {
  subscription: ReturnType<typeof makeSubscription> | null;
  subscribe: ReturnType<typeof vi.fn>;
  requestPermission: ReturnType<typeof vi.fn>;
};
function makeSubscription() {
  return {
    endpoint: 'https://push.example.test/a',
    options: { applicationServerKey: null as ArrayBuffer | null },
    getKey: (name: string) => new Uint8Array(name === 'auth' ? 16 : 65).buffer,
    unsubscribe: vi.fn(async () => true),
  };
}
function browser(permission: NotificationPermission, options: { push?: boolean } = {}): Fake {
  const fake: Fake = {
    subscription: null,
    subscribe: vi.fn(async () => {
      fake.subscription = makeSubscription();
      return fake.subscription;
    }),
    requestPermission: vi.fn(async () => permission),
  };
  const registration = {
    pushManager: { getSubscription: async () => fake.subscription, subscribe: fake.subscribe },
  };
  vi.stubGlobal(
    'Notification',
    Object.assign(function Notification() {}, {
      permission: permission === 'granted' ? 'default' : permission,
      requestPermission: fake.requestPermission,
    }),
  );
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => ({ matches: false }),
  });
  if (options.push === false) Reflect.deleteProperty(window, 'PushManager');
  else Object.defineProperty(window, 'PushManager', { configurable: true, value: class {} });
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: {
      getRegistration: async () => registration,
      register: vi.fn(async () => registration),
      ready: Promise.resolve(registration),
    },
  });
  return fake;
}
const show = (signedIn = true) =>
  render(
    <NextIntlClientProvider locale="zh" messages={toMessages(zh)} timeZone="UTC">
      <PushReminderSettings signedIn={signedIn} />
    </NextIntlClientProvider>,
  );
const setAgent = (agent: string) =>
  Object.defineProperty(navigator, 'userAgent', { configurable: true, value: agent });

beforeEach(() => {
  setAgent('Mozilla/5.0 (X11; Linux x86_64) Chrome/130');
  server.subscribe.mockReset().mockResolvedValue({ ok: true, data: { subscribed: true } });
  server.unsubscribe.mockReset().mockResolvedValue({ ok: true, data: { subscribed: false } });
  server.status
    .mockReset()
    .mockResolvedValue({ ok: true, data: { subscribed: false, hour: null } });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('daily reminder settings', () => {
  it('never asks for permission while rendering', async () => {
    const fake = browser('granted');
    show();
    await screen.findByRole('checkbox');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(fake.requestPermission).not.toHaveBeenCalled();
    expect(fake.subscribe).not.toHaveBeenCalled();
    expect(server.subscribe).not.toHaveBeenCalled();
  });

  it('subscribes with the chosen hour after the user turns it on', async () => {
    const fake = browser('granted');
    show();
    fireEvent.change(await screen.findByLabelText(zh['me.push.time']), { target: { value: '20' } });
    fireEvent.click(screen.getByRole('checkbox'));
    await waitFor(() => expect(server.subscribe).toHaveBeenCalledOnce());
    expect(fake.requestPermission).toHaveBeenCalledOnce();
    expect(fake.subscribe).toHaveBeenCalledWith(expect.objectContaining({ userVisibleOnly: true }));
    expect(server.subscribe.mock.calls[0]?.[0]).toMatchObject({
      endpoint: 'https://push.example.test/a',
      locale: 'zh',
      hour: 20,
    });
    await waitFor(() => expect(screen.getByRole('checkbox')).toHaveProperty('checked', true));
  });

  it('explains a dismissed prompt and a denied permission without subscribing', async () => {
    const dismissed = browser('default');
    show();
    fireEvent.click(await screen.findByRole('checkbox'));
    expect(await screen.findByRole('status')).toHaveProperty(
      'textContent',
      zh['me.push.dismissed'],
    );
    expect(dismissed.subscribe).not.toHaveBeenCalled();
    cleanup();
    const denied = browser('default');
    denied.requestPermission.mockResolvedValue('denied');
    show();
    fireEvent.click(await screen.findByRole('checkbox'));
    expect(await screen.findByText(zh['me.push.denied'])).toBeTruthy();
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it.each([
    ['an already blocked permission', () => browser('denied'), 'me.push.denied'],
    [
      'a browser without Push API',
      () => browser('default', { push: false }),
      'me.push.unsupported',
    ],
    [
      'iOS Safari outside the home screen',
      () => {
        setAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1');
        return browser('default');
      },
      'me.push.iosInstall',
    ],
  ] as const)('shows guidance instead of a switch for %s', async (_name, setup, key) => {
    const fake = setup();
    show();
    expect(await screen.findByText(zh[key])).toBeTruthy();
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(fake.requestPermission).not.toHaveBeenCalled();
  });

  it('asks signed-out visitors to sign in and never touches the browser subscription', async () => {
    browser('default');
    show(false);
    expect(await screen.findByRole('link', { name: zh['me.push.signIn'] })).toBeTruthy();
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(server.status).not.toHaveBeenCalled();
  });

  it('shows the stored state and removes the device when turned off', async () => {
    const fake = browser('default');
    fake.subscription = makeSubscription();
    const subscription = fake.subscription;
    server.status.mockResolvedValue({ ok: true, data: { subscribed: true, hour: 9 } });
    show();
    await waitFor(() => expect(screen.getByRole('checkbox')).toHaveProperty('checked', true));
    expect(screen.getByLabelText(zh['me.push.time'])).toHaveProperty('value', '9');
    fireEvent.click(screen.getByRole('checkbox'));
    await waitFor(() => expect(subscription.unsubscribe).toHaveBeenCalledOnce());
    expect(server.unsubscribe).toHaveBeenCalledWith('https://push.example.test/a');
    await waitFor(() => expect(screen.getByRole('checkbox')).toHaveProperty('checked', false));
  });

  it('reports a server failure without claiming success', async () => {
    browser('granted');
    server.subscribe.mockResolvedValue({ ok: false, error: { code: 'E_INTERNAL' } });
    show();
    fireEvent.click(await screen.findByRole('checkbox'));
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', zh['me.push.error']);
    expect(screen.getByRole('checkbox')).toHaveProperty('checked', false);
  });
});
