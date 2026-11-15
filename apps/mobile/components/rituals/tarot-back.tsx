import { Alert } from 'react-native';
import { useCopy } from '../../lib/copy';
import { Action } from '../native-ui';
type Phase = 'setup' | 'shuffle' | 'cut' | 'pick' | 'reveal';
/**
 * Step-back controls for every tarot phase before the first card is turned. Going back past
 * a step that already holds progress asks first, because the deck has to be shuffled again.
 */
export function TarotBackActions({
  phase,
  busy,
  started,
  picked,
  revealed,
  onBack,
}: {
  phase: Phase;
  busy: boolean;
  started: boolean;
  picked: boolean;
  revealed: boolean;
  onBack: (to: Exclude<Phase, 'reveal'>) => void;
}) {
  const t = useCopy();
  if (phase === 'setup' || revealed) return null;
  function confirm(body: 'reshuffle' | 'unpick', go: () => void) {
    if (body === 'reshuffle' ? !started && !picked : !picked) return go();
    Alert.alert(t('mobile.ritual.resetTitle'), t(`mobile.ritual.${body}Body`), [
      { text: t('tarot.stay'), style: 'cancel' },
      { text: t('mobile.ritual.resetConfirm'), style: 'destructive', onPress: go },
    ]);
  }
  const previous =
    phase === 'cut'
      ? { label: 'form.birth.back' as const, go: () => onBack('shuffle') }
      : phase === 'pick'
        ? { label: 'form.birth.back' as const, go: () => confirm('unpick', () => onBack('cut')) }
        : phase === 'reveal'
          ? { label: 'mobile.ritual.backToPick' as const, go: () => onBack('pick') }
          : null;
  return (
    <>
      {previous ? (
        <Action id="tarot-back" label={t(previous.label)} disabled={busy} onPress={previous.go} />
      ) : null}
      <Action
        id="tarot-back-question"
        label={t('divination.backToQuestion')}
        disabled={busy}
        onPress={() => confirm('reshuffle', () => onBack('setup'))}
      />
    </>
  );
}
