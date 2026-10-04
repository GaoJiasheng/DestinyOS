import { readFileSync } from 'node:fs';
import { checkCatalogs } from './i18n-validation';
const zh: unknown = JSON.parse(
  readFileSync(new URL('../apps/web/messages/zh.json', import.meta.url), 'utf8'),
);
const en: unknown = JSON.parse(
  readFileSync(new URL('../apps/web/messages/en.json', import.meta.url), 'utf8'),
);
const errors = checkCatalogs(zh, en);
if (errors.length) {
  process.stderr.write(`${errors.join('\n')}\n`);
  process.exitCode = 1;
} else process.stdout.write('i18n: zh/en keys and ICU syntax are valid.\n');
