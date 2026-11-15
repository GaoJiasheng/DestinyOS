'use client';
import type { ComponentProps } from 'react';
import { Link, usePathname } from '@/i18n/navigation';

/** Sign-in link that returns to the current page after login (same rule as the top bar). */
export function LoginLink(props: Omit<ComponentProps<typeof Link>, 'href'>) {
  const pathname = usePathname();
  const href = pathname.startsWith('/auth')
    ? '/auth/login'
    : `/auth/login?${new URLSearchParams({ callbackUrl: pathname })}`;
  return <Link {...props} href={href} />;
}
