'use server';
import { auth } from '@/lib/auth';
import { refreshRevenuecat } from '@/lib/revenuecat';
import { revalidatePath } from 'next/cache';
/** Refresh only the logged-in customer's entitlement; absent provider configuration is a no-op. */
export async function refreshMembershipAction() {
  const session = await auth();
  if (!session?.user.id) return { result: 'error' as const };
  try {
    if (!(await refreshRevenuecat(session.user.id))) return { result: 'skipped' as const };
    revalidatePath('/[locale]', 'layout');
    return { result: 'refreshed' as const };
  } catch {
    return { result: 'error' as const };
  }
}
