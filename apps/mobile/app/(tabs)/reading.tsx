import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useProfiles } from '../../lib/profiles';
import { useCopy } from '../../lib/copy';
import { Page, CopyText, Action } from '../../components/native-ui';
/** Eight documented system entries plus synastry; later tasks connect native reports. */
export default function ReadingScreen() {
  const t = useCopy();
  const router = useRouter();
  const { active } = useProfiles();
  return (
    <Page title="nav.reading">
      <CopyText>{active?.data?.name || t('mobile.profiles.empty')}</CopyText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {(
          ['bazi', 'ziwei', 'iching', 'qimen', 'tarot', 'astrology', 'vedic', 'numerology'] as const
        ).map((system) => (
          <View key={system} style={{ width: '47%' }}>
            <Action
              id={`system-${system}`}
              label={t(`nav.${system}`)}
              onPress={() =>
                router.push(
                  system === 'tarot'
                    ? '/tarot/reading'
                    : system === 'iching'
                      ? '/iching'
                      : '/me/birth',
                )
              }
            />
          </View>
        ))}
      </View>
      <Action label={t('mobile.reading.synastry')} onPress={() => router.push('/me')} />
    </Page>
  );
}
