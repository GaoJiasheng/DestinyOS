'use client';
import { forwardRef, useMemo, useEffect, useRef, useTransition, type ComponentProps } from 'react';
import { Link, useRouter } from './navigation-core';
import { navigationStarted, navigationFinished } from '@/lib/navigation-feedback';
/** Next's viewport prefetch plus explicit keyboard, hover and touch intent. */
export const PrefetchLink = forwardRef<HTMLAnchorElement, ComponentProps<typeof Link>>(
  function PrefetchLink({ prefetch = true, onMouseEnter, onTouchStart, onFocus, ...props }, ref) {
    const router = useRouter();
    const warm = () => {
      if (prefetch === false) return;
      const href = typeof props.href === 'string' ? props.href : props.href.pathname;
      if (!href?.startsWith('/') || href.startsWith('//')) return;
      const target = new URL(href, location.origin);
      // DESIGN-GAP: Intent prefetch retains URL-object query values, including calendar/journal dates; Next's viewport prefetch already preserves them.
      if (typeof props.href !== 'string') {
        const query = props.href.query;
        if (typeof query === 'string') target.search = query;
        else if (query)
          for (const [key, value] of Object.entries(query))
            for (const item of Array.isArray(value) ? value : [value])
              if (item != null) target.searchParams.append(key, String(item));
        if (props.href.search) target.search = props.href.search;
        if (props.href.hash) target.hash = props.href.hash;
      }
      router.prefetch(
        target.pathname + target.search + target.hash,
        props.locale ? { locale: props.locale } : undefined,
      );
    };
    return (
      <Link
        {...props}
        ref={ref}
        prefetch={prefetch}
        onMouseEnter={(event) => {
          warm();
          onMouseEnter?.(event);
        }}
        onTouchStart={(event) => {
          warm();
          onTouchStart?.(event);
        }}
        onFocus={(event) => {
          warm();
          onFocus?.(event);
        }}
      />
    );
  },
);
/** Start progress synchronously for imperative navigation, preserving next-intl's locale handling. */
export function useFeedbackRouter(): ReturnType<typeof useRouter> {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const refreshPending = useRef(false);
  useEffect(() => {
    if (refreshPending.current && !pending) {
      refreshPending.current = false;
      navigationFinished();
    }
  }, [pending]);
  return useMemo(
    () => ({
      ...router,
      push: (...args: Parameters<typeof router.push>) => {
        navigationStarted();
        return router.push(...args);
      },
      replace: (...args: Parameters<typeof router.replace>) => {
        navigationStarted();
        return router.replace(...args);
      },
      refresh: () => {
        navigationStarted();
        refreshPending.current = true;
        startTransition(() => router.refresh());
      },
    }),
    [router],
  );
}
