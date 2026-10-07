'use client';
import * as React from 'react';
import { useFormStatus } from 'react-dom';
import { useSubmitTransition } from '@/components/forms/use-submit-transition';
import { useCopy } from '@/i18n/use-copy';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
export const buttonVariants = cva('button', {
  variants: {
    variant: { default: 'button-primary', secondary: 'button-secondary', ghost: 'button-ghost' },
  },
  defaultVariants: { variant: 'default' },
});
/** shadcn-style button; asChild allows a semantic link to share button styling. */
export function Button({
  className,
  variant,
  asChild = false,
  children,
  disabled,
  action,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    action?: (event: React.MouseEvent<HTMLButtonElement>) => Promise<void>;
  }) {
  const Comp = asChild ? Slot : 'button';
  const form = useFormStatus();
  const transition = useSubmitTransition();
  const pending = form.pending || transition.pending;
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, className }))}
      {...props}
      onClick={action ? (event) => transition.run(() => action(event)) : props.onClick}
      disabled={disabled || (!asChild && pending)}
      aria-busy={pending || props['aria-busy']}
    >
      {!asChild && pending ? <PendingLabel /> : children}
    </Comp>
  );
}
/** Inline localized form progress accompanies automatic double-submit prevention. */
function PendingLabel() {
  const t = useCopy();
  return <span aria-live="polite">{t('common.loading')}</span>;
}
