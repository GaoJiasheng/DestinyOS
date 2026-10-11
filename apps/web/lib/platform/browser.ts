import { platform } from './environment';
import { openNodePage } from './browser-node';
import { openCloudflarePage } from './browser-cloudflare';
export interface ReportPage {
  navigate(url: string): Promise<void>;
  validate(): Promise<void>;
  pdf(): Promise<Uint8Array>;
  prepareImage(): Promise<number>;
  limitImageHeight(height: number): Promise<number>;
  compressImage(data: Uint8Array): Promise<Uint8Array>;
  screenshotImage(quality: number): Promise<Uint8Array>;
  close(): Promise<void>;
}
/** Open an isolated browser, allowing only the canonical origin and document-only print capability. */
export function openReportPage(origin: string, path: string, token: string): Promise<ReportPage> {
  return platform() === 'cloudflare'
    ? openCloudflarePage(origin, path, token)
    : openNodePage(origin, path, token);
}
