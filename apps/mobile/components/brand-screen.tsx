import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { brand } from '@tianji/shared/brand';
import {
  designTokens,
  points,
  nativeTypography as type,
  mobileGeometry as geometry,
  spacing,
  corner,
} from '@tianji/ui-core/tokens';
import { useTheme, radius } from '../lib/theme';
import { usePreferences } from '../lib/preferences';
/** Brand entry for the scaffold; M05 implements the complete onboarding sequence. */
export function BrandScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors, body } = useTheme();
  const locale = usePreferences((state) => state.locale);
  // DESIGN-GAP: A static token-colored star layer gives M01 a reduced-motion-safe brand screen; M02 owns Skia effects.
  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors['bg-0'] }]}>
      <View
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {Array.from({ length: geometry.stars }, (_, i) => (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: `${(i * 37 + 11) % 100}%`,
              top: `${(i * 19 + 3) % 100}%`,
              width: i % 5 === 0 ? geometry.starBright : geometry.starSmall,
              height: i % 5 === 0 ? geometry.starBright : geometry.starSmall,
              borderRadius: radius,
              backgroundColor: colors['gold-soft'],
              opacity: i % 3 === 0 ? 0.6 : 0.25,
            }}
          />
        ))}
      </View>
      <View style={styles.center}>
        <Text style={[styles.eyebrow, { color: colors['gold-soft'], fontFamily: body }]}>
          {t('home.eyebrow')}
        </Text>
        <View style={[styles.orbit, { borderColor: colors['line-2'] }]}>
          <View style={[styles.innerOrbit, { borderColor: colors.gold }]}>
            <Text style={{ color: colors.gold, fontSize: type.ganzhi }}>✦</Text>
          </View>
        </View>
        <Text
          accessibilityRole="header"
          style={[styles.brand, { color: colors['text-1'], fontFamily: 'WenKai' }]}
        >
          {t('brand.nameZh', { name: locale === 'zh-TW' ? brand.nameZhTW : brand.nameZh })}
        </Text>
        <Text style={[styles.english, { color: colors['gold-soft'], fontFamily: 'Cinzel' }]}>
          {t('brand.nameEn', { name: brand.nameEn })}
        </Text>
        <Text style={[styles.tagline, { color: colors['text-2'], fontFamily: body }]}>
          {t('brand.tagline')}
        </Text>
      </View>
      <View style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          testID="brand-start"
          onPress={() => router.replace('/today')}
          style={[styles.button, { backgroundColor: colors.accent }]}
        >
          <Text
            style={{
              color:
                colors.accent === colors.gold ? colors['bg-0'] : designTokens.extra['on-accent'],
              fontFamily: body,
              fontSize: type.body,
            }}
          >
            {t('home.cta.today')}
          </Text>
        </Pressable>
        <Text style={[styles.disclaimer, { color: colors['text-2'], fontFamily: body }]}>
          {t('report.disclaimer.short')}
        </Text>
      </View>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: points(designTokens.spacing['space-7']) },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: points(designTokens.spacing['space-5']),
  },
  eyebrow: {
    fontSize: type.small,
    letterSpacing: type.small * points(designTokens.extra['tracking-eyebrow']),
  },
  orbit: {
    width: geometry.orbit,
    height: geometry.orbit,
    borderWidth: geometry.border,
    borderRadius: corner('r-pill'),
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing('space-6'),
  },
  innerOrbit: {
    width: geometry.innerOrbit,
    height: geometry.innerOrbit,
    borderWidth: geometry.border,
    borderRadius: corner('r-pill'),
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: {
    fontSize: points(designTokens.typography['size-ganzhi']),
    letterSpacing: type.ganzhi * points(designTokens.extra['tracking-brand']),
  },
  english: {
    fontSize: type.h2,
    letterSpacing: type.h2 * points(designTokens.typography['tracking-west']),
  },
  tagline: { fontSize: type.body, textAlign: 'center', lineHeight: type.body * type.leading },
  footer: { gap: spacing('space-6'), paddingBottom: spacing('space-6') },
  button: {
    minHeight: points(designTokens.motion['button-height']),
    borderRadius: corner('r-pill'),
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing('space-4'),
  },
  disclaimer: {
    fontSize: type.caption,
    lineHeight: type.caption * type.leading,
    textAlign: 'center',
  },
});
