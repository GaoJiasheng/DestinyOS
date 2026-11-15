import { useEffect } from 'react';
import { router, type ErrorBoundaryProps } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Sentry from '@sentry/react-native';
import { useCopy } from '../lib/copy';
import { Page, CopyText, Action } from './native-ui';

/** Readable recovery screen for render errors; local data is never touched from here. */
export function RouteErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const t = useCopy();
  useEffect(() => {
    // beforeSend strips the message and any application state before upload.
    Sentry.captureException(error);
  }, [error]);
  return (
    // The root layout's boundary renders above the app's own SafeAreaProvider.
    <SafeAreaProvider>
      <Page title="mobile.shell.error.title">
        <CopyText testID="route-error">{t('mobile.shell.error.body')}</CopyText>
        <Action id="route-error-retry" label={t('common.retry')} onPress={() => void retry()} />
        <Action
          id="route-error-home"
          label={t('common.backHome')}
          onPress={() => {
            try {
              router.replace('/today');
            } catch {
              // The navigator itself failed; retrying the layout is the only remaining path.
            }
            void retry();
          }}
        />
      </Page>
    </SafeAreaProvider>
  );
}
