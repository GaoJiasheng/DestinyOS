import { auth } from '@/lib/auth';
import { exportAccount, releaseExport, reserveExport } from '@/lib/account-service';
import { ApiError, errorResponse } from '@/lib/api-error';
export const dynamic = 'force-dynamic';
/** Download the authenticated owner's decrypted JSON under an atomic ten-minute quota that only successful exports use. */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user.id) throw new ApiError('E_UNAUTHORIZED', 'Sign in required', 401);
    const lease = await reserveExport(session.user.id);
    let data: Awaited<ReturnType<typeof exportAccount>>;
    try {
      data = await exportAccount(session.user.id);
    } catch (error) {
      await releaseExport(session.user.id, lease).catch(() => undefined);
      throw error;
    }
    return Response.json(
      { ok: true, data },
      {
        headers: {
          'Content-Disposition': 'attachment; filename="tianji-export.json"',
          'Cache-Control': 'private, no-store',
        },
      },
    );
  } catch (e) {
    return errorResponse(
      e instanceof ApiError ? e : new ApiError('E_INTERNAL', 'Export failed', 500),
    );
  }
}
