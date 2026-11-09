import { describe, expect, it } from 'vitest';
import {
  base64UrlDecode,
  base64UrlEncode,
  decryptPushPayload,
  encryptPushPayload,
  generateRawKeyPair,
  sendPush,
  validPushEndpoint,
  vapidAuthorization,
} from '@/lib/web-push';
import { localClock, reminderDue, reminderPayload } from '@/lib/web-push-schedule';
import zh from '../messages/zh.json';
import tw from '../messages/zh-TW.json';
import en from '../messages/en.json';

// RFC 8291 Appendix A.
const rfc = {
  plaintext: 'When I grow up, I want to be a watermelon',
  server: {
    privateKey: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
    publicKey:
      'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
  },
  receiver: {
    privateKey: 'q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94',
    publicKey:
      'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
  },
  salt: 'DGv6ra1nlYgDCS1FRnbzlw',
  auth: 'BTBZMqHH6r4Tts7J_aSIgg',
  body: 'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN',
};

describe('web push protocol', () => {
  it('reproduces the RFC 8291 Appendix A message byte for byte', async () => {
    const body = await encryptPushPayload({
      plaintext: rfc.plaintext,
      p256dh: rfc.receiver.publicKey,
      auth: rfc.auth,
      salt: base64UrlDecode(rfc.salt),
      localKeys: rfc.server,
    });
    expect(base64UrlEncode(body)).toBe(rfc.body);
    const plain = await decryptPushPayload(base64UrlDecode(rfc.body), rfc.receiver, rfc.auth);
    expect(new TextDecoder().decode(plain)).toBe(rfc.plaintext);
  });

  it('round-trips with fresh receiver keys and rejects the wrong auth secret', async () => {
    const receiver = await generateRawKeyPair();
    const auth = base64UrlEncode(crypto.getRandomValues(new Uint8Array(16)));
    const first = await encryptPushPayload({
      plaintext: '今天的运势',
      p256dh: receiver.publicKey,
      auth,
    });
    const second = await encryptPushPayload({
      plaintext: '今天的运势',
      p256dh: receiver.publicKey,
      auth,
    });
    expect(base64UrlEncode(first)).not.toBe(base64UrlEncode(second));
    expect(new TextDecoder().decode(await decryptPushPayload(first, receiver, auth))).toBe(
      '今天的运势',
    );
    const other = base64UrlEncode(crypto.getRandomValues(new Uint8Array(16)));
    await expect(decryptPushPayload(first, receiver, other)).rejects.toThrow();
    await expect(
      encryptPushPayload({ plaintext: 'x'.repeat(3001), p256dh: receiver.publicKey, auth }),
    ).rejects.toThrow('too large');
  });

  it('signs a VAPID JWT that verifies with the public key', async () => {
    const keys = await generateRawKeyPair();
    const header = await vapidAuthorization({
      endpoint: 'https://push.example.test/send/abc',
      subject: 'mailto:owner@example.test',
      keys,
      now: 1_800_000_000,
    });
    const match = /^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/.exec(header);
    if (!match) throw new Error('Malformed header');
    const [, head, claims, signature, k] = match;
    expect(k).toBe(keys.publicKey);
    expect(JSON.parse(new TextDecoder().decode(base64UrlDecode(head ?? '')))).toEqual({
      typ: 'JWT',
      alg: 'ES256',
    });
    expect(JSON.parse(new TextDecoder().decode(base64UrlDecode(claims ?? '')))).toEqual({
      aud: 'https://push.example.test',
      exp: 1_800_000_000 + 12 * 3600,
      sub: 'mailto:owner@example.test',
    });
    const publicKey = await crypto.subtle.importKey(
      'raw',
      base64UrlDecode(keys.publicKey),
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify'],
    );
    const verify = (data: string) =>
      crypto.subtle.verify(
        { name: 'ECDSA', hash: 'SHA-256' },
        publicKey,
        base64UrlDecode(signature ?? ''),
        new TextEncoder().encode(data),
      );
    expect(await verify(`${head}.${claims}`)).toBe(true);
    expect(await verify(`${head}.${claims}x`)).toBe(false);
    await expect(
      vapidAuthorization({ endpoint: 'https://push.example.test/a', subject: 'owner', keys }),
    ).rejects.toThrow('subject');
  });

  it('posts an encrypted body to a mock endpoint and maps 404/410 to gone', async () => {
    const receiver = await generateRawKeyPair();
    const auth = base64UrlEncode(crypto.getRandomValues(new Uint8Array(16)));
    const vapid = { subject: 'mailto:owner@example.test', keys: await generateRawKeyPair() };
    const target = {
      endpoint: 'https://push.example.test/send/1',
      p256dh: receiver.publicKey,
      auth,
    };
    const seen: { headers: Headers; body: Uint8Array }[] = [];
    const mock =
      (status: number): typeof fetch =>
      async (_input, init) => {
        seen.push({
          headers: new Headers(init?.headers),
          body: new Uint8Array(await new Response(init?.body).arrayBuffer()),
        });
        return new Response(null, { status });
      };
    const payload = reminderPayload('en', { title: 'T', body: 'B' });
    expect(await sendPush(target, payload, { vapid, fetch: mock(201) })).toEqual({
      status: 'sent',
    });
    expect(await sendPush(target, payload, { vapid, fetch: mock(404) })).toEqual({
      status: 'gone',
    });
    expect(await sendPush(target, payload, { vapid, fetch: mock(410) })).toEqual({
      status: 'gone',
    });
    expect(await sendPush(target, payload, { vapid, fetch: mock(500) })).toEqual({
      status: 'failed',
      code: 500,
    });
    const failing: typeof fetch = async () => {
      throw new Error('offline');
    };
    expect(await sendPush(target, payload, { vapid, fetch: failing })).toEqual({
      status: 'failed',
      code: 0,
    });
    const first = seen[0];
    if (!first) throw new Error('No request captured');
    expect(first.headers.get('content-encoding')).toBe('aes128gcm');
    expect(first.headers.get('ttl')).toBe('43200');
    expect(first.headers.get('authorization')).toMatch(/^vapid t=/);
    expect(new TextDecoder().decode(await decryptPushPayload(first.body, receiver, auth))).toBe(
      payload,
    );
  });

  it('accepts only public https push endpoints', () => {
    expect(validPushEndpoint('https://fcm.googleapis.com/fcm/send/abc')).toBe(true);
    expect(validPushEndpoint('http://fcm.googleapis.com/fcm/send/abc')).toBe(false);
    expect(validPushEndpoint('https://localhost/push')).toBe(false);
    expect(validPushEndpoint('https://127.0.0.1/push')).toBe(false);
    expect(validPushEndpoint('https://[::1]/push')).toBe(false);
    expect(validPushEndpoint('https://user:pw@push.example.test/x')).toBe(false);
    expect(validPushEndpoint('not a url')).toBe(false);
  });
});

describe('web push schedule', () => {
  const state = (timeZone: string, hour = 8, lastSentDate: string | null = null) => ({
    timeZone,
    hour,
    lastSentDate,
    disabledAt: null,
  });

  it('selects subscriptions whose local wall clock reached the chosen hour', () => {
    const now = new Date('2026-11-09T00:00:00Z');
    expect(localClock(now, 'Asia/Shanghai')).toEqual({ date: '2026-11-09', hour: 8 });
    expect(reminderDue(state('Asia/Shanghai'), now)).toBe(true);
    expect(reminderDue(state('Asia/Tokyo'), now)).toBe(false);
    expect(reminderDue(state('America/Los_Angeles'), now)).toBe(false);
    expect(reminderDue(state('America/Los_Angeles'), new Date('2026-11-09T16:00:00Z'))).toBe(true);
    // Half-hour offset zones are served at :30 of their chosen hour.
    expect(localClock(new Date('2026-11-09T03:00:00Z'), 'Asia/Kolkata')).toEqual({
      date: '2026-11-09',
      hour: 8,
    });
    expect(reminderDue(state('Asia/Kolkata'), new Date('2026-11-09T03:00:00Z'))).toBe(true);
    expect(reminderDue(state('Asia/Kolkata'), new Date('2026-11-09T02:00:00Z'))).toBe(false);
  });

  it('holds the hour boundary and local midnight', () => {
    expect(reminderDue(state('UTC'), new Date('2026-11-09T07:59:59Z'))).toBe(false);
    expect(reminderDue(state('UTC'), new Date('2026-11-09T08:00:00Z'))).toBe(true);
    expect(reminderDue(state('UTC'), new Date('2026-11-09T08:59:59Z'))).toBe(true);
    expect(reminderDue(state('UTC'), new Date('2026-11-09T09:00:00Z'))).toBe(false);
    expect(localClock(new Date('2026-11-09T16:00:00Z'), 'Asia/Shanghai')).toEqual({
      date: '2026-11-10',
      hour: 0,
    });
  });

  it('is idempotent per local date and skips disabled subscriptions', () => {
    const now = new Date('2026-11-09T00:10:00Z');
    expect(reminderDue(state('Asia/Shanghai', 8, '2026-11-09'), now)).toBe(false);
    expect(reminderDue(state('Asia/Shanghai', 8, '2026-11-08'), now)).toBe(true);
    expect(reminderDue({ ...state('Asia/Shanghai'), disabledAt: new Date() }, now)).toBe(false);
  });

  it('follows daylight saving changes', () => {
    // US spring forward 2026-03-08: 8:00 PDT is 15:00Z; the day before 8:00 PST is 16:00Z.
    expect(reminderDue(state('America/Los_Angeles'), new Date('2026-03-07T16:00:00Z'))).toBe(true);
    expect(reminderDue(state('America/Los_Angeles'), new Date('2026-03-08T15:00:00Z'))).toBe(true);
    expect(reminderDue(state('America/Los_Angeles'), new Date('2026-03-08T16:00:00Z'))).toBe(false);
    // US fall back 2026-11-01: 01:00 local happens twice; the claimed date blocks the second.
    const firstOne = new Date('2026-11-01T08:00:00Z');
    const secondOne = new Date('2026-11-01T09:00:00Z');
    expect(localClock(firstOne, 'America/Los_Angeles').hour).toBe(1);
    expect(localClock(secondOne, 'America/Los_Angeles').hour).toBe(1);
    expect(reminderDue(state('America/Los_Angeles', 1), firstOne)).toBe(true);
    expect(reminderDue(state('America/Los_Angeles', 1, '2026-11-01'), secondOne)).toBe(false);
    expect(reminderDue(state('America/Los_Angeles'), new Date('2026-11-01T16:00:00Z'))).toBe(true);
    expect(localClock(firstOne, 'Not/AZone')).toEqual({ date: '2026-11-01', hour: 8 });
  });

  it('widens the window only for the sender catch-up runs', () => {
    expect(reminderDue(state('UTC'), new Date('2026-11-09T09:00:00Z'), 2)).toBe(true);
    expect(reminderDue(state('UTC'), new Date('2026-11-09T10:59:59Z'), 2)).toBe(true);
    expect(reminderDue(state('UTC'), new Date('2026-11-09T11:00:00Z'), 2)).toBe(false);
    expect(reminderDue(state('UTC'), new Date('2026-11-09T07:59:59Z'), 2)).toBe(false);
    expect(reminderDue(state('UTC', 8, '2026-11-09'), new Date('2026-11-09T09:00:00Z'), 2)).toBe(
      false,
    );
  });

  it('builds a generic localized payload without personal data', () => {
    const payload = (locale: string) =>
      JSON.parse(reminderPayload(locale, { title: 'T', body: 'B' })) as Record<string, string>;
    expect(payload('en')).toEqual({
      title: 'T',
      body: 'B',
      url: '/en/today',
      tag: 'daily-reminder',
    });
    expect(payload('zh-TW').url).toBe('/zh-TW/today');
    expect(payload('fr').url).toBe('/zh/today');
  });

  it('keeps the reminder wording in the three catalogs', () => {
    for (const catalog of [zh, tw, en]) {
      const copy = { title: catalog['push.reminder.title'], body: catalog['push.reminder.body'] };
      expect(copy.title.length).toBeGreaterThan(0);
      expect(copy.body.length).toBeGreaterThan(0);
      expect(copy.title + copy.body).not.toMatch(/[{}]/);
    }
    expect(tw['push.reminder.title']).toBe('天機');
  });
});
