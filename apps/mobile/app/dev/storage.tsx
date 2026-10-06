import { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect } from 'expo-router';
import { useEffectsCopy } from '../../lib/effects-copy';
import { useTheme } from '../../lib/theme';
import { checkNativeStorage } from '../../lib/diagnostics/storage-check';
/** Developer-only M04 native acceptance; copy reuses the shared bilingual next-intl check keys. */
export default function StorageCheckPage() {
  const t = useEffectsCopy(),
    { colors, body } = useTheme();
  const [status, setStatus] = useState<'engine' | 'running' | 'passed' | 'failed'>('engine');
  if (!__DEV__) return <Redirect href="/" />;
  async function check() {
    setStatus('running');
    try {
      setStatus((await checkNativeStorage()).passed ? 'passed' : 'failed');
    } catch {
      setStatus('failed');
    }
  }
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors['bg-0'], justifyContent: 'center', padding: 24 }}
    >
      <Pressable
        testID="storage-check"
        disabled={status === 'running'}
        onPress={() => void check()}
      >
        <Text
          testID={`storage-${status}`}
          style={{ color: colors['text-1'], fontFamily: body, fontSize: 24 }}
        >
          {t(status)}
        </Text>
      </Pressable>
    </SafeAreaView>
  );
}
