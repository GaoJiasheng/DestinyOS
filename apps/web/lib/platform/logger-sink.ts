import { sanitize } from '../privacy';
/** Emit only sanitized JSON from Workers without importing pino or Node stream adapters. */
export function writeWorkerLog(
  level: string,
  fields: unknown,
  message?: string,
  destination?: { write(line: string): void },
) {
  const line = JSON.stringify({
    level,
    time: Date.now(),
    data: sanitize(fields),
    msg: sanitize(message),
  });
  if (destination) destination.write(line + '\n');
  else console.log(line);
}
