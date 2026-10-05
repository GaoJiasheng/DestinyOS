import { siteConfig } from '@/lib/site-config';
import { currentProfile } from '@/lib/profile-service';
import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { TarotMessages } from '@/components/tarot/tarot-messages';
import { TodayView } from '@/components/daily/today-view';
import { preload } from 'react-dom';
import workerAsset from '@/lib/daily-worker-asset.json';
export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };
/** Daily view hydrates local anonymous state or requests the owner cache. */
export default async function TodayPage() {
  const session = await auth();
  if (!session?.user.id) preload(workerAsset.url, { as: 'script' });
  const user = session?.user.id
    ? await getDb().user.findUnique({
        where: { id: session.user.id },
        select: { tz: true, plan: true },
      })
    : null;
  const profile = session?.user.id ? await currentProfile(session.user.id) : null;
  const vedicUsed = session?.user.id
    ? Boolean(
        await getDb().reading.findFirst({
          where: { userId: session.user.id, profileId: profile?.id, system: 'vedic' },
          select: { id: true },
        }),
      )
    : false;
  return (
    <TarotMessages daily>
      <TodayView
        key={profile ? `${profile.id}:${profile.version}` : 'local'}
        signedIn={Boolean(session?.user.id)}
        tz={user?.tz}
        plan={user?.plan ?? 'free'}
        vedicUsed={vedicUsed}
        panchangDefaultOpen={(await siteConfig())['feature.panchangDefaultOpen']}
      />
    </TarotMessages>
  );
}
