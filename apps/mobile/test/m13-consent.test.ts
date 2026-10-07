import {
  configureConsentDiagnostic,
  gatherAdConsent,
  useConsent,
  type ConsentPort,
} from '../lib/monetization/consent';
import { adRequestConfiguration, nativeConsent } from '../lib/monetization/native-consent';
import {
  AdsConsent,
  AdsConsentStatus,
  AdsConsentPrivacyOptionsRequirementStatus,
} from 'react-native-google-mobile-ads';
jest.mock('expo-tracking-transparency', () => ({
  requestTrackingPermissionsAsync: jest.fn(async () => ({ status: 'denied' })),
}));
let port: jest.Mocked<ConsentPort>;
let calls: string[];
beforeEach(() => {
  calls = [];
  port = {
    gather: jest.fn<ReturnType<ConsentPort['gather']>, Parameters<ConsentPort['gather']>>(
      async () => {
        calls.push('UMP');
        return { canRequest: true, personalized: true, privacyRequired: true };
      },
    ),
    att: jest.fn(async () => {
      calls.push('ATT');
      return false;
    }),
    initialize: jest.fn<
      ReturnType<ConsentPort['initialize']>,
      Parameters<ConsentPort['initialize']>
    >(async () => {
      calls.push('ADS');
    }),
    privacy: jest.fn(async () => {
      calls.push('PRIVACY');
    }),
  };
  configureConsentDiagnostic(port);
});
it('runs UMP then ATT then ad initialization, denying tracking still allows non-personalized ads', async () => {
  await gatherAdConsent('adult');
  expect(calls).toEqual(['UMP', 'ATT', 'ADS']);
  expect(port.initialize).toHaveBeenCalledWith(false, true);
  expect(useConsent.getState()).toMatchObject({ status: 'ready', nonPersonalized: true });
});
it.each(['teen', 'unknown'] as const)(
  'forces %s to non-personalized without asking ATT',
  async (age) => {
    await gatherAdConsent(age);
    expect(port.gather).toHaveBeenCalledWith(true);
    expect(port.att).not.toHaveBeenCalled();
    expect(port.initialize).toHaveBeenCalledWith(true, true);
    expect(adRequestConfiguration(true, true)).toMatchObject({
      ageRestrictedTreatment: 'teen',
      tagForUnderAgeOfConsent: true,
      publisherPrivacyPersonalizationState: 'disabled',
    });
  },
);
it('accepts personalized ads only with both UMP and ATT permission', async () => {
  port.att.mockResolvedValue(true);
  await gatherAdConsent('adult');
  expect(port.initialize).toHaveBeenCalledWith(false, false);
  expect(useConsent.getState().nonPersonalized).toBe(false);
});
it('refusal skips ATT; blocked age, consent errors and no-request consent do not initialize', async () => {
  port.gather.mockResolvedValue({ canRequest: true, personalized: false, privacyRequired: true });
  await gatherAdConsent('adult');
  expect(port.att).not.toHaveBeenCalled();
  expect(port.initialize).toHaveBeenCalledWith(false, true);
  port.initialize.mockClear();
  await gatherAdConsent('blocked');
  expect(port.initialize).not.toHaveBeenCalled();
  port.gather.mockRejectedValueOnce(new Error('offline'));
  await gatherAdConsent('adult');
  expect(useConsent.getState().status).toBe('error');
  port.gather.mockResolvedValue({ canRequest: false, personalized: false, privacyRequired: true });
  await gatherAdConsent('adult');
  expect(port.initialize).not.toHaveBeenCalled();
});
it('withdrawal hides existing ads immediately and opens UMP privacy options first', async () => {
  await gatherAdConsent('adult');
  const operation = gatherAdConsent('adult', true);
  expect(useConsent.getState().status).toBe('loading');
  await operation;
  expect(calls.slice(3)).toEqual(['PRIVACY', 'UMP', 'ATT', 'ADS']);
});
it('obsolete adult consent cannot initialize ads after the age gate becomes blocked', async () => {
  let finish: ((value: Awaited<ReturnType<ConsentPort['gather']>>) => void) | undefined;
  port.gather.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const adult = gatherAdConsent('adult');
  await Promise.resolve();
  const blocked = gatherAdConsent('blocked');
  finish?.({ canRequest: true, personalized: true, privacyRequired: true });
  await adult;
  await blocked;
  expect(port.att).not.toHaveBeenCalled();
  expect(port.initialize).not.toHaveBeenCalled();
  expect(useConsent.getState()).toMatchObject({ age: 'blocked', status: 'idle' });
});
it('native UMP reads consent purposes and forwards TFUA without account or birth data', async () => {
  jest.mocked(AdsConsent.gatherConsent).mockResolvedValue({
    canRequestAds: true,
    status: AdsConsentStatus.OBTAINED,
    privacyOptionsRequirementStatus: AdsConsentPrivacyOptionsRequirementStatus.REQUIRED,
    isConsentFormAvailable: true,
  });
  jest.mocked(AdsConsent.getUserChoices).mockResolvedValue({
    storeAndAccessInformationOnDevice: true,
    createAPersonalisedAdsProfile: false,
    selectPersonalisedAds: false,
  } as Awaited<ReturnType<typeof AdsConsent.getUserChoices>>);
  expect(await nativeConsent.gather(true)).toEqual({
    canRequest: true,
    personalized: false,
    privacyRequired: true,
  });
  expect(AdsConsent.gatherConsent).toHaveBeenLastCalledWith({ tagForUnderAgeOfConsent: true });
});
