import { useEffect, useState } from 'react';
import { Text, Image, View } from 'react-native';
import {
  NativeAd,
  NativeAdView,
  NativeAsset,
  NativeAssetType,
  NativeMediaView,
  TestIds,
} from 'react-native-google-mobile-ads';
import { useBilling } from '../lib/monetization/billing';
import { useConsent } from '../lib/monetization/consent';
import { useCopy } from '../lib/copy';
import { useTheme } from '../lib/theme';
import { useProfiles } from '../lib/profiles';
import { adAge } from '../lib/monetization/ad-policy';
/** Native-only test inventory. No placement outside Today/reports and no user targeting payloads. */
export function NativeAdCard({ slot }: { slot: 0 | 1 }) {
  const billing = useBilling(),
    consent = useConsent();
  const { profiles, settings, loading, error } = useProfiles();
  const age = loading || error ? 'blocked' : adAge(profiles, settings.ageBlocked);
  const allowed =
    billing.status === 'ready' &&
    !billing.access.pro &&
    consent.status === 'ready' &&
    consent.age === age &&
    age !== 'blocked';
  if (!allowed) return null;
  // Remount destroys loaded inventory immediately when rights/consent/age changes.
  return (
    <LoadedNativeAd
      key={`${billing.userId}-${age}-${consent.nonPersonalized}`}
      slot={slot}
      nonPersonalized={age !== 'adult' || consent.nonPersonalized}
    />
  );
}
function LoadedNativeAd({ slot, nonPersonalized }: { slot: 0 | 1; nonPersonalized: boolean }) {
  const [ad, setAd] = useState<NativeAd | null>(null);
  const t = useCopy(),
    { colors, body } = useTheme();
  useEffect(() => {
    let active = true;
    let loaded: NativeAd | undefined;
    void NativeAd.createForAdRequest(TestIds.NATIVE, {
      requestNonPersonalizedAdsOnly: nonPersonalized,
    })
      .then((value) => {
        if (!active) {
          value.destroy();
          return;
        }
        loaded = value;
        setAd(value);
      })
      .catch(() => undefined);
    // DESIGN-GAP: No-fill and failed loads collapse the independent container; never refresh automatically or invent placeholder ads.
    return () => {
      active = false;
      loaded?.destroy();
    };
  }, [nonPersonalized]);
  if (!ad) return null;
  const text = { color: colors['text-1'], fontFamily: body, fontSize: 16 };
  // DESIGN-GAP: Keep padding on an inner layout so Fabric's native ad bounds contain every asset and the SDK AdChoices overlay.
  return (
    <NativeAdView
      nativeAd={ad}
      testID={`native-ad-${slot}`}
      style={{ backgroundColor: colors['surface-1'], borderRadius: 16 }}
    >
      <View style={{ padding: 16, gap: 12 }}>
        <Text style={{ ...text, paddingRight: 32, fontSize: 12 }}>
          {t('mobile.billing.adLabel')}
        </Text>
        {ad.icon && (
          <NativeAsset assetType={NativeAssetType.ICON}>
            <Image source={{ uri: ad.icon.url }} style={{ width: 40, height: 40 }} />
          </NativeAsset>
        )}
        <NativeAsset assetType={NativeAssetType.HEADLINE}>
          <Text style={text}>{t('report.content', { text: ad.headline })}</Text>
        </NativeAsset>
        {ad.body && (
          <NativeAsset assetType={NativeAssetType.BODY}>
            <Text style={text}>{t('report.content', { text: ad.body })}</Text>
          </NativeAsset>
        )}
        <NativeMediaView style={{ width: '100%', height: 180 }} resizeMode="contain" />
        {ad.callToAction && (
          <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}>
            <Text style={{ ...text, color: colors.gold, padding: 12 }}>
              {t('report.content', { text: ad.callToAction })}
            </Text>
          </NativeAsset>
        )}
      </View>
    </NativeAdView>
  );
}
