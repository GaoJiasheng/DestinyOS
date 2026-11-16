import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { LocalDataSection } from '../components/local-data-section';
import { buildLocalExport, exportFileName } from '../lib/data/local-export';

const mockWrite = jest.fn(),
  mockShare = jest.fn(),
  mockSummary = jest.fn();
const mockExists = false;
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: jest.fn() }) }));
jest.mock('../lib/profiles', () => ({ useProfiles: () => ({ reload: jest.fn() }) }));
jest.mock('expo-file-system', () => ({
  Paths: { cache: 'cache' },
  File: class {
    uri = 'file:///cache/x.json';
    get exists() {
      return mockExists;
    }
    delete() {}
    write(text: string) {
      mockWrite(text);
    }
  },
}));
jest.mock('expo-sharing', () => ({
  isAvailableAsync: async () => true,
  shareAsync: (...args: unknown[]) => mockShare(...args),
}));
const birth = { date: '1990-01-01' };
const fakeStore = () => ({
  summary: mockSummary,
  profiles: {
    list: async () => [
      {
        id: 'p1',
        createdAt: 'c',
        data: { name: 'Mei', relation: 'self', birth, version: 1, isCurrent: true },
      },
    ],
  },
  readings: {
    listBySystem: async () => [
      {
        id: 'r1',
        createdAt: 'c',
        data: {
          profileId: 'p1',
          system: 'bazi',
          title: null,
          inputSnapshot: { system: 'bazi', partnerProfileId: 'p2' },
          chart: {},
          reportZh: null,
          reportEn: null,
          engineVersion: 'e',
          knowledgeVersion: 'k',
        },
      },
    ],
  },
  journal: {
    list: async () => [{ id: 'j1', createdAt: 'c', data: { date: '2026-11-01', mood: 3 } }],
  },
  settings: {
    list: async () => [
      {
        id: 's',
        createdAt: 'c',
        data: {
          locale: 'zh',
          theme: 'east',
          activeProfileId: 'p1',
          ageBlocked: true,
          onboardingVersion: 2,
        },
      },
    ],
  },
});
jest.mock('../lib/data/store', () => ({ getLocalStore: async () => fakeStore() }));

it('exports a web-shaped payload without internal or sensitive settings', async () => {
  const data = await buildLocalExport(fakeStore() as never, new Date('2026-11-16T08:00:00Z'));
  expect(data).toMatchObject({ version: 1, exportedAt: '2026-11-16T08:00:00.000Z' });
  expect(data.profiles[0]).toMatchObject({ id: 'p1', label: 'Mei', relation: 'self', birth });
  expect(data.readings[0]).toMatchObject({ id: 'r1', partnerProfileId: 'p2', system: 'bazi' });
  expect(data.journalEntries[0]).toMatchObject({ id: 'j1', mood: 3 });
  expect(data.user).toEqual(expect.objectContaining({ locale: 'zh', theme: 'east' }));
  const text = JSON.stringify(data);
  for (const banned of ['activeProfileId', 'ageBlocked', 'onboardingVersion', 'token', 'secret'])
    expect(text).not.toContain(banned);
  expect(exportFileName(new Date(2026, 10, 16))).toBe('tianji-export-2026-11-16.json');
});
describe('local data section export', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });
  it('warns about birth details, then writes and shares the file', async () => {
    mockSummary.mockResolvedValue({ profiles: 1, readings: 1 });
    render(<LocalDataSection />);
    await screen.findByTestId('local-data-summary');
    fireEvent.press(screen.getByTestId('local-data-export'));
    const buttons = (Alert.alert as jest.Mock).mock.calls[0][2] as { onPress?: () => void }[];
    expect(mockShare).not.toHaveBeenCalled();
    await act(async () => buttons[1]?.onPress?.());
    await waitFor(() => expect(mockShare).toHaveBeenCalled());
    expect(JSON.parse(mockWrite.mock.calls[0][0]).profiles).toHaveLength(1);
    expect(mockShare.mock.calls[0][1]).toMatchObject({ mimeType: 'application/json' });
  });
  it('shows an inline error when sharing fails', async () => {
    mockSummary.mockResolvedValue({ profiles: 1, readings: 0 });
    mockShare.mockRejectedValueOnce(new Error('x'));
    render(<LocalDataSection />);
    await screen.findByTestId('local-data-summary');
    fireEvent.press(screen.getByTestId('local-data-export'));
    const buttons = (Alert.alert as jest.Mock).mock.calls[0][2] as { onPress?: () => void }[];
    await act(async () => buttons[1]?.onPress?.());
    await screen.findByTestId('local-data-export-error');
  });
  it('disables export and explains when the device holds nothing', async () => {
    mockSummary.mockResolvedValue({ profiles: 0, readings: 0 });
    render(<LocalDataSection />);
    await screen.findByTestId('local-data-export-empty');
    expect(screen.getByTestId('local-data-export').props.accessibilityState.disabled).toBe(true);
  });
});
