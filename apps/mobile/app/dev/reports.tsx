import { useState } from 'react';
import { Redirect } from 'expo-router';
import A from '../../../../packages/engine/test/fixtures/birth/A.json';
import B from '../../../../packages/engine/test/fixtures/birth/B.json';
import { BirthInputSchema } from '@tianji/shared';
import { createNativeReading, reportSystems, type ReportSystem } from '../../lib/reports/readings';
import { getLocalStore } from '../../lib/data/store';
import { useCopy } from '../../lib/copy';
import { usePreferences } from '../../lib/preferences';
import { ReportScreen } from '../../components/report/report-screen';
import { ReportTheme } from '../../components/report/report-theme';
import { Page, Action, CopyText } from '../../components/native-ui';

/** Developer-only deterministic fixture acceptance uses real encrypted storage and production reports. */
export default function ReportsPreview() {
  const t = useCopy();
  const [reading, setReading] = useState<{ id: string; system: ReportSystem } | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(false);
  if (!__DEV__) return <Redirect href="/" />;
  async function fixture(system: ReportSystem) {
    setBusy(true);
    setError(false);
    try {
      const store = await getLocalStore();
      const a = await store.profiles.save(
        { name: '', birth: BirthInputSchema.parse(A), version: 1, isCurrent: true },
        'M06-fixture-A',
      );
      const b =
        system === 'synastry'
          ? await store.profiles.save(
              { name: '', birth: BirthInputSchema.parse(B), version: 1, isCurrent: true },
              'M06-fixture-B',
            )
          : undefined;
      const saved = await createNativeReading(
        system,
        a,
        b,
        '2026-10-04T04:00:00.000Z',
        'fixture-A',
      );
      setReading({ id: saved.id, system });
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  if (reading)
    return (
      <ReportTheme system={reading.system}>
        <ReportScreen key={reading.id} {...reading} onBack={() => setReading(null)} />
      </ReportTheme>
    );
  return (
    <Page title="nav.reading">
      {(['zh', 'en'] as const).map((locale) => (
        <Action
          key={locale}
          id={`fixture-locale-${locale}`}
          label={t(`nav.locale.${locale}`)}
          onPress={() => usePreferences.getState().setLocale(locale)}
        />
      ))}
      {busy ? <CopyText>{t('report.loading')}</CopyText> : null}
      {error ? <CopyText testID="fixture-error">{t('mobile.storage.error')}</CopyText> : null}
      {reportSystems.map((system) => (
        <Action
          key={system}
          id={`fixture-${system}`}
          disabled={busy}
          label={t(`nav.${system}`)}
          onPress={() => void fixture(system)}
        />
      ))}
    </Page>
  );
}
