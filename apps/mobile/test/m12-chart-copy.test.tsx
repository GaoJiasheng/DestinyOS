import { render, screen } from '@testing-library/react-native';
import { useChartLabel } from '../components/report/report-ui';
import { CopyText } from '../components/native-ui';
import { usePreferences } from '../lib/preferences';
function Caption() {
  const label = useChartLabel();
  return <CopyText testID="caption">{label('tarot.card.major_02_high_priestess.name')}</CopyText>;
}
it.each([
  ['en', 'The High Priestess'],
  ['zh', '女祭司'],
  ['zh-TW', '女祭司'],
] as const)(
  'renders the authoritative modular Tarot name in %s rather than a technical key',
  (locale, expected) => {
    usePreferences.setState({ locale });
    render(<Caption />);
    expect(screen.getByTestId('caption')).toHaveTextContent(expected);
  },
);
