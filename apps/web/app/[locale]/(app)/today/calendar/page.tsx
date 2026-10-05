import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { CalendarView } from '@/components/daily/calendar-view';
export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };
/** Calendar contains owner-only scores; anonymous profiles remain on the device. */
export default async function CalendarPage() {
  const session = await auth();
  const user = session?.user.id
    ? await getDb().user.findUnique({ where: { id: session.user.id }, select: { tz: true } })
    : null;
  const profile = session?.user.id
    ? await getDb().birthProfile.findFirst({
        where: { userId: session.user.id, isCurrent: true },
        select: { timeUnknown: true },
      })
    : null;
  return (
    <CalendarView
      signedIn={Boolean(session?.user.id)}
      tz={user?.tz}
      timeUnknown={profile?.timeUnknown}
    />
  );
}
