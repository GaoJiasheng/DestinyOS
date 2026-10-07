import { render, screen, waitFor, act } from '@testing-library/react-native';
import { AppState, Text } from 'react-native';
import { useEffectsMotion } from '../components/effects/motion';
let mockReduced = false,
  mockReader = false,
  mockLowPower = false;
jest.mock('../lib/accessibility', () => ({
  useSystemAccessibility: () => ({ reduced: mockReduced, screenReader: mockReader }),
}));
jest.mock('expo-battery', () => ({ useLowPowerMode: () => mockLowPower }));
jest.mock('react-native-reanimated', () => ({ useSharedValue: () => ({ value: false }) }));
function Probe() {
  const motion = useEffectsMotion();
  return <Text testID="active">{String(motion.active)}</Text>;
}
it('stops for reduce motion, screen reader, low power and background without losing controls', async () => {
  const original = AppState.currentState;
  AppState.currentState = 'active';
  const listener = jest.spyOn(AppState, 'addEventListener');
  const { rerender, unmount } = render(<Probe />);
  await waitFor(() => expect(screen.getByTestId('active').props.children).toBe('true'));
  for (const reason of ['reduced', 'reader', 'power'] as const) {
    mockReduced = reason === 'reduced';
    mockReader = reason === 'reader';
    mockLowPower = reason === 'power';
    rerender(<Probe />);
    expect(screen.getByTestId('active').props.children).toBe('false');
  }
  mockReduced = mockReader = mockLowPower = false;
  rerender(<Probe />);
  act(() => listener.mock.calls[0]?.[1]('background'));
  expect(screen.getByTestId('active').props.children).toBe('false');
  act(() => listener.mock.calls[0]?.[1]('active'));
  expect(screen.getByTestId('active').props.children).toBe('true');
  unmount();
  listener.mockRestore();
  AppState.currentState = original;
});
