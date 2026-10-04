import { auth } from '@/lib/auth';
import { exportAccount, reserveExport } from '@/lib/account-service';
import { ApiError, errorResponse } from '@/lib/api-error';
export const dynamic = 'force-dynamic';
/** Download the authenticated owner's decrypted JSON under an atomic ten-minute quota. */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user.id) throw new ApiError('E_UNAUTHORIZED', 'Sign in required', 401);
    await reserveExport(session.user.id);
    return Response.json(
      { ok: true, data: await exportAccount(session.user.id) },
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
