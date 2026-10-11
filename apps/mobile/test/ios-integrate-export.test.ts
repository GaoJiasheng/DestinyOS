import type { File } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { shareExport, type ReportActions } from '../lib/reports/actions';
jest.mock('../lib/account/controller', () => ({ useAccount: { getState: jest.fn() } }));
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(async () => undefined),
}));
it.each([
  ['report.jpg', 'image/jpeg'],
  ['report.pdf', 'application/pdf'],
  ['legacy.png', 'image/png'],
])(
  'shares %s with the correct native MIME and deletes the transient file',
  async (filename, mimeType) => {
    const erase = jest.fn();
    const file = {
      uri: `file:///cache/${filename}`,
      exists: true,
      delete: erase,
    } as unknown as File;
    const actions: ReportActions = {
      history: jest.fn(),
      deleteChat: jest.fn(),
      send: jest.fn(),
      export: jest.fn(),
      link: jest.fn(),
      download: jest.fn(async () => file),
    };
    await shareExport(
      actions,
      { url: '/api/v1/mobile/export/reading?format=png', filename },
      'Download',
    );
    expect(Sharing.shareAsync).toHaveBeenLastCalledWith(file.uri, {
      mimeType,
      dialogTitle: 'Download',
    });
    expect(erase).toHaveBeenCalledTimes(1);
  },
);
it('erases the private file when the OS share fails', async () => {
  const erase = jest.fn();
  const file = { uri: 'file:///cache/report.jpg', exists: true, delete: erase } as unknown as File;
  const actions: ReportActions = {
    history: jest.fn(),
    deleteChat: jest.fn(),
    send: jest.fn(),
    export: jest.fn(),
    link: jest.fn(),
    download: jest.fn(async () => file),
  };
  jest.mocked(Sharing.shareAsync).mockRejectedValueOnce(new Error('Canceled'));
  await expect(
    shareExport(actions, { url: '/download', filename: 'report.jpg' }, 'Download'),
  ).rejects.toThrow('Canceled');
  expect(erase).toHaveBeenCalledTimes(1);
});
