// DESIGN-GAP: OpenNext generates this module after Next typechecking; declare its stable handler boundary.
declare module '*/.open-next/worker.js' {
  const handler: {
    fetch(
      request: Request,
      env: object,
      ctx: { waitUntil(promise: Promise<unknown>): void },
    ): Promise<Response>;
  };
  export default handler;
}
declare module '*/.open-next/cloudflare/init.js' {
  export function runWithCloudflareRequestContext(
    request: Request,
    env: object,
    ctx: { waitUntil(promise: Promise<unknown>): void },
    handler: () => Promise<Response>,
  ): Promise<Response>;
}
