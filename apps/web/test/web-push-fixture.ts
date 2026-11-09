import { vi } from 'vitest';
import { generateRawKeyPair, type RawKeyPair } from '../lib/web-push';

export const FIELD_KEY = `v1:${Buffer.alloc(32, 1).toString('base64')}`;
export const copy = {
  zh: { title: '天机', body: '提醒' },
  'zh-TW': { title: '天機', body: '提醒' },
  en: { title: 'DestinyOS', body: 'Reminder' },
};
/** 08:00 in Shanghai, 00:00 UTC. */
export const eightAm = new Date('2026-11-09T00:00:00Z');
export type PushDevice = { p256dh: string; auth: string; receiver: RawKeyPair };
export type PushVapid = { subject: string; keys: RawKeyPair };
export type Delivery = { url: string; body: Uint8Array };

/** Local mock push service: records every encrypted request and never opens a network connection. */
export function pushService(status: (url: string) => number = () => 201) {
  const deliveries: Delivery[] = [];
  const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    deliveries.push({ url, body: new Uint8Array(init?.body as ArrayBuffer) });
    return new Response(null, { status: status(url) });
  }) as unknown as typeof fetch;
  return { deliveries, fetcher };
}
export const endpoint = (name: string) => `https://push.example.test/send/${name}`;
export const subscriptionInput = (
  device: PushDevice,
  name: string,
  extra: Record<string, unknown> = {},
) => ({
  endpoint: endpoint(name),
  p256dh: device.p256dh,
  auth: device.auth,
  tz: 'Asia/Shanghai',
  locale: 'en',
  hour: 8,
  ...extra,
});
export async function stubPushEnvironment(): Promise<{ vapid: PushVapid; device: PushDevice }> {
  vi.stubEnv('PLATFORM', 'vercel');
  vi.stubEnv('FIELD_ENCRYPTION_KEYS', FIELD_KEY);
  vi.stubEnv('CRON_SECRET', 'cron-secret');
  vi.stubEnv('FEATURE_WEB_PUSH', 'true');
  vi.stubEnv('NEXT_PUBLIC_FEATURE_WEB_PUSH', 'true');
  const vapid = { subject: 'mailto:ops@example.test', keys: await generateRawKeyPair() };
  vi.stubEnv('NEXT_PUBLIC_VAPID_PUBLIC_KEY', vapid.keys.publicKey);
  vi.stubEnv('VAPID_PRIVATE_KEY', vapid.keys.privateKey);
  vi.stubEnv('VAPID_SUBJECT', vapid.subject);
  const receiver = await generateRawKeyPair();
  const auth = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('base64url');
  return { vapid, device: { p256dh: receiver.publicKey, auth, receiver } };
}
