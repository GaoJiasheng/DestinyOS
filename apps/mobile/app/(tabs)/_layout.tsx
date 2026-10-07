import {
  nativeTypography as type,
  mobileGeometry as geometry,
  spacing,
  corner,
} from '@tianji/ui-core/tokens';
import { Tabs } from 'expo-router';
import { useState } from 'react';
import { AskSheet } from '../../components/ask-sheet';
import { useCopy } from '../../lib/copy';
import { Text, useWindowDimensions } from 'react-native';
import { useTheme } from '../../lib/theme';
const tabs = [
  ['today', 'nav.today', '☀︎'],
  ['reading', 'nav.reading', '◇'],
  ['ask', 'nav.ask', '✦'],
  ['learn', 'nav.learn', '☷'],
  ['me', 'nav.me', '○'],
] as const;
/** Five documented native tabs, with a raised central ask entry. */
export default function TabLayout() {
  const t = useCopy();
  const { fontScale } = useWindowDimensions();
  const [askOpen, setAskOpen] = useState(false);
  const { colors, body } = useTheme();
  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarAllowFontScaling: true,
          tabBarActiveTintColor: colors.gold,
          tabBarInactiveTintColor: colors['text-2'],
          tabBarStyle: {
            height: 60 + 24 * fontScale,
            backgroundColor: colors['bg-1'],
            borderTopColor: colors['line-1'],
          },
          tabBarLabelStyle: { fontFamily: body, fontSize: type.caption },
        }}
      >
        {tabs.map(([name, key, symbol]) => (
          <Tabs.Screen
            key={name}
            name={name}
            listeners={
              name === 'ask'
                ? {
                    tabPress: (event) => {
                      event.preventDefault();
                      setAskOpen(true);
                    },
                  }
                : undefined
            }
            options={{
              title: t(key),
              tabBarAccessibilityLabel: t(key),
              tabBarButtonTestID: `tab-${name}`,
              tabBarIcon: ({ color }) => (
                <Text
                  accessible={false}
                  allowFontScaling={false}
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
      <AskSheet open={askOpen} onClose={() => setAskOpen(false)} />
    </>
  );
}
