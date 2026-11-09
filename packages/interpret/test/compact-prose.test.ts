import { describe, expect, it } from 'vitest';
import { createProseCompactor } from '../src/compact-prose';
describe('createProseCompactor', () => {
  it('removes standing caveats from Chinese paragraphs, including semicolon pairs', () => {
    const compact = createProseCompactor('zh');
    expect(
      compact.paragraph(
        '比如你可以分别列出风险。你可以先从一次具体经历检验这个角度，再决定它是否值得放进自己的行动计划；传统标记只能提供提问，不能替代现实判断。',
        'neutral',
      ),
    ).toBe('比如你可以分别列出风险。');
  });
  it('keeps the first occurrence of a repeated sentence and removes later ones', () => {
    const compact = createProseCompactor('zh');
    const repeated = '建议先写下原本的期待。';
    expect(compact.paragraph(`这是第一段。${repeated}`, 'neutral')).toBe(`这是第一段。${repeated}`);
    expect(compact.paragraph(`这是第二段。${repeated}`, 'neutral')).toBe('这是第二段。');
  });
  it('strips a standing or repeated trailing clause without leaving a broken sentence', () => {
    const compact = createProseCompactor('zh');
    expect(
      compact.paragraph('同时，先整理一个常用角落，用现实反馈判断这个角度是否贴合你。', 'neutral'),
    ).toBe('同时，先整理一个常用角落。');
    // A merely repeated tail may finish a dependent clause, so only the listed tails are stripped.
    compact.paragraph('比如开会时，大家先说明各自的想法。', 'neutral');
    expect(compact.paragraph('比如散步时，大家先说明各自的想法。', 'neutral')).toBe(
      '比如散步时，大家先说明各自的想法。',
    );
  });
  it('closes an English sentence and recapitalizes what follows a removed clause', () => {
    const compact = createProseCompactor('en');
    expect(
      compact.paragraph(
        'Name the two needs; the angle is a symbolic prompt rather than a forecast of an event.',
        'neutral',
      ),
    ).toBe('Name the two needs.');
    compact.paragraph('Review it after a week.', 'neutral');
    expect(compact.paragraph('Review it after a week; keep the useful part.', 'neutral')).toBe(
      'Keep the useful part.',
    );
  });
  it('returns an empty paragraph when nothing new remains', () => {
    const compact = createProseCompactor('en');
    compact.paragraph('A repeated sentence stands alone.', 'neutral');
    expect(compact.paragraph('A repeated sentence stands alone.', 'neutral')).toBe('');
  });
  it('keeps a repeated sentence when the following one depends on it', () => {
    const compact = createProseCompactor('zh');
    compact.paragraph('宫位描述生活领域。', 'neutral');
    expect(compact.paragraph('宫位描述生活领域。它提示观察重点。', 'neutral')).toBe(
      '宫位描述生活领域。它提示观察重点。',
    );
  });
  it('keeps the softening of a negative unit', () => {
    const compact = createProseCompactor('zh');
    compact.paragraph('建议先留一段缓冲时间。', 'neutral');
    const negative = '这段时间压力偏大。建议先留一段缓冲时间。';
    expect(compact.paragraph(negative, 'negative')).toBe(negative);
  });
  it('limits repeat removal to one section in section scope but always removes standing caveats', () => {
    const compact = createProseCompactor('zh', 'section');
    compact.startSection();
    compact.paragraph('相同的句子。', 'neutral');
    compact.startSection();
    expect(
      compact.paragraph('相同的句子。传统标记只能提供提问，不能替代现实判断。', 'neutral'),
    ).toBe('相同的句子。');
  });
});
