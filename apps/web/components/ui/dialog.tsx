'use client';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useRef, type ReactNode } from 'react';
import { useCopy } from '@/i18n/use-copy';
/** Accessible modal with focus trapping, labelled content, and translated controls. */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  required = false,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  required?: boolean;
  className?: string;
}) {
  const t = useCopy();
  // DESIGN-GAP: Controlled dialogs use external buttons instead of Radix Trigger; preserve their actual opener for keyboard focus restoration.
  const opener = useRef<HTMLElement | null>(null);
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="dialog-overlay" />
        <DialogPrimitive.Content
          className={`dialog-content${className ? ` ${className}` : ''}`}
          {...(!description ? { 'aria-describedby': undefined } : {})}
          onOpenAutoFocus={() => {
            opener.current =
              document.activeElement instanceof HTMLElement ? document.activeElement : null;
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (opener.current?.isConnected) opener.current.focus();
          }}
          onEscapeKeyDown={required ? (event) => event.preventDefault() : undefined}
          onPointerDownOutside={required ? (event) => event.preventDefault() : undefined}
        >
          <DialogPrimitive.Title className="type-h2">{title}</DialogPrimitive.Title>
          {description ? (
            <DialogPrimitive.Description className="muted dialog-description">
              {description}
            </DialogPrimitive.Description>
          ) : null}
          {children}
          {!required ? (
            <DialogPrimitive.Close
              className="icon-button dialog-close"
              aria-label={t('common.close')}
            >
              <X aria-hidden size={20} />
            </DialogPrimitive.Close>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
