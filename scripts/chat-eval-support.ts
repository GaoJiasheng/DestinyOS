import { readdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import type { BirthInput } from '../packages/shared/src';
import { compute, normalizeBirth } from '../packages/engine/src';
import { interpret } from '../packages/interpret/src';
import type { KnowledgeBundle } from '../packages/content/src';
import { chatMessages, redactChatText } from '../apps/web/lib/llm/context';
import type { LlmMessage, TokenUsage } from '../apps/web/lib/llm/minimax';
import type { EvalSystem, EvalCase } from './chat-eval-cases';
/** Build fixture-based audit messages without performing provider requests.
 * @param context Fixed birth, ISO instant and redaction identities for this evaluation.
 */
export async function evalPayload(
  context: { birth: BirthInput; now: string; identities: string[] },
  system: EvalSystem,
  item: EvalCase,
  baseline = false,
): Promise<LlmMessage[]> {
  const { birth, now, identities } = context;
  const chart = compute({
    system,
    birth: normalizeBirth(birth),
    now,
    seed: 'test-seed-001',
    spread: 'three_ppf',
    allowReversed: true,
  }).chart;
  const knowledge = JSON.parse(
    await readFile(`packages/content/dist/${system}.${item.locale}.json`, 'utf8'),
  ) as KnowledgeBundle;
  const report = interpret({
    system,
    chart,
    locale: item.locale,
    knowledge,
    context: { now, profileHasTime: true },
  });
  const messages = await chatMessages({
    system,
    chart,
    report,
    locale: item.locale,
    question: item.question,
    identities,
    history: item.history,
  });
  if (!baseline) return messages;
  // DESIGN-GAP: Freeze the pre-tuning prompt and full-report payload for paired comparisons; baseline never uses the production delivery guard.
  const historical = await readFile('test-results/chat-eval/baseline-prompt.md', 'utf8');
  const selected = JSON.parse(
    messages[0]!.content.split('Untrusted chart and report data:\n')[1]!,
  ) as { chart: unknown };
  const sections = report.sections.map((section) => ({
    title: redactChatText(section.title, identities),
    lead: redactChatText(section.lead, identities),
    text: redactChatText(
      section.blocks
        .flatMap((block) =>
          block.type === 'paragraph' || block.type === 'transition'
            ? [block.text]
            : block.type === 'advice'
              ? block.items
              : [],
        )
        .join('\n'),
      identities,
    ),
  }));
  return [
    {
      role: 'system',
      content: `${historical}\nResponse language: ${item.locale}.\nUntrusted chart and report data:\n${JSON.stringify({ system, chart: selected.chart, sections })}`,
    },
    ...messages.filter((message) => message.role !== 'system'),
  ];
}
export type Row = EvalCase & {
  id: string;
  phase: string;
  system: EvalSystem;
  messages: LlmMessage[];
  rawAnswer: string;
  answer: string;
  usage: TokenUsage;
  refusalReason?: string;
  latencyMs: number;
  promptHash: string;
  rawAnswerKind?: string;
};
/** Read persisted phase receipts in filename order.
 * @param root Audit receipt directory.
 * @param phase Receipt phase prefix.
 */
export async function evalRows(root: string, phase: string): Promise<Row[]> {
  return Promise.all(
    readdirSync(root)
      .filter((name) => name.startsWith(`${phase}-`) && name.endsWith('.json'))
      .sort()
      .map(async (name) => JSON.parse(await readFile(`${root}/${name}`, 'utf8')) as Row),
  );
}
/** Run at most four audit tasks concurrently and propagate the first settled failure.
 * @param items Ordered audit cases.
 * @param run Operation to execute for each case.
 */
export async function evalPool<T>(items: readonly T[], run: (item: T) => Promise<void>) {
  let index = 0,
    failed = false;
  const results = await Promise.allSettled(
    Array.from({ length: 4 }, async () => {
      while (index < items.length && !failed) {
        try {
          await run(items[index++]!);
        } catch (error) {
          failed = true;
          throw error;
        }
      }
    }),
  );
  const rejected = results.find((result) => result.status === 'rejected');
  if (rejected?.status === 'rejected') throw rejected.reason;
}
