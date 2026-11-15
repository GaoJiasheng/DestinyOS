import { membershipEnabled } from '../lib/monetization/features';
import { Alert, Platform } from 'react-native';
import * as Apple from 'expo-apple-authentication';
import { useEffect, useRef, useState } from 'react';
import { useRouter, useLocalSearchParams, type Href } from 'expo-router';
import { Page, CopyText, Action, Field } from './native-ui';
import { useCopy } from '../lib/copy';
import {
  useAccount,
  accountAction,
  loginProvider,
  requestMagicLink,
  confirmMagicLink,
  decideImport,
  logoutAccount,
  syncAccount,
  deleteAccount,
} from '../lib/account/controller';
import { Preferences } from './preferences';
import { LocalDataSection } from './local-data-section';
import { safeReturnTo } from '../lib/return-to';
const resendSeconds = 60;
// The magic link reopens the App through /auth/verify, which carries no return path of its own.
let magicReturnTo: Href | undefined;
// DESIGN-GAP: Native account-specific labels extend the shared next-intl catalogs under mobile.account; documented auth/me copy keys remain unchanged.
/** Native provider and email entry with explicit anonymous-data upload consent. */
export function LoginScreen() {
  const t = useCopy(),
    state = useAccount(),
    router = useRouter(),
    params = useLocalSearchParams<{ returnTo?: string }>();
  // Kept as a plain string: typed-route unions are too large for dependency arrays.
  const target = String(safeReturnTo(params.returnTo) ?? '/me/settings');
  const [email, setEmail] = useState(''),
    [sent, setSent] = useState(false),
    [cooldown, setCooldown] = useState(0);
  // Return to where sign-in started once a provider login (and any import decision) settles.
  const signingIn = useRef(false);
  useEffect(() => {
    if (!signingIn.current || state.busy) return;
    if (!state.session) {
      if (state.error) signingIn.current = false;
      return;
    }
    if (state.pending > 0) return;
    signingIn.current = false;
    router.replace(target as Href);
  }, [state.session, state.pending, state.busy, state.error, router, target]);
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);
  function provider(name: 'apple' | 'google') {
    signingIn.current = true;
    void accountAction(() => loginProvider(name));
  }
  return (
    <Page title="auth.login.title">
      {state.session ? (
        <>
          <CopyText testID="account-signed-in">{t('auth.login.signedIn')}</CopyText>
          {state.pending > 0 ? (
            <>
              <CopyText title testID="account-import-prompt">
                {t('mobile.account.import.title', { count: state.pending })}
              </CopyText>
              <CopyText>{t('mobile.account.import.help')}</CopyText>
              <Action
                id="account-import-confirm"
                disabled={state.busy}
                label={t('mobile.account.import.confirm')}
                onPress={() => void accountAction(() => decideImport(true))}
              />
              <Action
                id="account-import-skip"
                disabled={state.busy}
                label={t('mobile.account.import.skip')}
                onPress={() => void accountAction(() => decideImport(false))}
              />
            </>
          ) : (
            <Action
              id="account-continue"
              disabled={state.busy}
              label={t('auth.login.continueBack')}
              onPress={() => router.replace(target as Href)}
            />
          )}
        </>
      ) : (
        <>
          <CopyText>{t('mobile.account.login.help')}</CopyText>
          {Platform.OS === 'ios' && !state.mock ? (
            <Apple.AppleAuthenticationButton
              buttonType={Apple.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={Apple.AppleAuthenticationButtonStyle.WHITE}
              cornerRadius={12}
              style={{ height: 48, width: '100%', opacity: state.busy ? 0.45 : 1 }}
              onPress={() => {
                if (!state.busy) provider('apple');
              }}
            />
          ) : (
            <Action
              id="account-apple"
              disabled={state.busy}
              label={t('mobile.account.apple')}
              onPress={() => provider('apple')}
            />
          )}
          <Action
            id="account-google"
            disabled={state.busy}
            label={t('auth.login.google')}
            onPress={() => provider('google')}
          />
          <Field
            id="account-email"
            label={t('auth.login.email')}
            value={email}
            onChange={(value) => {
              setEmail(value);
              // The confirmation names the address, so it must not outlive an edit.
              setSent(false);
            }}
            maxLength={254}
            keyboardType="email-address"
            textContentType="emailAddress"
            autoComplete="email"
          />
          <Action
            id="account-magic-send"
            disabled={state.busy || cooldown > 0}
            label={
              cooldown > 0
                ? t('mobile.account.resendIn', { seconds: cooldown })
                : t('auth.login.send')
            }
            onPress={() =>
              void accountAction(async () => {
                await requestMagicLink(email);
                magicReturnTo = safeReturnTo(params.returnTo);
                setSent(true);
                setCooldown(resendSeconds);
              })
            }
          />
          {sent && (
            <CopyText testID="account-magic-sent">{t('auth.magic.sent', { email })}</CopyText>
          )}
        </>
      )}
      {state.busy && <CopyText>{t('auth.verify.confirming')}</CopyText>}
      {state.error && <CopyText testID="account-error">{t(state.error)}</CopyText>}
    </Page>
  );
}
/** Universal-link verification never consumes the token on navigation or email scanning. */
export function VerifyScreen() {
  const params = useLocalSearchParams<{ email?: string; token?: string }>(),
    t = useCopy(),
    router = useRouter(),
    state = useAccount();
  return (
    <Page title="auth.verify.confirm">
      <CopyText>{t('auth.verify.description')}</CopyText>
      <CopyText>{t('auth.login.email')}</CopyText>
      <CopyText>{params.email ?? ''}</CopyText>
      <Action
        id="account-magic-confirm"
        disabled={state.busy || !params.email || !params.token}
        label={t('auth.verify.confirm')}
        onPress={() =>
          void accountAction(async () => {
            if (!params.email || !params.token) return;
            await confirmMagicLink(params.email, params.token);
            // DESIGN-GAP: Replace the verification route immediately after success so credentials are removed from navigation history.
            const returnTo = magicReturnTo;
            magicReturnTo = undefined;
            router.replace(
              returnTo
                ? { pathname: '/auth/login', params: { returnTo: String(returnTo) } }
                : '/auth/login',
            );
          })
        }
      />
      {(!params.email || !params.token || state.error) && (
        <CopyText testID="account-error">{t(state.error ?? 'auth.error.verification')}</CopyText>
      )}
      <Action label={t('auth.login.title')} onPress={() => router.replace('/auth/login')} />
    </Page>
  );
}
/** Account settings include retryable sync and privacy actions directly inside the App. */
export function AccountSettingsScreen() {
  const t = useCopy(),
    state = useAccount(),
    router = useRouter();
  const [confirm, setConfirm] = useState(''),
    [feedback, setFeedback] = useState(false);
  return (
    <Page title="me.settings">
      <Action
        id="account-notifications"
        label={t('mobile.push.title')}
        onPress={() => router.push('/me/settings/notifications')}
      />
      {membershipEnabled() && (
        <Action
          id="account-billing"
          label={t('billing.title')}
          onPress={() => router.push('/me/billing')}
        />
      )}
      {state.deleted && <CopyText testID="account-deleted">{t('mobile.account.deleted')}</CopyText>}
      {!state.session ? (
        <Action
          id="account-login"
          label={t('auth.login.title')}
          onPress={() =>
            router.push({ pathname: '/auth/login', params: { returnTo: '/me/settings' } })
          }
        />
      ) : (
        <>
          <CopyText testID="account-signed-in">{t('auth.login.signedIn')}</CopyText>
          {state.pending > 0 && (
            <Action
              id="account-review-import"
              label={t('mobile.account.import.review')}
              onPress={() => router.push('/auth/login')}
            />
          )}
          <Action
            id="account-sync"
            disabled={state.busy || state.syncing || state.pending > 0}
            label={t(state.syncing ? 'mobile.account.syncing' : 'mobile.account.sync')}
            onPress={() => void syncAccount()}
          />
          {state.lastSync && !state.syncing && !state.error && (
            <CopyText testID="account-sync-success">{t('mobile.account.synced')}</CopyText>
          )}
          {state.error && <CopyText testID="account-error">{t(state.error)}</CopyText>}
          <Action
            id="account-devices"
            label={t('mobile.account.devices')}
            onPress={() => router.push('/me/settings/devices')}
          />
          <Action
            id="account-logout"
            disabled={state.busy}
            label={t('auth.login.signOut')}
            onPress={() =>
              Alert.alert(t('mobile.account.logout.title'), t('mobile.account.logout.body'), [
                { text: t('profiles.cancel'), style: 'cancel' },
                {
                  text: t('auth.login.signOut'),
                  style: 'destructive',
                  onPress: () => void accountAction(logoutAccount),
                },
              ])
            }
          />
          <CopyText title>{t('me.delete')}</CopyText>
          <CopyText>{t('me.deleteHelp')}</CopyText>
          {membershipEnabled() && (
            <CopyText testID="account-store-subscriptions">
              {t('mobile.account.storeSubscriptions')}
            </CopyText>
          )}
          <Field
            id="account-delete-text"
            label={t('me.delete.confirm')}
            value={confirm}
            onChange={setConfirm}
            maxLength={6}
          />
          <Action
            id="account-delete-feedback"
            label={t('me.deleteFeedback')}
            selected={feedback}
            onPress={() => setFeedback(!feedback)}
          />
          <Action
            id="account-delete"
            disabled={state.busy || confirm !== 'DELETE'}
            label={t('me.deleteFinal')}
            onPress={() =>
              void accountAction(async () => {
                await deleteAccount('DELETE', feedback);
              })
            }
          />
        </>
      )}
      {!state.session && state.error && (
        <CopyText testID="account-error">{t(state.error)}</CopyText>
      )}
      {!state.session && <LocalDataSection />}
      <Preferences />
    </Page>
  );
}
