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
import { getOfflineKnowledge } from '../lib/knowledge';
void SplashScreen.preventAutoHideAsync();
/** Load embedded subsets before exposing native routes; all copy comes from the Web catalogs. */
export default function RootLayout() {
  const [loaded, error] = useFonts(fonts);
  useEffect(() => {
    if (loaded || error) void SplashScreen.hideAsync();
  }, [loaded, error]);
  useEffect(() => {
    // DESIGN-GAP: Warm the offline content/data layer after mounting. M05 owns the localized
    // storage recovery screen; a key/cipher failure never falls back to plaintext storage.
    void getOfflineKnowledge('bazi').catch(() => undefined);
  }, []);
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
              <Stack
                screenOptions={{ headerShown: false }}
                screenLayout={({ children }) => <SessionGate>{children}</SessionGate>}
              />
            </ProfilesProvider>
          </AccountBootstrap>
        </SafeAreaProvider>
      </I18nextProvider>
    </GestureHandlerRootView>
  );
}
