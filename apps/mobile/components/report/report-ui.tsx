import { Modal, View, ScrollView, Text, Pressable, type LayoutChangeEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ReactNode } from 'react';
import { useCopy } from '../../lib/copy';
import { useTheme } from '../../lib/theme';
import { usePreferences } from '../../lib/preferences';
import { resources, type MessageKey } from '../../lib/i18n';
import { CopyText, Action } from '../native-ui';
import type { ChartLabel } from '../../lib/reports/chart-scene';
import { useCallback, useRef } from 'react';
import { focusHeading, useReducedMotion } from '../../lib/accessibility';
import { bundledKnowledge } from '../../lib/knowledge/bundled';
import { sourceLocale, localeText } from '@tianji/shared/locale';
import { dataPathLabel, dataValueLabel } from '../../lib/reports/data-labels';

/** Localized dynamic catalog access, retaining source keys and next-intl for every value. */
export function useChartLabel(): ChartLabel {
  const t = useCopy();
  const locale = usePreferences((s) => s.locale);
  return useCallback(
    (key, fallback, values) => {
      if (key === 'report.content') return t('report.content', { text: fallback ?? '' });
      if (key in resources[locale].translation) return t(key as MessageKey, values);
      const glossaryKey = /^glossary\.(.+)\.term$/.exec(key)?.[1];
      if (glossaryKey) {
        const entry = bundledKnowledge().glossary.find((g) => g.key === glossaryKey);
        if (entry)
          return t('report.content', {
            text: localeText(entry[sourceLocale(locale)].term, locale),
          });
      }
      // DESIGN-GAP: Technical schema fields without a documented label are displayed as their
      // exact code through report.content; this also keeps professional metadata auditable.
      return t('report.content', { text: fallback ?? key });
    },
    [locale, t],
  );
}
/** Native card uses the same palette/spacing as the common report shell. */
export function ReportCard({
  children,
  id,
  onLayout,
}: {
  children: ReactNode;
  id?: string;
  onLayout?: (event: LayoutChangeEvent) => void;
}) {
  const { colors } = useTheme();
  return (
    <View
      testID={id}
      onLayout={onLayout}
      style={{
        backgroundColor: colors['surface-1'],
        borderColor: colors['line-1'],
        borderWidth: 1,
        borderRadius: 16,
        padding: 16,
        gap: 12,
      }}
    >
      {children}
    </View>
  );
}
/** Modal bottom sheet with an explicit close control, system back handling and scrolling. */
export function ReportSheet({
  title,
  children,
  close,
  id = 'report-sheet',
}: {
  title: string;
  children: ReactNode;
  close: () => void;
  id?: string;
}) {
  const { colors } = useTheme(),
    t = useCopy();
  const heading = useRef<Text>(null);
  const reduced = useReducedMotion();
  return (
    <Modal
      visible
      animationType={reduced ? 'none' : 'slide'}
      onShow={() => focusHeading(heading)}
      transparent
      onRequestClose={close}
    >
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000088' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          onPress={close}
          style={{ flex: 1 }}
        />
        <SafeAreaView
          edges={['bottom']}
          testID={id}
          accessibilityViewIsModal
          style={{
            maxHeight: '78%',
            backgroundColor: colors['bg-1'],
            padding: 20,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
          }}
        >
          <ScrollView contentContainerStyle={{ gap: 16, paddingBottom: 12 }}>
            <CopyText title textRef={heading}>
              {title}
            </CopyText>
            {children}
          </ScrollView>
          <Action id="report-sheet-close" label={t('common.close')} onPress={close} />
        </SafeAreaView>
      </View>
    </Modal>
  );
}
/** Bilingual technical data tree: complete tables remain selectable and accessible to VoiceOver. */
export function DataTree({
  value,
  path = '',
  depth = 0,
  professional = false,
}: {
  value: unknown;
  path?: string;
  depth?: number;
  professional?: boolean;
}) {
  const locale = usePreferences((s) => s.locale);
  const t = useChartLabel(),
    { colors, body } = useTheme();
  const displayPath = professional ? path : dataPathLabel(path, t);
  if (value === null || typeof value !== 'object') {
    const text = professional
      ? t('report.content', String(value))
      : dataValueLabel(value, path, locale, t, resources[locale].translation, bundledKnowledge());
    return (
      <Text
        selectable
        style={{ color: colors['text-2'], fontFamily: body, fontSize: 15, lineHeight: 23 }}
      >
        {t('report.content', `${displayPath}: ${text}`)}
      </Text>
    );
  }
  return (
    <View
      style={{
        gap: 5,
        paddingLeft: depth ? 8 : 0,
        borderLeftWidth: depth ? 1 : 0,
        borderColor: colors['line-1'],
      }}
    >
      {Object.entries(value).map(([key, child]) => (
        <View key={key} style={{ gap: 4 }}>
          {child !== null && typeof child === 'object' ? (
            <CopyText>
              {t(
                'report.content',
                professional
                  ? path
                    ? `${path}.${key}`
                    : key
                  : dataPathLabel(path ? `${path}.${key}` : key, t),
              )}
            </CopyText>
          ) : null}
          <DataTree
            value={child}
            path={path ? `${path}.${key}` : key}
            depth={depth + 1}
            professional={professional}
          />
        </View>
      ))}
    </View>
  );
}
