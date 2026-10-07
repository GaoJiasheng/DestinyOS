import { fetch } from 'expo/fetch';
import { File, Paths } from 'expo-file-system';
import { z } from 'zod';
import { ChatHistorySchema, consumeChat } from '@tianji/api-client';
import type { ReportActions } from '../reports/actions';
import { brand } from '@tianji/shared';
const origin = 'http://127.0.0.1:8099';
async function request(path: string, method = 'GET', input?: unknown, signal?: AbortSignal) {
  if (!__DEV__) throw new Error('E_FORBIDDEN');
  return fetch(origin + path, {
    method,
    signal,
    headers: { 'Content-Type': 'application/json' },
    ...(input === undefined ? {} : { body: JSON.stringify(input) }),
  });
}
/** Development-only HTTP transport validates real incremental native fetch and OS export sharing. */
export const diagnosticActions: ReportActions = {
  async history() {
    return ChatHistorySchema.parse(await (await request('/chat')).json());
  },
  async deleteChat() {
    await request('/chat', 'DELETE');
  },
  async send(_id, locale, question, delta, signal) {
    await consumeChat(await request('/chat', 'POST', { locale, question }, signal), delta, signal);
  },
  async export(_id, input) {
    return z
      .array(z.object({ url: z.string(), filename: z.string() }))
      .parse(await (await request('/export', 'POST', input)).json());
  },
  async download(path, filename) {
    const response = await request(path);
    if (!response.ok) throw new Error('E_DOWNLOAD');
    const file = new File(Paths.cache, `maestro-${Date.now()}-${filename}`);
    file.write(new Uint8Array(await response.arrayBuffer()));
    return file;
  },
  async link() {
    if (!__DEV__) throw new Error('E_FORBIDDEN');
    return `https://${brand.domain}/s/M12fixture0123456789abc`;
  },
};
/** Reset only the synthetic local conversation; no production database or personal records are affected. */
export async function resetDiagnosticConversation() {
  await request('/reset', 'POST');
}
