import { act, renderHook } from '@testing-library/react-native';
import { AppState } from 'react-native';
import * as Audio from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { SettingsSchema } from '../lib/data/models';
import { useRitualFeedback } from '../lib/rituals/feedback';
const mockSettings = SettingsSchema.parse({});
const mockPlayer = {
  pause: jest.fn(),
  play: jest.fn(),
  seekTo: jest.fn(async () => undefined),
  remove: jest.fn(),
};
jest.mock('../lib/profiles', () => ({ useProfiles: () => ({ settings: mockSettings }) }));
jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn(() => mockPlayer),
  setAudioModeAsync: jest.fn(async () => undefined),
}));
jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(async () => undefined),
  impactAsync: jest.fn(async () => undefined),
  notificationAsync: jest.fn(async () => undefined),
  ImpactFeedbackStyle: { Heavy: 'heavy', Medium: 'medium', Light: 'light' },
  NotificationFeedbackType: { Success: 'success' },
}));
beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(mockSettings, SettingsSchema.parse({}));
  Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active' });
});
it('defaults to silent sound, assigns distinct haptics and respects disabled tactile feedback', () => {
  const { result, rerender } = renderHook(() => useRitualFeedback());
  act(() => {
    result.current.feedback('coin');
    result.current.feedback('flip');
    result.current.feedback('shuffle');
    result.current.feedback('palace');
    result.current.feedback('complete');
  });
  expect(Audio.createAudioPlayer).not.toHaveBeenCalled();
  expect(Haptics.impactAsync).toHaveBeenCalledWith('heavy');
  expect(Haptics.impactAsync).toHaveBeenCalledWith('medium');
  expect(Haptics.impactAsync).toHaveBeenCalledWith('light');
  expect(Haptics.selectionAsync).toHaveBeenCalled();
  expect(Haptics.notificationAsync).toHaveBeenCalledWith('success');
  mockSettings.hapticsOn = false;
  rerender({});
  jest.mocked(Haptics.impactAsync).mockClear();
  act(() => result.current.feedback('coin'));
  expect(Haptics.impactAsync).not.toHaveBeenCalled();
});
it('explicitly obeys the silent switch, stops sounds when disabled and releases route-scoped players', async () => {
  mockSettings.soundOn = true;
  const { result, rerender, unmount } = renderHook(() => useRitualFeedback());
  await act(async () => {
    result.current.feedback('flip');
  });
  expect(Audio.setAudioModeAsync).toHaveBeenCalledWith(
    expect.objectContaining({
      playsInSilentMode: false,
      shouldPlayInBackground: false,
      allowsRecording: false,
    }),
  );
  expect(mockPlayer.play).toHaveBeenCalledTimes(1);
  mockSettings.soundOn = false;
  rerender({});
  expect(mockPlayer.pause).toHaveBeenCalled();
  unmount();
  expect(mockPlayer.remove).toHaveBeenCalledTimes(1);
});
it('drops pending playback when the route is disposed or the app is not foreground', async () => {
  mockSettings.soundOn = true;
  const { result, unmount } = renderHook(() => useRitualFeedback());
  act(() => {
    result.current.feedback('coin');
    unmount();
  });
  await act(async () => undefined);
  expect(mockPlayer.play).not.toHaveBeenCalled();
  Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'background' });
  const background = renderHook(() => useRitualFeedback());
  act(() => background.result.current.feedback('coin'));
  expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
});
