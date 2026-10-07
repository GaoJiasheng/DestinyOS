import { brand } from '@tianji/shared/brand';
import { openBrowserAsync } from 'expo-web-browser';
import { usePreferences } from '../lib/preferences';
import { useRouter } from 'expo-router';
import { useCopy } from '../lib/copy';
import { useOnline } from '../lib/network';
import { useAccount } from '../lib/account/controller';
import { useBilling, billingAction, refreshBilling } from '../lib/monetization/billing';
import { gatherAdConsent, useConsent } from '../lib/monetization/consent';
import { products } from '../lib/monetization/model';
import { Action, Page, CopyText } from './native-ui';
/** Native paywall with store-localized prices, restore, system management and cross-platform refresh. */
export function BillingScreen() {
  const t = useCopy(),
    router = useRouter(),
    online = useOnline();
  const signedIn = useAccount((s) => Boolean(s.session));
  const state = useBilling(),
    consent = useConsent(),
    locale = usePreferences((s) => s.locale);
  const disabled = !online || state.busy || state.status === 'loading';
  // DESIGN-GAP: Store unavailability uses a neutral retry notice; SDK setup instructions stay in the developer README.
  return (
    <Page title="billing.title">
      <CopyText title>
        {t('pricing.pro.title', { brand: locale === 'en' ? brand.nameEn : brand.nameZh })}
      </CopyText>
      <Action id="billing-back" label={t('nav.me')} onPress={() => router.replace('/me')} />
      <CopyText testID="billing-plan" title>
        {t(
          state.access.pro
            ? state.access.lifetime
              ? 'mobile.billing.lifetime'
              : 'mobile.billing.active'
            : 'mobile.billing.free',
        )}
      </CopyText>
      <CopyText>{t('pricing.pro.benefit.noAds')}</CopyText>
      <CopyText>{t('mobile.billing.crossPlatform')}</CopyText>
      {state.access.until && (
        <CopyText>
          {t('mobile.billing.until', {
            date: new Date(state.access.until).toLocaleDateString(locale),
          })}
        </CopyText>
      )}
      {state.diagnostic && (
        <CopyText testID="billing-diagnostic">{t('mobile.billing.diagnostic')}</CopyText>
      )}
      {!online && <CopyText testID="billing-offline">{t('mobile.billing.network')}</CopyText>}
      {!signedIn ? (
        <Action
          id="billing-login"
          label={t('auth.login.title')}
          onPress={() => router.push('/auth/login')}
        />
      ) : (
        <>
          {!state.configured && (
            <CopyText testID="billing-unconfigured">{t('mobile.billing.unconfigured')}</CopyText>
          )}
          {state.status === 'loading' && <CopyText>{t('mobile.billing.loading')}</CopyText>}
          {products.map((id, index) => {
            const product = state.products.find((item) => item.id === id);
            return (
              <Action
                key={id}
                id={`buy-${id}`}
                disabled={disabled || !product || state.access.lifetime}
                label={t(index === 0 ? 'mobile.billing.monthly' : 'mobile.billing.buyLifetime', {
                  price: product?.price ?? (index === 0 ? 'US$2.99' : 'US$6.99'),
                })}
                onPress={() => void billingAction(id)}
              />
            );
          })}
          <CopyText>{t('mobile.billing.renewal')}</CopyText>
          <CopyText>{t('mobile.billing.lifetimeNote')}</CopyText>
          <Action
            id="billing-restore"
            disabled={disabled || !state.configured}
            label={t('mobile.billing.restore')}
            onPress={() => void billingAction('restore')}
          />
          <Action
            id="billing-refresh"
            disabled={disabled}
            label={t('billing.refreshMembership')}
            onPress={() => void refreshBilling()}
          />
          {state.configured && (
            <Action
              id="billing-manage"
              disabled={disabled || !state.configured}
              label={t('mobile.billing.manage')}
              onPress={() => void billingAction('manage')}
            />
          )}
        </>
      )}
      {state.syncPending && (
        <CopyText testID="billing-sync-pending">{t('mobile.billing.syncPending')}</CopyText>
      )}
      {state.message && <CopyText testID="billing-message">{t(state.message)}</CopyText>}
      <Action
        id="billing-privacy"
        disabled={!online}
        label={t('mobile.billing.privacy')}
        onPress={() => void gatherAdConsent(consent.age, consent.privacyRequired)}
      />
      {consent.status === 'error' && <CopyText>{t('mobile.billing.consentError')}</CopyText>}
      <Action
        label={t('legal.privacy')}
        onPress={() =>
          void openBrowserAsync(`https://${brand.domain}/${locale}/privacy`).catch(() => undefined)
        }
      />
      <Action
        label={t('legal.terms')}
        onPress={() =>
          void openBrowserAsync(`https://${brand.domain}/${locale}/terms`).catch(() => undefined)
        }
      />
    </Page>
  );
}
