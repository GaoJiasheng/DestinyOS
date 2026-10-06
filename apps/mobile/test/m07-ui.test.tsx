import { act, render, fireEvent, screen } from '@testing-library/react-native';
import { AppState, Alert } from 'react-native';
import { TarotRitual } from '../components/rituals/tarot-ritual';
import { IchingRitual } from '../components/rituals/iching-ritual';
import { QimenRitual } from '../components/rituals/qimen-ritual';
import { usePreferences } from '../lib/preferences';
import { SettingsSchema } from '../lib/data/models';
import { createNativeReading } from '../lib/reports/readings';
const mockStop = jest.fn();
const mockReplace = jest.fn(),
  mockBack = jest.fn(),
  mockDispatch = jest.fn(),
  mockFeedback = jest.fn();
let mockMethod = '',
  mockPrevent: ((input: { data: { action: { type: string } } }) => void) | undefined;
const mockSettings = SettingsSchema.parse({ tz: 'Asia/Singapore' });
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, back: mockBack }),
  useNavigation: () => ({ dispatch: mockDispatch }),
  useLocalSearchParams: () => ({ method: mockMethod }),
}));
jest.mock('expo-router/react-navigation', () => ({
  useIsFocused: () => true,
  usePreventRemove: (dirty: boolean, callback: typeof mockPrevent) => {
    mockPrevent = dirty ? callback : undefined;
  },
}));
jest.mock('expo-crypto', () => ({ randomUUID: () => '00000000-0000-4000-8000-000000000007' }));
jest.mock('../lib/profiles', () => ({
  useProfiles: () => ({
    active: null,
    settings: mockSettings,
    updateSettings: jest.fn(async () => undefined),
  }),
}));
jest.mock('../components/effects/motion', () => ({ useEffectsMotion: () => ({ active: true }) }));
jest.mock('../lib/rituals/feedback', () => ({
  useRitualFeedback: () => ({ feedback: mockFeedback, stop: mockStop }),
}));
jest.mock('../lib/rituals/frames', () => ({ useRitualFrames: jest.fn() }));
jest.mock('../lib/rituals/shake', () => ({ useShake: jest.fn() }));
jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker');
jest.mock('../lib/reports/readings', () => ({ createNativeReading: jest.fn() }));
jest.mock('../components/rituals/cast-stage', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    CoinThrow: () => null,
    RitualBurst: () => null,
    HexagramLines: () => null,
    HexagramResult: () => <View testID="ritual-hexagram" />,
    QimenLighting: () => <View testID="ritual-nine-palaces" />,
  };
});
jest.mock('../components/rituals/tarot-stage', () => {
  const { Pressable, View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    SpreadThumbnail: () => null,
    DeckStage: ({ onSplit, onPile }: { onSplit: () => void; onPile: (i: number) => void }) => (
      <View>
        <Pressable testID="test-drag-cut" onPress={onSplit} />
        {[0, 1, 2].map((i) => (
          <Pressable key={i} testID={`tarot-pile-${i}`} onPress={() => onPile(i)} />
        ))}
      </View>
    ),
    TarotFan: ({ onPick }: { onPick: (i: number) => void }) => (
      <Pressable testID="tarot-pick-77" onPress={() => onPick(77)} />
    ),
    RitualCard: ({ onFlip, index }: { onFlip: () => void; index: number }) => (
      <Pressable testID={`tarot-flip-${index}`} onPress={onFlip} />
    ),
  };
});
beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockMethod = '';
  mockPrevent = undefined;
  Object.assign(mockSettings, SettingsSchema.parse({ tz: 'Asia/Singapore' }));
  usePreferences.setState({ locale: 'zh', theme: 'auto' });
  Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active' });
});
afterEach(() => {
  jest.useRealTimers();
});
async function advance(ms = 10000) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
}
it('requires a shuffle, respects cut order/manual picks and waits for all flips before the result', async () => {
  render(<TarotRitual />);
  fireEvent.press(screen.getByTestId('tarot-begin'));
  expect(screen.getByTestId('tarot-next').props.accessibilityState.disabled).toBe(true);
  fireEvent.press(screen.getByTestId('tarot-shuffle'));
  fireEvent.press(screen.getByTestId('tarot-shuffle'));
  await advance(700);
  expect(screen.getByText('已洗牌 1 次')).toBeTruthy();
  fireEvent.press(screen.getByTestId('tarot-next'));
  fireEvent.press(screen.getByTestId('test-drag-cut'));
  for (const i of [2, 0, 1]) fireEvent.press(screen.getByTestId(`tarot-pile-${i}`));
  fireEvent.press(screen.getByTestId('tarot-cut-next'));
  fireEvent.press(screen.getByTestId('tarot-pick-77'));
  expect(screen.getByTestId('ritual-result').props.accessibilityState.disabled).toBe(true);
  fireEvent.press(screen.getByTestId('tarot-flip-0'));
  await advance(950);
  expect(screen.getByTestId('ritual-result').props.accessibilityState.disabled).toBe(false);
  jest.mocked(createNativeReading).mockRejectedValueOnce(new Error('cipher'));
  fireEvent.press(screen.getByTestId('ritual-result'));
  await advance();
  expect(screen.getByTestId('ritual-error')).toBeTruthy();
  expect(jest.mocked(createNativeReading).mock.calls[0]?.[5]?.pickedIndices).toEqual([77]);
  expect(mockFeedback).toHaveBeenCalledWith('flip');
});
it('six throws are serialized, ignore duplicate taps, and keep the saved result after a failed save', async () => {
  mockMethod = 'liuyao';
  render(<IchingRitual />);
  fireEvent.press(screen.getByTestId('iching-begin'));
  fireEvent.press(screen.getByTestId('iching-shake'));
  fireEvent.press(screen.getByTestId('iching-shake'));
  await advance(1300);
  expect(screen.getByText('已摇 1 / 6 爻（自下而上）')).toBeTruthy();
  fireEvent.press(screen.getByTestId('iching-shake-all'));
  await advance();
  expect(screen.getByText('已摇 6 / 6 爻（自下而上）')).toBeTruthy();
  expect(screen.getByTestId('ritual-hexagram')).toBeTruthy();
  jest.mocked(createNativeReading).mockRejectedValueOnce(new Error('cipher'));
  fireEvent.press(screen.getByTestId('ritual-result'));
  await advance();
  expect(jest.mocked(createNativeReading).mock.calls[0]?.[5]?.question?.method).toBe('liuyao');
  expect(mockFeedback.mock.calls.filter(([kind]) => kind === 'coin')).toHaveLength(6);
});
it('validates number boundaries, defaults audio off, and offers English Meihua casting', () => {
  usePreferences.setState({ locale: 'en' });
  render(<IchingRitual />);
  expect(screen.getByTestId('ritual-sound').props.value).toBe(false);
  fireEvent.press(screen.getByTestId('iching-method-numbers'));
  fireEvent.changeText(screen.getByTestId('iching-number-0'), '0');
  fireEvent.changeText(screen.getByTestId('iching-number-1'), '5');
  fireEvent.press(screen.getByTestId('iching-begin'));
  expect(screen.getByTestId('ritual-invalid')).toBeTruthy();
  fireEvent.changeText(screen.getByTestId('iching-number-0'), '3');
  fireEvent.press(screen.getByTestId('iching-begin'));
  expect(screen.getByTestId('iching-cast')).toBeTruthy();
});
it('protects unfinished ritual exits and cancels the in-flight coin on unmount', async () => {
  mockMethod = 'liuyao';
  const view = render(<IchingRitual />);
  fireEvent.press(screen.getByTestId('iching-begin'));
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  act(() => mockPrevent?.({ data: { action: { type: 'GO_BACK' } } }));
  expect(alert).toHaveBeenCalled();
  alert.mockRestore();
  fireEvent.press(screen.getByTestId('iching-shake'));
  view.unmount();
  await advance();
  expect(mockFeedback).not.toHaveBeenCalledWith('coin');
  expect(createNativeReading).not.toHaveBeenCalled();
});
it('validates zoned Qimen civil time and finishes all four layers before enabling the report', async () => {
  render(<QimenRitual />);
  fireEvent.changeText(screen.getByTestId('qimen-clock'), 'bad');
  fireEvent.press(screen.getByTestId('qimen-cast'));
  expect(screen.getByTestId('ritual-invalid')).toBeTruthy();
  fireEvent.changeText(screen.getByTestId('qimen-clock'), '2026-10-04T12:00:00');
  fireEvent.press(screen.getByTestId('qimen-cast'));
  expect(screen.getByTestId('ritual-result').props.accessibilityState.disabled).toBe(true);
  await advance(1500);
  expect(screen.getByTestId('ritual-result').props.accessibilityState.disabled).toBe(false);
  expect(mockFeedback.mock.calls.filter(([kind]) => kind === 'palace')).toHaveLength(4);
});
