import { auth } from '@/lib/auth';
import { consumeExport } from '@/lib/admin-export';
import { exportAccount } from '@/lib/account-service';
import { ApiError, errorResponse } from '@/lib/api-error';
export const dynamic = 'force-dynamic';
/** Deliver the recipient's export only after matching the session and consuming the fifteen-minute email token. */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const session = await auth();
    if (!session?.user.id) throw new ApiError('E_UNAUTHORIZED', 'Recipient sign-in required', 401);
    if (!(await consumeExport((await params).token, session.user.id)))
      throw new ApiError('E_NOT_FOUND', 'Export link unavailable', 404);
    return Response.json(
      { ok: true, data: await exportAccount(session.user.id) },
      {
        headers: {
          'Content-Disposition': 'attachment; filename="tianji-export.json"',
          'Cache-Control': 'private, no-store',
          'X-Robots-Tag': 'noindex',
        },
      },
    );
  } catch (error) {
    return errorResponse(
      error instanceof ApiError ? error : new ApiError('E_INTERNAL', 'Export failed', 500),
    );
  }
}
