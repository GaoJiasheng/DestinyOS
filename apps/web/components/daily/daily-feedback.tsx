'use client';
import { useState } from 'react';
import { useCopy } from '@/i18n/use-copy';
import { Button } from '@/components/ui/button';
import { useSubmitTransition } from '@/components/forms/use-submit-transition';
import { submitFeedbackAction } from '@/app/readings/actions';

/** Daily vote; failures stay inside this card so an unsaved journal entry below is never unmounted. */
export function DailyFeedback({
  vote,
  setVote,
}: {
  vote: number | null;
  setVote: (vote: number) => void;
}) {
  const t = useCopy();
  const feedback = useSubmitTransition();
  const [failed, setFailed] = useState<1 | -1 | null>(null);
  const send = (n: 1 | -1) =>
    feedback.run(async () => {
      setFailed(null);
      // A thrown action (offline, deploy skew) would otherwise escape the transition into the route error boundary.
      const ok = await submitFeedbackAction({ sectionKey: 'daily', vote: n }).then(
        (r) => r.ok,
        () => false,
      );
      if (ok) setVote(n);
      else setFailed(n);
    });
  return (
    <section className="report-card" data-daily-block="12">
      <h2>{t('daily.feedback')}</h2>
      {([1, -1] as const).map((n) => (
        <Button
          key={n}
          variant="ghost"
          disabled={vote !== null || feedback.pending}
          aria-label={t(n === 1 ? 'daily.feedbackYes' : 'daily.feedbackNo')}
          onClick={() => send(n)}
        >
          {n === 1 ? '👍' : '👎'}
        </Button>
      ))}
      {feedback.pending ? <p role="status">{t('common.loading')}</p> : null}
      {vote !== null ? <p role="status">{t('daily.feedbackSaved')}</p> : null}
      {failed !== null && !feedback.pending ? (
        <div role="alert">
          {t('daily.feedbackError')}{' '}
          <Button variant="ghost" onClick={() => send(failed)}>
            {t('common.retry')}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
