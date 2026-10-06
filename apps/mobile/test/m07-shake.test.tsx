import { act, renderHook } from '@testing-library/react-native';
import { Accelerometer } from 'expo-sensors';
import { AppState, type AppStateStatus } from 'react-native';
import { useShake } from '../lib/rituals/shake';
let mockFocused = true;
let mockSample:
  ((value: { x: number; y: number; z: number; timestamp: number }) => void) | undefined;
const mockRemove = jest.fn();
jest.mock('expo-router/react-navigation', () => ({ useIsFocused: () => mockFocused }));
jest.mock('expo-sensors', () => ({
  Accelerometer: {
    isAvailableAsync: jest.fn(async () => true),
    setUpdateInterval: jest.fn(),
    addListener: jest.fn((callback: typeof mockSample) => {
      mockSample = callback;
      return { remove: mockRemove };
    }),
  },
}));
beforeEach(() => {
  jest.clearAllMocks();
  mockFocused = true;
  Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active' });
});
it('subscribes at 20Hz, forwards a debounced physical shake, and removes sensors on blur', async () => {
  const onShake = jest.fn();
  const hook = renderHook(() => useShake(true, onShake));
  await act(async () => undefined);
  expect(Accelerometer.setUpdateInterval).toHaveBeenCalledWith(50);
  act(() => {
    mockSample?.({ x: 3, y: 0, z: 1, timestamp: 1 });
    mockSample?.({ x: 3, y: 0, z: 1, timestamp: 2 });
  });
  expect(onShake).toHaveBeenCalledTimes(1);
  mockFocused = false;
  hook.rerender({});
  expect(mockRemove).toHaveBeenCalledTimes(1);
});
it('does not subscribe when unavailable, disabled or backgrounded', async () => {
  jest.mocked(Accelerometer.isAvailableAsync).mockResolvedValueOnce(false);
  const unavailable = renderHook(() => useShake(true, jest.fn()));
  await act(async () => undefined);
  expect(Accelerometer.addListener).not.toHaveBeenCalled();
  unavailable.unmount();
  const disabled = renderHook(() => useShake(false, jest.fn()));
  await act(async () => undefined);
  expect(Accelerometer.addListener).not.toHaveBeenCalled();
  disabled.unmount();
  Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'background' });
  renderHook(() => useShake(true, jest.fn()));
  await act(async () => undefined);
  expect(Accelerometer.addListener).not.toHaveBeenCalled();
});
it('unsubscribes when backgrounded and re-arms only after foregrounding', async () => {
  let changed: ((state: AppStateStatus) => void) | undefined;
  const listen = jest.spyOn(AppState, 'addEventListener').mockImplementation((_, callback) => {
    changed = callback;
    return { remove: jest.fn() };
  });
  renderHook(() => useShake(true, jest.fn()));
  await act(async () => undefined);
  act(() => {
    Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'background' });
    changed?.('background');
  });
  expect(mockRemove).toHaveBeenCalledTimes(1);
  await act(async () => {
    Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active' });
    changed?.('active');
  });
  expect(Accelerometer.addListener).toHaveBeenCalledTimes(2);
  listen.mockRestore();
});
