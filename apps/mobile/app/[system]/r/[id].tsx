import { useLocalSearchParams } from 'expo-router';
import { ReportSystemSchema } from '../../../lib/reports/readings';
import { ReportScreen } from '../../../components/report/report-screen';
import { ReportTheme } from '../../../components/report/report-theme';
import { Page, CopyText } from '../../../components/native-ui';
import { useCopy } from '../../../lib/copy';
/** Native route matches /[system]/r/[id]; identifiers never carry birth information. */
export default function NativeReportRoute() {
  const { system, id, reused } = useLocalSearchParams<{
    system: string;
    id: string;
    reused?: string;
  }>();
  const parsed = ReportSystemSchema.safeParse(system),
    t = useCopy();
  if (!parsed.success || typeof id !== 'string' || id.length > 100)
    return (
      <Page title="report.missing">
        <CopyText>{t('report.missing')}</CopyText>
      </Page>
    );
  return (
    <ReportTheme system={parsed.data}>
      <ReportScreen key={`${system}-${id}`} system={parsed.data} id={id} reused={reused === '1'} />
    </ReportTheme>
  );
}
export { RouteErrorBoundary as ErrorBoundary } from '../../../components/error-boundary';
