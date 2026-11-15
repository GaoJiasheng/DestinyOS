import { Page, CopyText } from '../components/native-ui';
import { useCopy } from '../lib/copy';
/** COPPA block remains enforced across navigation and restarts; the copy states the real 13+ rule and scope. */
export default function AgeRestricted() {
  const t = useCopy();
  return (
    <Page title="mobile.age.title">
      <CopyText>{t('mobile.age.body')}</CopyText>
    </Page>
  );
}
