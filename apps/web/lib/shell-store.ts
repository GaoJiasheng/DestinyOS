import { useSyncExternalStore } from 'react';

/**
 * Device state the root shell learns after hydration (account hint, theme lock). Kept outside React
 * context because a context change reaches every still-streaming Suspense boundary below the
 * provider and makes React re-render it on the client; a store re-renders only its readers, and a
 * reader that is still dehydrated hydrates against the server value first.
 */
export interface ShellStore<T> {
  readonly initial: T;
  get(): T;
  set(value: T): void;
  subscribe(listener: () => void): () => void;
}

export function createShellStore<T>(initial: T): ShellStore<T> {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    initial,
    get: () => value,
    set(next) {
      if (Object.is(next, value)) return;
      value = next;
      for (const listener of listeners) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** Read a shell store; server rendering and hydration always see its initial value. */
export function useShellStore<T>(store: ShellStore<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, () => store.initial);
}
