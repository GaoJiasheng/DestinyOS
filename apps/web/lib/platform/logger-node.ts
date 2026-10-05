import pino, { type DestinationStream } from 'pino';
import { sanitize } from '../privacy';

/** Create a JSON logger that removes request bodies and sensitive fields before serialization. */
export function createNodeLogger(destination?: DestinationStream) {
  const options: pino.LoggerOptions = {
    redact: [
      'req.body',
      'req.headers.authorization',
      'req.headers.cookie',
      '*.birth',
      '*.encBirth',
      '*.question',
      '*.email',
    ],
    hooks: {
      logMethod(args, method) {
        for (let index = 0; index < args.length; index++) {
          args[index] = sanitize(args[index]) as (typeof args)[number];
        }
        method.apply(this, args);
      },
    },
  };
  return destination ? pino(options, destination) : pino(options);
}
