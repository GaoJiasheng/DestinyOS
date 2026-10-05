import { AsyncLocalStorage } from 'node:async_hooks';
interface Scope {
  clients: Map<string, { $disconnect(): Promise<void> }>;
}
const globalScope = globalThis as typeof globalThis & { destinyDbScope?: AsyncLocalStorage<Scope> };
// DESIGN-GAP: A shared AsyncLocalStorage spans OpenNext's bundled modules; only the scope container is global, never a connection.
const scopes = (globalScope.destinyDbScope ??= new AsyncLocalStorage<Scope>());
/** Return the current request's client cache without crossing Workers request contexts. */
export function databaseScope(): Scope | undefined {
  return scopes.getStore();
}
/** Keep database connections alive through streamed bodies, then disconnect on completion, failure or cancellation. */
export async function withDatabaseScope(
  dispatch: () => Promise<Response>,
  waitUntil: (promise: Promise<unknown>) => void,
): Promise<Response> {
  const scope: Scope = { clients: new Map() };
  const cleanup = () =>
    Promise.allSettled(Array.from(scope.clients.values(), (client) => client.$disconnect()));
  return scopes.run(scope, async () => {
    try {
      const response = await dispatch();
      if (!response.body) {
        await cleanup();
        return response;
      }
      const stream = new TransformStream<Uint8Array, Uint8Array>();
      waitUntil(
        response.body
          .pipeTo(stream.writable)
          .catch(() => undefined)
          .finally(cleanup),
      );
      return new Response(stream.readable, response);
    } catch (error) {
      await cleanup();
      throw error;
    }
  });
}
