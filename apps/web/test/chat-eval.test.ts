import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { System } from '@tianji/shared';
import { interpret, type Report } from '@tianji/interpret';
import type { KnowledgeBundle } from '@tianji/content';
import { chatMessages } from '../lib/llm/context';
import { finishChatAnswer } from '../lib/llm/answer';
import { chatRefusal } from '../lib/llm/safety';
import { streamChatReply } from '../lib/llm/reply';
import { selectChatSections, excerptChatText } from '../lib/llm/selection';
import { chatEvalCases, evalSystems } from '../../../scripts/chat-eval-cases';
import { combineScores, scriptScores } from '../../../scripts/chat-eval-rubric';
import zh from '../messages/zh.json';
import en from '../messages/en.json';

afterEach(() => vi.unstubAllEnvs());

function fixtureReport(
  system: 'bazi' | 'ziwei' | 'tarot' | 'astrology',
  locale: 'zh' | 'en',
): Report {
  const path =
    system === 'astrology' ? 'astrology.A' : system === 'tarot' ? 'tarot.three_ppf' : `${system}.a`;
  return interpret({
    system,
    chart: JSON.parse(readFileSync(`packages/content/test/fixtures/${path}.json`, 'utf8')),
    locale,
    knowledge: JSON.parse(
      readFileSync(`packages/content/dist/${system}.${locale}.json`, 'utf8'),
    ) as KnowledgeBundle,
    context: { now: '2026-10-04T00:00:00Z', profileHasTime: true },
  });
}
describe('chat evaluation regression', () => {
  it('has exactly 40 questions, 20 per language, bounded by the actual API limit', () => {
    expect(chatEvalCases).toHaveLength(40);
    for (const locale of ['zh', 'en'])
      expect(chatEvalCases.filter((item) => item.locale === locale)).toHaveLength(20);
    expect(chatEvalCases.every((item) => item.question.length <= 120)).toBe(true);
  });
  for (const item of chatEvalCases.filter((item) => item.boundary)) {
    it(`refuses ${item.id}/${item.category} across all report systems without calling MiniMax`, async () => {
      for (const system of evalSystems) {
        const fetcher = vi.fn<typeof fetch>();
        const messages = [{ role: 'system' as const, content: `Current system ${system}` }];
        const events = [];
        for await (const event of streamChatReply(
          messages,
          { question: item.question, locale: item.locale, identities: [] },
          { fetcher },
        ))
          events.push(event);
        expect(fetcher).not.toHaveBeenCalled();
        expect(events).toEqual([
          { type: 'delta', text: chatRefusal(item.question, item.locale)!.content },
          { type: 'usage', usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 } },
        ]);
      }
      const refusal = chatRefusal(item.question, item.locale)!;
      const expectedReason = item.category === 'health' ? 'medical' : item.category;
      expect(refusal.reason).toBe(expectedReason);
      expect(refusal.content).toMatch(item.locale === 'en' ? /^I cannot/ : /^我不能/);
      expect(refusal.content).not.toMatch(/活该|废物|idiot|administrator password|1990|08:30/);
      const disguised = item.question.split('').join('\u200b');
      expect(chatRefusal(disguised, item.locale)?.reason).toBe(
        chatRefusal(item.question, item.locale)?.reason,
      );
    });
  }
  it('allows ordinary health/money and grounded reflection questions and all suggestion chips', () => {
    for (const item of chatEvalCases.filter((item) => !item.boundary))
      expect(chatRefusal(item.question, item.locale), item.id).toBeNull();
    for (const [locale, catalog] of [
      ['zh', zh],
      ['en', en],
    ] as const) {
      for (const [key, value] of Object.entries(catalog).filter(([key]) =>
        key.startsWith('report.chat.chips.'),
      )) {
        expect(value.length, key).toBeLessThanOrEqual(120);
        expect(chatRefusal(value, locale), key).toBeNull();
      }
    }
  });
  it('selects career, relationship, timing and tarot chapters without sending the full report', async () => {
    const expected = {
      bazi: ['pattern_career', 'summary_actions'],
      ziwei: ['career_wealth', 'summary_actions'],
      tarot: ['cards', 'answer'],
      astrology: ['love_career', 'summary_actions'],
    };
    for (const system of evalSystems) {
      const report = fixtureReport(system, 'en');
      expect(
        selectChatSections(report.sections, 'Which career strengths?').map(
          (section) => section.key,
        ),
      ).toEqual(expected[system]);
      const messages = await chatMessages({
        system: System[system],
        chart: {},
        report,
        locale: 'en',
        question: 'Which career strengths?',
        identities: [],
        history: [],
      });
      const data: unknown = JSON.parse(
        messages[0]!.content.split('Untrusted chart and report data:\n')[1]!,
      );
      expect(data).toMatchObject({
        sections: expected[system].map((key) => ({ key })),
        availableSections: report.sections.map((section) => section.key),
      });
      expect(messages[0]!.content).not.toContain(
        report.sections.find((section) => section.key === 'overview')!.lead,
      );
    }
    const report = fixtureReport('bazi', 'zh');
    expect(selectChatSections(report.sections, '感情沟通').map((section) => section.key)).toEqual([
      'love',
    ]);
    expect(
      selectChatSections(report.sections, '今年事业流年时机').map((section) => section.key),
    ).toEqual(['luck_timeline', 'pattern_career']);
    expect(
      selectChatSections(report.sections, '还有呢？', '事业优势').map((section) => section.key),
    ).toEqual(['pattern_career', 'summary_actions']);
  });
  it('bounds excerpts/history without breaking JSON or passing evidence/debug/source fields', async () => {
    const report = fixtureReport('bazi', 'en');
    const messages = await chatMessages({
      system: System.bazi,
      chart: {},
      report,
      locale: 'en',
      question: 'What can I reflect on?',
      identities: [],
      history: Array.from({ length: 14 }, (_, index) => ({
        role: index % 2 ? ('assistant' as const) : ('user' as const),
        content: 'Long history. '.repeat(1000),
      })),
    });
    expect(messages).toHaveLength(9);
    expect(
      messages.slice(1, -2).every((message) => Array.from(message.content).length <= 1001),
    ).toBe(true);
    const data = JSON.parse(
      messages[0]!.content.split('Untrusted chart and report data:\n')[1]!,
    ) as { sections: { text: string }[] };
    expect(data.sections.length).toBeLessThanOrEqual(2);
    expect(data.sections.every((section) => Array.from(section.text).length <= 2601)).toBe(true);
    expect(JSON.stringify(data)).not.toMatch(/unitId|chart_ref|evidence|anchor/);
    expect(excerptChatText('木🌱'.repeat(500), 101)).not.toContain('\uFFFD');
  });
  it('normalizes formatting and finishes bounded replies without releasing mixed languages', async () => {
    const clean = finishChatAnswer(
      '**Water** may symbolize reflection.\n1. Try listening first. ' +
        'A long unfinished sentence '.repeat(300),
      'en',
    );
    expect(clean).toBe('Water may symbolize reflection. Try listening first.');
    expect(finishChatAnswer('An English answer with 中文.', 'en')).toBe(
      en['report.chat.languageFailed'],
    );
    expect(finishChatAnswer('请提供 cardKey 来解释。', 'zh')).toBe('请提供 牌名 来解释。');
    vi.stubEnv('MINIMAX_API_KEY', 'unit-secret');
    expect(finishChatAnswer('这是 1.5 分, 可以试试; 再观察!', 'zh')).toBe(
      '这是 1.5 分，可以试试；再观察！',
    );
    const secret = 'PrivateName';
    const chunks = [
      'Water supports reflection. ' + 'word '.repeat(50),
      'Private',
      'Name encourages patience.',
    ];
    const fetcher = vi.fn<typeof fetch>(
      async () =>
        new Response(
          chunks
            .map((content) => `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`)
            .join('') +
            'data: {"usage":{"prompt_tokens":10,"completion_tokens":10,"total_tokens":20}}\n\ndata: [DONE]\n\n',
        ),
    );
    const events = [];
    for await (const event of streamChatReply(
      [],
      { question: 'What does water mean?', locale: 'en', identities: [secret] },
      { fetcher },
    ))
      events.push(event);
    const answer = events
      .filter((event) => event.type === 'delta')
      .map((event) => event.text)
      .join('');
    expect(answer).not.toContain(secret);
    expect(answer).toMatch(/[.!?]$/);
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it('keeps objective failures from being hidden by optimistic model grades', () => {
    const item = chatEvalCases.find((item) => item.locale === 'en' && !item.boundary)!;
    const checked = scriptScores(item, '中文'.repeat(400), false);
    const scores = combineScores(
      { grounding: 2, nonFabrication: 2, boundaries: 2, tone: 2, length: 2, language: 2 },
      checked,
    );
    expect(scores.language).toBe(0);
    expect(scriptScores(item, 'word '.repeat(201), false).length).toBe(0);
  });
});
