import { runWithCloudflareRequestContext } from '../.open-next/cloudflare/init.js';
import { streamMiniMax } from '../lib/llm/minimax';
import { readExport, writeExport } from '../lib/platform/storage';
import { getUpstashRedis } from '../lib/redis';
import { Resend } from 'resend';
import Stripe from 'stripe';
import puppeteer from '@cloudflare/puppeteer';
import { openCloudflarePage } from '../lib/platform/browser-cloudflare';
import { printPng } from '../lib/print-png';
import { cloudflareBindings } from '../lib/platform/cloudflare';
// DESIGN-GAP: This test-only Wrangler entry is never imported by worker.ts or deployed; it verifies SDKs inside workerd without production auth bypasses.
export default {
  fetch(request: Request, env: object, ctx: { waitUntil(promise: Promise<unknown>): void }) {
    return runWithCloudflareRequestContext(request, env, ctx, async () => {
      const path = new URL(request.url).pathname;
      if (path === '/llm') {
        const encoder = new TextEncoder();
        const iterator = streamMiniMax([
          {
            role: 'user',
            content: 'Give one brief, kind symbolic reflection. No personal data is supplied.',
          },
        ]);
        return new Response(
          new ReadableStream<Uint8Array>({
            async pull(controller) {
              try {
                const event = await iterator.next();
                if (event.done) controller.close();
                else controller.enqueue(encoder.encode(JSON.stringify(event.value) + '\n'));
              } catch {
                controller.error(new Error('Provider smoke failed'));
              }
            },
            async cancel() {
              await iterator.return(undefined);
            },
          }),
          { headers: { 'Content-Type': 'application/x-ndjson' } },
        );
      }
      if (path === '/print-fixture') {
        if (request.headers.get('x-report-print-token') !== 'isolated-smoke')
          return new Response(null, { status: 401 });
        return new Response(
          `<!doctype html><html><head><meta charset="utf-8"><style>
          @font-face { font-family: 'Noto Serif SC'; src:url('/fonts/noto-ui.woff2'); }
          @font-face { font-family: 'Cormorant Garamond'; src:url('/_data/node_modules/@fontsource/cormorant-garamond/files/cormorant-garamond-latin-600-normal.woff'); }
          @page { size:A4; margin:0; } body { margin:0; } h1 { font:24px/1.8 'Noto Serif SC'; } .print-sheet { width:794px; height:1123px; box-sizing:border-box; break-after:page; padding:32px; }
          .print-page-content { height:1050px; overflow:hidden; font:16px/1.8 'Noto Serif SC'; } .english { font-family:'Cormorant Garamond'; }
        </style></head><body><div class="print-report" data-ready="loading">${Array.from({ length: 3 }, () => `<section class="print-sheet"><div class="print-page-content"><h1>天机命盘</h1><p class="english">DestinyOS: a grounded reflection.</p>${'<p>仅供娱乐与参考。</p>'.repeat(12)}</div></section>`).join('')}</div><script>
          (async()=>{try { await Promise.all([document.fonts.load('16px "Noto Serif SC"','天机命盘'),document.fonts.load('16px "Cormorant Garamond"','DestinyOS')]); await document.fonts.ready; document.querySelector('.print-report').dataset.ready='true'; } catch { document.querySelector('.print-report').dataset.ready='error'; }})();
        </script></body></html>`,
          { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
        );
      }
      if (path === '/render') {
        const origin = new URL(request.url).origin;
        const page = await openCloudflarePage(origin, '/print-fixture', 'isolated-smoke');
        try {
          await page.navigate(origin + '/print-fixture');
          await page.validate();
          const count = await page.pageCount();
          const pdf = new URL(request.url).searchParams.get('format') !== 'png';
          if (!pdf) await page.preparePng();
          const bytes = pdf ? await page.pdf() : await printPng(await page.screenshot(0));
          return new Response(new Uint8Array(bytes), {
            headers: {
              'Content-Type': pdf ? 'application/pdf' : 'image/png',
              'X-Page-Count': String(count),
            },
          });
        } finally {
          await page.close();
        }
      }
      if (path === '/browser') {
        try {
          const browser = await puppeteer.launch((await cloudflareBindings()).BROWSER);
          await browser.close();
          return Response.json({ available: true });
        } catch {
          return Response.json({ available: false });
        }
      }
      if (path === '/storage') {
        await writeExport('isolated-smoke', new Uint8Array([1, 2, 3]), 'image/png');
        const data = await readExport('isolated-smoke');
        return Response.json({
          r2: data?.join(',') === '1,2,3',
          upstash: (await getUpstashRedis().ping()) === 'PONG',
        });
      }
      if (path === '/services') {
        const originalFetch = globalThis.fetch;
        let requestVerified = false;
        // Exercise Resend's real serialization/fetch path while guaranteeing no external message is sent.
        globalThis.fetch = async (input, init) => {
          const url = input instanceof Request ? input.url : String(input);
          if (url !== 'https://api.resend.com/emails')
            throw new Error('Unexpected mock destination');
          requestVerified =
            init?.method === 'POST' && String(init.body).includes('isolated@example.com');
          return Response.json({ id: 'isolated-mail' });
        };
        try {
          const mail = await new Resend('re_isolated').emails.send({
            from: 'test@isolated.example',
            to: 'isolated@example.com',
            subject: 'SDK smoke',
            text: 'Test only',
          });
          const stripe = new Stripe('sk_test_isolated', {
            httpClient: Stripe.createFetchHttpClient(),
          });
          const body =
            '{ "id": "evt_isolated", "object": "event", "type": "invoice.payment_failed" }';
          const signature = await stripe.webhooks.generateTestHeaderStringAsync({
            payload: body,
            secret: 'whsec_isolated',
            cryptoProvider: Stripe.createSubtleCryptoProvider(),
          });
          const event = await stripe.webhooks.constructEventAsync(
            await new Request('https://isolated.example/webhook', { method: 'POST', body }).text(),
            signature,
            'whsec_isolated',
            undefined,
            Stripe.createSubtleCryptoProvider(),
          );
          return Response.json({
            resend: requestVerified && mail.data?.id === 'isolated-mail',
            stripeRawBody: event.id === 'evt_isolated',
          });
        } finally {
          globalThis.fetch = originalFetch;
        }
      }
      return new Response('Not found', { status: 404 });
    });
  },
};
