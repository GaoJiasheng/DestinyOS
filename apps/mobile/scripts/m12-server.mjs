import { URL } from 'node:url';
import { setInterval, clearInterval } from 'node:timers';
import process from 'node:process';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
// DESIGN-GAP: Local-only Maestro transport streams the production NDJSON protocol and serves pre-existing Web A4 artifacts; never connects to a real account/provider.
const root = resolve(import.meta.dirname, '../../..');
let messages = [],
  remaining = 3;
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1:8099');
    let raw = '';
    for await (const part of req) raw += part;
    const input = raw ? JSON.parse(raw) : {};
    const json = (value) => {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(value));
    };
    if (url.pathname === '/reset') {
      messages = [];
      remaining = 3;
      return json({});
    }
    if (url.pathname === '/chat' && req.method === 'GET')
      return json({ available: true, remaining, limit: 3, messages });
    if (url.pathname === '/chat' && req.method === 'DELETE') {
      messages = [];
      return json({});
    }
    if (url.pathname === '/chat' && req.method === 'POST') {
      if (!remaining) {
        res.statusCode = 429;
        return json({ error: { code: 'E_QUOTA_EXCEEDED' } });
      }
      res.setHeader('Content-Type', 'application/x-ndjson');
      res.setHeader('Cache-Control', 'no-store');
      const text =
        input.locale === 'en'
          ? 'Your report offers a starting point for reflection. Consider its evidence and practise clear communication. This is for entertainment.'
          : '报告提供了自我观察的起点。可以结合其中的依据，练习清晰表达和倾听。以上内容仅供娱乐与自我反思。';
      let position = 0;
      const timer = setInterval(() => {
        if (position < text.length) {
          res.write(
            JSON.stringify({ type: 'delta', text: text.slice(position, position + 5) }) + '\n',
          );
          position += 5;
        } else {
          clearInterval(timer);
          remaining--;
          messages.push(
            {
              id: `${Date.now()}-u`,
              role: 'user',
              content: input.question,
              createdAt: new Date().toISOString(),
            },
            {
              id: `${Date.now()}-a`,
              role: 'assistant',
              content: text,
              createdAt: new Date().toISOString(),
            },
          );
          res.end('{"type":"done"}\n');
        }
      }, 150);
      res.on('close', () => clearInterval(timer));
      return;
    }
    if (url.pathname === '/export') {
      const ext = input.format === 'pdf' ? 'pdf' : 'png';
      return json(
        Array.from({ length: input.format === 'png' ? 2 : 1 }, (_, i) => ({
          url: `/file?ext=${ext}&page=${i + 1}&locale=${input.locale === 'en' ? 'en' : 'zh'}`,
          filename: `reading-${i + 1}.${ext}`,
        })),
      );
    }
    if (url.pathname === '/file') {
      const ext = url.searchParams.get('ext') === 'pdf' ? 'pdf' : 'png',
        locale = url.searchParams.get('locale') === 'en' ? 'en' : 'zh',
        page = url.searchParams.get('page') === '2' ? '02' : '01';
      res.setHeader('Content-Type', ext === 'pdf' ? 'application/pdf' : 'image/png');
      return res.end(
        await readFile(
          resolve(
            root,
            `test-results/export/bazi-2026-10-04-${locale}${ext === 'png' ? `-${page}` : ''}.${ext}`,
          ),
        ),
      );
    }
    res.statusCode = 404;
    json({});
  } catch {
    res.statusCode = 500;
    res.end('{}');
  }
});
server.listen(8099, '127.0.0.1', () => process.stdout.write('M12 local fixture server: 8099\n'));
