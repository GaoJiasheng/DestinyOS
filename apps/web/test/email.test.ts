import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SendEmail } from '@cloudflare/workers-types';
import {
  CloudflareEmailSender,
  MockEmailSender,
  emailFrom,
  sendEmail,
} from '../lib/platform/email';
import { magicLinkEmail, sendMagicEmail } from '../lib/auth-email';

const mock = vi.hoisted(() => ({ bindings: vi.fn() }));
vi.mock('../lib/platform/cloudflare', () => ({ cloudflareBindings: mock.bindings }));
const from = { email: 'noreply@send.gavin.pub', name: '天机 DestinyOS' };
const message = {
  to: 'recipient@example.test',
  subject: 'Test',
  text: 'Plain',
  html: '<p>HTML</p>',
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('platform email delivery', () => {
  it('provides configurable sender address and name with brand defaults', () => {
    expect(emailFrom({})).toEqual(from);
    expect(emailFrom({ EMAIL_FROM: 'support@example.test', EMAIL_FROM_NAME: 'Support' })).toEqual({
      email: 'support@example.test',
      name: 'Support',
    });
  });

  it('sends structured HTML/text through the current request binding and propagates failures', async () => {
    vi.stubEnv('PLATFORM', 'cloudflare');
    vi.stubEnv('EMAIL_FROM', from.email);
    vi.stubEnv('EMAIL_FROM_NAME', from.name);
    vi.stubEnv('TEST_MAIL_URL', 'https://external.example/mail');
    const send = vi.fn<SendEmail['send']>().mockResolvedValue({ messageId: 'cf-test' });
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    mock.bindings.mockResolvedValueOnce({ EMAIL: { send } });
    await sendEmail(message);
    expect(send).toHaveBeenCalledWith({ ...message, from });
    const nextSend = vi
      .fn<SendEmail['send']>()
      .mockRejectedValue(new Error('E_SENDER_NOT_VERIFIED'));
    mock.bindings.mockResolvedValueOnce({ EMAIL: { send: nextSend } });
    await expect(sendEmail(message)).rejects.toThrow('E_SENDER_NOT_VERIFIED');
    expect(nextSend).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledOnce();
    mock.bindings.mockResolvedValueOnce({});
    await expect(sendEmail(message)).rejects.toThrow('EMAIL binding required');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('supports text-only messages without manufacturing HTML', async () => {
    const binding: SendEmail = { send: async () => ({ messageId: 'cf-test' }) };
    const send = vi.spyOn(binding, 'send');
    await new CloudflareEmailSender(binding, from).send({
      to: message.to,
      subject: 'Text',
      text: 'Body',
    });
    expect(send).toHaveBeenCalledWith({ from, to: message.to, subject: 'Text', text: 'Body' });
  });

  it('captures local mail in a bounded mock outbox without network requests', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const sender = new MockEmailSender(from);
    await sender.send(message);
    expect(sender.outbox).toEqual([{ ...message, from }]);
    for (let i = 0; i < 100; i++) await sender.send({ ...message, subject: String(i) });
    expect(sender.outbox).toHaveLength(100);
    expect(sender.outbox[0]?.subject).toBe('0');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('uses only the loopback mock sink, rejects redirects and reports failed delivery', async () => {
    for (const endpoint of [
      'https://127.0.0.1/mail',
      'http://example.test/mail',
      'http://127.0.0.1/other',
      'http://user@127.0.0.1/mail',
      'http://127.0.0.1/mail?redirect=1',
    ]) {
      expect(() => new MockEmailSender(from, endpoint)).toThrow('Mock mail sink');
    }
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response('OK'));
    vi.stubGlobal('fetch', fetch);
    const sender = new MockEmailSender(from, 'http://127.0.0.1:58081/mail');
    await sender.send(message);
    expect(fetch).toHaveBeenCalledWith(
      new URL('http://127.0.0.1:58081/mail'),
      expect.objectContaining({ redirect: 'error', body: JSON.stringify({ ...message, from }) }),
    );
    fetch.mockResolvedValueOnce(new Response('', { status: 503 }));
    await expect(sender.send(message)).rejects.toThrow('Mock mail delivery failed');
    expect(sender.outbox).toHaveLength(1);
    fetch.mockRejectedValueOnce(new Error('redirect blocked'));
    await expect(sender.send(message)).rejects.toThrow('redirect blocked');
  });

  it('fails closed for Node production unless running explicit isolated loopback E2E', async () => {
    vi.stubEnv('PLATFORM', 'vercel');
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('TEST_WEB_MODE', '');
    vi.stubEnv('AUTH_URL', 'http://localhost:3100');
    vi.stubEnv('AUTH_SECRET', 'isolated-email-test');
    vi.stubEnv('TEST_MAIL_URL', 'http://127.0.0.1:58081/mail');
    await expect(sendEmail(message)).rejects.toThrow('binding required in production');
    vi.stubEnv('TEST_WEB_MODE', 'production');
    vi.stubEnv('AUTH_URL', 'https://tianji.gavin.pub');
    await expect(sendEmail(message)).rejects.toThrow('binding required in production');
    vi.stubEnv('AUTH_URL', 'http://localhost:3100');
    vi.stubEnv('AUTH_SECRET', 'real-secret');
    await expect(sendEmail(message)).rejects.toThrow('binding required in production');
    vi.stubEnv('AUTH_SECRET', 'isolated-email-test');
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response('OK'));
    vi.stubGlobal('fetch', fetch);
    await sendEmail(message);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it.each(['zh', 'en'] as const)(
    'keeps %s magic-link copy and escapes HTML through the platform',
    async (locale) => {
      const url = `https://tianji.gavin.pub/${locale}/auth/verify?token=token&email=a%40example.test`;
      const template = magicLinkEmail(locale, url);
      expect(template.subject).toBe(locale === 'zh' ? '登录 天机' : 'Sign in to DestinyOS');
      expect(template.text).toContain(url);
      expect(template.html).toContain('&amp;email=');
      expect(template.html).toContain(`lang="${locale}"`);
      vi.stubEnv('PLATFORM', 'cloudflare');
      const send = vi.fn<SendEmail['send']>().mockResolvedValue({ messageId: 'cf-test' });
      mock.bindings.mockResolvedValue({ EMAIL: { send } });
      await sendMagicEmail(message.to, locale, url);
      expect(send).toHaveBeenCalledWith(expect.objectContaining({ to: message.to, ...template }));
    },
  );
});
