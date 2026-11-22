import { useEffect, useRef, type ReactNode, type RefObject, type ComponentProps } from 'react';
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
  contentKey,
}: {
  title: MessageKey;
  children: ReactNode;
  footer?: ReactNode;
  scrollRef?: RefObject<ScrollView | null>;
  scroll?: boolean;
  /** Changing it starts a fresh scroll view at the top, while the safe-area and keyboard
   * containers stay mounted (remounting those re-measures insets and shifts the page). */
  contentKey?: string | number;
}) {
  const { colors } = useTheme();
  const t = useCopy();
  const heading = useRef<Text>(null);
  useEffect(() => focusHeading(heading), [title]);
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors['bg-0'] }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        // Android edge-to-edge no longer resizes the window for the keyboard, so shrink the page.
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {scroll ? (
          <ScrollView
            key={contentKey}
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
type InputProps = ComponentProps<typeof TextInput>;
/** Labeled native text entry; personal values stay inside component state and encrypted storage. */
export function Field({
  label,
  value,
  onChange,
  id,
  numeric = false,
  placeholder,
  maxLength,
  multiline = false,
  keyboardType,
  onSubmit,
  returnKeyType,
  textContentType,
  autoComplete,
  editable,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  id: string;
  /** Legacy shortcut for signed decimals; prefer keyboardType="number-pad" for whole numbers. */
  numeric?: boolean;
  placeholder?: string;
  maxLength?: number;
  /** Wraps long text; without onSubmit, Return inserts a new line. */
  multiline?: boolean;
  keyboardType?: InputProps['keyboardType'];
  /** Return submits instead of only dismissing the keyboard (also for multiline fields). */
  onSubmit?: () => void;
  returnKeyType?: InputProps['returnKeyType'];
  textContentType?: InputProps['textContentType'];
  autoComplete?: InputProps['autoComplete'];
  editable?: boolean;
}) {
  const { colors, body } = useTheme();
  // Android has no numbers-and-punctuation keyboard; "numeric" there still allows sign and decimal.
  const legacyNumeric = Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric';
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
        multiline={multiline}
        editable={editable}
        returnKeyType={returnKeyType ?? (multiline && !onSubmit ? 'default' : 'done')}
        submitBehavior={multiline ? (onSubmit ? 'submit' : 'newline') : 'blurAndSubmit'}
        onSubmitEditing={onSubmit ?? Keyboard.dismiss}
        autoCapitalize="none"
        keyboardType={keyboardType ?? (numeric ? legacyNumeric : 'default')}
        textContentType={textContentType}
        autoComplete={autoComplete}
        style={{
          minHeight: multiline ? 96 : 48,
          borderWidth: 1,
          borderColor: colors['line-2'],
          borderRadius: corner('r-md'),
          padding: 12,
          color: colors['text-1'],
          fontFamily: body,
          fontSize: type.body,
          textAlignVertical: multiline ? 'top' : 'center',
        }}
      />
    </View>
  );
}
