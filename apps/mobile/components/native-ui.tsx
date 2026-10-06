import type { ReactNode } from 'react';
import {
  Pressable,
  Text,
  TextInput,
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
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
}: {
  children: ReactNode;
  title?: boolean;
  testID?: string;
}) {
  const { colors, body, heading } = useTheme();
  return (
    <Text
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
export function Page({ title, children }: { title: MessageKey; children: ReactNode }) {
  const { colors } = useTheme();
  const t = useCopy();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors['bg-0'] }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{
            padding: spacing('space-6'),
            gap: spacing('space-5'),
            flexGrow: 1,
          }}
        >
          <CopyText title>{t(title)}</CopyText>
          {children}
          <CopyText>{t('report.disclaimer.short')}</CopyText>
        </ScrollView>
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
      <Text style={{ color: colors['text-1'], fontFamily: body, fontSize: type.body }}>
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
