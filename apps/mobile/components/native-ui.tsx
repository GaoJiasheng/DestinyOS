import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { focusHeading } from '../lib/accessibility';
import {
  Pressable,
  Text,
  TextInput,
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  AccessibilityInfo,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { nativeTypography as type, spacing, corner } from '@tianji/ui-core/tokens';
import { useCopy } from '../lib/copy';
import type { MessageKey } from '../lib/i18n';
import { useTheme } from '../lib/theme';

/** Accessible native text with design token fonts and dynamic system scaling. */
export function CopyText({
  children,
  title = false,
  testID,
  textRef,
  status = false,
}: {
  children: ReactNode;
  title?: boolean;
  testID?: string;
  textRef?: RefObject<Text | null>;
  status?: boolean;
}) {
  const { colors, body, heading } = useTheme();
  useEffect(() => {
    if (status && typeof children === 'string' && Platform.OS === 'ios')
      AccessibilityInfo.announceForAccessibility(children);
  }, [children, status]);
  return (
    <Text
      ref={textRef}
      allowFontScaling
      accessibilityLiveRegion={status ? 'polite' : undefined}
      testID={testID}
      accessibilityRole={title ? 'header' : undefined}
      style={{
        color: colors[title ? 'text-1' : 'text-2'],
        fontFamily: title ? heading : body,
        fontSize: title ? type.h2 : type.body,
        lineHeight: (title ? type.h2 : type.body) * type.leading,
      }}
    >
      {children}
    </Text>
  );
}
/** Scrollable native screen with keyboard avoidance and persistent entertainment notice. */
export function Page({
  title,
  children,
  footer,
  scrollRef,
  scroll = true,
}: {
  title: MessageKey;
  children: ReactNode;
  footer?: ReactNode;
  scrollRef?: RefObject<ScrollView | null>;
  scroll?: boolean;
}) {
  const { colors } = useTheme();
  const t = useCopy();
  const heading = useRef<Text>(null);
  useEffect(() => focusHeading(heading), [title]);
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors['bg-0'] }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {scroll ? (
          <ScrollView
            ref={scrollRef}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={{
              padding: spacing('space-6'),
              gap: spacing('space-5'),
              flexGrow: 1,
            }}
          >
            <CopyText title textRef={heading}>
              {t(title)}
            </CopyText>
            {children}
            <CopyText>{t('report.disclaimer.short')}</CopyText>
          </ScrollView>
        ) : (
          <View style={{ flex: 1, padding: spacing('space-6'), gap: spacing('space-4') }}>
            <CopyText title textRef={heading}>
              {t(title)}
            </CopyText>
            {children}
            <CopyText>{t('report.disclaimer.short')}</CopyText>
          </View>
        )}
        {footer && (
          <View style={{ padding: 16, gap: 12, backgroundColor: colors['bg-1'] }}>{footer}</View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
/** Native button/radio with at least a 48pt touch target and a translated accessible label. */
export function Action({
  label,
  onPress,
  id,
  disabled = false,
  selected,
  children,
}: {
  label: string;
  onPress: () => void;
  id?: string;
  disabled?: boolean;
  selected?: boolean;
  children?: ReactNode;
}) {
  const { colors, body } = useTheme();
  return (
    <Pressable
      testID={id}
      accessibilityRole={selected === undefined ? 'button' : 'radio'}
      accessibilityLabel={label}
      accessibilityState={{ disabled, ...(selected === undefined ? {} : { checked: selected }) }}
      disabled={disabled}
      onPress={onPress}
      style={{
        minWidth: 48,
        minHeight: 48,
        justifyContent: 'center',
        padding: spacing('space-4'),
        borderRadius: corner('r-md'),
        borderWidth: 1,
        borderColor: selected ? colors.gold : colors['line-1'],
        backgroundColor: colors['surface-1'],
        opacity: disabled ? 0.45 : 1,
      }}
    >
      <Text
        allowFontScaling
        style={{ color: colors['text-1'], fontFamily: body, fontSize: type.body }}
      >
        {label}
      </Text>
      {children}
    </Pressable>
  );
}
/** Labeled native text entry; personal values stay inside component state and encrypted storage. */
export function Field({
  label,
  value,
  onChange,
  id,
  numeric = false,
  placeholder,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  id: string;
  numeric?: boolean;
  placeholder?: string;
  maxLength?: number;
}) {
  const { colors, body } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <CopyText>{label}</CopyText>
      <TextInput
        testID={id}
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors['text-2']}
        maxLength={maxLength}
        autoCorrect={false}
        returnKeyType="done"
        onSubmitEditing={Keyboard.dismiss}
        autoCapitalize="none"
        keyboardType={numeric ? 'numbers-and-punctuation' : 'default'}
        style={{
          minHeight: 48,
          borderWidth: 1,
          borderColor: colors['line-2'],
          borderRadius: corner('r-md'),
          padding: 12,
          color: colors['text-1'],
          fontFamily: body,
          fontSize: type.body,
        }}
      />
    </View>
  );
}
