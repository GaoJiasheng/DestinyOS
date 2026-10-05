import assert from 'node:assert/strict';
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { streamMiniMax, type LlmMessage, type TokenUsage } from '../apps/web/lib/llm/minimax';
/** Prepare the existing individual audit client and receipt-backed request budget.
 * @param root Directory for request receipts; importing this module performs no paid requests.
 */
export function createIndividualEvalClient(root: string) {
  // DESIGN-GAP: Import only MiniMax credentials, never the other secrets in the local environment file.
  for (const line of readFileSync('apps/web/.env.local', 'utf8').split('\n')) {
    const match = /^(MINIMAX_API_KEY|MINIMAX_BASE_URL|MINIMAX_MODEL)=(.*)$/.exec(line);
    if (match) process.env[match[1]!] = match[2]!.trim().replace(/^['"]|['"]$/g, '');
  }
  assert(process.env.MINIMAX_API_KEY, 'MiniMax key required');
  const ledger = `${root}/requests.ndjson`;
  if (existsSync(`${root}/audit-history.json`))
    throw new Error(
      'This directory contains the recovered batch audit; use chat:eval or CHAT_EVAL_OUTPUT for a new individual audit.',
    );
  let requestCount = existsSync(ledger)
    ? readFileSync(ledger, 'utf8').trim().split('\n').filter(Boolean).length
    : 0;
  // DESIGN-GAP: Persist every HTTP attempt, including retries, before dispatch; reserve two of the 200 calls for the existing bilingual smoke test.
  const fetcher: typeof fetch = async (url, options) => {
    requestCount = existsSync(ledger)
      ? readFileSync(ledger, 'utf8').trim().split('\n').filter(Boolean).length
      : 0;
    assert(requestCount < 198, 'Evaluation request budget exhausted');
    appendFileSync(
      ledger,
      JSON.stringify({ request: ++requestCount, at: new Date().toISOString() }) + '\n',
    );
    return fetch(url, options);
  };
  async function call(messages: LlmMessage[]) {
    let rawAnswer = '';
    let usage: TokenUsage | undefined;
    const started = Date.now();
    const events = streamMiniMax(messages, { fetcher, timeoutMs: 120000 });
    for await (const event of events) {
      if (event.type === 'delta') rawAnswer += event.text;
      else usage = event.usage;
    }
    assert(usage, 'Missing provider token counts');
    return { rawAnswer, usage, latencyMs: Date.now() - started };
  }

  return { call, ledger, getRequestCount: () => requestCount };
}
