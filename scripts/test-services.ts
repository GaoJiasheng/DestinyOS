import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import RedisMock from 'ioredis-mock';
import { createServer as createTcpServer } from 'node:net';
import { createServer as createHttpServer } from 'node:http';
import { spawn } from 'node:child_process';

// DESIGN-GAP: PGlite and ioredis-mock are isolated test substitutes, exposed through PostgreSQL/RESP
// so E2E exercises the real Prisma client and local Redis limiter without application mock branches.
const pg = new PGlite();
const shadow = new PGlite();
// DESIGN-GAP: PGlite multiplexes sessions; clear session-local prepared statements on startup.
// Prisma migration engines reuse names across connections, unlike PGlite's single backend.
for (const database of [pg, shadow]) {
  const execute = database.execProtocolRawStream.bind(database);
  database.execProtocolRawStream = async (message, options) => {
    const buffer = Buffer.from(message);
    if (buffer.length >= 8 && buffer[0] === 0 && buffer.readUInt32BE(4) === 196608) {
      const text = Buffer.from('DEALLOCATE ALL\0');
      const reset = Buffer.alloc(5 + text.length);
      reset[0] = 81;
      reset.writeUInt32BE(4 + text.length, 1);
      text.copy(reset, 5);
      await execute(reset, { onRawData: () => undefined });
    }
    return execute(message, options);
  };
}
await pg.waitReady;
await shadow.waitReady;
const postgres = new PGLiteSocketServer({ db: pg, port: 55432, maxConnections: 20 });
const shadowServer = new PGLiteSocketServer({ db: shadow, port: 55433, maxConnections: 10 });
await postgres.start();
await shadowServer.start();
const redis = new RedisMock();

function encode(value: unknown): string {
  if (value === null || value === undefined) return '$-1\r\n';
  if (Array.isArray(value)) return `*${value.length}\r\n${value.map(encode).join('')}`;
  if (typeof value === 'number') return `:${value}\r\n`;
  const text = String(value);
  return `$${Buffer.byteLength(text)}\r\n${text}\r\n`;
}

const cache = createTcpServer((socket) => {
  let input = Buffer.alloc(0);
  let queue = Promise.resolve();
  socket.on('data', (chunk) => {
    input = Buffer.concat([input, chunk]);
    while (input.length) {
      const firstLine = input.indexOf('\r\n');
      if (firstLine < 0) break;
      const count = Number(input.subarray(1, firstLine).toString());
      let offset = firstLine + 2;
      const args: string[] = [];
      for (let i = 0; i < count; i++) {
        const end = input.indexOf('\r\n', offset);
        if (end < 0) break;
        const length = Number(input.subarray(offset + 1, end).toString());
        if (input.length < end + 2 + length + 2) break;
        args.push(input.subarray(end + 2, end + 2 + length).toString());
        offset = end + 2 + length + 2;
      }
      if (args.length !== count) break;
      input = input.subarray(offset);
      queue = queue.then(async () => {
        const [command, ...rest] = args;
        try {
          const name = command?.toLowerCase() ?? '';
          const method: unknown = (redis as unknown as Record<string, unknown>)[name];
          if (name !== 'client' && typeof method !== 'function')
            throw new Error(`Unsupported mock command: ${name}`);
          const execute = method as (...args: string[]) => Promise<unknown>;
          const result = name === 'client' ? 'OK' : await execute.apply(redis, rest);
          socket.write(encode(result));
        } catch (error) {
          socket.write(
            `-ERR ${error instanceof Error ? error.message.replace(/[\r\n]/g, ' ') : 'mock failure'}\r\n`,
          );
        }
      });
    }
  });
});
await new Promise<void>((resolve) => cache.listen(56379, '127.0.0.1', resolve));
const outbox: unknown[] = [];
const mail = createHttpServer((request, response) => {
  if (request.method === 'POST' && request.url === '/mail') {
    let data = '';
    request.on('data', (chunk: Buffer) => {
      data += chunk.toString();
    });
    request.on('end', () => {
      outbox.push(JSON.parse(data) as unknown);
      response.end('OK');
    });
  } else if (request.url === '/mail') {
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify(outbox));
  } else if (request.url === '/reset' && request.method === 'POST') {
    outbox.length = 0;
    void redis.flushall().then(() => response.end('OK'));
  } else {
    response.writeHead(404);
    response.end();
  }
});
await new Promise<void>((resolve) => mail.listen(58081, '127.0.0.1', resolve));
console.log('Test PostgreSQL, shadow database, Redis and mail sink are ready.');

let child: ReturnType<typeof spawn> | undefined;
if (process.argv.includes('--web')) {
  const migrate = spawn('pnpm', ['db:deploy'], { stdio: 'inherit', env: process.env });
  const code = await new Promise<number | null>((resolve) => migrate.on('exit', resolve));
  if (code !== 0) throw new Error('Test database migration failed');
  child = spawn('pnpm', ['--filter', '@tianji/web', 'dev', '--port', '3100'], {
    stdio: 'inherit',
    env: process.env,
  });
}
async function stop() {
  child?.kill('SIGTERM');
  cache.close();
  mail.close();
  redis.disconnect();
  await postgres.stop();
  await shadowServer.stop();
  await pg.close();
  await shadow.close();
  process.exit(0);
}
process.on('SIGTERM', () => {
  void stop();
});
process.on('SIGINT', () => {
  void stop();
});
