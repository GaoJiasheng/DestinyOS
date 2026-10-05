import { createServer } from 'node:http';
import RedisMock from 'ioredis-mock';
import { z } from 'zod';
// DESIGN-GAP: A test-only loopback REST facade exercises the real Upstash client without requiring a production cache or disabling quotas.
const redis = new RedisMock();
const commandSchema = z.array(z.union([z.string(), z.number()]));
function encode(value: unknown): unknown {
  if (typeof value === 'string' && value !== 'OK') return Buffer.from(value).toString('base64');
  return Array.isArray(value) ? value.map(encode) : value;
}
async function execute(value: unknown) {
  try {
    const [name, ...args] = commandSchema.parse(value);
    let result: unknown;
    switch (String(name).toLowerCase()) {
      case 'ping':
        result = await redis.ping();
        break;
      case 'get':
        result = await redis.get(String(args[0]));
        break;
      case 'del':
        result = await redis.del(...args.map(String));
        break;
      case 'set': {
        const expiry = args.findIndex((arg) => String(arg).toLowerCase() === 'ex');
        const seconds = expiry >= 0 ? Number(args[expiry + 1]) : 3600;
        result = args.some((arg) => String(arg).toLowerCase() === 'nx')
          ? await redis.set(String(args[0]), String(args[1]), 'EX', seconds, 'NX')
          : await redis.set(String(args[0]), String(args[1]), 'EX', seconds);
        break;
      }
      case 'evalsha':
        throw new Error('NOSCRIPT');
      case 'eval':
        result = await redis.eval(
          String(args[0]).replace(/^#![^\n]*\n/, ''),
          Number(args[1]),
          ...args.slice(2),
        );
        break;
      case 'incr':
        result = await redis.incr(String(args[0]));
        break;
      default:
        throw new Error('Unsupported mock command');
    }
    return { result: encode(result) };
  } catch (error) {
    return {
      error:
        error instanceof Error && error.message.includes('NOSCRIPT')
          ? 'NOSCRIPT No matching script'
          : 'Mock Redis command failed',
    };
  }
}
createServer(async (request, response) => {
  try {
    let body = '';
    for await (const chunk of request) body += String(chunk);
    const input: unknown = JSON.parse(body);
    const result =
      request.url?.includes('pipeline') || request.url?.includes('multi-exec')
        ? await Promise.all(z.array(z.unknown()).parse(input).map(execute))
        : await execute(input);
    response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(result));
  } catch {
    response.writeHead(400).end();
  }
}).listen(8791, '127.0.0.1', () => console.log('Isolated Upstash REST mock ready on 8791'));
