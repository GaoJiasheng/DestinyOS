import type { DestinationStream } from 'pino';
import { sanitize } from '../privacy';
import { platform } from './environment';
import { createNodeLogger } from './logger-node';
export interface JsonLogger {
  info(fields: unknown, message?: string): void;
  warn(fields: unknown, message?: string): void;
  error(fields: unknown, message?: string): void;
}
/** Emit sanitized JSON without Node streams in Workers, using pino on Vercel/local Node. */
export function createLogger(destination?: DestinationStream): JsonLogger {
  if (platform() !== 'cloudflare') return createNodeLogger(destination);
  const write = (level: string, fields: unknown, message?: string) => {
    const line = JSON.stringify({
      level,
      time: Date.now(),
      data: sanitize(fields),
      msg: sanitize(message),
    });
    if (destination) destination.write(line + '\n');
    else console.log(line);
  };
  return {
    info: (fields, message) => write('info', fields, message),
    warn: (fields, message) => write('warn', fields, message),
    error: (fields, message) => write('error', fields, message),
  };
}
