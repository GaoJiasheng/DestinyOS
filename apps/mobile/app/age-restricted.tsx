import { Page, CopyText } from '../components/native-ui';
import { useCopy } from '../lib/copy';
/** COPPA block remains enforced across navigation and restarts. */
export default function AgeRestricted() {
  const t = useCopy();
  return (
    <Page title="form.birth.age.title">
      <CopyText>{t('form.birth.age.body')}</CopyText>
    </Page>
  );
}
