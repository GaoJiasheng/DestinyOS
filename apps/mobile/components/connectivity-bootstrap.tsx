import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useNetworkState } from 'expo-network';
import { apiBaseUrl } from '../lib/api-base';
import { useBackendConnectivity } from '../lib/network';
/** Poll slowly while healthy; after failures retry at 15s, doubling up to 2 minutes. */
export function nextProbeDelay(reachable: boolean, failures: number) {
  return reachable ? 60000 : Math.min(15000 * 2 ** Math.max(0, failures - 1), 120000);
}
/** First-party availability probe; no identity, profile or device identifier is transmitted. */
export function ConnectivityBootstrap() {
  const network = useNetworkState();
  useEffect(() => {
    let active = true;
    let request: AbortController | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;
    async function probe() {
      if (!active || AppState.currentState !== 'active') return;
      if (!network.isConnected || network.isInternetReachable === false) {
        useBackendConnectivity.setState({ reachable: false });
        return;
      }
      request?.abort();
      const controller = new AbortController();
      request = controller;
      const timeout = setTimeout(() => controller.abort(), 5000);
      try {
        // DESIGN-GAP: OS internet connectivity does not guarantee API availability (including simulator loopback outages); disable cloud-only actions until the first-party health probe recovers.
        const response = await fetch(`${apiBaseUrl}/api/v1/health`, {
          signal: controller.signal,
          credentials: 'omit',
          redirect: 'error',
        });
        if (active && request === controller) {
          useBackendConnectivity.setState({ reachable: response.ok });
          failures = response.ok ? 0 : failures + 1;
        }
      } catch {
        if (active && request === controller) {
          useBackendConnectivity.setState({ reachable: false });
          failures += 1;
        }
      } finally {
        clearTimeout(timeout);
        if (active && request === controller)
          timer = setTimeout(() => void probe(), nextProbeDelay(failures === 0, failures));
      }
    }
    void probe();
    const subscription = AppState.addEventListener('change', (state) => {
      clearTimeout(timer);
      if (state === 'active') void probe();
      else request?.abort();
    });
    return () => {
      active = false;
      clearTimeout(timer);
      request?.abort();
      subscription.remove();
    };
  }, [network.isConnected, network.isInternetReachable]);
  return null;
}
