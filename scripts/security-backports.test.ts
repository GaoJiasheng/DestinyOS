import { test } from 'vitest';
import { verifySecurityBackports } from './security-backports';

test('installed dependency backports reject malformed signatures, deep ASTs and allocation attacks', async () => {
  await verifySecurityBackports();
});
