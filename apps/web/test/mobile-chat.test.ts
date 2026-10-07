import { raw, stamp, request } from './mobile-fixture';
import { expect, it, vi } from 'vitest';
import { mobileApi } from '../lib/mobile/router';
import { issueSession } from '../lib/mobile/auth';
import { putSync } from '../lib/mobile/sync';
import { decryptField } from '../lib/crypto';
import { streamChatReply } from '../lib/llm/reply';
it('streams owner NDJSON with shared Web daily quotas, encrypted history and cancelled generation refunds', async () => {
  vi.stubEnv('FEATURE_LLM_CHAT', 'true');
  vi.stubEnv('MINIMAX_API_KEY', 'mock-provider');
  const session = await issueSession('owner', { deviceName: 'Phone', platform: 'ios' });
  await putSync('owner', 'readings', {
    items: [
      {
        id: 'tarot-reading',
        updatedAt: stamp(),
        deleted: false,
        createdAt: new Date().toISOString(),
        request: {
          system: 'tarot',
          locale: 'en',
          spread: 'single',
          seed: 'mobile-chat-test',
          idempotencyKey: crypto.randomUUID(),
        },
      },
    ],
  });
  const chat = () =>
    mobileApi(
      request(
        'chat/tarot-reading',
        'POST',
        { locale: 'en', question: 'How can I reflect on this card?' },
        session.accessToken,
      ),
    );
  for (let i = 0; i < 3; i++) {
    const response = await chat();
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/x-ndjson');
    const lines = (await response.text())
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as unknown);
    expect(lines).toContainEqual({ type: 'delta', text: 'Grounded reply' });
    expect(lines.at(-1)).toEqual({ type: 'done' });
  }
  expect((await chat()).status).toBe(429);
  expect(streamChatReply).toHaveBeenCalledTimes(3);
  const messages = await raw.chatMessage.findMany({ where: { readingId: 'tarot-reading' } });
  expect(messages).toHaveLength(6);
  expect(messages[0]!.content).toMatch(/^v1:/);
  expect(decryptField(messages[0]!.content, 'ChatMessage.content', 'owner')).toContain('reflect');
  await raw.user.update({ where: { id: 'owner' }, data: { plan: 'pro' } });
  const cancelled = await chat();
  const reader = cancelled.body!.getReader();
  await reader.read();
  await reader.cancel();
  expect((await raw.chatQuota.findFirstOrThrow({ where: { userId: 'owner' } })).count).toBe(3);
  expect(await raw.chatMessage.count()).toBe(6);
  const other = await issueSession('other', { deviceName: 'Other', platform: 'android' });
  expect(
    (
      await mobileApi(
        request(
          'chat/tarot-reading',
          'POST',
          { locale: 'en', question: 'Test' },
          other.accessToken,
        ),
      )
    ).status,
  ).toBe(403);
  const history = await mobileApi(
    request('chat/tarot-reading', 'GET', undefined, session.accessToken),
  );
  expect(history.status).toBe(200);
  const body = (await history.json()) as { data: { messages: unknown[]; remaining: number } };
  expect(body.data.messages).toHaveLength(6);
  expect(body.data.remaining).toBe(27);
  for (const method of ['GET', 'DELETE']) {
    expect(
      (await mobileApi(request('chat/tarot-reading', method, undefined, other.accessToken))).status,
    ).toBe(403);
  }
  const deleted = await mobileApi(
    request('chat/tarot-reading', 'DELETE', undefined, session.accessToken),
  );
  expect(deleted.status).toBe(200);
  expect(await raw.chatMessage.count()).toBe(0);
  expect((await raw.chatQuota.findFirstOrThrow({ where: { userId: 'owner' } })).count).toBe(3);
  vi.stubEnv('FEATURE_LLM_CHAT', 'false');
  vi.stubEnv('MINIMAX_API_KEY', '');
});
