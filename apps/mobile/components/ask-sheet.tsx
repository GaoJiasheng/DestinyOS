import { useRef, useState } from 'react';
import { focusHeading, useReducedMotion } from '../lib/accessibility';
import { Modal, View, Pressable, ScrollView, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOnline } from '../lib/network';
import { useCopy } from '../lib/copy';
import { useTheme } from '../lib/theme';
import { useProfiles } from '../lib/profiles';
import { askRoute, latestReportId } from '../lib/rituals/ask';
import { Action, CopyText, Field } from './native-ui';
/**
 * The central tab opens a dismissible native bottom sheet without replacing the selected tab.
 * The question typed here travels into the ritual so it never has to be typed twice.
 */
export function AskSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useCopy();
  const { active } = useProfiles();
  const [question, setQuestion] = useState(''),
    [noReport, setNoReport] = useState(false),
    [failed, setFailed] = useState(false);
  const heading = useRef<Text>(null);
  const reduced = useReducedMotion();
  const online = useOnline();
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  function close() {
    setNoReport(false);
    setFailed(false);
    onClose();
  }
  function go(kind: 'tarot' | 'meihua' | 'liuyao') {
    const route = askRoute(kind, question);
    setQuestion('');
    close();
    router.push(route);
  }
  async function master() {
    setNoReport(false);
    setFailed(false);
    try {
      const id = await latestReportId(active?.id);
      if (!id) return setNoReport(true);
      close();
      router.push({ pathname: '/r/[id]/chat', params: { id } });
    } catch {
      setFailed(true);
    }
  }
  return (
    <Modal
      visible={open}
      transparent
      animationType={reduced ? 'none' : 'slide'}
      onShow={() => focusHeading(heading)}
      onRequestClose={close}
    >
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000088' }}>
        <Pressable
          style={{ flex: 1 }}
          accessibilityRole="button"
          accessibilityLabel={t('mobile.ask.close')}
          onPress={close}
        />
        <View
          accessibilityViewIsModal
          importantForAccessibility="yes"
          testID="ask-sheet"
          style={{
            maxHeight: '90%',
            backgroundColor: colors['bg-1'],
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 24,
            paddingBottom: Math.max(24, insets.bottom),
            gap: 12,
          }}
        >
          <ScrollView contentContainerStyle={{ gap: 12 }} keyboardShouldPersistTaps="handled">
            <CopyText title textRef={heading}>
              {t('nav.ask')}
            </CopyText>
            <Field
              id="ask-question"
              label={t('home.ask.question')}
              placeholder={t('home.ask.placeholder')}
              value={question}
              onChange={setQuestion}
              maxLength={120}
            />
            <Action id="ask-tarot" label={t('mobile.ask.single')} onPress={() => go('tarot')} />
            <Action id="ask-meihua" label={t('mobile.ask.meihua')} onPress={() => go('meihua')} />
            <Action id="ask-liuyao" label={t('mobile.ask.liuyao')} onPress={() => go('liuyao')} />
            <Action
              id="ask-master"
              disabled={!online}
              label={
                online
                  ? t('mobile.ask.master')
                  : `${t('mobile.ask.master')} · ${t('mobile.ask.network')}`
              }
              onPress={() => void master()}
            />
            {noReport ? (
              <>
                <CopyText status testID="ask-no-report">
                  {t('mobile.ask.noReport')}
                </CopyText>
                <Action
                  id="ask-start-reading"
                  label={t('home.cta.start')}
                  onPress={() => {
                    close();
                    router.push('/reading');
                  }}
                />
              </>
            ) : null}
            {failed ? <CopyText status>{t('mobile.storage.error')}</CopyText> : null}
          </ScrollView>
          <Action id="ask-close" label={t('mobile.ask.close')} onPress={close} />
        </View>
      </View>
    </Modal>
  );
}
