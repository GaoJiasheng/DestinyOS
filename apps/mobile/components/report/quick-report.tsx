import { useState } from 'react';
import { useRouter } from 'expo-router';
import { createNativeReading, readingError } from '../../lib/reports/readings';
import { useCopy } from '../../lib/copy';
import { useChartLabel } from './report-ui';
import { Action, CopyText } from '../native-ui';
/** Quick offline default report; the full interactive casting ritual is supplied by M07. */
export function QuickReport({ system }: { system: 'tarot' | 'iching' }) {
  const t = useCopy(),
    label = useChartLabel(),
    router = useRouter();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  async function create() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const saved = await createNativeReading(system, null);
      router.push({ pathname: '/[system]/r/[id]', params: { system, id: saved.id } });
    } catch (cause) {
      setError(readingError(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <CopyText>
        {t(system === 'tarot' ? 'tarot.spread.single.hint' : 'mobile.report.timeCast')}
      </CopyText>
      <Action
        id={`quick-report-${system}`}
        label={busy ? t('report.loading') : t('tarot.result')}
        disabled={busy}
        onPress={() => void create()}
      />
      {error ? <CopyText>{label(error)}</CopyText> : null}
    </>
  );
}
