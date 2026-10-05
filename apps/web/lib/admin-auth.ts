import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { auth } from './auth';
import { getDb } from './db';
import { roleForEmail } from './auth-role';
/** Enforce allowlist, database role and session freshness independently on every page and action. */
export async function requireAdmin(fresh = true) {
  const session = await auth();
  if (
    !session?.user.id ||
    session.user.role !== 'admin' ||
    roleForEmail(session.user.email) !== 'admin'
  )
    notFound();
  const jar = await cookies();
  const token =
    jar.get('__Secure-authjs.session-token')?.value ?? jar.get('authjs.session-token')?.value;
  const stored = token
    ? await getDb().session.findUnique({
        where: { sessionToken: token },
        select: { userId: true, expires: true, authenticatedAt: true },
      })
    : null;
  if (!stored || stored.userId !== session.user.id || stored.expires <= new Date()) notFound();
  if (fresh && !recentAuthentication(stored.authenticatedAt)) redirect('/admin/re-auth');
  return session.user;
}
/** Accept an authentication timestamp only within the last ten minutes, including clock skew protection. */
export function recentAuthentication(at: Date, now = Date.now()) {
  const age = now - at.getTime();
  return age >= 0 && age < 10 * 60 * 1000;
}
/** Read the dedicated administrator language preference, defaulting to Chinese. */
export async function adminLocale(): Promise<'zh' | 'en' | 'zh-TW'> {
  return (await cookies()).get('admin_locale')?.value === 'en' ? 'en' : 'zh';
}
