import type { DestinationStream } from 'pino';
import { writeWorkerLog } from './logger-sink';
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
  const write = (level: string, fields: unknown, message?: string) =>
    writeWorkerLog(level, fields, message, destination);
  return {
    info: (fields, message) => write('info', fields, message),
    warn: (fields, message) => write('warn', fields, message),
    error: (fields, message) => write('error', fields, message),
  };
}
