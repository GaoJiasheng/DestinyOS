import { auth } from '@/lib/auth';
import { listProfilesAction } from '@/app/profiles/actions';
import { SynastryForm } from '@/components/forms/synastry-form';
import { getCopy } from '@/i18n/get-copy';
export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };
/** Saved paired inputs are resolved server-side by owner ID; no birth information enters URLs. */
export default async function SynastryPage() {
  const session = await auth();
  const result = session?.user.id ? await listProfilesAction() : null;
  if (result && !result.ok)
    return <p role="alert">{(await getCopy())('report.error.E_INTERNAL')}</p>;
  return (
    <SynastryForm
      key={result?.ok ? (result.data.selectedId ?? 'empty') : 'anonymous'}
      signedIn={!!session?.user.id}
      profiles={result?.ok ? result.data.items : undefined}
      selectedId={result?.ok ? result.data.selectedId : undefined}
    />
  );
}
