import { describe, it, expect } from 'vitest';
import { encryptAnonymous, decryptAnonymous, type AnonymousData } from '../lib/anonymous-storage';
const data: AnonymousData = {
  anonId: crypto.randomUUID(),
  profile: {
    calendar: 'gregorian',
    year: 1990,
    month: 5,
    day: 15,
    hour: 8,
    minute: 30,
    timeUnknown: false,
    gender: 'male',
    place: { name: 'Beijing', lat: 39.9, lng: 116.4, tz: 'Asia/Shanghai' },
  },
  readings: [],
  settings: {},
};
describe('device AES-GCM snapshot', () => {
  it('round-trips without exposing birth fields, uses a new nonce each write', async () => {
    const a = await encryptAnonymous(data),
      b = await encryptAnonymous(data);
    expect(a).not.toContain('Beijing');
    expect(a).not.toContain('1990');
    expect(JSON.parse(a).iv).not.toEqual(JSON.parse(b).iv);
    expect(await decryptAnonymous(a)).toEqual(data);
  });
  it('rejects ciphertext tampering and identity transplantation', async () => {
    const raw = JSON.parse(await encryptAnonymous(data)) as {
      ciphertext: number[];
      anonId: string;
    };
    raw.ciphertext[0] = raw.ciphertext[0]! ^ 1;
    await expect(decryptAnonymous(JSON.stringify(raw))).rejects.toThrow();
    const other = JSON.parse(await encryptAnonymous(data)) as { anonId: string };
    other.anonId = crypto.randomUUID();
    await expect(decryptAnonymous(JSON.stringify(other))).rejects.toThrow();
  });
});
