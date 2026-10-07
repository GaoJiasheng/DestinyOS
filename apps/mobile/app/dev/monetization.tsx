import { useState } from 'react';
import { Redirect } from 'expo-router';
import mobileAds from 'react-native-google-mobile-ads';
import { BirthInputSchema } from '@tianji/shared';
import A from '../../../../packages/engine/test/fixtures/birth/A.json';
import { usePreferences } from '../../lib/preferences';
import { useCopy } from '../../lib/copy';
import { useProfiles } from '../../lib/profiles';
import { getLocalStore } from '../../lib/data/store';
import { createAccountMock } from '../../lib/account/mock';
import { configureAccountMock, loginProvider, decideImport } from '../../lib/account/controller';
import { createBillingMock } from '../../lib/monetization/mock';
import {
  configureBillingDiagnostic,
  identifyBilling,
  refreshBilling,
  billingAction,
  useBilling,
} from '../../lib/monetization/billing';
import {
  configureConsentDiagnostic,
  gatherAdConsent,
  useConsent,
} from '../../lib/monetization/consent';
import { nativeConsent, adRequestConfiguration } from '../../lib/monetization/native-consent';
import { useNetworkDiagnostic } from '../../lib/network';
import { Page, CopyText, Action } from '../../components/native-ui';
import { BillingScreen } from '../../components/billing-screen';
import { NativeAdCard } from '../../components/native-ad-card';
let mock: ReturnType<typeof createBillingMock> | undefined;
/** Dedicated test screen: synthetic purchases, real Google test inventory, injectable UMP/ATT, never production grants. */
export default function MonetizationDiagnostics() {
  const t = useCopy(),
    profiles = useProfiles(),
    billing = useBilling(),
    consent = useConsent();
  const [ready, setReady] = useState(false),
    [showBilling, setShowBilling] = useState(false),
    [managed, setManaged] = useState(false);
  if (!__DEV__) return <Redirect href="/" />;
  async function age(teen: boolean, personalized: boolean, fail = false, nativeTracking = false) {
    const store = await getLocalStore('M10-mock-user');
    for (const p of await store.profiles.list(500)) await store.profiles.delete(p.id);
    await store.profiles.save({
      name: '',
      relation: 'self',
      birth: BirthInputSchema.parse({
        ...A,
        year: teen ? new Date().getUTCFullYear() - 15 : 1990,
      }),
      version: 1,
      isCurrent: true,
    });
    await profiles.reload();
    configureConsentDiagnostic({
      async gather() {
        if (fail) throw new Error('TEST_CONSENT_FAILURE');
        return { canRequest: true, personalized, privacyRequired: true };
      },
      async privacy() {},
      async att() {
        return nativeTracking ? nativeConsent.att() : false;
      },
      async initialize(underAge, nonPersonalized) {
        await mobileAds().setRequestConfiguration(
          adRequestConfiguration(underAge, nonPersonalized),
        );
        await mobileAds().initialize();
      },
    });
    await gatherAdConsent(teen ? 'teen' : 'adult');
  }
  if (showBilling)
    return (
      <>
        <BillingScreen />
        <Action
          id="m13-close"
          label={t('mobile.ask.close')}
          onPress={() => setShowBilling(false)}
        />
      </>
    );
  return (
    <Page title="mobile.billing.mock.title">
      <CopyText>{t('mobile.billing.diagnostic')}</CopyText>
      <Action
        id="m13-zh"
        label={t('nav.locale.zh')}
        onPress={() => usePreferences.getState().setLocale('zh')}
      />
      <Action
        id="m13-en"
        label={t('nav.locale.en')}
        onPress={() => usePreferences.getState().setLocale('en')}
      />
      <Action
        id="m13-prepare"
        label={t('mobile.billing.mock.prepare')}
        onPress={() =>
          void (async () => {
            const account = createAccountMock();
            await configureAccountMock(account.fetcher, account.provider, account);
            await loginProvider('apple');
            await decideImport(false);
            await (
              await getLocalStore('M10-mock-user')
            ).updateSettings({ onboardingVersion: 1, ageBlocked: false });
            mock = createBillingMock();
            await configureBillingDiagnostic(mock.provider, mock.sync);
            await identifyBilling('M10-mock-user');
            await age(false, true);
            setReady(true);
          })()
        }
      />
      {ready && (
        <>
          <CopyText testID="m13-plan">
            {t(
              billing.access.pro
                ? billing.access.lifetime
                  ? 'mobile.billing.lifetime'
                  : 'mobile.billing.active'
                : 'mobile.billing.free',
            )}
          </CopyText>
          <Action
            id="m13-show"
            label={t('mobile.billing.mock.show')}
            onPress={() => setShowBilling(true)}
          />
          <Action
            id="m13-monthly"
            label={t('mobile.billing.mock.monthly')}
            onPress={() => void billingAction('tianji_pro_monthly')}
          />
          <Action
            id="m13-lifetime"
            label={t('mobile.billing.mock.lifetime')}
            onPress={() => void billingAction('tianji_pro_lifetime')}
          />
          <Action
            id="m13-refund"
            label={t('mobile.billing.mock.refund')}
            onPress={() => mock?.revoke()}
          />
          <Action
            id="m13-restore"
            label={t('mobile.billing.mock.restore')}
            onPress={() => {
              mock?.clearDevice();
              void billingAction('restore');
            }}
          />
          <Action
            id="m13-fail"
            label={t('mobile.billing.mock.fail')}
            onPress={() => mock?.fail('error')}
          />
          <Action
            id="m13-cancel"
            label={t('mobile.billing.mock.cancel')}
            onPress={() => mock?.fail('cancel')}
          />
          <Action
            id="m13-server"
            label={t('mobile.billing.mock.serverError')}
            onPress={() => {
              mock?.syncError(!billing.syncPending);
              void refreshBilling();
            }}
          />
          <Action
            id="m13-offline"
            label={t('mobile.billing.network')}
            onPress={() =>
              useNetworkDiagnostic.setState({ offline: !useNetworkDiagnostic.getState().offline })
            }
          />
          <Action
            id="m13-adult"
            label={t('mobile.billing.mock.adult')}
            onPress={() => void age(false, true)}
          />
          <Action
            id="m13-teen"
            label={t('mobile.billing.mock.teen')}
            onPress={() => void age(true, false)}
          />
          <Action
            id="m13-reject"
            label={t('mobile.billing.mock.reject')}
            onPress={() => void age(false, false)}
          />
          <Action
            id="m13-consent-error"
            label={t('mobile.billing.mock.consentError')}
            onPress={() => void age(false, false, true)}
          />
          <Action
            id="m13-native-att"
            label={t('mobile.billing.mock.nativeAtt')}
            onPress={() => void age(false, true, false, true)}
          />
          <Action
            id="m13-native-consent"
            label={t('mobile.billing.mock.nativeConsent')}
            onPress={() => {
              configureConsentDiagnostic(nativeConsent);
              void gatherAdConsent('adult');
            }}
          />
          <Action
            id="m13-manage"
            label={t('mobile.billing.manage')}
            onPress={() => void billingAction('manage').then(() => setManaged(true))}
          />
          {managed && <CopyText testID="m13-managed">{t('mobile.billing.mock.managed')}</CopyText>}
          {billing.message && <CopyText testID="m13-message">{t(billing.message)}</CopyText>}
          {billing.syncPending && (
            <CopyText testID="m13-sync-pending">{t('mobile.billing.syncPending')}</CopyText>
          )}
          {consent.status === 'ready' && (
            <CopyText testID="m13-consent-ready">{t('mobile.billing.mock.consentReady')}</CopyText>
          )}
          {consent.nonPersonalized && (
            <CopyText testID="m13-npa">{t('mobile.billing.mock.nonPersonalized')}</CopyText>
          )}
          {consent.status === 'error' && (
            <CopyText testID="m13-consent-failed">{t('mobile.billing.consentError')}</CopyText>
          )}
          <NativeAdCard slot={0} />
        </>
      )}
    </Page>
  );
}
