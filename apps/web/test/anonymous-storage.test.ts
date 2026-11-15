import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import {
  anonymousEvictionEvent,
  encryptAnonymous,
  decryptAnonymous,
  readAnonymous,
  updateAnonymous,
  type AnonymousData,
} from '../lib/anonymous-storage';
import { fromBase64, isQuotaError } from '../lib/anonymous-encoding';
import { mergeAnonymous, parseAnonymousExport } from '../lib/anonymous-import';
import { baziReading } from './fixtures/bazi-reading';
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
/** Re-encode a current envelope as the legacy number-array format; key and AAD are unchanged between versions. */
function legacy(raw: string) {
  const value = JSON.parse(raw) as { anonId: string; iv: string; ciphertext: string };
  return JSON.stringify({
    version: 1,
    anonId: value.anonId,
    iv: [...fromBase64(value.iv)],
    ciphertext: [...fromBase64(value.ciphertext)],
  });
}
function reading(index: number) {
  return {
    ...baziReading('zh'),
    id: `33333333-3333-4333-8333-${String(index).padStart(12, '0')}`,
    createdAt: new Date(Date.UTC(2026, 0, 1 + index)).toISOString(),
  };
}
/** In-memory Storage that rejects writes beyond a character budget, like a full browser quota. */
class QuotaStorage {
  items = new Map<string, string>();
  limit = Infinity;
  writes = 0;
  getItem(key: string) {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.writes++;
    if (value.length > this.limit)
      throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    this.items.set(key, value);
  }
  removeItem(key: string) {
    this.items.delete(key);
  }
}
describe('device AES-GCM snapshot', () => {
  it('round-trips without exposing birth fields, uses a new nonce each write', async () => {
    const a = await encryptAnonymous(data),
      b = await encryptAnonymous(data);
    expect(a).not.toContain('Beijing');
    expect(a).not.toContain('1990');
    expect(JSON.parse(a).version).toBe(2);
    expect(typeof JSON.parse(a).ciphertext).toBe('string');
    expect(JSON.parse(a).iv).not.toEqual(JSON.parse(b).iv);
    expect(await decryptAnonymous(a)).toEqual(data);
  });
  it('rejects ciphertext tampering and identity transplantation', async () => {
    const raw = JSON.parse(await encryptAnonymous(data)) as { ciphertext: string };
    const bytes = fromBase64(raw.ciphertext);
    bytes[0] = bytes[0]! ^ 1;
    raw.ciphertext = btoa(String.fromCharCode(...bytes));
    await expect(decryptAnonymous(JSON.stringify(raw))).rejects.toThrow();
    const other = JSON.parse(await encryptAnonymous(data)) as { anonId: string };
    other.anonId = crypto.randomUUID();
    await expect(decryptAnonymous(JSON.stringify(other))).rejects.toThrow();
    const malformed = JSON.parse(await encryptAnonymous(data)) as { iv: string };
    malformed.iv = 'not base64!';
    await expect(decryptAnonymous(JSON.stringify(malformed))).rejects.toThrow();
  });
  it('still reads and authenticates legacy version 1 snapshots', async () => {
    const old = legacy(await encryptAnonymous({ ...data, readings: [reading(1)] }));
    expect(await decryptAnonymous(old)).toEqual({ ...data, readings: [reading(1)] });
    const tampered = JSON.parse(old) as { ciphertext: number[] };
    tampered.ciphertext[3] = tampered.ciphertext[3]! ^ 1;
    await expect(decryptAnonymous(JSON.stringify(tampered))).rejects.toThrow();
  });
  it('stores a typical report in under half the legacy size', async () => {
    const snapshot = { ...data, readings: [reading(1)] };
    const current = await encryptAnonymous(snapshot);
    expect(current.length * 2).toBeLessThan(legacy(current).length);
  });
});
describe('device writes', () => {
  let storage: QuotaStorage, events: EventTarget;
  beforeEach(() => {
    storage = new QuotaStorage();
    events = new EventTarget();
    vi.stubGlobal('localStorage', storage);
    vi.stubGlobal('document', { cookie: '' });
    vi.stubGlobal('window', events);
  });
  afterEach(() => vi.unstubAllGlobals());
  it('upgrades a legacy snapshot on the next write without losing readings', async () => {
    const saved = { ...data, readings: [reading(1), reading(2)] };
    storage.items.set('tianji.anon', legacy(await encryptAnonymous(saved)));
    expect(await readAnonymous()).toEqual(saved);
    await updateAnonymous((d) => ({ ...d, displayName: 'Ming' }));
    const raw = storage.getItem('tianji.anon')!;
    expect(JSON.parse(raw).version).toBe(2);
    expect(await readAnonymous()).toEqual({ ...saved, displayName: 'Ming' });
  });
  it('drops the oldest readings until the snapshot fits, keeping the new one and reporting it', async () => {
    const saved = { ...data, readings: [reading(4), reading(2), reading(3)] };
    storage.items.set('tianji.anon', await encryptAnonymous(saved));
    // Room for exactly two readings.
    storage.limit = (
      await encryptAnonymous({ ...data, readings: [reading(5), reading(4)] })
    ).length;
    const onEvict = vi.fn(),
      heard = vi.fn();
    events.addEventListener(anonymousEvictionEvent, (event) =>
      heard((event as CustomEvent).detail),
    );
    const result = await updateAnonymous((d) => ({ ...d, readings: [reading(5), ...d.readings] }), {
      onEvict,
    });
    expect(result.readings.map((r) => r.id)).toEqual([reading(5).id, reading(4).id]);
    expect((await readAnonymous())?.readings.map((r) => r.id)).toEqual([
      reading(5).id,
      reading(4).id,
    ]);
    expect(onEvict).toHaveBeenCalledWith({ count: 2 });
    expect(heard).toHaveBeenCalledWith({ count: 2 });
  });
  it('gives up once only the newest reading is left and keeps the stored snapshot intact', async () => {
    const saved = { ...data, readings: [reading(1)] };
    const raw = await encryptAnonymous(saved);
    storage.items.set('tianji.anon', raw);
    storage.limit = 10;
    await expect(
      updateAnonymous((d) => ({ ...d, readings: [reading(2), ...d.readings] })),
    ).rejects.toSatisfy(isQuotaError);
    expect(storage.getItem('tianji.anon')).toBe(raw);
    // The queue recovers for the next write.
    storage.limit = Infinity;
    await updateAnonymous((d) => ({ ...d, displayName: 'After' }));
    expect((await readAnonymous())?.displayName).toBe('After');
  });
  it('rethrows non-quota storage errors without dropping data', async () => {
    storage.items.set('tianji.anon', await encryptAnonymous({ ...data, readings: [reading(1)] }));
    const broken = vi.spyOn(storage, 'setItem').mockImplementation(() => {
      throw new DOMException('Denied', 'SecurityError');
    });
    await expect(updateAnonymous((d) => d)).rejects.toThrow('Denied');
    expect(broken).toHaveBeenCalledTimes(1);
  });
});
describe('device import', () => {
  it('accepts the settings export shape and rejects malformed files', () => {
    const snapshot = { ...data, readings: [reading(1)] };
    expect(parseAnonymousExport(JSON.stringify({ ok: true, data: snapshot }))).toEqual({
      ok: true,
      data: snapshot,
    });
    expect(parseAnonymousExport(JSON.stringify(snapshot)).ok).toBe(true);
    expect(parseAnonymousExport('{oops')).toEqual({ ok: false, error: 'E_IMPORT_JSON' });
    expect(parseAnonymousExport(JSON.stringify({ ok: true, data: null }))).toEqual({
      ok: false,
      error: 'E_IMPORT_EMPTY',
    });
    expect(
      parseAnonymousExport(JSON.stringify({ ok: true, data: { ...snapshot, readings: [{}] } })),
    ).toEqual({ ok: false, error: 'E_IMPORT_SHAPE' });
  });
  it('merges readings by id and keeps the device identity and profile', () => {
    const device = { ...data, readings: [reading(2), reading(1)], settings: { tz: 'Asia/Tokyo' } };
    const incoming: AnonymousData = {
      anonId: crypto.randomUUID(),
      displayName: 'Imported',
      readings: [{ ...reading(1), title: 'changed' }, reading(3)],
      settings: { tz: 'UTC', soundOn: true },
    };
    const { data: merged, added } = mergeAnonymous(device, incoming);
    expect(added).toBe(1);
    expect(merged.anonId).toBe(device.anonId);
    expect(merged.profile).toEqual(device.profile);
    expect(merged.displayName).toBe('Imported');
    expect(merged.settings).toEqual({ tz: 'Asia/Tokyo', soundOn: true });
    expect(merged.readings.map((r) => r.id)).toEqual([reading(3).id, reading(2).id, reading(1).id]);
    expect(merged.readings[2]?.title).toBeNull();
  });
});
