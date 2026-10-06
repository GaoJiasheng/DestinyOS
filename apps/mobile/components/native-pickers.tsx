import { View, Switch, Platform } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useTheme } from '../lib/theme';
import { CopyText } from './native-ui';
/** Theme-aware native wheels and switches shared by date and school controls. */
export function useNativePickers() {
  const { colors } = useTheme();
  function wheel(
    label: string,
    value: number | string,
    onChange: (value: number | string) => void,
    choices: { label: string; value: number | string }[],
    testID: string,
    enabled = true,
  ) {
    const height = Platform.OS === 'ios' ? 160 : 60;
    return (
      <View style={{ flex: 1, minWidth: 0 }}>
        <CopyText>{label}</CopyText>
        <Picker
          testID={testID}
          accessibilityLabel={label}
          selectedValue={value}
          onValueChange={onChange}
          enabled={enabled}
          style={{ color: colors['text-1'], height, width: '100%' }}
          // DESIGN-GAP: Match the iOS native wheel frame to its wrapper; the library's
          // default 216pt inner height otherwise overlaps adjacent fields/buttons.
          itemStyle={{ color: colors['text-1'], fontSize: 16, height, width: '100%' }}
        >
          {choices.map((choice) => (
            <Picker.Item
              key={choice.value}
              label={choice.label}
              value={choice.value}
              color={colors['text-1']}
            />
          ))}
        </Picker>
      </View>
    );
  }
  function toggle(
    label: string,
    value: boolean,
    onChange: (value: boolean) => void,
    testID: string,
    enabled = true,
  ) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <CopyText>{label}</CopyText>
        </View>
        <Switch
          testID={testID}
          accessibilityLabel={label}
          value={value}
          disabled={!enabled}
          onValueChange={onChange}
          trackColor={{ true: colors.gold }}
        />
      </View>
    );
  }
  return { wheel, toggle };
}
