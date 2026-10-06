import { useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useSharedValue, useFrameCallback } from 'react-native-reanimated';
import { brand } from '@tianji/shared/brand';
import { useCopy } from '../lib/copy';
import { useProfiles } from '../lib/profiles';
import { usePreferences } from '../lib/preferences';
import { requestNotificationPermission } from '../lib/notifications';
import { Starfield } from './effects/starfield';
import { useEffectsMotion } from './effects/motion';
import { Page, CopyText, Action } from './native-ui';
import { Preferences } from './preferences';

/** Three introduction screens, followed by OS notification permission and optional local profile. */
export function Onboarding() {
  const t = useCopy();
  const router = useRouter();
  const { settings, updateSettings } = useProfiles();
  const locale = usePreferences((state) => state.locale);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [denied, setDenied] = useState(false);
  const [fillNext, setFillNext] = useState(false);
  const [failed, setFailed] = useState(false);
  const size = Math.min(useWindowDimensions().width - 48, 320);
  const { active } = useEffectsMotion();
  const clock = useSharedValue(0);
  useFrameCallback((frame) => {
    if (active) clock.value = frame.timestamp;
  });
  if (settings.onboardingVersion >= 1) return <Redirect href={fillNext ? '/me/birth' : '/today'} />;
  async function finish(fill: boolean) {
    setFillNext(fill);
    setBusy(true);
    setFailed(false);
    try {
      await updateSettings({ onboardingVersion: 1 });
      router.replace(fill ? '/me/birth' : '/today');
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page
      title={
        step === 0
          ? 'mobile.onboarding.stars'
          : step === 1
            ? 'mobile.onboarding.intro.title'
            : step === 2
              ? 'legal.disclaimer'
              : step === 3
                ? 'mobile.onboarding.notifications'
                : 'form.birth.title'
      }
    >
      <View testID={`onboarding-${step}`} style={{ gap: 20 }}>
        {step === 0 && (
          <>
            <Starfield size={size} clock={clock} active={active} labels={{}} />
            <CopyText title>
              {t(locale === 'en' ? 'brand.nameEn' : 'brand.nameZh', {
                name:
                  locale === 'en'
                    ? brand.nameEn
                    : locale === 'zh-TW'
                      ? brand.nameZhTW
                      : brand.nameZh,
              })}
            </CopyText>
            <CopyText>{t('brand.tagline')}</CopyText>
            <Preferences />
          </>
        )}
        {step === 1 && <CopyText>{t('mobile.onboarding.intro.body')}</CopyText>}
        {step === 2 && <CopyText>{t('legal.disclaimer.full')}</CopyText>}
        {step < 3 && (
          <Action
            id="onboarding-next"
            label={t(step === 2 ? 'mobile.onboarding.accept' : 'form.birth.next')}
            onPress={() => setStep(step + 1)}
          />
        )}
        {step === 3 && (
          <>
            <CopyText>{t('mobile.onboarding.notifications.body')}</CopyText>
            {denied && (
              <CopyText testID="notifications-denied">
                {t('mobile.onboarding.notifications.denied')}
              </CopyText>
            )}
            {!denied ? (
              <Action
                id="notifications-request"
                disabled={busy}
                label={t('mobile.onboarding.notifications.request')}
                onPress={() => {
                  setBusy(true);
                  void requestNotificationPermission(t('mobile.onboarding.notifications'))
                    .then((granted) => {
                      if (granted) setStep(4);
                      else setDenied(true);
                    })
                    .catch(() => setDenied(true))
                    .finally(() => setBusy(false));
                }}
              />
            ) : (
              <Action
                id="onboarding-next"
                label={t('form.birth.next')}
                onPress={() => setStep(4)}
              />
            )}
          </>
        )}
        {step === 4 && (
          <>
            <CopyText>{t('mobile.profiles.empty')}</CopyText>
            <Action
              id="onboarding-fill"
              disabled={busy}
              label={t('mobile.onboarding.profile')}
              onPress={() => void finish(true)}
            />
            <Action
              id="onboarding-skip"
              disabled={busy}
              label={t('mobile.onboarding.skip')}
              onPress={() => void finish(false)}
            />
          </>
        )}
        {failed && <CopyText>{t('mobile.storage.error')}</CopyText>}
        {step > 0 && (
          <Action
            id="onboarding-back"
            disabled={busy}
            label={t('form.birth.back')}
            onPress={() => setStep(step - 1)}
          />
        )}
      </View>
    </Page>
  );
}
