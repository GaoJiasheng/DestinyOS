import { Platform } from 'react-native';
import mobileAds, {
  AdsConsent,
  AdsConsentPrivacyOptionsRequirementStatus,
  AdsConsentStatus,
  AdsConsentDebugGeography,
  AgeRestrictedTreatment,
  MaxAdContentRating,
  type RequestConfiguration,
} from 'react-native-google-mobile-ads';
import { requestTrackingPermissionsAsync } from 'expo-tracking-transparency';
import type { ConsentPort } from './consent';
/** Shared with diagnostics, so tests exercise the same SDK age restrictions. */
export function adRequestConfiguration(
  underAge: boolean,
  nonPersonalized: boolean,
): RequestConfiguration {
  return {
    ageRestrictedTreatment: underAge
      ? AgeRestrictedTreatment.TEEN
      : AgeRestrictedTreatment.UNSPECIFIED,
    // DESIGN-GAP: v17.2 Android compares upper-case native enum names against lower-case JS values; retain the supported TFUA fallback on both platforms.
    tagForUnderAgeOfConsent: underAge,
    publisherPrivacyPersonalizationState: nonPersonalized ? 'disabled' : 'enabled',
    maxAdContentRating: MaxAdContentRating.T,
  };
}
/** Native consent adapter; UMP handles regulated regions and state-law/RDP signals itself. */
export const nativeConsent: ConsentPort = {
  async gather(underAge) {
    const info = await AdsConsent.gatherConsent({
      tagForUnderAgeOfConsent: underAge,
      ...(__DEV__ && process.env.EXPO_PUBLIC_UMP_DEBUG_GEOGRAPHY === 'EEA'
        ? { debugGeography: AdsConsentDebugGeography.EEA }
        : {}),
      ...(__DEV__ && process.env.EXPO_PUBLIC_UMP_DEBUG_GEOGRAPHY === 'US'
        ? { debugGeography: AdsConsentDebugGeography.REGULATED_US_STATE }
        : {}),
    });
    const choices =
      info.status === AdsConsentStatus.OBTAINED ? await AdsConsent.getUserChoices() : null;
    return {
      canRequest: info.canRequestAds,
      personalized:
        info.status === AdsConsentStatus.NOT_REQUIRED ||
        Boolean(
          choices?.storeAndAccessInformationOnDevice &&
          choices.createAPersonalisedAdsProfile &&
          choices.selectPersonalisedAds,
        ),
      privacyRequired:
        info.privacyOptionsRequirementStatus === AdsConsentPrivacyOptionsRequirementStatus.REQUIRED,
    };
  },
  async privacy() {
    await AdsConsent.showPrivacyOptionsForm();
  },
  async att() {
    if (Platform.OS !== 'ios') return true;
    return (await requestTrackingPermissionsAsync()).status === 'granted';
  },
  async initialize(underAge, nonPersonalized) {
    await mobileAds().setRequestConfiguration(adRequestConfiguration(underAge, nonPersonalized));
    await mobileAds().initialize();
  },
};
