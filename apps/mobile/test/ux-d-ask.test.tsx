import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AskSheet } from '../components/ask-sheet';
import { usePreferences } from '../lib/preferences';
import { latestReportId } from '../lib/rituals/ask';
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
}));
jest.mock('../lib/profiles', () => ({ useProfiles: () => ({ active: { id: 'P1' } }) }));
jest.mock('../lib/network', () => ({ useOnline: () => true }));
jest.mock('../lib/rituals/ask', () => ({
  ...jest.requireActual<typeof import('../lib/rituals/ask')>('../lib/rituals/ask'),
  latestReportId: jest.fn(),
}));
beforeEach(() => {
  jest.clearAllMocks();
  usePreferences.setState({ locale: 'zh', theme: 'auto' });
});
it('carries the typed question into the chosen ritual', () => {
  const close = jest.fn();
  render(<AskSheet open onClose={close} />);
  fireEvent.changeText(screen.getByTestId('ask-question'), '  这份工作该不该接？ ');
  fireEvent.press(screen.getByTestId('ask-tarot'));
  expect(close).toHaveBeenCalledTimes(1);
  expect(mockPush).toHaveBeenCalledWith({
    pathname: '/tarot/reading',
    params: { spread: 'single', question: '这份工作该不该接？' },
  });
});
it('opens the newest report chat, or explains that a reading comes first', async () => {
  jest.mocked(latestReportId).mockResolvedValueOnce(null).mockResolvedValueOnce('R9');
  const close = jest.fn();
  render(<AskSheet open onClose={close} />);
  fireEvent.press(screen.getByTestId('ask-master'));
  await waitFor(() => expect(screen.getByTestId('ask-no-report')).toBeTruthy());
  expect(latestReportId).toHaveBeenCalledWith('P1');
  expect(close).not.toHaveBeenCalled();
  fireEvent.press(screen.getByTestId('ask-master'));
  await waitFor(() =>
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/r/[id]/chat', params: { id: 'R9' } }),
  );
});
