import { Modal, View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOnline } from '../lib/network';
import { useCopy } from '../lib/copy';
import { useTheme } from '../lib/theme';
import { Action, CopyText } from './native-ui';
/** The central tab opens a dismissible native bottom sheet without replacing the selected tab. */
export function AskSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useCopy();
  const online = useOnline();
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000088' }}>
        <Pressable
          style={{ flex: 1 }}
          accessibilityRole="button"
          accessibilityLabel={t('mobile.ask.close')}
          onPress={onClose}
        />
        <View
          accessibilityViewIsModal
          testID="ask-sheet"
          style={{
            backgroundColor: colors['bg-1'],
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 24,
            paddingBottom: Math.max(24, insets.bottom),
            gap: 12,
          }}
        >
          <CopyText title>{t('nav.ask')}</CopyText>
          <Action
            id="ask-tarot"
            label={t('mobile.ask.single')}
            onPress={() => {
              onClose();
              router.push('/tarot/reading');
            }}
          />
          <Action
            id="ask-meihua"
            label={t('mobile.ask.meihua')}
            onPress={() => {
              onClose();
              router.push({ pathname: '/iching', params: { method: 'random' } });
            }}
          />
          <Action
            id="ask-liuyao"
            label={t('mobile.ask.liuyao')}
            onPress={() => {
              onClose();
              router.push({ pathname: '/iching', params: { method: 'liuyao' } });
            }}
          />
          <Action
            id="ask-master"
            disabled={!online}
            label={
              online
                ? t('mobile.ask.master')
                : `${t('mobile.ask.master')} · ${t('mobile.ask.network')}`
            }
            onPress={() => {
              onClose();
              router.push('/me/history');
            }}
          />
          <Action id="ask-close" label={t('mobile.ask.close')} onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}
