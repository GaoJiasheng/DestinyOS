import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { I18nextProvider } from 'react-i18next';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AccountBootstrap } from '../components/account-bootstrap';
import { MonetizationBootstrap } from '../components/monetization-bootstrap';
import { EngagementBootstrap } from '../components/engagement-bootstrap';
import { ProfilesProvider } from '../lib/profiles';
import { SessionGate } from '../components/session-gate';
import { fonts } from '../lib/fonts';
import { i18n } from '../lib/i18n';
import * as Sentry from '@sentry/react-native';
import { MotionPreferenceContext, useSystemAccessibility } from '../lib/accessibility';
import { useProfiles } from '../lib/profiles';
import { markStartupReady } from '../lib/diagnostics/startup';
void SplashScreen.preventAutoHideAsync();
/** Load embedded subsets before exposing native routes; all copy comes from the Web catalogs. */
function RootLayout() {
  const [loaded, error] = useFonts(fonts);
  useEffect(() => {
    if (loaded || error) void SplashScreen.hideAsync();
  }, [loaded, error]);
  if (!loaded && !error) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <I18nextProvider i18n={i18n}>
        <SafeAreaProvider>
          <StatusBar style="light" />
          <AccountBootstrap>
            <ProfilesProvider>
              <EngagementBootstrap />
              <MonetizationBootstrap />
              <AccessibleStack />
            </ProfilesProvider>
          </AccountBootstrap>
        </SafeAreaProvider>
      </I18nextProvider>
    </GestureHandlerRootView>
  );
}

/** System and in-app motion settings also apply to native navigation transitions. */
function AccessibleStack() {
  const { reduced } = useSystemAccessibility();
  const { settings, loading, error } = useProfiles();
  useEffect(() => {
    if (!loading && !error) requestAnimationFrame(() => markStartupReady());
  }, [loading, error]);
  return (
    <MotionPreferenceContext.Provider value={settings.reducedMotion}>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: reduced || settings.reducedMotion ? 'none' : 'default',
        }}
        screenLayout={({ children }) => <SessionGate>{children}</SessionGate>}
      />
    </MotionPreferenceContext.Provider>
  );
}

export default Sentry.wrap(RootLayout);
