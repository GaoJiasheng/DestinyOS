import { useRouter } from 'expo-router';
import { EmptyScreen } from '../../components/empty-screen';
import { Action, CopyText } from '../../components/native-ui';
import { useProfiles } from '../../lib/profiles';
import { useCopy } from '../../lib/copy';
/** Today scaffold exposes the birth entry while M08 owns the fortune content. */
export default function Today() {
  const router = useRouter();
  const { active } = useProfiles();
  const t = useCopy();
  return (
    <EmptyScreen title="nav.today">
      <CopyText>{active?.data?.name || t('mobile.profiles.empty')}</CopyText>
      <Action
        id="today-birth"
        label={t(active ? 'mobile.profiles.edit' : 'mobile.onboarding.profile')}
        onPress={() =>
          router.push(active ? { pathname: '/me/birth', params: { id: active.id } } : '/me/birth')
        }
      />
    </EmptyScreen>
  );
}
