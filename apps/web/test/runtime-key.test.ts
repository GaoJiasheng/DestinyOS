import { expect, it } from 'vitest';
import { runtimeKey } from '../i18n/runtime-key';
import zh from '../messages/zh.json';

// toMessages() moves a key that is also a namespace to `<key>.__value`; callers only find it there when the key is registered in runtime-key.ts. An unregistered collision renders the raw key in production.
it('registers every catalog key that is also the parent of other keys', () => {
  const keys = Object.keys(zh);
  const parents = new Set<string>();
  for (const key of keys) {
    const parts = key.split('.');
    for (let index = 1; index < parts.length; index++) parents.add(parts.slice(0, index).join('.'));
  }
  const unregistered = keys.filter(
    (key) => parents.has(key) && runtimeKey(key) !== `${key}.__value`,
  );
  expect(unregistered).toEqual([]);
});
