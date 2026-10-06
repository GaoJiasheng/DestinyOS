import { verificationSchema } from '@/lib/auth-confirmation';
/** Universal links fall back to the existing localized Web confirmation without consuming the token on GET. */
export async function GET(request: Request) {
  const url = new URL(request.url),
    parsed = verificationSchema.safeParse({
      ...Object.fromEntries(url.searchParams),
      locale: url.searchParams.get('locale') ?? 'zh',
    });
  if (!parsed.success)
    return new Response(null, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  const destination = new URL(`/${parsed.data.locale}/auth/verify`, url.origin);
  destination.searchParams.set('token', parsed.data.token);
  destination.searchParams.set('email', parsed.data.email);
  return Response.redirect(destination, 307);
}
