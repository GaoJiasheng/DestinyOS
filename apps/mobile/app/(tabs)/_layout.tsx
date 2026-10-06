import {
  nativeTypography as type,
  mobileGeometry as geometry,
  spacing,
  corner,
} from '@tianji/ui-core/tokens';
import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../lib/theme';
// DESIGN-GAP: reading/ask are native tab container routes; M05 will present the documented ask sheet.
const tabs = [
  ['today', 'nav.today', '☀︎'],
  ['reading', 'nav.reading', '◇'],
  ['ask', 'nav.ask', '✦'],
  ['learn', 'nav.learn', '☷'],
  ['me', 'nav.me', '○'],
] as const;
/** Five documented native tabs, with a raised central ask entry. */
export default function TabLayout() {
  const { t } = useTranslation();
  const { colors, body } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors['text-2'],
        tabBarStyle: { backgroundColor: colors['bg-1'], borderTopColor: colors['line-1'] },
        tabBarLabelStyle: { fontFamily: body, fontSize: type.caption },
      }}
    >
      {tabs.map(([name, key, symbol]) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title: t(key),
            tabBarButtonTestID: `tab-${name}`,
            tabBarIcon: ({ color }) => (
              <Text
                accessible={false}
                style={{
                  color,
                  fontSize: name === 'ask' ? geometry.askIcon : geometry.icon,
                  ...(name === 'ask'
                    ? {
                        backgroundColor: colors['surface-2'],
                        borderColor: colors.gold,
                        borderWidth: geometry.border,
                        borderRadius: corner('r-pill'),
                        width: spacing('space-9'),
                        height: spacing('space-9'),
                        textAlign: 'center',
                        marginTop: -spacing('space-4'),
                      }
                    : {}),
                }}
              >
                {symbol}
              </Text>
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
