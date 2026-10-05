'use client';
import * as Popover from '@radix-ui/react-popover';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useCopy } from '@/i18n/use-copy';
/** Focus-trapped, keyboard-accessible glossary explanation with bilingual name and learning link. */
export function TermChip({ termKey }: { termKey: string }) {
  const t = useTranslations();
  const copy = useCopy();
  const path = `glossary.${termKey}`;
  return (
    <Popover.Root modal>
      <Popover.Trigger className="term-chip">
        {t.has(`${path}.term`) ? t(`${path}.term`) : copy('report.content', { text: termKey })}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="term-popover" sideOffset={8} collisionPadding={16}>
          <p className="type-h3">
            {t.has(`${path}.bilingual`)
              ? t(`${path}.bilingual`)
              : copy('report.content', { text: termKey })}
          </p>
          {t.has(`${path}.pinyin`) ? (
            <p className="muted" lang="zh-Latn">
              {t(`${path}.pinyin`)}
            </p>
          ) : null}
          <p>{t.has(`${path}.short`) ? t(`${path}.short`) : copy('common.learnMore')}</p>
          <Link href={`/learn/glossary/${termKey}`} className="text-link">
            {copy('common.learnMore')}
          </Link>
          <Popover.Close className="icon-button" aria-label={copy('common.close')}>
            ×
          </Popover.Close>
          <Popover.Arrow className="popover-arrow" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
