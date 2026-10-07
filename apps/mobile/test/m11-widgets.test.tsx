import { View as MockView, Text as MockText } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { FortuneWidget } from '../native/android/widget';
import { WidgetSnapshotSchema, type WidgetSnapshot } from '../lib/engagement/planner';
jest.mock('expo-crypto', () => ({}));
jest.mock('../lib/knowledge', () => ({}));
jest.mock('../lib/data/store', () => ({}));
jest.mock('../lib/engagement/widget-storage', () => ({}));
jest.mock('../lib/reports/tarot-images', () => ({ tarotImages: { major_00_fool: 1 } }));
jest.mock('react-native-android-widget', () => ({
  FlexWidget: ({
    children,
    clickActionData,
  }: {
    children: React.ReactNode;
    clickActionData?: { uri: string };
  }) => <MockView accessibilityLabel={clickActionData?.uri}>{children}</MockView>,
  TextWidget: ({ text }: { text: string }) => <MockText>{text}</MockText>,
  ImageWidget: () => <MockView testID="card-thumbnail" />,
}));
const snapshot: WidgetSnapshot = {
  version: 1,
  locale: 'en',
  stale: 'Refresh today',
  days: [
    {
      startsAt: 0,
      expiresAt: Date.now() + 86400000,
      date: '2026-10-07',
      title: 'Today',
      line: 'Take a breath',
      stars: '★★★★☆',
      dimensions: ['Career ★★★★☆', 'Wealth ★★★☆☆', 'Love ★★★☆☆', 'Health ★★★☆☆', 'Social ★★★☆☆'],
      color: 'Lucky color · Red',
      colorHex: '#aa0000',
      numbers: 'Lucky number · 2 / 7',
      hours: 'Good hours · 09:00–11:00',
      card: 'major_00_fool',
      cardReversed: false,
      cardLabel: 'Daily card',
      url: 'tianji:///today',
      background: '#0b0d17',
      foreground: '#eeeeee',
      accent: '#ccbb77',
    },
  ],
};
it('small/medium/large show documented fields and the daily deep link', () => {
  const small = render(<FortuneWidget snapshot={snapshot} size="small" />);
  expect(screen.getByText('★★★★☆')).toBeTruthy();
  expect(screen.queryByText('Career ★★★★☆')).toBeNull();
  expect(screen.queryByTestId('card-thumbnail')).toBeNull();
  expect(screen.getByLabelText('tianji:///today')).toBeTruthy();
  small.unmount();
  const medium = render(<FortuneWidget snapshot={snapshot} size="medium" />);
  expect(screen.getByText('Career ★★★★☆')).toBeTruthy();
  expect(screen.getByText('Lucky number · 2 / 7')).toBeTruthy();
  expect(screen.queryByTestId('card-thumbnail')).toBeNull();
  medium.unmount();
  render(<FortuneWidget snapshot={snapshot} size="large" />);
  expect(screen.getByTestId('card-thumbnail')).toBeTruthy();
  expect(screen.getByText(/Good hours/)).toBeTruthy();
});
it('expired snapshots hide stale scores and offer a refresh; empty links open the birth form', () => {
  const stale = render(<FortuneWidget snapshot={{ ...snapshot, days: [] }} size="large" />);
  expect(screen.getByText('Refresh today')).toBeTruthy();
  expect(screen.queryByText('★★★★☆')).toBeNull();
  stale.unmount();
  render(<FortuneWidget snapshot={null} size="small" />);
  expect(screen.getByLabelText('tianji:///me/birth')).toBeTruthy();
});
it('rejects unversioned or extra-sensitive fields at the native shared-storage boundary', () => {
  expect(WidgetSnapshotSchema.safeParse(snapshot).success).toBe(true);
  expect(WidgetSnapshotSchema.safeParse({ ...snapshot, birth: { year: 1990 } }).success).toBe(
    false,
  );
  expect(
    WidgetSnapshotSchema.safeParse({
      ...snapshot,
      days: [{ ...snapshot.days[0], profileId: 'secret' }],
    }).success,
  ).toBe(false);
  expect(WidgetSnapshotSchema.safeParse({ ...snapshot, version: 2 }).success).toBe(false);
});
