import { adminLocale } from '@/lib/admin-auth';
import { getCopy } from './get-copy';
/** Resolve every admin server component explicitly, including a locale switch within the current action request. */
export async function getAdminCopy() {
  return getCopy(await adminLocale());
}
