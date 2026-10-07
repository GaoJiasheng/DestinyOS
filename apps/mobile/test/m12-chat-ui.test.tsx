import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ApiClientError } from '@tianji/api-client';
import { ChatScreen } from '../components/report/chat-screen';
import { usePreferences } from '../lib/preferences';
import { useNetworkDiagnostic } from '../lib/network';
import type { ReportActions } from '../lib/reports/actions';
import { Alert } from 'react-native';
import { openBrowserAsync } from 'expo-web-browser';
jest.mock('expo-web-browser', () => ({
  openBrowserAsync: jest.fn(async () => ({ type: 'cancel' })),
  maybeCompleteAuthSession: jest.fn(),
}));
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), push: mockPush }) }));
let actions: ReportActions;
beforeEach(() => {
  usePreferences.setState({ locale: 'en' });
  useNetworkDiagnostic.setState({ offline: false });
  actions = {
    history: jest.fn(async () => ({ available: true, remaining: 3, limit: 3, messages: [] })),
    deleteChat: jest.fn(async () => {}),
    send: jest.fn(async (_id, _locale, _question, delta) => {
      delta('First ');
      delta('answer');
    }),
    export: jest.fn(),
    link: jest.fn(),
    download: jest.fn(),
  };
});
it('renders incremental reply, decrements quota, keeps dialogue, and clears the composer only after done', async () => {
  let resolve: () => void = () => {};
  actions.send = jest.fn(async (_id, _locale, _question, delta) => {
    delta('First chunk');
    await new Promise<void>((done) => {
      resolve = done;
    });
    delta(' complete');
  });
  render(<ChatScreen id="reading-1" actions={actions} />);
  await waitFor(() => expect(screen.getByTestId('chat-quota')).toHaveTextContent(/3 questions/));
  fireEvent.changeText(screen.getByTestId('chat-question'), 'Explain the report');
  fireEvent.press(screen.getByTestId('chat-send'));
  await waitFor(() => expect(screen.getByTestId('chat-stream')).toHaveTextContent(/First chunk/));
  expect(screen.getByTestId('chat-question').props.value).toBe('Explain the report');
  await act(async () => resolve());
  await waitFor(() => expect(screen.getByTestId('chat-quota')).toHaveTextContent(/2 questions/));
  expect(screen.getByText('First chunk complete')).toBeTruthy();
  expect(screen.getByTestId('chat-question').props.value).toBe('');
});
it('offline disables sending and aborts an in-flight reply without retaining partial dialogue', async () => {
  let signal: AbortSignal | undefined;
  actions.send = jest.fn(async (_id, _locale, _question, delta, abort) => {
    signal = abort;
    delta('partial');
    await new Promise<void>((resolve) => abort.addEventListener('abort', () => resolve()));
  });
  render(<ChatScreen id="reading-1" actions={actions} />);
  await waitFor(() => expect(screen.getByTestId('chat-quota')).toBeTruthy());
  fireEvent.changeText(screen.getByTestId('chat-question'), 'Question');
  fireEvent.press(screen.getByTestId('chat-send'));
  await waitFor(() => expect(screen.getByTestId('chat-stream')).toBeTruthy());
  await act(async () => useNetworkDiagnostic.setState({ offline: true }));
  expect(signal?.aborted).toBe(true);
  expect(screen.getByTestId('chat-offline')).toBeTruthy();
  expect(screen.getByTestId('chat-send')).toBeDisabled();
  expect(screen.queryByText('partial')).toBeNull();
});
it('quota errors disable sending; unavailable and logged-out history expose localized retry states', async () => {
  actions.send = jest.fn(async () => {
    throw new ApiClientError('E_QUOTA_EXCEEDED', 429, 'api');
  });
  const view = render(<ChatScreen id="reading-1" actions={actions} />);
  await waitFor(() => expect(screen.getByTestId('chat-quota')).toBeTruthy());
  fireEvent.changeText(screen.getByTestId('chat-question'), 'Question');
  fireEvent.press(screen.getByTestId('chat-send'));
  await waitFor(() => expect(screen.getByTestId('chat-send')).toBeDisabled());
  expect(screen.getByTestId('chat-error')).toHaveTextContent(/allowance is used up/);
  view.unmount();
  actions.history = jest.fn(async () => {
    throw new ApiClientError('E_UNAUTHORIZED', 401, 'api');
  });
  render(<ChatScreen id="reading-2" actions={actions} />);
  await waitFor(() => expect(screen.getByTestId('chat-error')).toHaveTextContent(/Sign in/));
  fireEvent.press(screen.getByTestId('chat-login'));
  expect(mockPush).toHaveBeenCalledWith('/auth/login');
});
it('deletion requires explicit OS confirmation and reloads owner history', async () => {
  actions.history = jest.fn(async () => ({
    available: true,
    remaining: 2,
    limit: 3,
    messages: [{ id: 'msg', role: 'assistant' as const, content: 'Prior answer', createdAt: '' }],
  }));
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  render(<ChatScreen id="reading-1" actions={actions} />);
  await waitFor(() => expect(screen.getByText('Prior answer')).toBeTruthy());
  fireEvent.press(screen.getByTestId('chat-delete'));
  expect(actions.deleteChat).not.toHaveBeenCalled();
  await act(async () => alert.mock.calls[0]?.[2]?.[1]?.onPress?.());
  await waitFor(() => expect(actions.deleteChat).toHaveBeenCalledWith('reading-1'));
  alert.mockRestore();
});
it('changing the report clears the unsent private question', async () => {
  const view = render(<ChatScreen id="reading-1" actions={actions} />);
  await screen.findByTestId('chat-quota');
  fireEvent.changeText(screen.getByTestId('chat-question'), 'Private unsent question');
  view.rerender(<ChatScreen id="reading-2" actions={actions} />);
  await waitFor(() => expect(screen.getByTestId('chat-question').props.value).toBe(''));
});
it('labels AI responses and opens the report channel without including dialogue in its URL', async () => {
  render(<ChatScreen id="reading-1" actions={actions} />);
  await screen.findByTestId('chat-quota');
  expect(screen.getByTestId('chat-ai-notice')).toHaveTextContent(/generated by AI/);
  fireEvent.press(screen.getByTestId('chat-report'));
  expect(openBrowserAsync).toHaveBeenCalledWith('https://tianji.gavin.pub/en/contact');
});
