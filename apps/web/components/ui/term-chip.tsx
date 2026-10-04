'use client';
import * as Popover from '@radix-ui/react-popover';
import { useCopy } from '@/i18n/use-copy';
import { Link } from '@/i18n/navigation';
/** Keyboard-accessible term chip with a glass explanation popover. */
export function TermChip() {
  const t = useCopy();
  return (
    <Popover.Root>
      <Popover.Trigger className="term-chip">{t('dev.tokens.chip')}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="term-popover" sideOffset={8} collisionPadding={16}>
          <p className="type-h3">{t('dev.tokens.termBilingual')}</p>
          <p className="muted">{t('dev.tokens.chipDescription')}</p>
          <Link href="/learn" className="text-link">
            {t('common.learnMore')}
          </Link>
          <Popover.Arrow className="popover-arrow" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
