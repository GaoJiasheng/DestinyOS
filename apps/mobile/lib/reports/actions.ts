import { z } from 'zod';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Share } from 'react-native';
import { brand } from '@tianji/shared';
import {
  ApiClientError,
  ChatInputSchema,
  consumeChat,
  chatEndpoint,
  deleteChatEndpoint,
  exportEndpoint,
  shareEndpoint,
  type ChatHistorySchema,
  type ExportInputSchema,
  type ShareInputSchema,
} from '@tianji/api-client';
import { accountSession, syncAccount, useAccount } from '../account/controller';
import { currentOwner } from '../account/scope';
import { getLocalStore } from '../data/store';
import type { MobileLocale, MessageKey } from '../i18n';
export interface ReportActions {
  history(id: string): Promise<z.infer<typeof ChatHistorySchema>>;
  deleteChat(id: string): Promise<void>;
  send(
    id: string,
    locale: MobileLocale,
    question: string,
    delta: (text: string) => void,
    signal: AbortSignal,
  ): Promise<void>;
  export(
    id: string,
    input: z.infer<typeof ExportInputSchema>,
  ): Promise<{ url: string; filename: string }[]>;
  link(id: string, input: z.infer<typeof ShareInputSchema>): Promise<string>;
  download(path: string, filename: string): Promise<File>;
}
async function prepare(id: string) {
  const owner = currentOwner();
  if (!owner || owner !== accountSession.session?.userId || useAccount.getState().pending)
    throw new ApiClientError('E_UNAUTHORIZED', 401, 'api');
  if (!(await (await getLocalStore(owner)).readings.get(id)))
    throw new ApiClientError('E_FORBIDDEN', 403, 'api');
  await syncAccount();
  if (currentOwner() !== owner || accountSession.session?.userId !== owner)
    throw new ApiClientError('E_UNAUTHORIZED', 401, 'api');
  if (useAccount.getState().error) throw new ApiClientError('E_INTERNAL', 0, 'api');
}
/** Native cloud operations first synchronize an explicitly owned report using the existing consent boundary. */
export const reportActions: ReportActions = {
  async history(id) {
    await prepare(id);
    return accountSession.request(chatEndpoint(id), {});
  },
  async deleteChat(id) {
    await prepare(id);
    await accountSession.request(deleteChatEndpoint(id), {});
  },
  async send(id, locale, question, delta, signal) {
    await prepare(id);
    const input = ChatInputSchema.parse({ locale, question });
    const response = await accountSession.raw(`/api/v1/mobile/chat/${encodeURIComponent(id)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal,
    });
    await consumeChat(response, delta, signal);
  },
  async export(id, input) {
    await prepare(id);
    return (await accountSession.request(exportEndpoint(id), input)).files;
  },
  async link(id, input) {
    await prepare(id);
    const value = await accountSession.request(shareEndpoint(id), input);
    const expected = `https://${brand.domain}/s/${value.token}`;
    if (value.url !== expected) throw new ApiClientError('E_INTERNAL', 0, 'decode');
    return expected;
  },
  async download(path, filename) {
    if (
      !/^\/api\/v1\/mobile\/export\/[A-Za-z0-9-]+\?/.test(path) ||
      !/^[A-Za-z0-9_.-]+\.(pdf|png|zip)$/.test(filename)
    )
      throw new ApiClientError('E_INTERNAL', 0, 'decode');
    const response = await accountSession.raw(path);
    if (!response.ok) throw new ApiClientError('E_INTERNAL', response.status, 'api');
    const bytes = new Uint8Array(await response.arrayBuffer());
    // DESIGN-GAP: Cap each transient native export at 8 MiB before writing plaintext to cache.
    if (bytes.length > 8 * 1024 * 1024 || bytes.length === 0)
      throw new ApiClientError('E_INTERNAL', 0, 'decode');
    const file = new File(Paths.cache, `export-${Date.now()}-${filename}`);
    file.write(bytes);
    return file;
  },
};
/** Share a transient export using OS facilities, then erase plaintext artifacts even on cancellation. */
export async function shareExport(
  actions: ReportActions,
  item: { url: string; filename: string },
  title: string,
) {
  if (!(await Sharing.isAvailableAsync())) throw new Error('E_SHARE');
  const file = await actions.download(item.url, item.filename);
  try {
    await Sharing.shareAsync(file.uri, {
      mimeType: item.filename.endsWith('.pdf')
        ? 'application/pdf'
        : item.filename.endsWith('.zip')
          ? 'application/zip'
          : 'image/png',
      dialogTitle: title,
    });
  } finally {
    if (file.exists) file.delete();
  }
}
/** Share only the public token URL; private reading IDs and birth fields never enter OS link payloads. */
export async function shareLink(url: string) {
  await Share.share({ message: url, url });
}
/** Translate cloud error codes while keeping raw server and personal details out of the interface. */
export function reportActionError(error: unknown, mode: 'chat' | 'export' | 'share'): MessageKey {
  const code = error instanceof ApiClientError ? error.code : '';
  if (code === 'E_UNAUTHORIZED') return mode === 'chat' ? 'report.chat.login' : 'export.login';
  if (code === 'E_FORBIDDEN') return mode === 'chat' ? 'report.chat.forbidden' : 'export.denied';
  if (code === 'E_QUOTA_EXCEEDED') return 'report.chat.quota';
  if (code === 'E_RATE_LIMITED')
    return mode === 'chat' ? 'report.chat.rateLimited' : 'export.rateLimit';
  if (mode === 'chat' && (code === 'E_VALIDATION' || code === 'E_INVALID_INPUT'))
    return 'report.chat.tooLong';
  return mode === 'chat' ? 'report.chat.away' : 'export.failed';
}
