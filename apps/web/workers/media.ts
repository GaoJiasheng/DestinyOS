import { z } from 'zod';
import { writeWorkerLog } from '../lib/platform/logger-sink';
import { mediaContext, type MediaEnvironment } from './media-context';
import { renderCard } from '../lib/og-card-render';
import { renderPublicOgTemplate } from '../lib/public-og-template';
import { renderAuthorizedExport } from '../lib/export-render';
import { ExportRequestSchema } from '../lib/report-export-schema';
import { DailyCardSchema } from '../lib/share-projection';
import { System } from '@tianji/shared';
import { toTraditional } from '../../../scripts/traditional-converter';
const locale = z.enum(['zh', 'en', 'zh-TW']);
const text = z.string().max(240);
const score = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]);
const share = z.object({
  locale,
  system: z.nativeEnum(System),
  template: z.enum(['chart', 'quote', 'daily', 'synastry']),
  revealLevel: z.number().int().min(0).max(2),
  headline: text,
  keywords: z.array(text).max(12),
  scores: z
    .object({
      career: score,
      wealth: score,
      love: score,
      health: score,
      social: score,
    })
    .strict(),
  diagram: z
    .object({
      kind: z.enum(['pillars', 'wheel', 'cards', 'hexagram', 'grid']),
      items: z
        .array(
          z
            .object({
              label: text,
              value: text,
              longitude: z.number().optional(),
              yang: z.boolean().optional(),
            })
            .strict(),
        )
        .max(100),
    })
    .strict()
    .optional(),
});
const cardInput = z
  .object({
    card: z.union([DailyCardSchema, share]),
    format: z.enum(['story', 'landscape']).default('landscape'),
    destination: z.string().url().max(1024).optional(),
  })
  .strict();
const ogInput = z
  .object({
    locale,
    path: z.string().max(240),
    page: z.object({ title: z.string().max(1024), description: z.string().max(4096) }).strict(),
  })
  .strict();
const exportInput = z
  .object({
    request: ExportRequestSchema,
    reading: z.object({ system: z.nativeEnum(System), createdAt: z.string() }).strict(),
    origin: z.string().url(),
    path: z.string().max(512),
    token: z.string().max(4096),
  })
  .strict();
/** Binding-only renderer accepts projections and short-lived print capabilities, never user sessions. */
export default {
  async fetch(request: Request, env: MediaEnvironment): Promise<Response> {
    return mediaContext.run(env, async () => {
      const path = new URL(request.url).pathname;
      if (path === '/health' && request.method === 'GET')
        return Response.json({ ok: true, service: 'destinyos-media' });
      if (request.method !== 'POST') return new Response(null, { status: 405 });
      try {
        if (path === '/traditional') {
          const input = z
            .object({ text: z.string().max(10000) })
            .strict()
            .parse(await request.json());
          return Response.json(
            { text: toTraditional(input.text) },
            { headers: { 'Cache-Control': 'private, no-store' } },
          );
        }
        if (path === '/card') {
          const input = cardInput.parse(await request.json());
          return await renderCard(input.card, input.format, input.destination);
        }
        if (path === '/public-og') {
          const input = ogInput.parse(await request.json());
          return await renderPublicOgTemplate(input.locale, input.path, input.page);
        }
        if (path === '/export') {
          const input = exportInput.parse(await request.json());
          const canonical = new URL(env.NEXT_PUBLIC_SITE_URL ?? 'https://tianji.gavin.pub').origin;
          if (
            input.origin !== canonical ||
            !/^\/(zh|en|zh-TW)\/[a-z]+\/r\/[^/]+\/print$/.test(input.path)
          )
            return new Response(null, { status: 400 });
          const stream = new ReadableStream<Uint8Array>({
            async start(controller) {
              const emit = (event: unknown) =>
                controller.enqueue(new TextEncoder().encode(JSON.stringify(event) + '\n'));
              try {
                const data = await renderAuthorizedExport(
                  input.request,
                  input.reading,
                  input.origin,
                  input.path,
                  input.token,
                  (value) => emit({ kind: 'progress', value }),
                );
                const parts = Array.isArray(data) ? data : [data];
                if (parts.reduce((sum, part) => sum + part.byteLength, 0) > 32 * 1024 * 1024)
                  throw new Error('Export stream budget exceeded');
                for (const part of parts)
                  emit({ kind: 'part', data: Buffer.from(part).toString('base64') });
                emit({ kind: 'result', pages: Array.isArray(data), count: parts.length });
              } catch (error) {
                // DESIGN-GAP: Child failures log only error metadata, never request bodies or print capabilities.
                writeWorkerLog('error', {
                  event: 'media-rendering-failed',
                  errorName: error instanceof Error ? error.name : 'Unknown',
                });
                emit({ kind: 'error' });
              } finally {
                controller.close();
              }
            },
          });
          return new Response(stream, {
            headers: {
              'Content-Type': 'application/x-ndjson',
              'Cache-Control': 'private, no-store',
            },
          });
        }
        return new Response(null, { status: 404 });
      } catch (error) {
        // DESIGN-GAP: Child failures log only error metadata, never request bodies or print capabilities.
        writeWorkerLog('error', {
          event: 'media-rendering-failed',
          errorName: error instanceof Error ? error.name : 'Unknown',
        });
        return new Response(null, { status: 400 });
      }
    });
  },
};
