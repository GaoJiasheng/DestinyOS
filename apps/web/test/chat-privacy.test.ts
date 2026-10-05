import { describe, expect, it, vi } from 'vitest';
import {
  chatChart,
  chatMessages,
  privateIdentifiers,
  redactChatText,
  boundAnswer,
} from '../lib/llm/context';
import { System } from '@tianji/shared';
import { streamMiniMax } from '../lib/llm/minimax';
import { encryptField, decryptField } from '../lib/crypto';
import { SiteConfigSchema } from '../lib/site-config-schema';
const report = {
  system: 'bazi',
  locale: 'zh',
  knowledgeVersion: 'v1',
  engineVersion: 'v1',
  interpretVersion: 'v1',
  headline: {
    persona: 'Alice 北京 1990-05-15',
    keywords: [],
    scores: { career: 3, wealth: 3, love: 3, health: 3, social: 3 },
    confidence: 0.8,
  },
  sections: [
    {
      key: 'overview',
      title: 'Alice 的报告',
      lead: '1990年5月15日 北京',
      blocks: [
        {
          type: 'paragraph',
          text: '木有生长的象征。Alice alice@example.com Beijing May 15, 1990 08:30',
          unitId: 'x',
          polarity: 'neutral',
        },
        { type: 'chart_ref', component: 'x', props: { birthDate: '1990-05-15' } },
        {
          type: 'evidence',
          items: [{ label: 'birth', path: 'input.birth', value: '1990-05-15', anchor: 'x' }],
        },
      ],
    },
  ],
  hits: [],
  readability: { zhChars: 10, enWords: 0, termDensity: 0, passed: true, issues: [] },
  disclaimerKey: 'report.disclaimer.short',
};
describe('B-05 privacy boundary', () => {
  it('actual outbound payload excludes birth/name/place/email from chart, report, question and history', async () => {
    vi.stubEnv('MINIMAX_API_KEY', 'unit-secret');
    vi.stubEnv('MINIMAX_BASE_URL', 'https://api.minimaxi.com/v1');
    try {
      const chart = {
        input: { name: 'Alice', birthDate: '1990-05-15', place: '北京' },
        jdUT: 2448026.854,
        solarTimeAdjust: { original: '1990-05-15T08:30' },
        pillars: { day: { stem: 'jia', branch: 'chen' } },
      };
      const messages = await chatMessages({
        system: System.bazi,
        chart,
        report,
        locale: 'zh',
        question: 'Alice 在北京出生，1990-05-15 08:30，alice@example.com，木意味着什么？',
        identities: ['Alice', '北京', 'Beijing', 'alice@example.com'],
        history: [
          { role: 'user', content: 'Beijing, May 15, 1990' },
          { role: 'assistant', content: 'Alice，木象征生长。' },
        ],
      });
      let payload = '';
      const fetcher = vi.fn<typeof fetch>(async (_url, options) => {
        payload = String(options?.body);
        return new Response(
          'data: {"choices":[{"delta":{"content":"木象征生长"}}]}\n\ndata: {"usage":{"prompt_tokens":1,"completion_tokens":1,"total_tokens":2}}\n\ndata: [DONE]\n\n',
        );
      });
      for await (const event of streamMiniMax(messages, { fetcher })) expect(event).toBeDefined();
      for (const pii of [
        'Alice',
        '1990-05-15',
        '1990年5月15日',
        'May 15, 1990',
        '08:30',
        '北京',
        'Beijing',
        'alice@example.com',
        '2448026.854',
        'input.birth',
        'unit-secret',
      ])
        expect(payload).not.toContain(pii);
      expect(payload).toContain('jia');
      expect(payload).toContain('木象征生长');
    } finally {
      vi.unstubAllEnvs();
    }
  });
  it('redacts identities containing JSON escapes before serializing report prose', async () => {
    const identity = 'A"lice\\Smith';
    const source = {
      ...report,
      sections: [
        {
          ...report.sections[0]!,
          title: identity,
          lead: identity,
          blocks: [{ type: 'transition', text: identity }],
        },
      ],
    };
    const messages = await chatMessages({
      system: System.bazi,
      chart: {},
      report: source,
      locale: 'en',
      question: identity,
      identities: [identity],
      history: [],
    });
    const data: unknown = JSON.parse(
      messages[0]!.content.split('Untrusted chart and report data:\n')[1]!,
    );
    expect(JSON.stringify(data)).not.toContain('lice');
    expect(messages.at(-1)?.content).toBe('[redacted]');
  });
  it('removes reversible birthdays and source fields for all seven systems', () => {
    for (const system of [
      System.bazi,
      System.ziwei,
      System.iching,
      System.qimen,
      System.tarot,
      System.astrology,
      System.vedic,
    ]) {
      const projection = JSON.stringify(
        chatChart(system, {
          input: 'secret',
          jdUT: 2448026,
          castAt: { local: 'secret' },
          question: 'secret',
          seed: 'secret',
          basics: { lunar: { year: 1990, month: 5, day: 15 }, soulMaster: 'ziwei' },
          bodies: [{ key: 'sun', lon: 30, email: 'secret', latitude: 20 }],
          pillars: { day: { stem: 'jia', local: 'secret' } },
        }),
      );
      expect(projection).not.toMatch(/secret|2448026|1990|latitude|email|lunar/);
    }
  });
  it('redacts unsolicited identity declarations and multiple date/time formats locally', () => {
    expect(
      redactChatText(
        '我叫张三，出生于杭州。my name is John Doe. born in London. 15/05/1990 1990年5月15日 15 May 1990 8点30分 a@example.com',
      ),
    ).not.toMatch(/张三|杭州|John Doe|London|1990|30分|example/);
    expect(
      privateIdentifiers({
        displayName: '张三',
        birth: { place: { name: '杭州' } },
        email: 'x@y.com',
      }),
    ).toEqual(['张三', '杭州', 'x@y.com']);
  });
  it('enforces 300 Unicode characters or 200 English words', () => {
    expect(Array.from(boundAnswer('木🌱'.repeat(500), 'zh'))).toHaveLength(300);
    expect(boundAnswer('word '.repeat(500), 'en').split(/\s+/)).toHaveLength(200);
  });
  it('encrypts chat using owner-derived keys and dedicated AAD', () => {
    const key = `v1:${Buffer.alloc(32, 1).toString('base64')}`;
    const encrypted = encryptField('private question', 'ChatMessage.content', 'owner', key);
    expect(encrypted).not.toContain('private');
    expect(decryptField(encrypted, 'ChatMessage.content', 'owner', key)).toBe('private question');
    expect(() => decryptField(encrypted, 'ChatMessage.content', 'intruder', key)).toThrow();
    expect(() => decryptField(encrypted, 'Reading.encInput', 'owner', key)).toThrow();
  });
  it('prompts include grounded safety, uncertainty and length/language boundaries', async () => {
    const messages = await chatMessages({
      system: System.bazi,
      chart: {},
      report,
      locale: 'en',
      question: 'What is certain?',
      identities: ['Alice', '北京', 'Beijing'],
      history: [],
    });
    const prompt = messages[0]!.content;
    for (const term of [
      'death',
      'disease',
      'medical',
      'legal',
      'investment',
      'uncertain',
      '300',
      '200',
      'untrusted',
      'Response language: en',
    ])
      expect(prompt).toContain(term);
  });
  it('validates configurable quotas and disables chat by default', () => {
    const settings = SiteConfigSchema.parse({
      announcement: { zh: '', en: '', scope: [], startsAt: null, endsAt: null },
      'ads.enabled': false,
      'feature.llmPolish': false,
      'feature.panchangDefaultOpen': false,
      maintenance: false,
    });
    expect(settings['chat.freeDailyLimit']).toBe(3);
    expect(settings['chat.proDailyLimit']).toBe(30);
    expect(settings['feature.llmChat']).toBe(false);
    for (const value of [-1, 1.5, 10001])
      expect(
        SiteConfigSchema.safeParse({ ...settings, 'chat.freeDailyLimit': value }).success,
      ).toBe(false);
  });
});
