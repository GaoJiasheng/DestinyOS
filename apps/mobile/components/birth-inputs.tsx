import type { ReactNode, RefObject } from 'react';
import { Pressable, Text, TextInput, View, Keyboard, type KeyboardTypeOptions } from 'react-native';
import { nativeTypography as type, corner } from '@tianji/ui-core/tokens';
import { useCopy } from '../lib/copy';
import { useTheme } from '../lib/theme';
import type { BirthField, FieldIssue } from '../lib/birth-form';
import type { MessageKey } from '../lib/i18n';
/** Inline, field-level reason shown directly under the control it belongs to. */
export function FieldErrors({ issues, field }: { issues: FieldIssue[]; field: BirthField }) {
  const t = useCopy();
  const { colors, body } = useTheme();
  const mine = issues.filter((issue) => issue.field === field);
  if (!mine.length) return null;
  return (
    <View testID={`birth-error-${field}`} accessibilityLiveRegion="polite">
      {mine.map((issue) => (
        <Text
          key={issue.key}
          allowFontScaling
          accessibilityRole="alert"
          style={{
            color: colors.danger,
            fontFamily: body,
            fontSize: type.body,
            lineHeight: type.body * type.leading,
          }}
        >
          {t(issue.key, issue.params)}
        </Text>
      ))}
    </View>
  );
}
/** Labeled text entry with blur reporting, an optional clear button and an inline error slot. */
export function TextEntry({
  id,
  label,
  value,
  onChange,
  onBlur,
  placeholder,
  maxLength,
  keyboardType = 'default',
  invalid = false,
  inputRef,
  clearLabel,
  onClear,
  children,
  errorHint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  maxLength?: number;
  keyboardType?: KeyboardTypeOptions;
  invalid?: boolean;
  inputRef?: RefObject<TextInput | null>;
  clearLabel?: MessageKey;
  onClear?: () => void;
  children?: ReactNode;
  errorHint?: string;
}) {
  const t = useCopy();
  const { colors, body } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text
        allowFontScaling
        style={{
          color: colors['text-2'],
          fontFamily: body,
          fontSize: type.body,
          lineHeight: type.body * type.leading,
        }}
      >
        {label}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <TextInput
          ref={inputRef}
          testID={id}
          accessibilityLabel={label}
          accessibilityHint={invalid ? errorHint : undefined}
          value={value}
          onChangeText={onChange}
          onBlur={onBlur}
          placeholder={placeholder}
          placeholderTextColor={colors['text-2']}
          maxLength={maxLength}
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={Keyboard.dismiss}
          autoCapitalize="none"
          keyboardType={keyboardType}
          style={{
            flex: 1,
            minHeight: 48,
            borderWidth: 1,
            borderColor: invalid ? colors.danger : colors['line-2'],
            borderRadius: corner('r-md'),
            padding: 12,
            color: colors['text-1'],
            fontFamily: body,
            fontSize: type.body,
          }}
        />
        {onClear && value ? (
          <Pressable
            testID={`${id}-clear`}
            accessibilityRole="button"
            accessibilityLabel={t(clearLabel ?? 'form.birth.city.clearLabel')}
            onPress={onClear}
            hitSlop={4}
            style={{ minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text allowFontScaling style={{ color: colors['text-1'], fontFamily: body }}>
              {t('form.birth.city.clear')}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}
