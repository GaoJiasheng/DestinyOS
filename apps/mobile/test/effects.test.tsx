import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import EffectsPage from '../app/dev/effects';
import { usePreferences } from '../lib/preferences';
import { checkEngine, matchesReference } from '../lib/diagnostics/engine-check';
import { summarizeFrames, meetsFrameBudget } from '../lib/diagnostics/frames';
jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({}) }));
jest.mock('expo-file-system', () => ({
  File: class {
    write() {}
  },
  Paths: { document: 'file://fixture' },
}));
jest.mock('../lib/diagnostics/engine-check', () => ({
  ...jest.requireActual<typeof import('../lib/diagnostics/engine-check')>(
    '../lib/diagnostics/engine-check',
  ),
  checkEngine: jest.fn(),
}));
jest.mock('../lib/diagnostics/frames', () => ({
  ...jest.requireActual<typeof import('../lib/diagnostics/frame-metrics')>(
    '../lib/diagnostics/frame-metrics',
  ),
  useFrameProbe: () => ({ value: 900 }),
}));
jest.mock('../components/effects/motion', () => ({
  useEffectsMotion: () => ({ active: true, enabled: { value: true } }),
}));
jest.mock('../components/effects/starfield', () => ({ Starfield: () => null }));
jest.mock('../components/effects/particles', () => ({ Particles: () => null }));
jest.mock('../components/effects/rituals', () => ({ TarotFlip: () => null, Coins: () => null }));
jest.mock('../components/effects/wheel', () => ({ Wheel: () => null }));
jest.mock('../components/effects/sphere', () => ({ Sphere: () => null }));
beforeEach(() => usePreferences.setState({ locale: 'zh', theme: 'auto' }));
it('offers all six scenes and verifies the explicit Skia fallback', () => {
  render(<EffectsPage />);
  expect(screen.getByText('特效实验室')).toBeTruthy();
  fireEvent.press(screen.getByTestId('effect-sphere'));
  fireEvent.press(screen.getByTestId('force-fallback'));
  expect(screen.getByTestId('sphere-fallback')).toBeTruthy();
  for (const name of ['starfield', 'particles', 'tarot', 'coins', 'wheel']) {
    fireEvent.press(screen.getByTestId(`effect-${name}`));
    expect(screen.getByTestId(`scene-${name}`)).toBeTruthy();
  }
});
it('uses English next-intl copy and does not report a failed engine check as successful', async () => {
  usePreferences.setState({ locale: 'en' });
  jest.mocked(checkEngine).mockRejectedValueOnce(new Error('fixture failure'));
  render(<EffectsPage />);
  expect(screen.getByText('Effects laboratory')).toBeTruthy();
  fireEvent.press(screen.getByTestId('engine-check'));
  await waitFor(() => expect(screen.getByTestId('engine-failed')).toBeTruthy());
});
it('accounts for stalls in FPS and rejects chart structural/numeric divergence', () => {
  const sample = summarizeFrames([16, 16, 100], 'ui-display');
  expect(sample.fps).toBeCloseTo(3000 / 132);
  expect(sample.p95Ms).toBe(100);
  expect(meetsFrameBudget(59.99, 60)).toBe(false);
  expect(meetsFrameBudget(59.999999999, 60)).toBe(true);
  expect(meetsFrameBudget(Number.NaN, 60)).toBe(false);
  expect(matchesReference({ a: [1, null] }, { a: [1.000001, null] })).toBe(true);
  expect(matchesReference({ a: 1 }, { a: 1.1 })).toBe(false);
  expect(matchesReference({ a: 1 }, { a: 1, b: 2 })).toBe(false);
});
