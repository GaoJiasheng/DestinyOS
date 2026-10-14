import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { securityHeaders } from '../lib/security-headers';

describe('static asset security headers', () => {
  it('mirrors every Next security header for asset-served HTML and Flight', async () => {
    const file = await readFile(new URL('../public/_headers', import.meta.url), 'utf8');
    const block = file.split(/\n(?=\/)/).find((section) => section.startsWith('/*\n'));
    expect(block).toBeDefined();
    for (const { key, value } of securityHeaders()) expect(block).toContain(`  ${key}: ${value}`);
  });
});
