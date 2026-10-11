import { build, type Plugin } from 'esbuild';
import { resolve } from 'node:path';
import { mkdir, cp } from 'node:fs/promises';
import { createRequire } from 'node:module';
const web = resolve(import.meta.dirname, '../apps/web');
const require = createRequire(resolve(web, 'package.json'));
const output = resolve(web, '.media');
await mkdir(output, { recursive: true });
const aliases: Plugin = {
  name: 'media-service-adapters',
  setup(plugin) {
    plugin.onResolve(
      {
        filter:
          /(?:next\/og|share-copy|i18n\/get-copy|platform\/resources|\.\/cloudflare|browser-node|png-node|index_bg\.wasm|yoga\.wasm)$/,
      },
      (args) => {
        if (args.path.endsWith('.wasm'))
          return {
            path: args.path.includes('yoga') ? './yoga.wasm' : './resvg.wasm',
            external: true,
          };
        if (args.path === 'next/og')
          return { path: resolve(web, 'workers/media-image-response.ts') };
        if (/share-copy|i18n\/get-copy/.test(args.path))
          return { path: resolve(web, 'workers/media-copy.ts') };
        if (/platform\/resources|\.\/cloudflare/.test(args.path))
          return { path: resolve(web, 'workers/media-context.ts') };
        if (/browser-node|png-node/.test(args.path))
          return { path: resolve(web, 'lib/platform/node-unavailable.ts') };
        return undefined;
      },
    );
  },
};
await build({
  entryPoints: [resolve(web, 'workers/media.ts')],
  outfile: resolve(output, 'worker.js'),
  tsconfig: resolve(web, 'tsconfig.json'),
  bundle: true,
  jsx: 'automatic',
  minify: true,
  platform: 'browser',
  format: 'esm',
  target: 'es2022',
  external: ['node:*'],
  define: { 'process.env.NODE_ENV': '"production"', 'process.env.PLATFORM': '"cloudflare"' },
  plugins: [aliases],
  metafile: true,
});
await cp(
  resolve(require.resolve('@resvg/resvg-wasm'), '../index_bg.wasm'),
  resolve(output, 'resvg.wasm'),
);
console.log('Built binding-only destinyos-media.');

await cp(require.resolve('yoga-wasm-web/dist/yoga.wasm'), resolve(output, 'yoga.wasm'));
