import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import {
  nativeTypography as type,
  mobileGeometry as geometry,
  spacing,
  corner,
} from '@tianji/ui-core/tokens';
import { useTheme } from '../lib/theme';
import type { MessageKey } from '../lib/i18n';
import type { ReactNode } from 'react';
/** Empty route scaffold with a translated title and entertainment disclaimer. */
export function EmptyScreen({ title, children }: { title: MessageKey; children?: ReactNode }) {
  const { t } = useTranslation();
  const { colors, heading, body } = useTheme();
  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={{ flex: 1, backgroundColor: colors['bg-0'] }}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <Text
          accessibilityRole="header"
          style={{ fontFamily: heading, fontSize: type.h1, color: colors['text-1'] }}
        >
          {t(title)}
        </Text>
        <View
          style={[
            styles.empty,
            { backgroundColor: colors['surface-1'], borderColor: colors['line-1'] },
          ]}
        >
          <Text style={{ color: colors['gold-soft'], fontFamily: body, fontSize: type.h3 }}>
            {t('common.comingSoon.title')}
          </Text>
        </View>
        {children}
        <Text
          style={{
            color: colors['text-2'],
            fontFamily: body,
            fontSize: type.caption,
            lineHeight: type.caption * type.leading,
          }}
        >
          {t('report.disclaimer.short')}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: spacing('space-6'), gap: spacing('space-6') },
  empty: {
    minHeight: geometry.emptyHeight,
    borderWidth: geometry.border,
    borderRadius: corner('r-lg'),
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing('space-5'),
  },
});
