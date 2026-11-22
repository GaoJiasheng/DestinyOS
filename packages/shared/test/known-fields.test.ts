import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { parseKnownFields } from '../src/schemas/known-fields';

const Chart = z
  .object({
    useGod: z.object({ favorable: z.array(z.string()) }).strict(),
    pillars: z.array(z.object({ stem: z.string() }).strict()),
  })
  .strict();

describe('parseKnownFields', () => {
  it('drops keys a newer engine added, at any depth, without touching the input', () => {
    const newer = {
      useGod: { favorable: ['wood'], useGod: 'water', idle: ['earth'] },
      pillars: [{ stem: 'jia', strength: 3 }],
      emphasis: {},
    };
    expect(parseKnownFields(Chart, newer)).toEqual({
      useGod: { favorable: ['wood'] },
      pillars: [{ stem: 'jia' }],
    });
    expect(newer.useGod.useGod).toBe('water');
  });
  it('still rejects missing or malformed fields', () => {
    expect(() => parseKnownFields(Chart, { useGod: { favorable: [] } })).toThrow();
    expect(() =>
      parseKnownFields(Chart, { useGod: { favorable: [1], extra: true }, pillars: [] }),
    ).toThrow();
  });
});
