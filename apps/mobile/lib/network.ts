import { useNetworkState } from 'expo-network';
import { create } from 'zustand';
// DESIGN-GAP: Unknown initial connectivity disables cloud actions until the OS reports a usable connection.
export const useNetworkDiagnostic = create<{ offline: boolean }>(() => ({ offline: false }));
/** Subscribe to OS reachability without collecting IP addresses or device identifiers. */
export function useOnline() {
  const state = useNetworkState();
  const offline = useNetworkDiagnostic((s) => s.offline);
  return state.isConnected === true && state.isInternetReachable !== false && !(__DEV__ && offline);
}
