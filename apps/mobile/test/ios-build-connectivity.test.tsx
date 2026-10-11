import { render, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { ConnectivityBootstrap } from '../components/connectivity-bootstrap';
import { useBackendConnectivity } from '../lib/network';
const originalFetch = globalThis.fetch;
const originalState = AppState.currentState;
beforeEach(() => {
  AppState.currentState = 'active';
  useBackendConnectivity.setState({ reachable: true });
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  AppState.currentState = originalState;
  jest.restoreAllMocks();
});
it('disables cloud actions on an unreachable API despite OS connectivity', async () => {
  globalThis.fetch = jest.fn(async () => {
    throw new TypeError('Network unavailable');
  });
  const view = render(<ConnectivityBootstrap />);
  await waitFor(() => expect(useBackendConnectivity.getState().reachable).toBe(false));
  view.unmount();
});
it('recovers cloud actions with an unauthenticated first-party health request', async () => {
  useBackendConnectivity.setState({ reachable: false });
  globalThis.fetch = jest.fn(async () => new Response('{}', { status: 200 }));
  const view = render(<ConnectivityBootstrap />);
  await waitFor(() => expect(useBackendConnectivity.getState().reachable).toBe(true));
  expect(globalThis.fetch).toHaveBeenCalledWith(
    'https://tianji.gavin.pub/api/v1/health',
    expect.objectContaining({ credentials: 'omit', redirect: 'error' }),
  );
  view.unmount();
});
