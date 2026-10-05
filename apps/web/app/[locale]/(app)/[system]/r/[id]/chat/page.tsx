import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { System } from '@tianji/shared';
import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { ChatPanel } from '@/components/report/chat-panel';
export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };
/** Full-screen reading dialogue, with owner access and the same anonymous sign-in invitation. */
export default async function ChatPage({
  params,
}: {
  params: Promise<{ locale: 'zh' | 'en'; system: string; id: string }>;
}) {
  const { locale, system, id } = await params;
  setRequestLocale(locale);
  if (!Object.values(System).includes(system as System) || system === 'daily') notFound();
  const session = await auth();
  if (session?.user.id) {
    const reading = await getDb().reading.findFirst({
      where: { id, userId: session.user.id, system: system as System, user: { deletedAt: null } },
      select: { id: true },
    });
    if (!reading) notFound();
  }
  return (
    <ChatPanel
      readingId={id}
      system={system as System}
      owner={Boolean(session?.user.id)}
      fullScreen
    />
  );
}
