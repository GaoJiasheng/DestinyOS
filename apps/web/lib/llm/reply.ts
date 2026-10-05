import { finishChatAnswer } from './answer';
import { chatRefusal } from './safety';
import { streamMiniMax, type LlmEvent, type LlmMessage } from './minimax';
/** Shared production/evaluation delivery boundary: refuse unsafe inputs locally, verify complete language/prose, redact identifiers and enforce visible length. */
export async function* streamChatReply(
  messages: readonly LlmMessage[],
  input: { question: string; locale: 'zh' | 'en' | 'zh-TW'; identities: readonly string[] },
  options: Parameters<typeof streamMiniMax>[1] = {},
): AsyncGenerator<LlmEvent> {
  const refusal = chatRefusal(input.question, input.locale);
  if (refusal) {
    yield { type: 'delta', text: refusal.content };
    yield { type: 'usage', usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 } };
    return;
  }
  let answer = '';
  for await (const event of streamMiniMax(messages, options)) {
    if (event.type === 'usage') yield event;
    else answer += event.text;
  }
  // DESIGN-GAP: Buffer this bounded reply until validation completes; The NDJSON transport is retained, and the panel shows thinking until the complete short answer is safe to display.
  yield { type: 'delta', text: finishChatAnswer(answer, input.locale, input.identities) };
}
