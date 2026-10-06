import { useState } from 'react';
import { Redirect, useRouter } from 'expo-router';
import A from '../../../../packages/engine/test/fixtures/birth/A.json';
import { BirthInputSchema } from '@tianji/shared';
import { getLocalStore } from '../../lib/data/store';
import { loadDaily } from '../../lib/daily/service';
import { useProfiles } from '../../lib/profiles';
import { usePreferences } from '../../lib/preferences';
import { useCopy } from '../../lib/copy';
import { Page, Action, CopyText } from '../../components/native-ui';
/** Development-only screenshot setup writes synthetic fixtures through production SQLCipher paths. */
export default function DailyFixtures() {
  const t = useCopy(),
    router = useRouter(),
    { reload } = useProfiles();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(false);
  if (!__DEV__) return <Redirect href="/" />;
  async function prepare(sample: boolean) {
    setBusy(true);
    setError(false);
    try {
      const store = await getLocalStore();
      // DESIGN-GAP: Dedicated fixture records never overwrite or erase unrelated device profiles.
      const profile = await store.profiles.save(
        { name: '', birth: BirthInputSchema.parse(A), version: 1, isCurrent: true },
        sample ? 'M08-empty-fixture' : 'M08-fixture-A',
      );
      if (sample) {
        await store.profiles.delete(profile.id);
        // Sample is used on a dedicated reset simulator; do not delete other profiles to force it.
        await store.updateSettings({
          activeProfileId: null,
          onboardingVersion: 1,
          tz: 'Asia/Shanghai',
          dailyNotificationHintDismissed: true,
        });
      } else {
        await store.updateSettings({
          activeProfileId: profile.id,
          onboardingVersion: 1,
          tz: 'Asia/Shanghai',
          dailyNotificationHintDismissed: true,
        });
        for (const [i, date] of ['2026-10-02', '2026-10-03', '2026-10-04'].entries()) {
          const daily = await loadDaily(
            profile,
            date,
            'Asia/Shanghai',
            usePreferences.getState().locale,
          );
          await store.saveJournal({
            profileId: profile.id,
            date,
            tz: 'Asia/Shanghai',
            mood: i + 3,
            text: '',
            prediction: {
              scores: daily.chart.scores,
              tz: 'Asia/Shanghai',
              profileVersion: profile.data!.version,
              engineVersion: daily.engineVersion,
            },
          });
        }
      }
      await reload();
      router.replace({ pathname: '/today', params: { date: '2026-10-04' } });
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page title="nav.today">
      {(['zh', 'en', 'zh-TW'] as const).map((locale) => (
        <Action
          key={locale}
          id={`daily-fixture-${locale}`}
          label={t(`nav.locale.${locale}`)}
          onPress={() => usePreferences.getState().setLocale(locale)}
        />
      ))}
      <Action
        id="daily-fixture-prepare"
        disabled={busy}
        label={t('daily.today')}
        onPress={() => void prepare(false)}
      />
      <Action
        id="daily-fixture-empty"
        disabled={busy}
        label={t('daily.example')}
        onPress={() => void prepare(true)}
      />
      {error && <CopyText testID="daily-fixture-error">{t('mobile.storage.error')}</CopyText>}
    </Page>
  );
}
