import { useState } from 'react';
import { TurboModuleRegistry, type TurboModule } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { BirthInputSchema } from '@tianji/shared';
import A from '../../../../packages/engine/test/fixtures/birth/A.json';
import {
  configureAccountMock,
  controlAccountMock,
  accountAction,
  useAccount,
} from '../../lib/account/controller';
import { createAccountMock } from '../../lib/account/mock';
import { getLocalStore } from '../../lib/data/store';
import { fixtureReport } from '../../lib/diagnostics/fixture';
import { usePreferences } from '../../lib/preferences';
import { useCopy } from '../../lib/copy';
import { Page, Action, CopyText } from '../../components/native-ui';
let mock: ReturnType<typeof createAccountMock> | undefined;
/** Synthetic identities are explicitly enabled only in the dedicated development test route. */
export default function AccountDiagnostics() {
  const router = useRouter(),
    t = useCopy(),
    state = useAccount(),
    [ready, setReady] = useState(Boolean(mock));
  if (!__DEV__) return <Redirect href="/" />;
  return (
    <Page title="mobile.account.mock.title">
      <Action
        id="account-fixture-zh"
        label={t('nav.locale.zh')}
        onPress={() => usePreferences.getState().setLocale('zh')}
      />
      <Action
        id="account-fixture-en"
        label={t('nav.locale.en')}
        onPress={() => usePreferences.getState().setLocale('en')}
      />
      <Action
        id="account-fixture-prepare"
        disabled={state.busy}
        label={t('mobile.account.mock.prepare')}
        onPress={() =>
          void accountAction(async () => {
            // DESIGN-GAP: Disable Fast Refresh only for the dedicated mock run so concurrent Web corpus generation cannot reset an active Maestro identity.
            TurboModuleRegistry.get<TurboModule & { setHotLoadingEnabled(enabled: boolean): void }>(
              'DevSettings',
            )?.setHotLoadingEnabled(false);
            mock = createAccountMock();
            await configureAccountMock(mock.fetcher, mock.provider, mock);
            const store = await getLocalStore(null);
            const existing = await store.profiles.get('M10-anonymous-fixture');
            if (!existing)
              await store.profiles.save(
                { name: '', birth: BirthInputSchema.parse(A), version: 1, isCurrent: true },
                'M10-anonymous-fixture',
              );
            if (!(await store.readings.get('M10-reading-fixture'))) {
              const fixture = fixtureReport('bazi', 'zh');
              await store.readings.save(
                {
                  profileId: 'M10-anonymous-fixture',
                  profileVersion: 1,
                  system: 'bazi',
                  status: 'ok',
                  inputSnapshot: {
                    system: 'bazi',
                    birth: BirthInputSchema.parse(A),
                    profileId: 'M10-anonymous-fixture',
                    locale: 'zh',
                    idempotencyKey: '9fba18f5-429b-463e-9d9a-55072d4c76c1',
                  },
                  chart: fixture.chart,
                  reportZh: fixture.report,
                  reportEn: null,
                  schoolUsed: {},
                  engineVersion: 'mock',
                  interpretVersion: 'mock',
                  knowledgeVersion: 'mock',
                  title: null,
                  isPublic: false,
                },
                'M10-reading-fixture',
              );
            }
            if (!(await store.journal.get('M10-journal-fixture')))
              await store.journal.save(
                {
                  profileId: 'M10-anonymous-fixture',
                  date: '2026-10-07',
                  mood: 3,
                  text: '',
                  tz: 'Asia/Shanghai',
                  prediction: {
                    scores: {
                      overall: 50,
                      career: 50,
                      love: 50,
                      wealth: 50,
                      health: 50,
                      social: 50,
                    },
                    tz: 'Asia/Shanghai',
                    profileVersion: 1,
                    engineVersion: 'mock',
                  },
                },
                'M10-journal-fixture',
              );
            await store.updateSettings({
              onboardingVersion: 1,
              locale: usePreferences.getState().locale,
            });
            setReady(true);
            router.replace('/auth/login');
          })
        }
      />
      {(ready || state.mock) && (
        <>
          <Action
            id="account-fixture-offline"
            label={t('mobile.account.mock.offline')}
            onPress={() => {
              controlAccountMock('offline');
              router.replace('/me/settings');
            }}
          />
          <Action
            id="account-fixture-online"
            label={t('mobile.account.mock.online')}
            onPress={() => {
              controlAccountMock('online');
              router.replace('/me/settings');
            }}
          />
          <Action
            id="account-fixture-expire"
            label={t('mobile.account.mock.expire')}
            onPress={() => {
              controlAccountMock('expire');
              router.replace('/me/settings');
            }}
          />
        </>
      )}
      {state.error && <CopyText>{t(state.error)}</CopyText>}
    </Page>
  );
}
