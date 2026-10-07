import { useEffect, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { restoreAccount, syncAccount, useAccount } from '../lib/account/controller';
import { Page, CopyText } from './native-ui';
import { useCopy } from '../lib/copy';
/** Restore secure identity before any screen can read the default owner scope. */
export function AccountBootstrap({ children }: { children: ReactNode }) {
  const ready = useAccount((state) => state.ready),
    t = useCopy();
  useEffect(() => {
    void restoreAccount();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void syncAccount();
    });
    // DESIGN-GAP: Foreground sync every five minutes keeps offline edits current within the existing API rate budget.
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') void syncAccount();
    }, 300000);
    return () => {
      subscription.remove();
      clearInterval(timer);
    };
  }, []);
  if (!ready)
    return (
      <Page title="auth.login.title">
        <CopyText>{t('mobile.profiles.loading')}</CopyText>
      </Page>
    );
  return children;
}
