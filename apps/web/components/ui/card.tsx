import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';
/** Theme-aware card surface with a light border and restrained hover treatment. */
export function Card({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="card" className={cn('card', className)} {...props} />;
}
