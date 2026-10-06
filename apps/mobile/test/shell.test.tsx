import { fireEvent, render, screen, act } from '@testing-library/react-native';
import { BrandScreen } from '../components/brand-screen';
import { Preferences } from '../components/preferences';
import { EmptyScreen } from '../components/empty-screen';
import { i18n, resources } from '../lib/i18n';
import { usePreferences } from '../lib/preferences';
import { themeColors } from '@tianji/ui-core/tokens';
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace }) }));
beforeEach(async () => {
  mockReplace.mockClear();
  usePreferences.setState({ theme: 'auto', locale: 'zh' });
  await i18n.changeLanguage('zh');
});
it('renders the brand, disclaimer and enters the today route', () => {
  render(<BrandScreen />);
  expect(screen.getByText('天机')).toBeTruthy();
  expect(screen.getByText('DestinyOS')).toBeTruthy();
  expect(screen.getByText(resources.zh.translation['report.disclaimer.short'])).toBeTruthy();
  fireEvent.press(screen.getByTestId('brand-start'));
  expect(mockReplace).toHaveBeenCalledWith('/today');
});
it('switches all three palettes and updates the selected radio', () => {
  render(<Preferences />);
  for (const theme of ['east', 'west', 'vedic'] as const) {
    fireEvent.press(screen.getByTestId(`theme-${theme}`));
    expect(usePreferences.getState().theme).toBe(theme);
    expect(screen.getByTestId(`theme-${theme}`).props.accessibilityState.checked).toBe(true);
    expect(themeColors(theme).accent).toBe(
      { east: '#C8412B', west: '#6B5BD2', vedic: '#D9822B' }[theme],
    );
  }
});
it('switches traditional Chinese and English from the same Web catalogs', async () => {
  render(
    <>
      <EmptyScreen title="nav.today" />
      <Preferences />
    </>,
  );
  await act(async () => fireEvent.press(screen.getByTestId('locale-zh-TW')));
  expect(screen.getByText(resources['zh-TW'].translation['common.comingSoon.title'])).toBeTruthy();
  await act(async () => fireEvent.press(screen.getByTestId('locale-en')));
  expect(screen.getByText(resources.en.translation['nav.today'])).toBeTruthy();
});
it('preserves Web ICU interpolation and exact catalog key parity', () => {
  for (const locale of ['zh-TW', 'en'] as const)
    expect(Object.keys(resources[locale].translation).sort()).toEqual(
      Object.keys(resources.zh.translation).sort(),
    );
  expect(i18n.t('auth.magic.sent', { email: 'reader@example.test' })).toContain(
    'reader@example.test',
  );
  expect(i18n.t('auth.magic.sent', { email: 'reader@example.test' })).not.toContain('{email}');
});
