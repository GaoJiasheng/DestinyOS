import { readFileSync } from 'node:fs';
import { checkCatalogs } from './i18n-validation';
const zh: unknown = JSON.parse(
  readFileSync(new URL('../apps/web/messages/zh.json', import.meta.url), 'utf8'),
);
const en: unknown = JSON.parse(
  readFileSync(new URL('../apps/web/messages/en.json', import.meta.url), 'utf8'),
);
const tw: unknown = JSON.parse(
  readFileSync(new URL('../apps/web/messages/zh-TW.json', import.meta.url), 'utf8'),
);
const errors = [...checkCatalogs(zh, en), ...checkCatalogs(zh, tw)];
for (const name of ['glossary', 'interpretation', 'tarot']) {
  const a: unknown = JSON.parse(
    readFileSync(new URL(`../apps/web/messages/zh/${name}.json`, import.meta.url), 'utf8'),
  );
  const b: unknown = JSON.parse(
    readFileSync(new URL(`../apps/web/messages/en/${name}.json`, import.meta.url), 'utf8'),
  );
  const tw: unknown = JSON.parse(
    readFileSync(new URL(`../apps/web/messages/zh-TW/${name}.json`, import.meta.url), 'utf8'),
  );
  errors.push(...checkCatalogs(a, tw).map((error) => `${name} zh-TW: ${error}`));
  errors.push(...checkCatalogs(a, b).map((error) => `${name}: ${error}`));
}
if (errors.length) {
  process.stderr.write(`${errors.join('\n')}\n`);
  process.exitCode = 1;
} else process.stdout.write('i18n: zh/en keys and ICU syntax are valid.\n');
