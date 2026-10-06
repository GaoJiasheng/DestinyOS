import { useRouter } from 'expo-router';
import { Page, CopyText, Action } from '../components/native-ui';
import { useCopy } from '../lib/copy';
/** M05 navigation destination; M07 implements random and shake/button rituals. */
export default function IChing() {
  const t = useCopy();
  const router = useRouter();
  return (
    <Page title="nav.iching">
      <CopyText>{t('mobile.ask.future')}</CopyText>
      <Action label={t('form.birth.back')} onPress={() => router.back()} />
    </Page>
  );
}
