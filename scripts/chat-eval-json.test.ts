import { expect, it } from 'vitest';
import { parseEvalJson } from './chat-eval-json';
it('preserves actual answers and numeric IDs when chart labels contain unescaped quotes', () => {
  const parsed = parseEvalJson(
    '[{"id":0,"answer":"报告中"answer"是反思。"},{"id":1,"answer":"No partner chart is supplied."}]',
  );
  expect(parsed).toEqual([
    { id: 0, answer: '报告中"answer"是反思。' },
    { id: 1, answer: 'No partner chart is supplied.' },
  ]);
});
