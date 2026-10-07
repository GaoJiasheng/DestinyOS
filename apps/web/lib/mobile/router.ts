import { z } from 'zod';
import { ApiError, errorResponse } from '../api-error';
import { logger } from '../logger';
import { assertRateLimit, ratelimit } from '../ratelimit';
import { requestIp } from '../request-ip';
import { getDb } from '../db';
import {
  beginOAuth,
  exchangeOAuth,
  exchangeGoogleCode,
  exchangeMagic,
  refreshSession,
  mobileOwner,
  requestMagic,
} from './auth';
import { getSync, putSync } from './sync';
import { resourceSchema, idSchema } from './schema';
import { knowledgeManifest, knowledgeBundle } from './knowledge';
import { prepareChat, chatHistory, deleteChat } from '../chat-service';
import { mobileExport, mobileDownload } from './export';
import { createShareForUser } from '../share-service';
import { refreshRevenuecat } from '../revenuecat';
import { softDeleteAccount } from '../account-service';
async function body(request: Request, maxBytes = 8 * 1024 * 1024): Promise<unknown> {
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    throw new ApiError('E_VALIDATION', 'JSON required', 400);
  if (Number(request.headers.get('content-length') ?? 0) > maxBytes)
    throw new ApiError('E_VALIDATION', 'Request too large', 400);
  // DESIGN-GAP: Read bounded chunks rather than trusting Content-Length; mobile sync retains the Web's 8MiB import ceiling.
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError('E_VALIDATION', 'JSON required', 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    size += chunk.value.length;
    if (size > maxBytes) {
      await reader.cancel();
      throw new ApiError('E_VALIDATION', 'Request too large', 400);
    }
    chunks.push(chunk.value);
  }
  const buffer = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.length;
  }
  return JSON.parse(new TextDecoder().decode(buffer)) as unknown;
}
const success = (data: unknown) =>
  Response.json({ ok: true, data }, { headers: { 'Cache-Control': 'private, no-store' } });
/** Dispatch Worker mobile APIs with Bearer-only authentication and the documented Web error envelope. */
export async function mobileApi(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url),
      path = url.pathname.replace(/^\/api\/v1\/mobile\//, '').split('/'),
      route = path.join('/'),
      method = request.method;
    if (
      method === 'POST' &&
      [
        'auth/challenge',
        'auth/apple',
        'auth/google',
        'auth/magic/request',
        'auth/magic/verify',
        'auth/refresh',
      ].includes(route)
    ) {
      // DESIGN-GAP: Authentication exchanges use the existing 20/hour/IP magic limit to bound provider verification and credential guessing.
      if (route !== 'auth/magic/request')
        assertRateLimit(await ratelimit('magic.ip', requestIp(request.headers)));
      const input = await body(request, 20000);
      if (route === 'auth/challenge') return success(await beginOAuth(input));
      if (route === 'auth/apple' || route === 'auth/google')
        return success(
          route === 'auth/google' &&
            input &&
            typeof input === 'object' &&
            'authorizationCode' in input
            ? await exchangeGoogleCode(input)
            : await exchangeOAuth(route === 'auth/apple' ? 'apple' : 'google', input),
        );
      if (route === 'auth/magic/request')
        return success(await requestMagic(input, requestIp(request.headers)));
      if (route === 'auth/magic/verify') return success(await exchangeMagic(input));
      return success(await refreshSession(input));
    }
    const { user, sessionId } = await mobileOwner(request);
    assertRateLimit(await ratelimit('daily', user.id));
    if (route === 'auth/logout' && method === 'POST') {
      await getDb().mobileSession.deleteMany({ where: { id: sessionId, userId: user.id } });
      return success({ loggedOut: true });
    }
    if (route === 'auth/sessions' && method === 'GET') {
      const sessions = await getDb().mobileSession.findMany({
        where: { userId: user.id, refreshExpiresAt: { gt: new Date() } },
        orderBy: { lastUsedAt: 'desc' },
        select: { id: true, deviceName: true, platform: true, createdAt: true, lastUsedAt: true },
      });
      return success({
        sessions: sessions.map((session) => ({ ...session, current: session.id === sessionId })),
      });
    }
    if (
      (route === 'auth/sessions' ||
        (path[0] === 'auth' && path[1] === 'sessions' && path.length === 3)) &&
      method === 'DELETE'
    ) {
      // DESIGN-GAP: DELETE auth/sessions accepts {sessionId}; the ID subroute is also available for native REST clients.
      const id = idSchema.parse(
        path[2] ??
          z
            .object({ sessionId: idSchema })
            .strict()
            .parse(await body(request, 1000)).sessionId,
      );
      const removed = await getDb().mobileSession.deleteMany({ where: { id, userId: user.id } });
      if (!removed.count) throw new ApiError('E_NOT_FOUND', 'Device session unavailable', 404);
      return success({ revoked: true });
    }
    if (path[0] === 'sync' && path.length === 2) {
      const resource = resourceSchema.parse(path[1]);
      if (method === 'GET') return success(await getSync(user.id, resource, url.searchParams));
      if (method === 'PUT') return success(await putSync(user.id, resource, await body(request)));
    }
    if (route === 'knowledge/manifest' && method === 'GET')
      return success(await knowledgeManifest(url.searchParams.get('knowledgeVersion')));
    if (path[0] === 'knowledge' && path[1] === 'bundle' && path.length === 3 && method === 'GET')
      return knowledgeBundle(path[2]!, url.searchParams.get('since'));
    // DESIGN-GAP: Native history and deletion reuse the Web owner checks with Bearer identity.
    if (path[0] === 'chat' && path.length === 2 && method === 'GET')
      return success(await chatHistory(idSchema.parse(path[1]), user.id));
    if (path[0] === 'chat' && path.length === 2 && method === 'DELETE') {
      await deleteChat(idSchema.parse(path[1]), user.id);
      return success({});
    }
    if (path[0] === 'chat' && path.length === 2 && method === 'POST') {
      const abort = new AbortController(),
        iterator = await prepareChat(
          idSchema.parse(path[1]),
          await body(request, 12000),
          AbortSignal.any([request.signal, abort.signal]),
          user.id,
        );
      const stream = new ReadableStream<Uint8Array>({
        async pull(controller) {
          try {
            const next = await iterator.next();
            if (next.done) controller.close();
            else controller.enqueue(new TextEncoder().encode(JSON.stringify(next.value) + '\n'));
          } catch {
            controller.error(new Error('Chat unavailable'));
          }
        },
        async cancel() {
          abort.abort();
          await iterator.return();
        },
      });
      return new Response(stream, {
        headers: {
          'Content-Type': 'application/x-ndjson',
          'Cache-Control': 'private, no-store',
          'X-Accel-Buffering': 'no',
        },
      });
    }
    if (path[0] === 'export' && path.length === 2) {
      const id = idSchema.parse(path[1]);
      if (method === 'POST')
        return success(await mobileExport(user.id, id, await body(request, 1000)));
      if (method === 'GET') return mobileDownload(user.id, id, url.searchParams);
    }
    if (path[0] === 'share' && path.length === 2 && method === 'POST') {
      const input = z
        .object({
          template: z.enum(['chart', 'quote', 'daily', 'synastry']),
          revealLevel: z.number().int().min(0).max(2).default(0),
          expiresIn: z.union([z.literal(7), z.literal(30)]).optional(),
          locale: z.enum(['zh', 'en', 'zh-TW']).default('zh'),
        })
        .strict()
        .parse(await body(request, 1000));
      const { locale, ...options } = input;
      return success(
        await createShareForUser(
          user.id,
          { ...options, readingId: idSchema.parse(path[1]) },
          locale,
        ),
      );
    }
    if (route === 'entitlements/sync' && method === 'POST') {
      await refreshRevenuecat(user.id);
      const current = await getDb().user.findUniqueOrThrow({ where: { id: user.id } });
      return success({
        userId: user.id,
        plan: current.plan,
        lifetime: current.lifetime,
        revenuecatProUntil: current.revenuecatProUntil,
      });
    }
    // DESIGN-GAP: Account deletion has an explicit mobile route and reuses the existing DELETE confirmation and seven-day retention workflow.
    if (route === 'account' && method === 'DELETE') {
      const deletion = z
        .object({ confirmText: z.literal('DELETE'), deleteFeedback: z.boolean().default(false) })
        .strict()
        .parse(await body(request, 1000));
      await softDeleteAccount(user.id, deletion.deleteFeedback);
      return success({ deleted: true });
    }
    throw new ApiError('E_NOT_FOUND', 'Mobile endpoint unavailable', 404);
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error);
    if (error instanceof z.ZodError || error instanceof SyntaxError)
      return errorResponse(new ApiError('E_VALIDATION', 'Invalid mobile request', 400));
    logger.error({ code: 'E_INTERNAL', route: 'mobile' }, 'Mobile API failure');
    return errorResponse(new ApiError('E_INTERNAL', 'Mobile service unavailable', 503));
  }
}
