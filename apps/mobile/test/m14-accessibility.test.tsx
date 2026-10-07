import { useRef } from 'react';
import { AccessibilityInfo, Text } from 'react-native';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import { useSystemAccessibility, focusHeading } from '../lib/accessibility';
import { Action, CopyText, Field } from '../components/native-ui';
import { usePreferences } from '../lib/preferences';
import { getCopy } from '../lib/copy';
function Probe() {
  const state = useSystemAccessibility();
  const heading = useRef<Text>(null);
  return (
    <>
      <CopyText title textRef={heading}>
        Title
      </CopyText>
      <CopyText testID="motion">{String(state.reduced)}</CopyText>
      <CopyText testID="reader">{String(state.screenReader)}</CopyText>
      <Action label="Focus" onPress={() => focusHeading(heading)} />
    </>
  );
}
it('updates VoiceOver/TalkBack and reduced motion live and cleans native listeners', async () => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(true);
  const remove = jest.fn();
  const listeners = new Map<string, (value: boolean) => void>();
  const subscribe = jest
    .spyOn(AccessibilityInfo, 'addEventListener')
    .mockReturnValue({ remove } as unknown as ReturnType<
      typeof AccessibilityInfo.addEventListener
    >);
  const { unmount } = render(<Probe />);
  await waitFor(() => expect(screen.getByTestId('reader').props.children).toBe('true'));
  expect(screen.getByTestId('motion').props.children).toBe('false');
  for (const [name, handler] of subscribe.mock.calls) {
    if (String(name) === 'reduceMotionChanged' || String(name) === 'screenReaderChanged')
      listeners.set(String(name), handler as unknown as (value: boolean) => void);
  }
  act(() => {
    listeners.get('reduceMotionChanged')?.(true);
    listeners.get('screenReaderChanged')?.(false);
  });
  expect(screen.getByTestId('motion').props.children).toBe('true');
  expect(screen.getByTestId('reader').props.children).toBe('false');
  unmount();
  expect(remove).toHaveBeenCalledTimes(2);
  jest.restoreAllMocks();
});
it.each(['zh', 'en'] as const)(
  'exposes localized roles, selection, disabled state and scalable input in %s',
  (locale) => {
    usePreferences.setState({ locale });
    const t = getCopy(locale),
      press = jest.fn();
    render(
      <>
        <Action label={t('mobile.audit.reduced')} selected onPress={press} />
        <Action label={t('common.retry')} disabled onPress={press} />
        <Field id="field" label={t('mobile.audit.field')} value="" onChange={jest.fn()} />
        <CopyText title>{t('mobile.audit.title')}</CopyText>
      </>,
    );
    expect(
      screen.getByRole('radio', { name: t('mobile.audit.reduced'), checked: true }),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: t('common.retry'), disabled: true })).toBeTruthy();
    expect(press).not.toHaveBeenCalled();
    expect(screen.getByLabelText(t('mobile.audit.field'))).toBeTruthy();
    expect(screen.getByRole('header').props.allowFontScaling).toBe(true);
  },
);
