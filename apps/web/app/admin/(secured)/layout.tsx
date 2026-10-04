import { requireAdmin } from '@/lib/admin-auth';
/** Guard every admin page with fresh authentication, including read-only audit and dashboard routes. */
export default async function SecuredAdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return children;
}
