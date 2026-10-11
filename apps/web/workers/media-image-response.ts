import satori, { init } from 'satori/wasm';
import yoga from 'yoga-wasm-web/dist/yoga.wasm';
import initYoga from 'yoga-wasm-web';
import { initWasm, Resvg } from '@resvg/resvg-wasm';
import wasm from '@resvg/resvg-wasm/index_bg.wasm';
import type { ReactNode } from 'react';
let initialized: Promise<void> | undefined;
/** Satori/resvg live exclusively in the media service; use compiled WASM, never runtime evaluation. */
export class ImageResponse extends Response {
  constructor(
    element: ReactNode,
    options: Parameters<typeof satori>[1] & { headers?: HeadersInit },
  ) {
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          await (initialized ??= Promise.all([initWasm(wasm), initYoga(yoga).then(init)]).then(
            () => undefined,
          ));
          const svg = await satori(element, options);
          const renderer = new Resvg(svg, { font: { loadSystemFonts: false } });
          try {
            const image = renderer.render();
            try {
              controller.enqueue(image.asPng());
            } finally {
              image.free();
            }
          } finally {
            renderer.free();
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });
    const headers = new Headers(options.headers);
    headers.set('Content-Type', 'image/png');
    super(stream, { headers });
  }
}
