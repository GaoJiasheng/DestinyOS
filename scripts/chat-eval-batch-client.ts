import assert from 'node:assert/strict';
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { streamMiniMax, type LlmMessage, type TokenUsage } from '../apps/web/lib/llm/minimax';
/** Prepare the existing bounded batch client, importing only provider credentials.
 * @param root Directory for request ledgers and partial provider receipts.
 */
export async function createBatchEvalClient(root: string) {
  for (const line of readFileSync('apps/web/.env.local', 'utf8').split('\n')) {
    const match = /^(MINIMAX_API_KEY|MINIMAX_BASE_URL|MINIMAX_MODEL)=(.*)$/.exec(line);
    if (match) process.env[match[1]!] = match[2]!.trim().replace(/^['"]|['"]$/g, '');
  }
  assert(process.env.MINIMAX_API_KEY);
  const ledger = `${root}/batch-requests.ndjson`;
  type AuditHistory = {
    knownRequests: number;
    reservedUncertainSmokeRequests: number;
    usage: TokenUsage;
    originalAverageProbeCostUsd?: number;
    originalAverageBenignProductionCostUsd?: number;
    originalAllConversationMixCostUsd?: number;
  };
  const prior: AuditHistory = existsSync(`${root}/audit-history.json`)
    ? (JSON.parse(await readFile(`${root}/audit-history.json`, 'utf8')) as AuditHistory)
    : {
        knownRequests: 0,
        reservedUncertainSmokeRequests: 0,
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      };
  // DESIGN-GAP: Batch independent questions per report to deduplicate chart facts; persist every attempt before dispatch, allow no retries and include prior paid requests in the 200-request cap.
  const fetcher: typeof fetch = async (url, options) => {
    const count = existsSync(ledger)
      ? readFileSync(ledger, 'utf8').trim().split('\n').filter(Boolean).length
      : 0;
    assert(
      prior.knownRequests + prior.reservedUncertainSmokeRequests + count < 200,
      '200-request cap',
    );
    appendFileSync(
      ledger,
      JSON.stringify({ request: prior.knownRequests + count + 1, at: new Date().toISOString() }) +
        '\n',
    );
    return fetch(url, options);
  };
  async function call(messages: LlmMessage[]) {
    let raw = '',
      usage: TokenUsage | undefined;
    try {
      for await (const event of streamMiniMax(messages, {
        fetcher,
        timeoutMs: 300000,
        maxTokens: 32768,
        maxAttempts: 1,
      })) {
        if (event.type === 'delta') raw += event.text;
        else usage = event.usage;
      }
      assert(usage);
      return { raw, usage };
    } catch (error) {
      await writeFile(
        `${root}/partial-response-${Date.now()}.json`,
        JSON.stringify({ raw, usage, complete: false }, null, 2) + '\n',
      );
      throw error;
    }
  }

  return { call, prior, ledger };
}
