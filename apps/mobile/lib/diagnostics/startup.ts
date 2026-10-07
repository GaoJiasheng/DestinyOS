import { File, Paths } from 'expo-file-system';
import { captureMetric } from '../monitoring';
const enteredAt = performance.now();
let recorded = false;
/** Record only the first ready frame; audit builds write timing alone for external launch measurement. */
export function markStartupReady() {
  if (recorded) return;
  recorded = true;
  const elapsedMs = performance.now() - enteredAt;
  captureMetric('startup.js_ready_ms', elapsedMs);
  // DESIGN-GAP: Cold start is measured externally from simctl launch to this ready frame; JS evaluation time alone is not native cold-start latency.
  if (process.env.EXPO_PUBLIC_M14_AUDIT === 'true')
    new File(Paths.document, 'M14-startup.json').write(
      JSON.stringify({
        readyAtUnixMs: Date.now(),
        jsReadyMs: elapsedMs,
        hermes: 'HermesInternal' in globalThis,
      }),
    );
}
