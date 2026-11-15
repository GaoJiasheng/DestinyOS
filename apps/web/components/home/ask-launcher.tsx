'use client';
import { useId, useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useCopy } from '@/i18n/use-copy';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

/** Tarot and Mei Hua share the 120-character question limit. */
export const askQuestionLimit = 120;

/** Build the direct ritual entry; the destination pages own consent, drafts and URL cleanup. */
export function askHref(kind: 'tarot' | 'iching', question: string) {
  const params = new URLSearchParams(
    kind === 'tarot' ? { spread: 'single' } : { method: 'random' },
  );
  const q = question.trim().slice(0, askQuestionLimit);
  if (q) params.set('q', q);
  return `${kind === 'tarot' ? '/tarot/reading' : '/iching/cast'}?${params.toString()}`;
}

/** Quick divination: an optional question, then one-card tarot or a random Mei Hua cast. */
export function AskLauncher() {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const t = useCopy();
  const router = useRouter();
  const id = useId();
  const go = (kind: 'tarot' | 'iching') => {
    setOpen(false);
    router.push(askHref(kind, question));
  };
  return (
    <>
      <button
        type="button"
        className="ask-tab"
        onClick={() => setOpen(true)}
        aria-label={t('nav.ask')}
      >
        <span>{t('nav.ask')}</span>
      </button>
      <Dialog open={open} onOpenChange={setOpen} title={t('home.ask.title')}>
        <div className="ask-question">
          <label htmlFor={`${id}-q`}>{t('home.ask.question')}</label>
          <textarea
            id={`${id}-q`}
            rows={2}
            maxLength={askQuestionLimit}
            value={question}
            placeholder={t('home.ask.placeholder')}
            onChange={(event) => setQuestion(event.target.value)}
          />
        </div>
        <div className="dialog-actions">
          <Button type="button" onClick={() => go('tarot')}>
            {t('home.ask.tarot')}
          </Button>
          <Button type="button" variant="secondary" onClick={() => go('iching')}>
            {t('home.ask.iching')}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
