import { describe, expect, it } from 'vitest';
import { askHref } from '../components/home/ask-launcher';

describe('quick ask entry', () => {
  it('opens the one-card tarot draw and the random Mei Hua cast directly', () => {
    expect(askHref('tarot', '')).toBe('/tarot/reading?spread=single');
    expect(askHref('iching', '   ')).toBe('/iching/cast?method=random');
  });

  it('encodes the trimmed question and enforces the shared 120-character limit', () => {
    expect(askHref('tarot', ' 这份工作 & offer? ')).toBe(
      `/tarot/reading?${new URLSearchParams({ spread: 'single', q: '这份工作 & offer?' })}`,
    );
    const long = '问'.repeat(130);
    const q = new URL(askHref('iching', long), 'http://x').searchParams.get('q');
    expect(q).toHaveLength(120);
  });
});
