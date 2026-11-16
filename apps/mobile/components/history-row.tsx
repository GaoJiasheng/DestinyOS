import { Alert, Pressable, Text, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { useCopy } from '../lib/copy';
import { useTheme } from '../lib/theme';
import { nativeTypography as type, spacing, corner } from '@tianji/ui-core/tokens';
import { Action } from './native-ui';

/**
 * One history row. Swipe-left reveals delete; screen reader and reduced-motion users get the same
 * action as a custom accessibility action plus a visible button, so the gesture is never the only way.
 */
export function HistoryRow({
  id,
  label,
  simple,
  onOpen,
  onDelete,
}: {
  id: string;
  label: string;
  /** True when swiping should be replaced by an always-visible delete button. */
  simple: boolean;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const t = useCopy(),
    { colors, body } = useTheme();
  const confirm = () =>
    Alert.alert(t('report.delete'), t('report.deleteConfirm'), [
      { text: t('profiles.cancel'), style: 'cancel' },
      { text: t('report.delete'), style: 'destructive', onPress: onDelete },
    ]);
  const deleteLabel = t('mobile.history.deleteItem', { label });
  const row = (
    <Pressable
      testID={`history-${id}`}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityActions={[{ name: 'delete', label: t('mobile.history.delete') }]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === 'delete') confirm();
      }}
      onPress={onOpen}
      style={{
        minHeight: 48,
        justifyContent: 'center',
        padding: spacing('space-4'),
        borderRadius: corner('r-md'),
        borderWidth: 1,
        borderColor: colors['line-1'],
        backgroundColor: colors['surface-1'],
      }}
    >
      <Text
        allowFontScaling
        style={{ color: colors['text-1'], fontFamily: body, fontSize: type.body }}
      >
        {label}
      </Text>
    </Pressable>
  );
  if (simple)
    return (
      <View style={{ gap: 8 }}>
        {row}
        <Action id={`history-delete-${id}`} label={deleteLabel} onPress={confirm} />
      </View>
    );
  return (
    <ReanimatedSwipeable
      overshootRight={false}
      renderRightActions={(_progress, _translation, methods) => (
        <Pressable
          testID={`history-delete-${id}`}
          accessibilityRole="button"
          accessibilityLabel={deleteLabel}
          onPress={() => {
            methods.close();
            confirm();
          }}
          style={{
            minWidth: 88,
            minHeight: 48,
            marginLeft: 8,
            justifyContent: 'center',
            alignItems: 'center',
            borderRadius: corner('r-md'),
            backgroundColor: colors['line-1'],
          }}
        >
          <Text
            allowFontScaling
            style={{ color: colors['text-1'], fontFamily: body, fontSize: type.body }}
          >
            {t('mobile.history.delete')}
          </Text>
        </Pressable>
      )}
    >
      {row}
    </ReanimatedSwipeable>
  );
}
