import { useEffect, useState } from 'react';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { BirthInputSchema } from '@tianji/shared';
import A from '../../../../packages/engine/test/fixtures/birth/A.json';
import { getLocalStore } from '../../lib/data/store';
import { useProfiles } from '../../lib/profiles';
import { usePreferences } from '../../lib/preferences';
import { createNativeReading } from '../../lib/reports/readings';
import { useCopy } from '../../lib/copy';
import { Page, CopyText, Action } from '../../components/native-ui';

// DESIGN-GAP: A development-only fixture deep link prepares real production screens, using public test data and no mocked UI.
/** Prepare a fresh screenshot scene on a dedicated simulator; release binaries redirect immediately. */
export default function StoreCapture() {
  const { scene, locale } = useLocalSearchParams<{ scene?: string; locale?: string }>();
  const router = useRouter(),
    { reload } = useProfiles(),
    t = useCopy();
  const [error, setError] = useState(false);
  const [started, setStarted] = useState(false);
  useEffect(() => {
    if (!__DEV__ || !started) return;
    let active = true;
    async function prepare() {
      // DESIGN-GAP: Finish encrypted preference hydration before setting the capture locale; automation starts explicitly to avoid matching the previous screen.
      await usePreferences.persist.rehydrate();
      usePreferences
        .getState()
        .setLocale(locale === 'en' ? 'en' : locale === 'zh-TW' ? 'zh-TW' : 'zh');
      const store = await getLocalStore();
      const profile = await store.profiles.save(
        { name: '', birth: BirthInputSchema.parse(A), version: 1, isCurrent: true },
        'M15-fixture-A',
      );
      await store.updateSettings({
        activeProfileId: profile.id,
        onboardingVersion: 1,
        tz: 'Asia/Shanghai',
        dailyNotificationHintDismissed: true,
      });
      await reload();
      if (!active) return;
      if (scene === 'bazi' || scene === 'astrology' || scene === 'tarot') {
        const reading = await createNativeReading(
          scene,
          profile,
          undefined,
          '2026-10-04T04:00:00.000Z',
          'fixture-A',
        );
        if (active)
          router.replace({
            pathname: '/[system]/r/[id]',
            params: { system: scene, id: reading.id },
          });
      } else if (scene === 'calendar') router.replace('/today/calendar');
      else if (scene === 'learn') router.replace('/learn/tarot/major_00_fool');
      else router.replace({ pathname: '/today', params: { date: '2026-10-04' } });
    }
    void prepare().catch(() => {
      if (active) setError(true);
    });
    return () => {
      active = false;
    };
  }, [scene, locale, reload, router, started]);
  if (!__DEV__) return <Redirect href="/" />;
  return (
    <Page title="nav.reading">
      <Action
        id="store-go"
        label={t('home.cta.start')}
        disabled={started}
        onPress={() => setStarted(true)}
      />
      <CopyText testID="store-prepare">
        {t(error ? 'mobile.storage.error' : 'report.loading')}
      </CopyText>
    </Page>
  );
}
