import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { usePreferences } from '../lib/preferences';
import {
  nativeTypography as type,
  mobileGeometry as geometry,
  spacing,
  corner,
} from '@tianji/ui-core/tokens';
import { useTheme } from '../lib/theme';
import { locales } from '../lib/i18n';
/** Accessible controls for the three documented palettes and shared catalog locales. */
export function Preferences() {
  const { t } = useTranslation();
  const { colors, body } = useTheme();
  const { theme, locale, setTheme, setLocale } = usePreferences();
  // DESIGN-GAP: Native settings use wrapped radio buttons; selected borders preview the active accent.
  const button = {
    padding: spacing('space-4'),
    borderWidth: geometry.border,
    borderRadius: corner('r-md'),
    borderColor: colors['line-2'],
    backgroundColor: colors['surface-1'],
  };
  const text = { color: colors['text-1'], fontFamily: body, fontSize: type.body };
  return (
    <View style={{ gap: spacing('space-4') }}>
      <Text style={text}>{t('nav.theme')}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing('space-2') }}>
        {(['auto', 'east', 'west', 'vedic'] as const).map((value) => (
          <Pressable
            key={value}
            accessibilityRole="radio"
            accessibilityState={{ checked: theme === value }}
            testID={`theme-${value}`}
            onPress={() => setTheme(value)}
            style={[button, theme === value && { borderColor: colors.accent }]}
          >
            <Text style={text}>{t(`nav.theme.${value}`)}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={text}>{t('nav.language')}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing('space-2') }}>
        {locales.map((value) => (
          <Pressable
            key={value}
            accessibilityRole="radio"
            accessibilityState={{ checked: locale === value }}
            testID={`locale-${value}`}
            onPress={() => setLocale(value)}
            style={[button, locale === value && { borderColor: colors.accent }]}
          >
            <Text style={text}>{t(`nav.locale.${value}`)}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
